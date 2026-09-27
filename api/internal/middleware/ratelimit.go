package middleware

import (
	"net/http"
	"sync"

	"golang.org/x/time/rate"

	"github.com/mikaminou/massicloud/api/internal/models"
)

// perProjectLimiter holds one token-bucket limiter per project ID.
//
// This is in-memory and per-process: fine for a single API replica, but a
// limit resets on pod restart and isn't shared across replicas if the API
// is ever scaled out horizontally. Move to a shared store (e.g. Redis) if
// that starts to matter.
type perProjectLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
	r        rate.Limit
	burst    int
}

func (l *perProjectLimiter) get(projectID string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()

	lim, ok := l.limiters[projectID]
	if !ok {
		lim = rate.NewLimiter(l.r, l.burst)
		l.limiters[projectID] = lim
	}
	return lim
}

// RateLimitPerProject rejects requests over ratePerMinute per project once
// the initial burst is used up. Must run after RequireProjectKey, which
// sets CtxProject.
func RateLimitPerProject(ratePerMinute int) func(http.Handler) http.Handler {
	limiter := &perProjectLimiter{
		limiters: make(map[string]*rate.Limiter),
		r:        rate.Limit(float64(ratePerMinute) / 60),
		burst:    ratePerMinute,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			project, ok := r.Context().Value(CtxProject).(models.Project)
			if !ok {
				writeMiddlewareJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "project context missing",
				})
				return
			}

			if !limiter.get(project.ID).Allow() {
				writeMiddlewareJSON(w, http.StatusTooManyRequests, map[string]string{
					"error": "rate limit exceeded, try again shortly",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
