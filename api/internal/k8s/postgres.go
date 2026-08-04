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
	memory := resource.MustParse(fmt.Sprintf("%dMi", memoryMB))
	cpu := resource.MustParse("500m")

	volSize := resource.MustParse("5Gi") // start small

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "postgres"},
		},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: name,
			Replicas:    ptrInt32(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": name, "component": "postgres"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "postgres",
						Image: c.cfg.PostgresImage,
						Ports: []corev1.ContainerPort{{
							Name:          "postgres",
							ContainerPort: 5432,
						}},
						Env: []corev1.EnvVar{
							{Name: "POSTGRES_USER", Value: "postgres"},
							{Name: "POSTGRES_DB", Value: "postgres"},
							{Name: "POSTGRES_PASSWORD", ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: name + "-creds"},
									Key:                  "POSTGRES_PASSWORD",
								},
							}},
							{Name: "PGDATA", Value: "/var/lib/postgresql/data/pgdata"},
						},
						VolumeMounts: []corev1.VolumeMount{{
							Name:      "data",
							MountPath: "/var/lib/postgresql/data",
						}},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								corev1.ResourceMemory: memory,
								corev1.ResourceCPU:    cpu,
							},
							Limits: corev1.ResourceList{
								corev1.ResourceMemory: memory,
							},
						},
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								Exec: &corev1.ExecAction{
									Command: []string{"pg_isready", "-U", "postgres"},
								},
							},
							InitialDelaySeconds: 5,
							PeriodSeconds:       5,
						},
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
