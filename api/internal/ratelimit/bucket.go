// Package ratelimit implements per-API-key token bucket rate limiting,
// with a Redis-backed primary store and an in-memory fallback for when
// Redis is unreachable (see limiter.go).
package ratelimit

import (
	"math"
	"time"
)

// Bucket is a token bucket's pure state. Pushing time handling to the
// caller (via the `now` parameter below) keeps this package's math
// deterministic and unit-testable without a clock or any I/O — both the
// Redis Lua script and the in-memory implementation apply the exact same
// formula against their own storage.
type Bucket struct {
	Tokens     float64
	LastRefill time.Time
}

// Refill returns the token count b would have at `now`, given it refills
// at ratePerSec tokens/sec up to capacity. It does not mutate b — callers
// combine this with Take under whatever locking/atomicity their storage
// backend provides.
func Refill(b Bucket, now time.Time, ratePerSec float64, capacity float64) float64 {
	elapsed := now.Sub(b.LastRefill).Seconds()
	if elapsed <= 0 {
		return b.Tokens
	}
	tokens := b.Tokens + elapsed*ratePerSec
	if tokens > capacity {
		tokens = capacity
	}
	return tokens
}

// Take reports whether a token can be taken from a bucket holding
// `available` tokens, and returns the token count after taking one (if
// allowed) or unchanged (if not).
func Take(available float64) (allowed bool, remaining float64) {
	if available >= 1 {
		return true, available - 1
	}
	return false, available
}

// RetryAfter returns whole seconds until at least one token would be
// available at ratePerSec, given `available` tokens right now. 0 if a
// token is already available (or the category has no refill rate at all).
func RetryAfter(available float64, ratePerSec float64) int {
	if available >= 1 || ratePerSec <= 0 {
		return 0
	}
	deficit := 1 - available
	return int(math.Ceil(deficit / ratePerSec))
}
