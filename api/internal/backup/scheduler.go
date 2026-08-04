package backup

import (
	"context"
	"log/slog"
	"time"

	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/store"
)

type Scheduler struct {
	service *Service
	store   *store.Store
	logger  *slog.Logger
	stop    chan struct{}
}

func NewScheduler(service *Service, store *store.Store, logger *slog.Logger) *Scheduler {
	return &Scheduler{
		service: service,
		store:   store,
		logger:  logger,
		stop:    make(chan struct{}),
	}
}

// Run starts the background scheduler. It checks every 5 minutes for instances
// due for a scheduled backup and runs cleanup every hour. Blocks until ctx is
// cancelled or Stop() is called.
func (s *Scheduler) Run(ctx context.Context) {
	s.logger.Info("backup scheduler started")

	backupTicker := time.NewTicker(5 * time.Minute)
	cleanupTicker := time.NewTicker(1 * time.Hour)
	defer backupTicker.Stop()
	defer cleanupTicker.Stop()

	// Run immediately on startup.
	s.checkDueBackups(ctx)
	if _, err := s.service.CleanupExpired(ctx); err != nil {
		s.logger.Error("startup cleanup failed", slog.Any("error", err))
	}

	for {
		select {
		case <-s.stop:
			s.logger.Info("backup scheduler stopped")
			return
		case <-ctx.Done():
			s.logger.Info("backup scheduler stopped (context cancelled)")
			return
		case <-backupTicker.C:
			s.checkDueBackups(ctx)
		case <-cleanupTicker.C:
			if _, err := s.service.CleanupExpired(ctx); err != nil {
				s.logger.Error("scheduled cleanup failed", slog.Any("error", err))
			}
		}
	}
}

// Stop signals the scheduler to exit. Safe to call once.
func (s *Scheduler) Stop() {
	close(s.stop)
}

func (s *Scheduler) checkDueBackups(ctx context.Context) {
	instances, err := s.store.ListAllInstancesForBackup(ctx)
	if err != nil {
		s.logger.Error("scheduler: list instances", slog.Any("error", err))
		return
	}

	for _, inst := range instances {
		if !s.isDue(ctx, inst) {
			continue
		}
		go func(instance models.Instance) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			if _, err := s.service.CreateBackup(bgCtx, instance, models.BackupScheduled); err != nil {
				s.logger.Error("scheduled backup failed",
					slog.String("instance_id", instance.ID),
					slog.Any("error", err),
				)
			}
		}(inst)
	}
}

// isDue returns true when the instance has no completed backup in the last 24 h.
func (s *Scheduler) isDue(ctx context.Context, instance models.Instance) bool {
	if instance.BackupSchedule != "daily" {
		return false
	}

	latest, err := s.store.GetLatestBackup(ctx, instance.ID)
	if err != nil {
		s.logger.Error("scheduler: check latest backup",
			slog.String("instance_id", instance.ID),
			slog.Any("error", err),
		)
		return false
	}

	if latest == nil {
		return true
	}
	return time.Since(latest.StartedAt) >= 24*time.Hour
}
