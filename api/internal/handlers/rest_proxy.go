package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"

	"github.com/mikaminou/massicloud/api/internal/k8s"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// ProxyREST forwards /v1/{slug}/db/{db}/rest/* to the instance's REST
// sidecar — PostgREST for postgres instances, mysql-rest for mysql ones.
func (h *Handler) ProxyREST(w http.ResponseWriter, r *http.Request) {
	project, ok := r.Context().Value(middleware.CtxProject).(models.Project)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "project context missing")
		return
	}

	instance, ok := r.Context().Value(middleware.CtxInstance).(models.Instance)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "instance context missing")
		return
	}

	apiKey, _ := r.Context().Value(middleware.CtxAPIKey).(models.APIKey)

	if instance.PostgRESTContainerID == "" {
		h.writeError(w, http.StatusFailedDependency,
			"REST API not yet provisioned for this instance")
		return
	}

	var upstreamHost string
	switch instance.Type {
	case models.InstanceTypePostgres:
		upstreamHost = k8s.PostgRESTUpstream(project.ID, instance.Name)
	case models.InstanceTypeMySQL:
		upstreamHost = k8s.MySQLRESTUpstream(project.ID, instance.Name)
	default:
		h.writeError(w, http.StatusBadRequest, "instance type does not support REST")
		return
	}
	upstream, _ := url.Parse("http://" + upstreamHost)

	slug := chi.URLParam(r, "slug")
	stage := chi.URLParam(r, "stage")
	db := chi.URLParam(r, "db")
	prefix := fmt.Sprintf("/v1/%s/%s/db/%s/rest", slug, stage, db)

	proxy := httputil.NewSingleHostReverseProxy(upstream)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		req.URL.Path = strings.TrimPrefix(r.URL.Path, prefix)
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.URL.RawPath = ""
		req.URL.RawQuery = r.URL.RawQuery

		req.Header.Del("X-MassiCloud-Key")
		req.Header.Del("apikey")

		if req.Header.Get("Authorization") == "" {
			var synthetic string
			var synthErr error
			switch apiKey.Type {
			case models.APIKeyService:
				synthetic, synthErr = issueRoleJWT(project, "service_role")
			default:
				synthetic, synthErr = issueRoleJWT(project, "anon")
			}
			if synthErr == nil {
				req.Header.Set("Authorization", "Bearer "+synthetic)
			}
		}

		req.Host = upstream.Host
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Server")
		return nil
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		h.logger.Error("rest proxy error",
			slog.String("project", project.ID),
			slog.String("instance", instance.ID),
			slog.Any("error", err))
		h.writeError(w, http.StatusBadGateway, "REST upstream unavailable")
	}

	proxy.ServeHTTP(w, r)
}

func issueRoleJWT(project models.Project, role string) (string, error) {
	claims := jwt.MapClaims{
		"role": role,
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(10 * time.Minute).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(project.JWTSigningSecret))
}
