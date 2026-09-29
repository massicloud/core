-- Atomic check-and-decrement for one token bucket. Runs entirely inside
-- Redis so concurrent requests against the same key can't race (the
-- read-refill-write-back sequence below is single-threaded from Redis'
-- point of view for the duration of the script).
--
-- KEYS[1] = bucket key ("ratelimit:{category}:{api_key}")
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill rate, tokens per second
-- ARGV[3] = now, unix milliseconds
-- ARGV[4] = idle TTL, seconds (bucket expires this long after last touch)
--
-- Returns {allowed (0/1), retry_after_seconds}

local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call("HMGET", KEYS[1], "tokens", "last_refill")
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  -- No bucket yet (first request, or it expired from idleness) — start full.
  tokens = capacity
  last_refill = now_ms
end

local elapsed_sec = math.max(0, now_ms - last_refill) / 1000
tokens = math.min(capacity, tokens + elapsed_sec * rate)

local allowed = 0
local retry_after = 0

if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
elseif rate > 0 then
  retry_after = math.ceil((1 - tokens) / rate)
end

redis.call("HMSET", KEYS[1], "tokens", tostring(tokens), "last_refill", tostring(now_ms))
-- Relative EXPIRE on every touch reaches the same "expires N seconds after
-- last access" behavior as computing an absolute EXPIREAT would, without
-- needing to compute that absolute time here.
redis.call("EXPIRE", KEYS[1], ttl)

return {allowed, retry_after}
