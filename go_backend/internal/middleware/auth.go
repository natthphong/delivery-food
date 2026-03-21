package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/httpapi"
)

type contextKey string

const claimsContextKey contextKey = "auth_claims"

func RequireAuth(tokenManager *backendauth.TokenManager, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
			httpapi.WriteError(w, apperror.Unauthorized("missing bearer token"))
			return
		}
		token := strings.TrimSpace(header[7:])
		if token == "" {
			httpapi.WriteError(w, apperror.Unauthorized("missing bearer token"))
			return
		}
		claims, err := tokenManager.ParseAccessToken(token)
		if err != nil {
			httpapi.WriteError(w, apperror.Unauthorized("invalid access token"))
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), claimsContextKey, claims)))
	}
}

func ClaimsFromContext(ctx context.Context) (*backendauth.AccessClaims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*backendauth.AccessClaims)
	return claims, ok
}
