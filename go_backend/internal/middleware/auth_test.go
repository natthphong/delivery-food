package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
)

func TestRequireAuthRejectsMissingBearerToken(t *testing.T) {
	manager := backendauth.NewTokenManager("test-secret")

	req := httptest.NewRequest(http.MethodGet, "/v1/cart", nil)
	rec := httptest.NewRecorder()

	RequireAuth(manager, func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next handler should not be called without a bearer token")
	})(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuthPassesClaimsToContext(t *testing.T) {
	manager := backendauth.NewTokenManager("test-secret")
	token, err := manager.SignAccessToken(7, "line", "line-user", 15*time.Minute)
	if err != nil {
		t.Fatalf("SignAccessToken() error = %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/cart", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	RequireAuth(manager, func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			t.Fatal("ClaimsFromContext() returned ok=false")
		}
		if claims.UserID != 7 {
			t.Fatalf("claims.UserID = %d, want 7", claims.UserID)
		}
		w.WriteHeader(http.StatusNoContent)
	})(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}
