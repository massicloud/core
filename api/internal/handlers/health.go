package handlers

import (
	"encoding/json"
	"github.com/mikaminou/massicloud/api/internal/email"
	"log/slog"
	"net/http"

	"github.com/mikaminou/massicloud/api/internal/auth"
	"github.com/mikaminou/massicloud/api/internal/backup"
	"github.com/mikaminou/massicloud/api/internal/config"
	"github.com/mikaminou/massicloud/api/internal/initschemas"
	"github.com/mikaminou/massicloud/api/internal/k8s"
	"github.com/mikaminou/massicloud/api/internal/mongoclient"
	"github.com/mikaminou/massicloud/api/internal/proxy"
	"github.com/mikaminou/massicloud/api/internal/storage"
	"github.com/mikaminou/massicloud/api/internal/store"
)

type Handler struct {
	k8s           *k8s.Client
	logger        *slog.Logger
	config        *config.Config
	store         *store.Store
	authService   *auth.Service
	storage       *storage.Client
	initService   *initschemas.Service
	backupService *backup.Service
	proxy         *proxy.PostgresProxy
	mongo         *mongoclient.Manager
	resetStore    platformResetStore
	emailSender   email.Sender
}

func New(
	k8sClient *k8s.Client,
	logger *slog.Logger,
	cfg *config.Config,
	store *store.Store,
	authSvc *auth.Service,
	storageClient *storage.Client,
	initSvc *initschemas.Service,
	backupSvc *backup.Service,
	dbProxy *proxy.PostgresProxy,
	emailSender email.Sender,
) *Handler {
	return &Handler{
		k8s:           k8sClient,
		logger:        logger,
		config:        cfg,
		store:         store,
		authService:   authSvc,
		storage:       storageClient,
		initService:   initSvc,
		backupService: backupSvc,
		proxy:         dbProxy,
		mongo:         mongoclient.NewManager(),
		resetStore:    store,
		emailSender:   emailSender,
	}
}

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{
		Status:  "ok",
		Service: "massicloud-api",
		Version: "0.1.0",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		h.logger.Error("failed to encode health response", "error", err)
	}
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		h.logger.Error("failed to encode response", "error", err)
	}
}

func (h *Handler) writeError(w http.ResponseWriter, status int, msg string) {
	h.writeJSON(w, status, map[string]string{"error": msg})
}
