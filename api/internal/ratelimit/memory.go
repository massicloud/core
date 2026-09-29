package ratelimit

import (
	"context"
	"sync"
	"time"
)

// MemoryLimiter is an in-memory, per-process token bucket store. Used
// standalone when REDIS_URL isn't configured, and as Hybrid's fallback
// when Redis is unreachable. Buckets are never shared across replicas —
// see the Hybrid doc comment in limiter.go for the tradeoff.
type MemoryLimiter struct {
	buckets sync.Map // key (string) -> *bucketEntry
}

type bucketEntry struct {
	mu     sync.Mutex
	tokens float64
	last   time.Time
}

func NewMemoryLimiter() *MemoryLimiter {
	return &MemoryLimiter{}
}

// Allow reports whether a request in category cat for apiKey is permitted
// right now, atomically consuming a token if so. Never returns an error —
// it's the backend of last resort and has no I/O to fail.
func (m *MemoryLimiter) Allow(_ context.Context, cat Category, apiKey string) (Result, error) {
	limit, ok := LimitFor(cat)
	if !ok {
		return Result{Allowed: true}, nil
	}

	now := time.Now()
	key := BucketKey(cat, apiKey)

	v, _ := m.buckets.LoadOrStore(key, &bucketEntry{tokens: limit.Capacity, last: now})
	entry := v.(*bucketEntry)

	entry.mu.Lock()
	defer entry.mu.Unlock()

	available := Refill(Bucket{Tokens: entry.tokens, LastRefill: entry.last}, now, limit.RatePerSec, limit.Capacity)
	allowed, remaining := Take(available)

	entry.tokens = remaining
	entry.last = now

	return Result{
		Allowed:    allowed,
		Limit:      limit.Capacity,
		RetryAfter: RetryAfter(available, limit.RatePerSec),
	}, nil
}
