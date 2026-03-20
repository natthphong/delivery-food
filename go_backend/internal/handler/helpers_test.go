package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
)

func TestParseHelpers(t *testing.T) {
	value, err := parseQueryInt64("42")
	if err != nil || value == nil || *value != 42 {
		t.Fatalf("parseQueryInt64() = %v, %v, want 42 and nil error", value, err)
	}

	floatValue, err := parseQueryFloat64("13.75")
	if err != nil || floatValue == nil || *floatValue != 13.75 {
		t.Fatalf("parseQueryFloat64() = %v, %v, want 13.75 and nil error", floatValue, err)
	}

	pathID, err := parsePathID("7")
	if err != nil || pathID != 7 {
		t.Fatalf("parsePathID() = %d, %v, want 7 and nil error", pathID, err)
	}
}

func TestParseHelpersRejectInvalidNumericInput(t *testing.T) {
	if _, err := parseQueryInt64("bad"); err == nil {
		t.Fatal("parseQueryInt64() error = nil, want error")
	}

	if _, err := parseQueryFloat64("bad"); err == nil {
		t.Fatal("parseQueryFloat64() error = nil, want error")
	}

	_, err := parsePathID("0")
	appErr, ok := apperror.As(err)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Code != "BAD_REQUEST" {
		t.Fatalf("appErr.Code = %q, want BAD_REQUEST", appErr.Code)
	}
}

func TestClientIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/catalog/search", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
	if got := clientIP(req); got != "203.0.113.10" {
		t.Fatalf("clientIP(X-Forwarded-For) = %q, want 203.0.113.10", got)
	}

	req = httptest.NewRequest("GET", "/v1/catalog/search", nil)
	req.Header.Set("X-Real-IP", "198.51.100.2")
	if got := clientIP(req); got != "198.51.100.2" {
		t.Fatalf("clientIP(X-Real-IP) = %q, want 198.51.100.2", got)
	}
}
