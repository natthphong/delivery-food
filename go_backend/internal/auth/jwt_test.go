package auth

import (
	"testing"
	"time"
)

func TestTokenManagerSignAndParseAccessToken(t *testing.T) {
	manager := NewTokenManager("test-secret")

	token, err := manager.SignAccessToken(42, "firebase", "firebase-uid", 15*time.Minute)
	if err != nil {
		t.Fatalf("SignAccessToken() error = %v", err)
	}

	claims, err := manager.ParseAccessToken(token)
	if err != nil {
		t.Fatalf("ParseAccessToken() error = %v", err)
	}

	if claims.UserID != 42 {
		t.Fatalf("claims.UserID = %d, want 42", claims.UserID)
	}
	if claims.AuthProvider != "firebase" {
		t.Fatalf("claims.AuthProvider = %q, want firebase", claims.AuthProvider)
	}
	if claims.AuthSubject != "firebase-uid" {
		t.Fatalf("claims.AuthSubject = %q, want firebase-uid", claims.AuthSubject)
	}
	if claims.ExpiresAt == nil || !claims.ExpiresAt.After(time.Now()) {
		t.Fatalf("claims.ExpiresAt = %v, want future timestamp", claims.ExpiresAt)
	}
}

func TestRefreshTokenHelpers(t *testing.T) {
	plain, hash, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error = %v", err)
	}

	if plain == "" {
		t.Fatal("plain refresh token is empty")
	}
	if hash == "" {
		t.Fatal("refresh token hash is empty")
	}
	if got := HashRefreshToken(plain); got != hash {
		t.Fatalf("HashRefreshToken() = %q, want %q", got, hash)
	}
}
