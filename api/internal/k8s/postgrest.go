package k8s

import (
	"context"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

type CreatePostgRESTRequest struct {
	ProjectID    string
	InstanceName string // matches the postgres instance name
	PostgresDSN  string
	JWTSecret    string // project's JWT signing secret
}

type PostgRESTRef struct {
	Namespace string
	Service   string
	Port      int
}

func (c *Client) CreatePostgRESTForInstance(ctx context.Context, req CreatePostgRESTRequest) (*PostgRESTRef, error) {
	ns := TenantNamespaceName(req.ProjectID)
	name := "postgrest-" + req.InstanceName

	// 1. Secret with connection details
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-config",
			Namespace: ns,
		},
		StringData: map[string]string{
			"PGRST_DB_URI":       req.PostgresDSN,
			"PGRST_JWT_SECRET":   req.JWTSecret,
			"PGRST_DB_SCHEMAS":   "public",
			"PGRST_DB_ANON_ROLE": "anon",
		},
	}
	_, err := c.cs.CoreV1().Secrets(ns).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create postgrest secret: %w", err)
	}

	// 2. Deployment
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "postgrest"},
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: ptrInt32(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": name, "component": "postgrest"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "postgrest",
						Image: c.cfg.PostgRESTImage,
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
		return nil, fmt.Errorf("create postgrest deployment: %w", err)
	}

	// 3. Service
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "postgrest"},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"app": name},
			Ports: []corev1.ServicePort{{
				Name:       "http",
				Port:       3000,
				TargetPort: intstr.FromInt(3000),
			}},
		},
	}
	_, err = c.cs.CoreV1().Services(ns).Create(ctx, svc, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create postgrest service: %w", err)
	}

	// 4. Wait for readiness
	if err := c.WaitForDeploymentReady(ctx, ns, name, 60); err != nil {
		return nil, fmt.Errorf("wait for postgrest ready: %w", err)
	}

	return &PostgRESTRef{
		Namespace: ns,
		Service:   name,
		Port:      3000,
	}, nil
}

// DeleteTenantPostgREST removes the Deployment, Service, and Secret for a
// tenant's PostgREST instance. Best-effort, mirrors DeleteTenantPostgres.
func (c *Client) DeleteTenantPostgREST(ctx context.Context, projectID, instanceName string) error {
	ns := TenantNamespaceName(projectID)
	name := "postgrest-" + instanceName

	_ = c.cs.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.AppsV1().Deployments(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-config", metav1.DeleteOptions{})
	return nil
}

// PostgRESTUpstream returns the in-cluster DNS name PostgREST is reachable at
// for a given tenant instance, used by the REST proxy.
func PostgRESTUpstream(projectID, instanceName string) string {
	return fmt.Sprintf("postgrest-%s.%s.svc.cluster.local:3000", instanceName, TenantNamespaceName(projectID))
}
