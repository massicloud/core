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

type CreateRedisRequest struct {
	ProjectID    string
	InstanceName string // e.g. "main"
	Password     string // pre-generated random password
	MemoryMB     int
}

type RedisRef struct {
	Namespace string // tenant-{project_id}
	Service   string // redis-{instance_name}
	Port      int    // node port
	Password  string
	DSN       string // convenience — full connection string
}

// CreateTenantRedis follows the same create-if-absent pattern as
// CreateTenantPostgres, with one deliberate difference: Redis has no REST
// sidecar in front of it (see concepts/redis.md) — the customer's own app
// connects to it directly, so it needs a Service reachable from outside the
// cluster, not just ClusterIP. We use NodePort rather than a LoadBalancer
// Service since that works on any k8s cluster (including a single-node k3s
// box) without depending on a cloud LB controller or MetalLB being
// installed, and DomainSuffix's DNS already points at the node running
// everything else (api.<suffix>, app.<suffix>, ...).
func (c *Client) CreateTenantRedis(ctx context.Context, req CreateRedisRequest) (*RedisRef, error) {
	ns := TenantNamespaceName(req.ProjectID)
	name := "redis-" + req.InstanceName

	// 1. Secret with the password
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-creds",
			Namespace: ns,
		},
		StringData: map[string]string{
			"REDIS_PASSWORD": req.Password,
		},
	}
	_, err := c.cs.CoreV1().Secrets(ns).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create redis secret: %w", err)
	}

	// 2. StatefulSet
	memoryMB := req.MemoryMB
	if memoryMB <= 0 {
		memoryMB = 256
	}
	volSize := resource.MustParse("2Gi")

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "redis"},
		},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: name,
			Replicas:    ptrInt32(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": name, "component": "redis"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:    "redis",
						Image:   c.cfg.RedisImage,
						Command: []string{"sh", "-c", `exec redis-server --requirepass "$REDIS_PASSWORD"`},
						Ports: []corev1.ContainerPort{{
							Name:          "redis",
							ContainerPort: 6379,
						}},
						Env: []corev1.EnvVar{
							{Name: "REDIS_PASSWORD", ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: name + "-creds"},
									Key:                  "REDIS_PASSWORD",
								},
							}},
						},
						VolumeMounts: []corev1.VolumeMount{{
							Name:      "data",
							MountPath: "/data",
						}},
						// DatabaseProfile (not a fixed ProfileRedisDefault) so
						// this still scales with req.MemoryMB, same as
						// before this used inline resource.MustParse calls.
						Resources: DatabaseProfile(memoryMB).ToRequirements(),
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								Exec: &corev1.ExecAction{
									Command: []string{"sh", "-c", `redis-cli -a "$REDIS_PASSWORD" ping`},
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

	// 3. Service — NodePort, not ClusterIP. Let k8s pick the port; we read
	// it back after creation (or from the existing Service, if this is a
	// re-run after a partial failure).
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "redis"},
		},
		Spec: corev1.ServiceSpec{
			Type:     corev1.ServiceTypeNodePort,
			Selector: map[string]string{"app": name},
			Ports: []corev1.ServicePort{{
				Name:       "redis",
				Port:       6379,
				TargetPort: intstr.FromInt(6379),
			}},
		},
	}
	created, err := c.cs.CoreV1().Services(ns).Create(ctx, svc, metav1.CreateOptions{})
	if err != nil {
		if !isAlreadyExists(err) {
			return nil, fmt.Errorf("create service: %w", err)
		}
		created, err = c.cs.CoreV1().Services(ns).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("get existing service: %w", err)
		}
	}
	if len(created.Spec.Ports) == 0 || created.Spec.Ports[0].NodePort == 0 {
		return nil, fmt.Errorf("redis service has no assigned node port")
	}
	nodePort := int(created.Spec.Ports[0].NodePort)

	// 4. Wait for the pod to be ready
	if err := c.WaitForStatefulSetReady(ctx, ns, name, 120); err != nil {
		return nil, fmt.Errorf("wait for redis ready: %w", err)
	}

	dsn := fmt.Sprintf("redis://:%s@%s:%d", req.Password, c.cfg.DomainSuffix, nodePort)

	return &RedisRef{
		Namespace: ns,
		Service:   name,
		Port:      nodePort,
		Password:  req.Password,
		DSN:       dsn,
	}, nil
}

// DeleteTenantRedis removes the StatefulSet, Service, Secret, and PVC for a
// tenant's Redis instance. Best-effort, mirrors DeleteTenantPostgres.
func (c *Client) DeleteTenantRedis(ctx context.Context, projectID, instanceName string) error {
	ns := TenantNamespaceName(projectID)
	name := "redis-" + instanceName

	_ = c.cs.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.AppsV1().StatefulSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-creds", metav1.DeleteOptions{})
	_ = c.cs.CoreV1().PersistentVolumeClaims(ns).Delete(ctx, "data-"+name+"-0", metav1.DeleteOptions{})
	return nil
}
