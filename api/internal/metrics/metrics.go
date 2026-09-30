// Package metrics defines the API's Prometheus metrics and the helpers that
// feed them. It is served on a separate port (METRICS_PORT) so /metrics is
// only reachable from inside the cluster.
package metrics

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

// Registry is the API's dedicated registry (Go runtime + process collectors
// plus everything below).
var Registry = prometheus.NewRegistry()

var (
	// HTTPRequestsTotal carries project_slug (bounded to real projects, see
	// SlugLabel) so per-tenant request/error rates can be graphed.
	HTTPRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "HTTP requests handled by the API.",
	}, []string{"method", "route", "status", "project_slug"})

	// HTTPRequestDuration deliberately has no project_slug label: with
	// histogram buckets, method x route x status x slug multiplies series
	// count too far. Per-tenant latency isn't needed; per-route is.
	HTTPRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency.",
		Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30},
	}, []string{"method", "route", "status"})

	RateLimitDenials = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "massicloud_ratelimit_denials_total",
		Help: "Requests rejected by the rate limiter. api_key_prefix is the first 12 chars of the key only.",
	}, []string{"category", "api_key_prefix"})

	ActiveTenants = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "massicloud_active_tenants",
		Help: "Number of projects (tenants) in the control plane.",
	})

	// ProjectInfo / BucketInfo are constant-1 info metrics that let
	// dashboards map tenant namespaces (tenant-{project_id}) and MinIO
	// buckets to project slugs with a PromQL join.
	ProjectInfo = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "massicloud_project_info",
		Help: "Project id to slug mapping (value is always 1).",
	}, []string{"project_id", "project_slug"})

	BucketInfo = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "massicloud_bucket_info",
		Help: "Bucket to project mapping (value is always 1).",
	}, []string{"bucket", "project_slug"})

	RedisDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "massicloud_redis_call_duration_seconds",
		Help:    "Duration of Redis commands issued by the API.",
		Buckets: []float64{.0005, .001, .0025, .005, .01, .025, .05, .1, .5},
	}, []string{"command"})

	RedisFailures = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "massicloud_redis_call_failures_total",
		Help: "Failed Redis commands (excluding key-not-found).",
	}, []string{"command"})

	DBDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "massicloud_db_query_duration_seconds",
		Help:    "Control-plane Postgres query duration, by SQL verb.",
		Buckets: []float64{.001, .0025, .005, .01, .025, .05, .1, .25, .5, 1, 2.5},
	}, []string{"operation"})

	DBFailures = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "massicloud_db_query_failures_total",
		Help: "Failed control-plane Postgres queries, by SQL verb.",
	}, []string{"operation"})
)

func init() {
	Registry.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
		HTTPRequestsTotal, HTTPRequestDuration, RateLimitDenials, ActiveTenants,
		ProjectInfo, BucketInfo, RedisDuration, RedisFailures, DBDuration, DBFailures,
	)
}

// ProjectRef and BucketRef are what the store hands the collector.
type ProjectRef struct{ ID, Slug string }
type BucketRef struct{ Name, ProjectSlug string }

// Source is implemented by *store.Store.
type Source interface {
	ListProjectRefs(ctx context.Context) ([]ProjectRef, error)
	ListBucketRefs(ctx context.Context) ([]BucketRef, error)
}

var (
	slugMu     sync.RWMutex
	knownSlugs = map[string]struct{}{}
)

// SlugLabel returns slug if it belongs to a real project, else "unknown", so
// requests to made-up /v1/{slug}/... paths can't create unbounded series.
func SlugLabel(slug string) string {
	if slug == "" {
		return ""
	}
	slugMu.RLock()
	_, ok := knownSlugs[slug]
	slugMu.RUnlock()
	if ok {
		return slug
	}
	return "unknown"
}

// Refresh reloads project/bucket info from src once.
func Refresh(ctx context.Context, src Source) error {
	projects, err := src.ListProjectRefs(ctx)
	if err != nil {
		return err
	}
	buckets, err := src.ListBucketRefs(ctx)
	if err != nil {
		return err
	}

	slugs := make(map[string]struct{}, len(projects))
	ProjectInfo.Reset()
	for _, p := range projects {
		slugs[p.Slug] = struct{}{}
		ProjectInfo.WithLabelValues(p.ID, p.Slug).Set(1)
	}
	BucketInfo.Reset()
	for _, b := range buckets {
		BucketInfo.WithLabelValues(b.Name, b.ProjectSlug).Set(1)
	}
	ActiveTenants.Set(float64(len(projects)))

	slugMu.Lock()
	knownSlugs = slugs
	slugMu.Unlock()
	return nil
}

// RunCollector refreshes every interval until ctx is cancelled. Errors are
// passed to onErr (the previous values stay in place).
func RunCollector(ctx context.Context, src Source, interval time.Duration, onErr func(error)) {
	tick := func() {
		c, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		if err := Refresh(c, src); err != nil && onErr != nil {
			onErr(err)
		}
	}
	tick()
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			tick()
		}
	}
}

// KeyPrefix returns the first 12 chars of an API key — never the full key.
func KeyPrefix(key string) string {
	if len(key) > 12 {
		return key[:12]
	}
	return key
}

// sqlVerb returns the leading SQL keyword, upper-cased, as a low-cardinality
// operation label.
func sqlVerb(sql string) string {
	sql = strings.TrimSpace(sql)
	if i := strings.IndexAny(sql, " \t\r\n("); i > 0 {
		sql = sql[:i]
	}
	if sql == "" {
		return "OTHER"
	}
	return strings.ToUpper(sql)
}
