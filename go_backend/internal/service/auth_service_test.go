package service

import (
	"testing"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
)

func TestClaimsFromLineProfile(t *testing.T) {
	displayName := "  LINE User  "
	email := "  line@example.com  "

	claims, err := claimsFromLineProfile(&dto.LineProfileDTO{
		UserID:      "  line-123  ",
		DisplayName: &displayName,
		Email:       &email,
	})
	if err != nil {
		t.Fatalf("claimsFromLineProfile() error = %v", err)
	}

	if claims.AuthSubject != "line-123" {
		t.Fatalf("claims.AuthSubject = %q, want line-123", claims.AuthSubject)
	}
	if claims.ProviderLabel != "liff" {
		t.Fatalf("claims.ProviderLabel = %q, want liff", claims.ProviderLabel)
	}
	if claims.DisplayName == nil || *claims.DisplayName != "LINE User" {
		t.Fatalf("claims.DisplayName = %v, want trimmed display name", claims.DisplayName)
	}
	if claims.Email == nil || *claims.Email != "line@example.com" {
		t.Fatalf("claims.Email = %v, want trimmed email", claims.Email)
	}
}

func TestClaimsFromLineProfileRequiresUserID(t *testing.T) {
	_, err := claimsFromLineProfile(&dto.LineProfileDTO{})
	appErr, ok := apperror.As(err)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Code != "BAD_REQUEST" {
		t.Fatalf("appErr.Code = %q, want BAD_REQUEST", appErr.Code)
	}
}
