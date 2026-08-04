package k8s

import (
	"context"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// CreateMySQLRESTRequest provisions the massicloud-mysql-rest sidecar for a
// tenant MySQL instance. Auth mirrors PostgREST: mysql-rest never sees the
// platform's mc_anon_xxx/mc_service_xxx keys (those are bcrypt-hashed on the
// platform and cannot be recovered) — it verifies the short-lived role JWT
// the REST proxy already synthesizes for every request (see
// api/internal/handlers/rest_proxy.go issueRoleJWT), the same one PostgREST
// gets. JWTSecret here is the project's JWT signing secret, not a per-key
// value.
type CreateMySQLRESTRequest struct {
	ProjectID    string
	InstanceName string // matches the mysql instance name
	AnonDSN      string
	ServiceDSN   string
	JWTSecret    string
}

type MySQLRESTRef struct {
	Namespace string
	Service   string
	Port      int
}

func (c *Client) CreateMySQLRESTForInstance(ctx context.Context, req CreateMySQLRESTRequest) (*MySQLRESTRef, error) {
	ns := TenantNamespaceName(req.ProjectID)
	name := "mysql-rest-" + req.InstanceName

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-config",
			Namespace: ns,
		},
		StringData: map[string]string{
			"MYSQL_DSN_ANON":    req.AnonDSN,
			"MYSQL_DSN_SERVICE": req.ServiceDSN,
			"JWT_SECRET":        req.JWTSecret,
		},
	}
	_, err := c.cs.CoreV1().Secrets(ns).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mysql-rest secret: %w", err)
	}

	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "mysql-rest"},
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: ptrInt32(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": name, "component": "mysql-rest"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "mysql-rest",
						Image: c.cfg.MySQLRESTImage,
						Ports: []corev1.ContainerPort{{
							Name:          "http",
							ContainerPort: 3000,
						}},
						EnvFrom: []corev1.EnvFromSource{{
							SecretRef: &corev1.SecretEnvSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: name + "-config"},
							},
						}},
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								HTTPGet: &corev1.HTTPGetAction{
									Path: "/",
									Port: intstr.FromInt(3000),
								},
							},
							InitialDelaySeconds: 5,
							PeriodSeconds:       5,
						},
					}},
				},
			},
		},
	}
	_, err = c.cs.AppsV1().Deployments(ns).Create(ctx, dep, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mysql-rest deployment: %w", err)
	}

	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "mysql-rest"},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"app": name},
			Ports: []corev1.ServicePort{{
				Name: "http",
				Port: 3000,
			}},
		},
	}
	_, err = c.cs.CoreV1().Services(ns).Create(ctx, svc, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mysql-rest service: %w", err)
	}

	if err := c.WaitForDeploymentReady(ctx, ns, name, 60); err != nil {
		return nil, fmt.Errorf("wait for mysql-rest ready: %w", err)
	}

	return &MySQLRESTRef{
		Namespace: ns,
		Service:   name,
		Port:      3000,
	}, nil
}

// DeleteTenantMySQLREST removes the Deployment, Service, and Secret for a
// tenant's mysql-rest instance. Best-effort, mirrors DeleteTenantPostgREST.
func (c *Client) DeleteTenantMySQLREST(ctx context.Context, projectID, instanceName string) error {
	ns := TenantNamespaceName(projectID)
	name := "mysql-rest-" + instanceName

	_ = c.cs.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.AppsV1().Deployments(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-config", metav1.DeleteOptions{})
	return nil
}

// MySQLRESTUpstream returns the in-cluster DNS name mysql-rest is reachable
// at for a given tenant instance, used by the REST proxy.
func MySQLRESTUpstream(projectID, instanceName string) string {
	return fmt.Sprintf("mysql-rest-%s.%s.svc.cluster.local:3000", instanceName, TenantNamespaceName(projectID))
}
