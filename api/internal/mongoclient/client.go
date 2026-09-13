// Package mongoclient provides a small connection cache for tenant MongoDB
// instances, mirroring internal/proxy's role for Postgres — resolve an
// instance to a live *mongo.Client, cached by instance ID, evicted when idle
// or when the instance is deleted.
package mongoclient

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const idleEvictAfter = 5 * time.Minute

type cachedClient struct {
	client   *mongo.Client
	lastUsed time.Time
}

// Manager caches *mongo.Client instances by instance ID, evicting entries
// idle for longer than idleEvictAfter.
type Manager struct {
	mu      sync.Mutex
	clients map[string]*cachedClient
	stop    chan struct{}
}

func NewManager() *Manager {
	m := &Manager{
		clients: make(map[string]*cachedClient),
		stop:    make(chan struct{}),
	}
	go m.evictLoop()
	return m
}

// GetClient returns a live client for the given instance, connecting and
// pinging on first use. dsn is the instance's stored service-role DSN.
func (m *Manager) GetClient(ctx context.Context, instanceID, dsn string) (*mongo.Client, error) {
	m.mu.Lock()
	if entry, ok := m.clients[instanceID]; ok {
		entry.lastUsed = time.Now()
		m.mu.Unlock()
		return entry.client, nil
	}
	m.mu.Unlock()

	client, err := Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	// Another goroutine may have raced us — keep whichever client got here first.
	if existing, ok := m.clients[instanceID]; ok {
		m.mu.Unlock()
		_ = client.Disconnect(context.Background())
		existing.lastUsed = time.Now()
		return existing.client, nil
	}
	m.clients[instanceID] = &cachedClient{client: client, lastUsed: time.Now()}
	m.mu.Unlock()

	return client, nil
}

// Remove evicts and disconnects the cached client for a deleted instance.
func (m *Manager) Remove(instanceID string) {
	m.mu.Lock()
	entry, ok := m.clients[instanceID]
	if ok {
		delete(m.clients, instanceID)
	}
	m.mu.Unlock()
	if ok {
		_ = entry.client.Disconnect(context.Background())
	}
}

func (m *Manager) evictLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-m.stop:
			return
		case <-ticker.C:
			m.evictIdle()
		}
	}
}

func (m *Manager) evictIdle() {
	cutoff := time.Now().Add(-idleEvictAfter)
	var stale []*mongo.Client

	m.mu.Lock()
	for id, entry := range m.clients {
		if entry.lastUsed.Before(cutoff) {
			stale = append(stale, entry.client)
			delete(m.clients, id)
		}
	}
	m.mu.Unlock()

	for _, c := range stale {
		_ = c.Disconnect(context.Background())
	}
}

// Connect opens and pings a new Mongo client for the given DSN. Callers that
// don't need caching (e.g. the one-time replica-set/user bootstrap in
// handlers.createMongoInstance) should call this directly and Disconnect
// when done, rather than going through a Manager.
func Connect(ctx context.Context, dsn string) (*mongo.Client, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(dsn))
	if err != nil {
		return nil, fmt.Errorf("mongoclient: connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("mongoclient: ping: %w", err)
	}
	return client, nil
}

// WithTimeout runs fn with a context bounded by timeout.
func WithTimeout(ctx context.Context, fn func(ctx context.Context) error, timeout time.Duration) error {
	tctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return fn(tctx)
}
