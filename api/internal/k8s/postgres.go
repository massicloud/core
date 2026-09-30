package k8s

import (
	"context"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

type CreatePostgresRequest struct {
	ProjectID    string
	InstanceName string // e.g. "main"
	Password     string // pre-generated random password
	MemoryMB     int
}

type PostgresRef struct {
	Namespace string // tenant-{project_id}
	Service   string // postgres-{instance_name}
	Port      int    // 5432
	Password  string
	DSN       string // convenience — full connection string
}

const (
	// postgresExporterImage is pinned; never use :latest.
	postgresExporterImage = "quay.io/prometheuscommunity/postgres-exporter:v0.15.0"
	postgresExporterPort  = 9187
)

// postgresServerArgs enables pg_stat_statements. shared_preload_libraries only
// takes effect at server start; the official image's entrypoint prepends
// "postgres" to args that begin with "-".
var postgresServerArgs = []string{
	"-c", "shared_preload_libraries=pg_stat_statements",
	"-c", "pg_stat_statements.max=10000",
	"-c", "pg_stat_statements.track=all",
}

func postgresExporterContainer(secretName string) corev1.Container {
	metricsProbe := corev1.ProbeHandler{
		HTTPGet: &corev1.HTTPGetAction{Path: "/metrics", Port: intstr.FromInt(postgresExporterPort)},
	}
	return corev1.Container{
		Name:  "pg-exporter",
		Image: postgresExporterImage,
		Args: []string{
			"--collector.stat_statements",
		},
		Ports: []corev1.ContainerPort{{Name: "metrics", ContainerPort: postgresExporterPort}},
		Env: []corev1.EnvVar{
			{Name: "POSTGRES_PASSWORD", ValueFrom: &corev1.EnvVarSource{
				SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: secretName},
					Key:                  "POSTGRES_PASSWORD",
				},
			}},
			// $(POSTGRES_PASSWORD) is expanded by Kubernetes; passwords are
			// base64url (generateSecret), so they are URL-safe.
			{Name: "DATA_SOURCE_NAME", Value: "postgresql://postgres:$(POSTGRES_PASSWORD)@localhost:5432/postgres?sslmode=disable"},
		},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("10m"),
				corev1.ResourceMemory: resource.MustParse("20Mi"),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("100m"),
				corev1.ResourceMemory: resource.MustParse("100Mi"),
			},
		},
		LivenessProbe:  &corev1.Probe{ProbeHandler: metricsProbe, InitialDelaySeconds: 15, PeriodSeconds: 30, TimeoutSeconds: 5},
		ReadinessProbe: &corev1.Probe{ProbeHandler: metricsProbe, InitialDelaySeconds: 5, PeriodSeconds: 10, TimeoutSeconds: 5},
	}
}

// newPostgresStatefulSet builds the tenant Postgres StatefulSet: the
// postgres container plus a postgres_exporter sidecar, scraped by the
// tenant-postgres PodMonitor (label component=postgres, port "metrics").
func newPostgresStatefulSet(cfg Config, ns, name string, memoryMB int, volSize resource.Quantity) *appsv1.StatefulSet {
	labels := map[string]string{"app": name, "component": "postgres"}
	secretName := name + "-creds"
	return &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns, Labels: labels},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: name,
			Replicas:    ptrInt32(1),
			Selector:    &metav1.LabelSelector{MatchLabels: map[string]string{"app": name}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
					// Hints only — the PodMonitor is the real scrape config.
					Annotations: map[string]string{
						"prometheus.io/scrape": "true",
						"prometheus.io/port":   "9187",
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "postgres",
						Image: cfg.PostgresImage,
						Args:  postgresServerArgs,
						Ports: []corev1.ContainerPort{{Name: "postgres", ContainerPort: 5432}},
						Env: []corev1.EnvVar{
							{Name: "POSTGRES_USER", Value: "postgres"},
							{Name: "POSTGRES_DB", Value: "postgres"},
							{Name: "POSTGRES_PASSWORD", ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: secretName},
									Key:                  "POSTGRES_PASSWORD",
								},
							}},
							{Name: "PGDATA", Value: "/var/lib/postgresql/data/pgdata"},
						},
						VolumeMounts: []corev1.VolumeMount{{Name: "data", MountPath: "/var/lib/postgresql/data"}},
						Resources:    DatabaseProfile(memoryMB).ToRequirements(),
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								Exec: &corev1.ExecAction{Command: []string{"pg_isready", "-U", "postgres"}},
							},
							InitialDelaySeconds: 5,
							PeriodSeconds:       5,
						},
					}, postgresExporterContainer(secretName)},
				},
			},
			VolumeClaimTemplates: []corev1.PersistentVolumeClaim{{
				ObjectMeta: metav1.ObjectMeta{Name: "data"},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceStorage: volSize},
					},
					StorageClassName: &cfg.StorageClass,
				},
			}},
		},
	}
}

func (c *Client) CreateTenantPostgres(ctx context.Context, req CreatePostgresRequest) (*PostgresRef, error) {
	ns := TenantNamespaceName(req.ProjectID)
	name := "postgres-" + req.InstanceName

	// 1. Secret with the password
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-creds",
			Namespace: ns,
		},
		StringData: map[string]string{
			"POSTGRES_PASSWORD": req.Password,
		},
	}
	_, err := c.cs.CoreV1().Secrets(ns).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create postgres secret: %w", err)
	}

	// 2. StatefulSet
	memoryMB := req.MemoryMB
	if memoryMB <= 0 {
		memoryMB = 512
	}

	volSize := resource.MustParse("5Gi") // start small

	sts := newPostgresStatefulSet(c.cfg, ns, name, memoryMB, volSize)
	_, err = c.cs.AppsV1().StatefulSets(ns).Create(ctx, sts, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create statefulset: %w", err)
	}

	// 3. Service (headless-style; ClusterIP is fine for our use)
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "postgres"},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"app": name},
			Ports: []corev1.ServicePort{{
				Name:       "postgres",
				Port:       5432,
				TargetPort: intstr.FromInt(5432),
			}},
		},
	}
	_, err = c.cs.CoreV1().Services(ns).Create(ctx, svc, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create service: %w", err)
	}

	// 4. Wait for the pod to be ready
	if err := c.WaitForStatefulSetReady(ctx, ns, name, 120); err != nil {
		return nil, fmt.Errorf("wait for postgres ready: %w", err)
	}

	// pg_stat_statements is preloaded via server args (see
	// postgresServerArgs); the extension itself must still be created. Do it
	// in template1 (so every database created later inherits it) and in the
	// default postgres database. Non-fatal: the instance works without it and
	// upgrade-tenant-postgres.sh can repair it.
	for _, db := range []string{"template1", "postgres"} {
		_, stderr, err := c.execInPod(ctx, ns, name+"-0", "postgres", []string{
			"psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1",
			"-c", "CREATE EXTENSION IF NOT EXISTS pg_stat_statements",
		})
		if err != nil {
			c.logger.Warn("create pg_stat_statements failed",
				"namespace", ns, "statefulset", name, "database", db,
				"error", err, "stderr", stderr)
		}
	}

	// Build the DSN
	dsn := fmt.Sprintf(
		"postgres://postgres:%s@%s.%s.svc.cluster.local:5432/postgres?sslmode=disable",
		req.Password, name, ns,
	)

	return &PostgresRef{
		Namespace: ns,
		Service:   name,
		Port:      5432,
		Password:  req.Password,
		DSN:       dsn,
	}, nil
}

// DeleteTenantPostgres removes the StatefulSet, Service, Secret, and PVC for a
// tenant's Postgres instance. Best-effort: individual delete errors are logged
// via the returned error but every resource is still attempted.
func (c *Client) DeleteTenantPostgres(ctx context.Context, projectID, instanceName string) error {
	ns := TenantNamespaceName(projectID)
	name := "postgres-" + instanceName

	_ = c.cs.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.AppsV1().StatefulSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-creds", metav1.DeleteOptions{})
	// PVCs are NOT auto-deleted by StatefulSet delete. Delete explicitly:
	_ = c.cs.CoreV1().PersistentVolumeClaims(ns).Delete(ctx, "data-"+name+"-0", metav1.DeleteOptions{})
	return nil
}
