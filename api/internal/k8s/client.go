package k8s

import (
	"fmt"
	"log/slog"
	"os"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	cs     *kubernetes.Clientset
	logger *slog.Logger
	cfg    Config
}

type Config struct {
	// Where tenant workloads are created. Ingress DNS suffix.
	DomainSuffix string // e.g. "massicloud.work"
	// Storage class name for PVCs.
	StorageClass string // e.g. "local-path" (k3s default)

	// Backing-service images — configurable so Helm can pin/override them
	// without a code change.
	PostgresImage  string // e.g. "postgres:16-alpine"
	RedisImage     string // e.g. "redis:7-alpine"
	PostgRESTImage string // e.g. "postgrest/postgrest:v12.2.3"
}

func New(logger *slog.Logger, cfg Config) (*Client, error) {
	var restCfg *rest.Config
	var err error

	// Try in-cluster config first (when the API runs as a pod in
	// the cluster). Fall back to KUBECONFIG env var for local dev.
	restCfg, err = rest.InClusterConfig()
	if err != nil {
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			return nil, fmt.Errorf("no in-cluster config and KUBECONFIG not set")
		}
		restCfg, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("build kubeconfig: %w", err)
		}
	}

	cs, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("create clientset: %w", err)
	}

	return &Client{cs: cs, logger: logger, cfg: cfg}, nil
}
