package k8s

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (c *Client) ApplyTenantResourceQuota(ctx context.Context, projectID string, cpu, memoryMB int) error {
	ns := TenantNamespaceName(projectID)
	quota := &corev1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "default",
			Namespace: ns,
		},
		Spec: corev1.ResourceQuotaSpec{
			Hard: corev1.ResourceList{
				corev1.ResourceRequestsCPU:            resource.MustParse(fmt.Sprintf("%d", cpu)),
				corev1.ResourceLimitsMemory:           resource.MustParse(fmt.Sprintf("%dMi", memoryMB)),
				corev1.ResourcePersistentVolumeClaims: resource.MustParse("5"),
			},
		},
	}
	_, err := c.cs.CoreV1().ResourceQuotas(ns).Create(ctx, quota, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return fmt.Errorf("create quota: %w", err)
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
	return nil
}
