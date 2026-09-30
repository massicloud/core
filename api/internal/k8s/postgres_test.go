package k8s

import (
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/api/resource"
)

func TestNewPostgresStatefulSetHasExporterSidecar(t *testing.T) {
	sts := newPostgresStatefulSet(Config{PostgresImage: "postgres:16-alpine", StorageClass: "local-path"},
		"tenant-abc", "postgres-main", 512, resource.MustParse("5Gi"))
	tpl := sts.Spec.Template

	if tpl.Labels["component"] != "postgres" {
		t.Errorf("pod template must carry component=postgres for the PodMonitor, got %v", tpl.Labels)
	}
	if tpl.Annotations["prometheus.io/scrape"] != "true" || tpl.Annotations["prometheus.io/port"] != "9187" {
		t.Errorf("missing prometheus.io hints: %v", tpl.Annotations)
	}
	if len(tpl.Spec.Containers) != 2 {
		t.Fatalf("want 2 containers, got %d", len(tpl.Spec.Containers))
	}

	pg, ex := tpl.Spec.Containers[0], tpl.Spec.Containers[1]
	args := strings.Join(pg.Args, " ")
	for _, want := range []string{"shared_preload_libraries=pg_stat_statements", "pg_stat_statements.max=10000", "pg_stat_statements.track=all"} {
		if !strings.Contains(args, want) {
			t.Errorf("postgres args missing %q: %s", want, args)
		}
	}

	if strings.HasSuffix(ex.Image, ":latest") || !strings.Contains(ex.Image, "postgres-exporter:v0.15.0") {
		t.Errorf("exporter image must be pinned, got %s", ex.Image)
	}
	if len(ex.Ports) != 1 || ex.Ports[0].Name != "metrics" || ex.Ports[0].ContainerPort != 9187 {
		t.Errorf("exporter port: %+v", ex.Ports)
	}
	var dsn string
	for _, e := range ex.Env {
		if e.Name == "DATA_SOURCE_NAME" {
			dsn = e.Value
		}
		if e.Name == "POSTGRES_PASSWORD" && (e.ValueFrom == nil || e.ValueFrom.SecretKeyRef.Name != "postgres-main-creds") {
			t.Error("exporter password must come from the postgres Secret")
		}
	}
	if dsn != "postgresql://postgres:$(POSTGRES_PASSWORD)@localhost:5432/postgres?sslmode=disable" {
		t.Errorf("DATA_SOURCE_NAME = %q (raw password must never appear inline)", dsn)
	}
	if ex.LivenessProbe == nil || ex.ReadinessProbe == nil ||
		ex.LivenessProbe.HTTPGet.Path != "/metrics" || ex.ReadinessProbe.HTTPGet.Port.IntValue() != 9187 {
		t.Error("exporter needs HTTP /metrics :9187 liveness + readiness probes")
	}
	// Tenant ResourceQuota requires all four compute fields on every container.
	for _, c := range tpl.Spec.Containers {
		if c.Resources.Requests.Cpu().IsZero() || c.Resources.Requests.Memory().IsZero() ||
			c.Resources.Limits.Cpu().IsZero() || c.Resources.Limits.Memory().IsZero() {
			t.Errorf("container %s missing requests/limits", c.Name)
		}
	}
}
