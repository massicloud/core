package k8s

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/ptr"
)

// mongoKeyfileBytes is the size of the internal-auth keyfile MongoDB uses to
// authenticate replica set members to each other. 756 bytes (base64-encoded)
// is comfortably within MongoDB's 6-1024 byte requirement.
const mongoKeyfileBytes = 756

// mongodUID is the uid the mongod process runs as in Percona's image —
// the keyfile must be owned by this user or mongod rejects it as "bad
// file". Set at the pod level (RunAsUser/RunAsGroup/FSGroup) so Kubernetes
// itself owns the mounted volumes accordingly, rather than chown'ing the
// keyfile by hand in the init container.
const mongodUID int64 = 1001

// Timeouts for the exec-into-pod replica-set bootstrap sequence in
// CreateTenantMongo (see initiateMongoReplicaSet et al.).
const (
	mongoPodRunningTimeoutSec = 60
	mongoPingTimeoutSec       = 60
	mongoPrimaryTimeoutSec    = 60
	mongoProvisionTimeoutSec  = 180
	mongoPollInterval         = 2 * time.Second
)

type CreateMongoRequest struct {
	ProjectID        string
	InstanceName     string // e.g. "main"
	RootPassword     string // pre-generated random password, admin bootstrap only
	ServicePassword  string // for massi_service (readWrite)
	ReadonlyPassword string // for massi_readonly (read)
	DatabaseName     string // "appdb"
	MemoryMB         int
	StorageGB        int
}

type MongoRef struct {
	Namespace    string
	Service      string // mongo-{instance_name}
	Port         int    // 27017
	DatabaseName string
	ServiceDSN   string // mongodb://massi_service:pw@svc:27017/appdb — safe to show to the user
	ReadonlyDSN  string // mongodb://massi_readonly:pw@svc:27017/appdb — safe to show to the user
	RootDSN      string // for one-time replica-set/user bootstrap only — never persisted or exposed
}

// CreateTenantMongo follows the same create-if-absent pattern as
// CreateTenantPostgres. Unlike Postgres, a freshly created Mongo pod isn't
// usable on its own: it comes up as an uninitiated single-member replica
// set with --auth enabled and zero users. This function drives it through
// to a working state itself, all by exec'ing mongosh inside the pod (there
// is no plain Kubernetes API call for any of this):
//
//  1. wait for the pod to run
//  2. wait for mongod to answer an unauthenticated ping
//  3. rs.initiate() — unauthenticated, relying on Mongo's "localhost
//     exception" (no-auth-required for local connections, but ONLY while
//     zero users exist anywhere in the deployment)
//  4. wait for PRIMARY
//  5. create the root user — still unauthenticated/localhost-exception;
//     this is the last step that can rely on it, since creating a user is
//     exactly what closes the exception
//  6. create massi_service/massi_readonly — now authenticated as root,
//     since the exception is closed
//
// Every exec in steps 3-5 must stay unauthenticated: passing -u/-p (or a
// URI with credentials) makes mongosh attempt SASL auth before running
// anything, which fails immediately since no user exists yet to authenticate
// as — indistinguishable from a bad password ("Authentication failed").
func (c *Client) CreateTenantMongo(ctx context.Context, req CreateMongoRequest) (*MongoRef, error) {
	ns := TenantNamespaceName(req.ProjectID)
	name := "mongo-" + req.InstanceName

	// 1. Keyfile secret — required for replica-set internal auth, even with
	// a single member.
	keyfile := make([]byte, mongoKeyfileBytes)
	if _, err := rand.Read(keyfile); err != nil {
		return nil, fmt.Errorf("generate mongo keyfile: %w", err)
	}
	encodedKeyfile := base64.StdEncoding.EncodeToString(keyfile)

	keyfileSecret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-keyfile",
			Namespace: ns,
		},
		StringData: map[string]string{
			"keyfile": encodedKeyfile,
		},
	}
	if _, err := c.cs.CoreV1().Secrets(ns).Create(ctx, keyfileSecret, metav1.CreateOptions{}); err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mongo keyfile secret: %w", err)
	}

	// 2. Creds secret. NOTE: MONGO_INITDB_ROOT_USERNAME/PASSWORD do NOT
	// bootstrap root here the way they do on a plain mongod — the official
	// (and Percona-derived) docker-entrypoint skips its automatic user
	// creation whenever --replSet is in the mongod arguments, since it can't
	// safely write a user before a primary is elected. root is instead
	// created explicitly below via exec + the localhost exception, using
	// this same password, once the replica set has been initiated.
	credsSecret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-creds",
			Namespace: ns,
		},
		StringData: map[string]string{
			"MONGO_INITDB_ROOT_USERNAME": "root",
			"MONGO_INITDB_ROOT_PASSWORD": req.RootPassword,
		},
	}
	if _, err := c.cs.CoreV1().Secrets(ns).Create(ctx, credsSecret, metav1.CreateOptions{}); err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mongo creds secret: %w", err)
	}

	// 3. StatefulSet
	memoryMB := req.MemoryMB
	if memoryMB <= 0 {
		memoryMB = 512
	}
	storageGB := req.StorageGB
	if storageGB <= 0 {
		storageGB = 10
	}
	volSize := resource.MustParse(fmt.Sprintf("%dGi", storageGB))

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "mongo"},
		},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: name,
			Replicas:    ptrInt32(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": name, "component": "mongo"},
				},
				Spec: corev1.PodSpec{
					// Pod-level SecurityContext: mongod (Percona's image)
					// runs as UID 1001, not the 999 originally assumed here.
					// FSGroup ensures the data PVC is group-owned by 1001
					// automatically. The keyfile still needs an explicit
					// chown in the init container: FSGroup only grants group
					// access, but mode 0400 is owner-only, so the keyfile
					// copy must be owned by 1001, not just group-owned.
					SecurityContext: &corev1.PodSecurityContext{
						RunAsUser:  ptr.To(mongodUID),
						RunAsGroup: ptr.To(mongodUID),
						FSGroup:    ptr.To(mongodUID),
					},
					// The keyfile Secret is mounted read-only with default
					// 0444 perms, which mongod rejects ("too open"). A
					// Secret's own defaultMode can't be forced below 0440 by
					// some CSI drivers, so we copy it into an emptyDir with
					// the exact mode mongod requires via an init container —
					// simpler and more portable than relying on volume mount
					// permission semantics.
					InitContainers: []corev1.Container{{
						Name: "fix-keyfile-perms",
						// busybox rather than the (much larger) Mongo image —
						// this container only needs cp/chmod, and a smaller
						// image pulls faster.
						Image: "busybox:1.36",
						Command: []string{
							"sh", "-c",
							"cp /keyfile-src/keyfile /keyfile/keyfile && chown 1001:1001 /keyfile/keyfile && chmod 0400 /keyfile/keyfile",
						},
						// Still root: the pod-level RunAsUser doesn't apply
						// until FSGroup has taken effect on the volume, and
						// this container only needs root to read the
						// world-readable Secret source and write into the
						// emptyDir — ownership of the copy is handled by
						// FSGroup, not by an explicit chown here.
						SecurityContext: &corev1.SecurityContext{
							RunAsUser:  ptr.To(int64(0)),
							RunAsGroup: ptr.To(int64(0)),
						},
						VolumeMounts: []corev1.VolumeMount{
							{Name: "keyfile-src", MountPath: "/keyfile-src", ReadOnly: true},
							{Name: "keyfile", MountPath: "/keyfile"},
						},
						Resources: ProfileInitTiny.ToRequirements(),
					}},
					// mongo container: no container-level RunAsUser — it
					// inherits the pod-level SecurityContext above.
					Containers: []corev1.Container{{
						Name:  "mongo",
						Image: c.cfg.MongoImage,
						// Args (not Command): Command replaces the image's
						// ENTRYPOINT outright when Args isn't also set, which
						// would skip Percona's own entrypoint script — still
						// needed for its keyfile/data-dir setup even though
						// --replSet below makes it skip MONGO_INITDB_ROOT_*
						// user bootstrap (root is created explicitly instead,
						// see CreateTenantMongo).
						Args: []string{
							"mongod",
							"--replSet", "rs0",
							"--keyFile", "/keyfile/keyfile",
							"--auth",
							"--bind_ip_all",
						},
						Ports: []corev1.ContainerPort{{
							Name:          "mongo",
							ContainerPort: 27017,
						}},
						EnvFrom: []corev1.EnvFromSource{{
							SecretRef: &corev1.SecretEnvSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: name + "-creds"},
							},
						}},
						VolumeMounts: []corev1.VolumeMount{
							{Name: "data", MountPath: "/data/db"},
							{Name: "keyfile", MountPath: "/keyfile"},
						},
						Resources: DatabaseProfile(memoryMB).ToRequirements(),
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								Exec: &corev1.ExecAction{
									Command: []string{"mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"},
								},
							},
							InitialDelaySeconds: 10,
							PeriodSeconds:       5,
						},
					}},
					Volumes: []corev1.Volume{{
						Name: "keyfile-src",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{
								SecretName: name + "-keyfile",
								// World-readable (not 0400): this is only the
								// source the init container cp's from, not
								// what mongod reads. Whatever UID actually
								// ends up reading it (RunAsUser:0 above
								// should cover it, but apparently doesn't
								// reliably in this cluster) needs read
								// access — the init container chmod's its
								// writable emptyDir *copy* down to 0400
								// before mongod ever sees it, so this being
								// world-readable doesn't weaken mongod's own
								// keyfile permission check.
								DefaultMode: ptr.To(int32(0444)),
							},
						},
					}, {
						Name:         "keyfile",
						VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
					}},
				},
			},
			VolumeClaimTemplates: []corev1.PersistentVolumeClaim{{
				ObjectMeta: metav1.ObjectMeta{Name: "data"},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceStorage: volSize},
					},
					StorageClassName: &c.cfg.StorageClass,
				},
			}},
		},
	}
	if _, err := c.cs.AppsV1().StatefulSets(ns).Create(ctx, sts, metav1.CreateOptions{}); err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create statefulset: %w", err)
	}

	// 4. Service — ClusterIP only. Per the v1 connectivity decision, Mongo
	// instances are reachable from apps deployed on MassiCloud (same
	// cluster) but not from the public internet; external TCP+TLS ingress
	// is a v2 concern.
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "mongo"},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"app": name},
			Ports: []corev1.ServicePort{{
				Name:       "mongo",
				Port:       27017,
				TargetPort: intstr.FromInt(27017),
			}},
		},
	}
	if _, err := c.cs.CoreV1().Services(ns).Create(ctx, svc, metav1.CreateOptions{}); err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create service: %w", err)
	}

	dbName := req.DatabaseName
	if dbName == "" {
		dbName = "appdb"
	}
	host := fmt.Sprintf("%s.%s.svc.cluster.local", name, ns)
	podName := name + "-0"
	podFQDN := fmt.Sprintf("%s.%s.%s.svc.cluster.local", podName, name, ns)

	// 5. A single-member replica set never reaches PRIMARY on its own —
	// mongod just sits there until something calls rs.initiate(). The
	// readiness probe (an unauthenticated `ping`) doesn't depend on that, so
	// it isn't a reliable signal here: we drive initiation ourselves by
	// exec'ing mongosh inside the pod, which is also why we wait for the pod
	// to be Running rather than Ready before starting.
	provisionCtx, cancel := context.WithTimeout(ctx, mongoProvisionTimeoutSec*time.Second)
	defer cancel()

	if err := c.WaitForPodRunning(provisionCtx, ns, podName, mongoPodRunningTimeoutSec); err != nil {
		return nil, fmt.Errorf("wait for mongo pod running: %w", err)
	}
	if err := c.waitMongoReachable(provisionCtx, ns, podName, mongoPingTimeoutSec); err != nil {
		return nil, fmt.Errorf("wait for mongo reachable: %w", err)
	}
	if err := c.initiateMongoReplicaSet(provisionCtx, ns, podName, podFQDN); err != nil {
		return nil, fmt.Errorf("initiate mongo replica set: %w", err)
	}
	if err := c.waitMongoPrimary(provisionCtx, ns, podName, mongoPrimaryTimeoutSec); err != nil {
		return nil, fmt.Errorf("wait for mongo primary: %w", err)
	}
	if err := c.createMongoRootUser(provisionCtx, ns, podName, req.RootPassword); err != nil {
		return nil, fmt.Errorf("create mongo root user: %w", err)
	}
	if err := c.createMongoUser(provisionCtx, ns, podName, req.RootPassword, "massi_service", req.ServicePassword, "readWrite", dbName); err != nil {
		return nil, fmt.Errorf("create massi_service user: %w", err)
	}
	if err := c.createMongoUser(provisionCtx, ns, podName, req.RootPassword, "massi_readonly", req.ReadonlyPassword, "read", dbName); err != nil {
		return nil, fmt.Errorf("create massi_readonly user: %w", err)
	}

	// Now that the replica set has a primary, the readiness probe (which
	// just pings) will already be passing — this confirms k8s has observed
	// that within its own probe cadence rather than assuming it.
	if err := c.WaitForStatefulSetReady(provisionCtx, ns, name, 60); err != nil {
		return nil, fmt.Errorf("wait for mongo ready: %w", err)
	}

	return &MongoRef{
		Namespace:    ns,
		Service:      name,
		Port:         27017,
		DatabaseName: dbName,
		ServiceDSN:   fmt.Sprintf("mongodb://massi_service:%s@%s:27017/%s?directConnection=true", req.ServicePassword, host, dbName),
		ReadonlyDSN:  fmt.Sprintf("mongodb://massi_readonly:%s@%s:27017/%s?directConnection=true", req.ReadonlyPassword, host, dbName),
		RootDSN:      fmt.Sprintf("mongodb://root:%s@%s:27017/admin?directConnection=true", req.RootPassword, host),
	}, nil
}

// DeleteTenantMongo removes the StatefulSet, Service, both Secrets, and the
// PVC for a tenant's Mongo instance. Best-effort, mirrors DeleteTenantPostgres.
func (c *Client) DeleteTenantMongo(ctx context.Context, projectID, instanceName string) error {
	ns := TenantNamespaceName(projectID)
	name := "mongo-" + instanceName

	_ = c.cs.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.AppsV1().StatefulSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-creds", metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-keyfile", metav1.DeleteOptions{})
	_ = c.cs.CoreV1().PersistentVolumeClaims(ns).Delete(ctx, "data-"+name+"-0", metav1.DeleteOptions{})
	return nil
}

// mongoContainer is the name of the mongod container in the StatefulSet
// pod template, shared by every mongosh exec call below.
const mongoContainer = "mongo"

// mongoUnauthCmd builds a bare, no-credentials mongosh invocation against
// localhost. Every step relying on the localhost exception (initiate,
// wait-for-primary, root creation) must go through this and never add
// -u/-p/--authenticationDatabase or a credentialed URI: any auth attempt,
// successful or not, forfeits the exception on a deployment with zero users.
func mongoUnauthCmd(script string) []string {
	return []string{"mongosh", "--host", "localhost", "--quiet", "--eval", script}
}

// mongoAuthCmd builds a mongosh invocation authenticated as root, for use
// once root exists and the localhost exception is no longer available (or
// needed).
func mongoAuthCmd(rootPassword, script string) []string {
	return []string{
		"mongosh", "--host", "localhost",
		"--authenticationDatabase", "admin",
		"-u", "root", "-p", rootPassword,
		"--quiet", "--eval", script,
	}
}

// waitMongoReachable polls an unauthenticated `ping` inside the pod until
// mongod answers. ping is on Mongo's pre-auth allow-list regardless of the
// localhost exception, so this only proves the network path and process are
// up — it says nothing about replica-set or user state.
func (c *Client) waitMongoReachable(ctx context.Context, ns, pod string, timeoutSec int) error {
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	cmd := mongoUnauthCmd("db.runCommand({ping:1}).ok")
	for {
		stdout, _, err := c.execInPod(ctx, ns, pod, mongoContainer, cmd)
		if err == nil && strings.TrimSpace(stdout) == "1" {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("mongo not reachable within %ds", timeoutSec)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(mongoPollInterval):
		}
	}
}

// initiateMongoReplicaSet runs rs.initiate() for the single-member "rs0"
// replica set. Unauthenticated: this runs before any user exists, relying
// on the localhost exception (see the CreateTenantMongo doc comment).
// Idempotent: an "already initialized" error (from a retried create, per
// CreateTenantMongo's create-if-absent pattern) is not a failure.
func (c *Client) initiateMongoReplicaSet(ctx context.Context, ns, pod, podFQDN string) error {
	script := fmt.Sprintf(
		`rs.initiate({_id:"rs0",members:[{_id:0,host:%q}]})`,
		podFQDN+":27017",
	)
	stdout, stderr, err := c.execInPod(ctx, ns, pod, mongoContainer, mongoUnauthCmd(script))
	if err == nil {
		return nil
	}
	if strings.Contains(stdout, "already initialized") || strings.Contains(stderr, "already initialized") {
		return nil
	}
	return fmt.Errorf("rs.initiate: %w (stdout=%q stderr=%q)", err, stdout, stderr)
}

// waitMongoPrimary polls rs.status().myState until it reports 1 (PRIMARY).
// Still unauthenticated/localhost-exception, like initiateMongoReplicaSet —
// no user exists yet at this point. With a single member and no peers to
// negotiate with, this normally resolves within a couple of seconds of
// rs.initiate().
func (c *Client) waitMongoPrimary(ctx context.Context, ns, pod string, timeoutSec int) error {
	cmd := mongoUnauthCmd("rs.status().myState")
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	for {
		stdout, _, err := c.execInPod(ctx, ns, pod, mongoContainer, cmd)
		if err == nil && strings.TrimSpace(stdout) == "1" {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("mongo did not reach PRIMARY within %ds", timeoutSec)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(mongoPollInterval):
		}
	}
}

// createMongoRootUser creates the root user, unauthenticated — this is the
// last step that can rely on the localhost exception, since creating a user
// is exactly what closes it. Every step after this one must authenticate.
// Idempotent: "already exists" is not a failure.
func (c *Client) createMongoRootUser(ctx context.Context, ns, pod, rootPassword string) error {
	script := fmt.Sprintf(
		`db.getSiblingDB("admin").createUser({user:"root",pwd:%q,roles:["root"]})`,
		rootPassword,
	)
	stdout, stderr, err := c.execInPod(ctx, ns, pod, mongoContainer, mongoUnauthCmd(script))
	if err == nil {
		return nil
	}
	if strings.Contains(stdout, "already exists") || strings.Contains(stderr, "already exists") {
		return nil
	}
	return fmt.Errorf("create root user: %w (stdout=%q stderr=%q)", err, stdout, stderr)
}

// createMongoUser creates an application user via mongosh, authenticating
// as root (the localhost exception is closed by this point). Idempotent:
// "already exists" (Mongo's error for a repeat createUser call) is not a
// failure, matching mongoclient.createUserIfAbsent.
func (c *Client) createMongoUser(ctx context.Context, ns, pod, rootPassword, username, password, role, dbName string) error {
	script := fmt.Sprintf(
		`db.getSiblingDB("admin").createUser({user:%q,pwd:%q,roles:[{role:%q,db:%q}]})`,
		username, password, role, dbName,
	)
	stdout, stderr, err := c.execInPod(ctx, ns, pod, mongoContainer, mongoAuthCmd(rootPassword, script))
	if err == nil {
		return nil
	}
	if strings.Contains(stdout, "already exists") || strings.Contains(stderr, "already exists") {
		return nil
	}
	return fmt.Errorf("createUser %s: %w (stdout=%q stderr=%q)", username, err, stdout, stderr)
}
