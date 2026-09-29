package ratelimit

import (
	"context"
	_ "embed"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

//go:embed tokenbucket.lua
var tokenBucketScript string

// RedisLimiter is the primary, cross-replica-shared token bucket store:
// one Redis hash per (category, API key), checked and decremented
// atomically by tokenbucket.lua so concurrent requests across every API
// pod racing on the same key can't both succeed past the limit.
type RedisLimiter struct {
	client *redis.Client
	script *redis.Script
}

func NewRedisLimiter(client *redis.Client) *RedisLimiter {
	return &RedisLimiter{
		client: client,
		script: redis.NewScript(tokenBucketScript),
	}
}

func (r *RedisLimiter) Allow(ctx context.Context, cat Category, apiKey string) (Result, error) {
	limit, ok := LimitFor(cat)
	if !ok {
		return Result{Allowed: true}, nil
	}

	key := BucketKey(cat, apiKey)
	nowMs := time.Now().UnixMilli()

	res, err := r.script.Run(ctx, r.client, []string{key},
		limit.Capacity, limit.RatePerSec, nowMs, int(IdleTTL.Seconds()),
	).Result()
	if err != nil {
		return Result{}, fmt.Errorf("ratelimit: redis script failed: %w", err)
	}

	vals, ok := res.([]interface{})
	if !ok || len(vals) != 2 {
		return Result{}, fmt.Errorf("ratelimit: unexpected script result shape: %#v", res)
	}
	allowed, _ := vals[0].(int64)
	retryAfter, _ := vals[1].(int64)

	return Result{
		Allowed:    allowed == 1,
		Limit:      limit.Capacity,
		RetryAfter: int(retryAfter),
	}, nil
}
