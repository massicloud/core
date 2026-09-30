package metrics

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

type fakeSource struct{}

func (fakeSource) ListProjectRefs(context.Context) ([]ProjectRef, error) {
	return []ProjectRef{{ID: "p1", Slug: "acme"}}, nil
}
func (fakeSource) ListBucketRefs(context.Context) ([]BucketRef, error) {
	return []BucketRef{{Name: "uploads", ProjectSlug: "acme"}}, nil
}

func TestHTTPMiddlewareLabels(t *testing.T) {
	if err := Refresh(context.Background(), fakeSource{}); err != nil {
		t.Fatal(err)
	}
	if got := testutil.ToFloat64(ActiveTenants); got != 1 {
		t.Fatalf("active tenants = %v", got)
	}

	r := chi.NewRouter()
	r.Use(HTTP)
	r.Get("/v1/{slug}/ping", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })

	for _, path := range []string{"/v1/acme/ping", "/v1/made-up-123/ping", "/nope"} {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}

	if got := testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("GET", "/v1/{slug}/ping", "418", "acme")); got != 1 {
		t.Errorf("known slug count = %v", got)
	}
	// Unknown slugs collapse to one series; raw paths never become labels.
	if got := testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("GET", "/v1/{slug}/ping", "418", "unknown")); got != 1 {
		t.Errorf("unknown slug count = %v", got)
	}
	if got := testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("GET", "unmatched", "404", "")); got != 1 {
		t.Errorf("unmatched count = %v", got)
	}
}

func TestKeyPrefixNeverFullKey(t *testing.T) {
	if got := KeyPrefix("mc_anon_abcdefghijklmnop"); got != "mc_anon_abcd" {
		t.Fatalf("got %q", got)
	}
	if got := KeyPrefix("short"); got != "short" {
		t.Fatalf("got %q", got)
	}
}

func TestSQLVerb(t *testing.T) {
	for in, want := range map[string]string{
		"select * from x": "SELECT", "  INSERT INTO t": "INSERT", "with a as (select 1) select": "WITH", "": "OTHER",
	} {
		if got := sqlVerb(in); got != want {
			t.Errorf("sqlVerb(%q) = %q, want %q", in, got, want)
		}
	}
}
