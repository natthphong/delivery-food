package authjwt

import (
	"testing"
	"time"
)

func TestGenerateAndParse(t *testing.T) {
	secret := "test-secret"
	token, err := Generate(secret, "u1", "u1@example.com", "User One", time.Minute)
	if err != nil {
		t.Fatalf("generate error: %v", err)
	}
	claims, err := Parse(secret, token)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if claims.UserID != "u1" || claims.Email != "u1@example.com" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}
