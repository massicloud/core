package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = 200
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

// RequestLogger logs every incoming request before any other middleware runs,
// and its response status after the handler completes. Wire it as the
// outermost middleware so it can see requests that later layers (CORS, auth,
// project-key resolution) reject before a handler ever runs.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		slog.Info("http request in",
			"method", r.Method,
			"path", r.URL.Path,
			"query", r.URL.RawQuery,
			"content_type", r.Header.Get("Content-Type"),
			"has_api_key", r.Header.Get("X-MassiCloud-Key") != "",
		)

		rec := &statusRecorder{ResponseWriter: w, status: 0}
		next.ServeHTTP(rec, r)

		slog.Info("http request out",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"bytes", rec.bytes,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}
