package k8s

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const TenantNamespacePrefix = "tenant-"

func TenantNamespaceName(projectID string) string {
	// Kubernetes namespace names must be lowercase and
	// conform to DNS-1123. Assume projectID is UUID.
	return TenantNamespacePrefix + projectID
}

func (c *Client) EnsureTenantNamespace(ctx context.Context, projectID string) error {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: TenantNamespaceName(projectID),
			Labels: map[string]string{
				"massicloud.io/tenant":     "true",
				"massicloud.io/project-id": projectID,
			},
		},
	}
	_, err := c.cs.CoreV1().Namespaces().Create(ctx, ns, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return fmt.Errorf("create namespace: %w", err)
	}
	return nil
}

func (c *Client) DeleteTenantNamespace(ctx context.Context, projectID string) error {
	err := c.cs.CoreV1().Namespaces().Delete(ctx, TenantNamespaceName(projectID), metav1.DeleteOptions{})
	if err != nil && !isNotFound(err) {
		return fmt.Errorf("delete namespace: %w", err)
	}
	return nil
}
