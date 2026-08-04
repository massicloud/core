package proxy

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mikaminou/massicloud/api/internal/store"
)

// PostgresProxy resolves an instance ID to a live pgxpool.Pool.
// Pools are cached by instance ID; call Remove when an instance is deleted.
type PostgresProxy struct {
	store *store.Store
	mu    sync.Mutex
	pools map[string]*pgxpool.Pool
}

func New(store *store.Store) *PostgresProxy {
	return &PostgresProxy{
		store: store,
		pools: make(map[string]*pgxpool.Pool),
	}
}

// GetPool returns a ready pool for the given instance ID.
// On first call the pool is created and Postgres readiness is verified
// (up to 30 s of retries, bounded further by ctx).
func (p *PostgresProxy) GetPool(ctx context.Context, instanceID string) (*pgxpool.Pool, error) {
	p.mu.Lock()
	if pool, ok := p.pools[instanceID]; ok {
		p.mu.Unlock()
		return pool, nil
	}
	p.mu.Unlock()

	instance, err := p.store.GetInstance(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("proxy: get instance: %w", err)
	}

	dsn := normalizeDSN(instance.DSN)
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("proxy: create pool: %w", err)
	}

	// Postgres in a freshly started container needs a few seconds to be ready.
	deadline := time.Now().Add(30 * time.Second)
	for {
		if err := pool.Ping(ctx); err == nil {
			break
		}
		if time.Now().After(deadline) {
			pool.Close()
			return nil, fmt.Errorf("proxy: postgres %s not ready after 30s", instanceID)
		}
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}

	p.mu.Lock()
	// Another goroutine may have raced us — keep whichever pool got here first.
	if existing, ok := p.pools[instanceID]; ok {
		p.mu.Unlock()
		pool.Close()
		return existing, nil
	}
	p.pools[instanceID] = pool
	p.mu.Unlock()

	return pool, nil
}

// Remove evicts the cached pool for a deleted instance.
func (p *PostgresProxy) Remove(instanceID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if pool, ok := p.pools[instanceID]; ok {
		pool.Close()
		delete(p.pools, instanceID)
	}
}

func normalizeDSN(raw string) string {
	if strings.HasPrefix(raw, "postgres://") || strings.HasPrefix(raw, "postgresql://") {
		u, err := url.Parse(raw)
		if err != nil {
			return raw
		}
		q := u.Query()
		if q.Get("sslmode") == "" {
			q.Set("sslmode", "disable")
			u.RawQuery = q.Encode()
		}
		return u.String()
	}
	if !strings.Contains(raw, "sslmode=") {
		return raw + " sslmode=disable"
	}
	return raw
}
