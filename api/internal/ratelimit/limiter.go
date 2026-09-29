package ratelimit

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Result is what a rate-limit check reports back to the middleware.
type Result struct {
	Allowed bool
	// Limit is the category's capacity, echoed back as X-RateLimit-Limit.
	Limit float64
	// RetryAfter is seconds until at least one token is available; 0 when
	// Allowed.
	RetryAfter int
}

// Limiter is satisfied by the Redis-backed and in-memory implementations,
// and by Hybrid itself, so the middleware only ever depends on this
// interface.
type Limiter interface {
	Allow(ctx context.Context, cat Category, apiKey string) (Result, error)
}

// redisCallTimeout bounds how long a single Redis round trip is allowed
// before Hybrid gives up on it and falls through to the in-memory limiter
// for this request. Deliberately tight — a slow Redis is worse than a
// per-pod-only limit for the duration of the slowness.
const redisCallTimeout = 50 * time.Millisecond

// fallbackWarnInterval throttles the "falling back to in-memory" log line
// so a sustained Redis outage logs once per pod per interval instead of
// once per request.
const fallbackWarnInterval = 10 * time.Second

// Hybrid tries Redis first and falls through to an in-memory limiter if
// Redis errors or doesn't respond within redisCallTimeout — a connection
// error, a timeout, EOF, whatever. It never falls through to "no limit":
// every request is rate-limited by one backend or the other.
//
// During a Redis outage, the in-memory fallback means each pod enforces
// its own separate view of every bucket — limits reset when a pod
// restarts and aren't shared across replicas — but requests are still
// rate-limited per pod rather than let through unchecked.
type Hybrid struct {
	redis  Limiter // nil when REDIS_URL isn't configured — memory-only from the start
	memory Limiter
	logger *slog.Logger

	mu           sync.Mutex
	lastWarnedAt time.Time
}

// NewHybrid builds a Hybrid limiter. redisClient may be nil (REDIS_URL not
// configured) — the returned limiter then serves every request from the
// in-memory backend only, with no per-request Redis attempt or warning.
func NewHybrid(redisClient *redis.Client, logger *slog.Logger) *Hybrid {
	var redisLimiter Limiter
	if redisClient != nil {
		redisLimiter = NewRedisLimiter(redisClient)
	}
	return &Hybrid{
		redis:  redisLimiter,
		memory: NewMemoryLimiter(),
		logger: logger,
	}
}

func (h *Hybrid) Allow(ctx context.Context, cat Category, apiKey string) (Result, error) {
	if h.redis != nil {
		redisCtx, cancel := context.WithTimeout(ctx, redisCallTimeout)
		result, err := h.redis.Allow(redisCtx, cat, apiKey)
		cancel()
		if err == nil {
			return result, nil
		}
		h.warnFallback(err)
	}
	return h.memory.Allow(ctx, cat, apiKey)
}

func (h *Hybrid) warnFallback(err error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	if now.Sub(h.lastWarnedAt) < fallbackWarnInterval {
		return
	}
	h.lastWarnedAt = now
	h.logger.Warn("ratelimit: redis unreachable, falling back to in-memory limiter",
		"error", err)
}
