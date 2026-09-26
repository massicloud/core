package k8s

import (
	"bytes"
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// execInPod runs command inside container of pod and returns its combined
// stdout/stderr. Used for the Mongo replica-set bootstrap (rs.initiate,
// createUser) which must happen from inside the pod's network namespace via
// mongosh — there is no other supported way to run an interactive-shell-only
// operation like rs.initiate() over the Kubernetes API.
func (c *Client) execInPod(ctx context.Context, ns, pod, container string, command []string) (string, string, error) {
	req := c.cs.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(pod).
		Namespace(ns).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   command,
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.restConfig, "POST", req.URL())
	if err != nil {
		return "", "", fmt.Errorf("create SPDY executor: %w", err)
	}

	var stdout, stderr bytes.Buffer
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})
	return stdout.String(), stderr.String(), err
}
