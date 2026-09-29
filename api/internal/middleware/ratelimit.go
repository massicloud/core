package middleware

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mikaminou/massicloud/api/internal/ratelimit"
)

// RequireCategory rate-limits requests through the given hybrid limiter,
// per (cat, API key). It reads the raw key straight from the request
// header rather than from CtxAPIKey (set by RequireProjectKey) because
// CtxAPIKey only ever holds the key's prefix/hash — never the raw value —
// and the bucket key is specified to be the raw key string.
//
// A request with no key header is let through untouched: whether the key
// is missing or invalid is RequireProjectKey's job to reject, not this
// middleware's — in every route this is wired onto, RequireProjectKey has
// already run and rejected an unkeyed/invalid request before this executes,
// so in practice the header is always present here.
func RequireCategory(limiter ratelimit.Limiter, cat ratelimit.Category) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-MassiCloud-Key")
			if apiKey == "" {
				apiKey = r.Header.Get("apikey")
			}
			if apiKey == "" {
				next.ServeHTTP(w, r)
				return
			}

			result, err := limiter.Allow(r.Context(), cat, apiKey)
			if err != nil {
				// Both the Redis and in-memory backends failed — the latter
				// never errors in practice, so this is effectively
				// unreachable. Fail open rather than take the API down over
				// a rate-limiter bug.
				next.ServeHTTP(w, r)
				return
			}

			if !result.Allowed {
				w.Header().Set("Retry-After", strconv.Itoa(result.RetryAfter))
				w.Header().Set("X-RateLimit-Limit", strconv.FormatFloat(result.Limit, 'f', 0, 64))
				w.Header().Set("X-RateLimit-Category", string(cat))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error":               "rate_limit_exceeded",
					"category":            string(cat),
					"retry_after_seconds": result.RetryAfter,
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
