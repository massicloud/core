package ratelimit

import "time"

// Category is one of the three rate-limit tiers every end-user (project
// API key gated) endpoint falls into. Same limits apply to anon and
// service keys — there's no per-key-type or per-project override yet (see
// BUGS.md / task notes: that's a paid-tier feature for later).
type Category string

const (
	CategoryReads  Category = "reads"
	CategoryWrites Category = "writes"
	CategoryAuth   Category = "auth"
)

// Limit is a token bucket's shape: how many tokens it can hold, and how
// fast it refills. Capacity and refill rate happen to be equal for every
// category today (a bucket that's been idle at least a second is always
// full again), but they're modeled separately since nothing requires that
// to stay true.
type Limit struct {
	Capacity   float64
	RatePerSec float64
}

var categoryLimits = map[Category]Limit{
	CategoryReads:  {Capacity: 300, RatePerSec: 300},
	CategoryWrites: {Capacity: 100, RatePerSec: 100},
	CategoryAuth:   {Capacity: 10, RatePerSec: 10},
}

// LimitFor returns the configured limit for cat, and whether cat is a
// recognized category at all — an unrecognized category is treated by
// callers as "don't limit" rather than a hard error, since a typo in a
// route's middleware wiring shouldn't take the endpoint down.
func LimitFor(cat Category) (Limit, bool) {
	l, ok := categoryLimits[cat]
	return l, ok
}

// BucketKey forms the storage key for a (category, API key) pair. The key
// is the raw API key string, not a hash or the resolved project/key
// record — every route in a category sharing one bucket per key is the
// whole point (which specific route was hit doesn't matter).
func BucketKey(cat Category, apiKey string) string {
	return "ratelimit:" + string(cat) + ":" + apiKey
}

// IdleTTL is how long a bucket may sit untouched in Redis before it's
// allowed to expire. Rate limits don't need to survive that long — this
// just keeps idle keys from accumulating forever.
const IdleTTL = time.Hour
