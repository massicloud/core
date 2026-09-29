package ratelimit

import (
	"testing"
	"time"
)

func TestRefill(t *testing.T) {
	base := time.Unix(1000, 0)

	t.Run("no time elapsed leaves tokens unchanged", func(t *testing.T) {
		got := Refill(Bucket{Tokens: 5, LastRefill: base}, base, 10, 20)
		if got != 5 {
			t.Fatalf("got %v, want 5", got)
		}
	})

	t.Run("refills proportional to elapsed time", func(t *testing.T) {
		now := base.Add(500 * time.Millisecond)
		got := Refill(Bucket{Tokens: 5, LastRefill: base}, now, 10, 20)
		want := 10.0 // 5 + 0.5*10
		if got != want {
			t.Fatalf("got %v, want %v", got, want)
		}
	})

	t.Run("refill is capped at capacity", func(t *testing.T) {
		now := base.Add(2 * time.Second)
		got := Refill(Bucket{Tokens: 5, LastRefill: base}, now, 10, 20)
		if got != 20 { // 5 + 2*10 = 25, capped at capacity 20
			t.Fatalf("got %v, want 20 (capped)", got)
		}
	})

	t.Run("never exceeds capacity", func(t *testing.T) {
		now := base.Add(time.Hour)
		got := Refill(Bucket{Tokens: 20, LastRefill: base}, now, 10, 20)
		if got != 20 {
			t.Fatalf("got %v, want 20", got)
		}
	})

	t.Run("negative elapsed time (clock skew) is a no-op", func(t *testing.T) {
		now := base.Add(-time.Second)
		got := Refill(Bucket{Tokens: 5, LastRefill: base}, now, 10, 20)
		if got != 5 {
			t.Fatalf("got %v, want 5 unchanged", got)
		}
	})
}

func TestTake(t *testing.T) {
	t.Run("allows and decrements when a token is available", func(t *testing.T) {
		allowed, remaining := Take(1)
		if !allowed || remaining != 0 {
			t.Fatalf("got (%v, %v), want (true, 0)", allowed, remaining)
		}
	})

	t.Run("allows fractional tokens above 1", func(t *testing.T) {
		allowed, remaining := Take(5.5)
		if !allowed || remaining != 4.5 {
			t.Fatalf("got (%v, %v), want (true, 4.5)", allowed, remaining)
		}
	})

	t.Run("denies and leaves tokens unchanged below 1", func(t *testing.T) {
		allowed, remaining := Take(0.5)
		if allowed || remaining != 0.5 {
			t.Fatalf("got (%v, %v), want (false, 0.5)", allowed, remaining)
		}
	})

	t.Run("denies at exactly zero", func(t *testing.T) {
		allowed, remaining := Take(0)
		if allowed || remaining != 0 {
			t.Fatalf("got (%v, %v), want (false, 0)", allowed, remaining)
		}
	})
}

func TestRetryAfter(t *testing.T) {
	cases := []struct {
		name      string
		available float64
		rate      float64
		want      int
	}{
		{"token already available", 1, 10, 0},
		{"more than one token available", 5, 10, 0},
		{"half a token short at 10/sec needs 0.05s, rounds up to 1s", 0.5, 10, 1},
		{"nearly a full token short at 1/sec rounds up to 1s", 0.01, 1, 1},
		{"far short at a slow rate needs several seconds", 0, 0.5, 2},
		{"zero rate never recovers, but still reports 0 rather than dividing by zero", 0.5, 0, 0},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := RetryAfter(c.available, c.rate)
			if got != c.want {
				t.Fatalf("RetryAfter(%v, %v) = %v, want %v", c.available, c.rate, got, c.want)
			}
		})
	}
}
