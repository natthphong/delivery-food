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
		if claims.SessionType != "" && claims.SessionType != "customer" {
			httpapi.WriteError(w, apperror.Forbidden("customer session required"))
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), claimsContextKey, claims)))
	}
}

func RequireAdminAuth(tokenManager *backendauth.TokenManager, next http.HandlerFunc) http.HandlerFunc {
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
		if claims.SessionType != "admin" {
			httpapi.WriteError(w, apperror.Forbidden("admin session required"))
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), claimsContextKey, claims)))
	}
}

func RequireAdminPermissions(tokenManager *backendauth.TokenManager, permissions []string, next http.HandlerFunc) http.HandlerFunc {
	return RequireAdminAuth(tokenManager, func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			httpapi.WriteError(w, apperror.Unauthorized("missing admin session"))
			return
		}
		for _, permission := range permissions {
			if HasPermission(claims, permission) {
				next(w, r)
				return
			}
		}
		httpapi.WriteError(w, apperror.Forbidden("permission denied"))
	})
}

func ClaimsFromContext(ctx context.Context) (*backendauth.AccessClaims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*backendauth.AccessClaims)
	return claims, ok
}

func HasRole(claims *backendauth.AccessClaims, role string) bool {
	if claims == nil {
		return false
	}
	for _, current := range claims.Roles {
		if current == role {
			return true
		}
	}
	return false
}

func HasPermission(claims *backendauth.AccessClaims, permission string) bool {
	if claims == nil {
		return false
	}
	for _, current := range claims.Permissions {
		if current == permission {
			return true
		}
	}
	return false
}

func BranchAllowed(claims *backendauth.AccessClaims, branchID int64) bool {
	if claims == nil {
		return false
	}
	if HasRole(claims, "owner") || HasRole(claims, "manager") {
		return true
	}
	for _, allowedID := range claims.BranchIDs {
		if allowedID == branchID {
			return true
		}
	}
	return false
}
