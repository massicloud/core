// Package auth verifies the short-lived role JWT that MassiCloud's REST
// proxy synthesizes per request — the same mechanism already used for
// PostgREST (see api/internal/handlers/rest_proxy.go issueRoleJWT). The
// proxy is the only thing that ever calls this service directly; it already
// authenticated the caller's X-MassiCloud-Key (bcrypt-hashed on the
// platform, never recoverable) before minting this token, so mysql-rest
// only needs to trust the JWT signature and read the role claim.
package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const roleContextKey ctxKey = "mysql_rest_role"

const (
	RoleAnon    = "anon"
	RoleService = "service_role"
)

// Middleware verifies the Authorization: Bearer <jwt> header and stores the
// resolved role ("anon" or "service_role") on the request context.
func Middleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
				return
			}
			raw := strings.TrimPrefix(header, "Bearer ")

			claims := jwt.MapClaims{}
			_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method")
				}
				return secret, nil
			})
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			role, _ := claims["role"].(string)
			if role != RoleAnon && role != RoleService {
				http.Error(w, `{"error":"invalid role claim"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), roleContextKey, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RoleFromContext returns the role resolved by Middleware ("" if absent).
func RoleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(roleContextKey).(string)
	return role
}
