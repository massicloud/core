package k8s

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
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

// WaitForPodRunning waits until pod's phase is Running, without regard to
// its readiness gate. Used for pods (like a fresh Mongo replica-set member)
// whose readiness probe can't pass until further setup runs against the
// already-Running pod.
func (c *Client) WaitForPodRunning(ctx context.Context, ns, name string, timeoutSec int) error {
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	for time.Now().Before(deadline) {
		pod, err := c.cs.CoreV1().Pods(ns).Get(ctx, name, metav1.GetOptions{})
		if err == nil && pod.Status.Phase == corev1.PodRunning {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("pod %s/%s not running within %ds", ns, name, timeoutSec)
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
