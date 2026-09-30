package k8s

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// TenantQuota describes the hard resource caps for a tenant namespace. All
// four compute fields are set deliberately (not just requests.cpu +
// limits.memory, which is what this used to enforce) — a Kubernetes
// ResourceQuota only requires containers to declare the specific fields
// present in the quota itself, so setting all four here is what makes every
// container in internal/k8s/ need a complete ResourceProfile.
type TenantQuota struct {
	RequestsCPU    string // e.g. "2"
	LimitsCPU      string // e.g. "8"
	RequestsMemory string // e.g. "2Gi"
	LimitsMemory   string // e.g. "8Gi"
	PVCs           string // e.g. "20"
	Pods           string // e.g. "50"
}

// DefaultTenantQuota accommodates at least 2 Postgres (default memory) + 1
// Mongo + 1 Redis + their sidecars (PostgREST) for a typical tenant.
var DefaultTenantQuota = TenantQuota{
	RequestsCPU:    "2",
	LimitsCPU:      "8",
	RequestsMemory: "2Gi",
	LimitsMemory:   "8Gi",
	PVCs:           "20",
	Pods:           "50",
}

func (c *Client) ApplyTenantResourceQuota(ctx context.Context, projectID string, q TenantQuota) error {
	ns := TenantNamespaceName(projectID)
	quota := &corev1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "default",
			Namespace: ns,
		},
		Spec: corev1.ResourceQuotaSpec{
			Hard: corev1.ResourceList{
				corev1.ResourceRequestsCPU:            resource.MustParse(q.RequestsCPU),
				corev1.ResourceLimitsCPU:              resource.MustParse(q.LimitsCPU),
				corev1.ResourceRequestsMemory:         resource.MustParse(q.RequestsMemory),
				corev1.ResourceLimitsMemory:           resource.MustParse(q.LimitsMemory),
				corev1.ResourcePersistentVolumeClaims: resource.MustParse(q.PVCs),
				corev1.ResourcePods:                   resource.MustParse(q.Pods),
			},
		},
	}
	_, err := c.cs.CoreV1().ResourceQuotas(ns).Create(ctx, quota, metav1.CreateOptions{})
	if err == nil {
		return nil
	}
	if !isAlreadyExists(err) {
		return fmt.Errorf("create quota: %w", err)
	}
	// A quota created before DefaultTenantQuota's caps changed would
	// otherwise stay stuck on its original (looser or stricter) numbers
	// forever, since Create is a no-op against an existing object — update
	// it in place so every tenant converges on the current caps. Update
	// requires the existing object's ResourceVersion, so fetch it first
	// rather than blindly PUTting our freshly-built one.
	existing, err := c.cs.CoreV1().ResourceQuotas(ns).Get(ctx, "default", metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get existing quota: %w", err)
	}
	existing.Spec = quota.Spec
	if _, err := c.cs.CoreV1().ResourceQuotas(ns).Update(ctx, existing, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update quota: %w", err)
	}
	return nil
}

func (c *Client) ApplyTenantNetworkPolicy(ctx context.Context, projectID string) error {
	ns := TenantNamespaceName(projectID)

	// Deny all ingress except from massicloud-system namespace
	// (where the API pod lives and the REST proxy runs)
	policy := &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "isolate-tenant",
			Namespace: ns,
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{}, // all pods
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			Ingress: []networkingv1.NetworkPolicyIngressRule{{
				From: []networkingv1.NetworkPolicyPeer{
					{
						NamespaceSelector: &metav1.LabelSelector{
							MatchLabels: map[string]string{"kubernetes.io/metadata.name": "massicloud-system"},
						},
					},
					{
						PodSelector: &metav1.LabelSelector{}, // same-namespace
					},
				},
			}},
		},
	}
	_, err := c.cs.NetworkingV1().NetworkPolicies(ns).Create(ctx, policy, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return fmt.Errorf("create network policy: %w", err)
	}

	// Additive policy: let Prometheus (monitoring namespace) scrape the
	// postgres_exporter sidecar. Without it isolate-tenant blocks the scrape.
	// Keep in sync with deploy/scripts/upgrade-tenant-postgres.sh.
	tcp := corev1.ProtocolTCP
	port := intstr.FromInt(postgresExporterPort)
	scrape := &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{Name: "allow-prometheus-scrape", Namespace: ns},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{MatchLabels: map[string]string{"component": "postgres"}},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			Ingress: []networkingv1.NetworkPolicyIngressRule{{
				From: []networkingv1.NetworkPolicyPeer{{
					NamespaceSelector: &metav1.LabelSelector{
						MatchLabels: map[string]string{"kubernetes.io/metadata.name": "monitoring"},
					},
				}},
				Ports: []networkingv1.NetworkPolicyPort{{Protocol: &tcp, Port: &port}},
			}},
		},
	}
	_, err = c.cs.NetworkingV1().NetworkPolicies(ns).Create(ctx, scrape, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return fmt.Errorf("create prometheus scrape network policy: %w", err)
	}
	return nil
}
