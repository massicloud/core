package k8s

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func ptrInt32(i int32) *int32 { return &i }

func (c *Client) WaitForStatefulSetReady(ctx context.Context, ns, name string, timeoutSec int) error {
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	for time.Now().Before(deadline) {
		sts, err := c.cs.AppsV1().StatefulSets(ns).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if sts.Status.ReadyReplicas > 0 && sts.Status.ReadyReplicas == *sts.Spec.Replicas {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("statefulset %s/%s not ready within %ds", ns, name, timeoutSec)
}

func (c *Client) WaitForDeploymentReady(ctx context.Context, ns, name string, timeoutSec int) error {
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	for time.Now().Before(deadline) {
		dep, err := c.cs.AppsV1().Deployments(ns).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if dep.Status.ReadyReplicas > 0 && dep.Status.ReadyReplicas == *dep.Spec.Replicas {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("deployment %s/%s not ready within %ds", ns, name, timeoutSec)
}
