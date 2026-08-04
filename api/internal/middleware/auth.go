package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/mikaminou/massicloud/api/internal/auth"
	"github.com/mikaminou/massicloud/api/internal/models"
)

type contextKey string

const UserClaimsKey contextKey = "user_claims"

func Authenticate(authSvc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}

			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"invalid authorization header"}`))
				return
			}

			claims, err := authSvc.ValidateToken(parts[1])
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"invalid or expired token"}`))
				return
			}

			ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetClaims(r *http.Request) (*models.Claims, bool) {
	claims, ok := r.Context().Value(UserClaimsKey).(*models.Claims)
	return claims, ok
}
