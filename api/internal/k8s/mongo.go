package k8s

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"

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
// the keyfile must be owned by this user or mongod refuses to start.
const mongodUID = "999"

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
// CreateTenantPostgres. Unlike Postgres, this only creates k8s resources and
// waits for the pod to be ready — it does NOT create the massi_service/
// massi_readonly application users or initiate the replica set. That
// happens afterward, from the API process, via the Mongo driver (see
// internal/mongoclient and handlers.createMongoInstance) — reusing the same
// driver already needed for the collection/document endpoints rather than
// building a separate exec-into-pod or Job-based init mechanism.
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

	// 2. Creds secret — MONGO_INITDB_ROOT_USERNAME/PASSWORD let Percona's own
	// entrypoint bootstrap the root user on first boot (the "localhost
	// exception" only covers connections from inside the pod, so we can't
	// create it ourselves from the API pod).
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
						// this container only needs cp/chmod/chown, and a
						// smaller image pulls faster.
						Image: "busybox:1.36",
						Command: []string{
							"sh", "-c",
							"cp /keyfile-src/keyfile /keyfile/keyfile && chmod 0400 /keyfile/keyfile && chown " + mongodUID + ":" + mongodUID + " /keyfile/keyfile",
						},
						// chown requires root; Percona's image (and now
						// busybox) doesn't run init containers as root by
						// default, so this was failing with a permission
						// error and leaving the pod stuck at Init:0/1
						// forever — which surfaced upstream as "statefulset
						// not ready within 120s" with no other clue.
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
					Containers: []corev1.Container{{
						Name:  "mongo",
						Image: c.cfg.MongoImage,
						// Args (not Command): Command replaces the image's
						// ENTRYPOINT outright when Args isn't also set, which
						// would skip Percona's own entrypoint script — the
						// thing that actually reads MONGO_INITDB_ROOT_USERNAME/
						// PASSWORD (from the "-creds" Secret above) and
						// bootstraps the root user on first boot before
						// exec'ing into mongod with these flags. Command here
						// silently produced a root-less, unauthenticatable
						// mongod, so BootstrapReplicaSetAndUsers's root-DSN
						// connection failed authentication on every create.
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

	// 5. Wait for the pod to be ready. Mongo's bootstrap (root user creation
	// + this init container) is slower than Postgres's, hence the longer
	// budget than the readiness probe's own timing alone would suggest.
	if err := c.WaitForStatefulSetReady(ctx, ns, name, 120); err != nil {
		return nil, fmt.Errorf("wait for mongo ready: %w", err)
	}

	dbName := req.DatabaseName
	if dbName == "" {
		dbName = "appdb"
	}
	host := fmt.Sprintf("%s.%s.svc.cluster.local", name, ns)

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
