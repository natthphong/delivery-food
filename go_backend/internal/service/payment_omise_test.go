package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestOmiseGatewayCreateCheckout(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			var payload map[string]any
			switch request.URL.Path {
			case "/sources":
				payload = map[string]any{
					"id": "src_test",
					"scannable_code": map[string]any{
						"image": map[string]any{
							"download_uri": "https://example.com/qr.png",
						},
					},
				}
			case "/charges":
				payload = map[string]any{
					"id":            "chrg_test",
					"status":        "pending",
					"authorize_uri": "https://omise.test/authorize",
				}
			default:
				return &http.Response{
					StatusCode: http.StatusNotFound,
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader(`{"message":"not found"}`)),
				}, nil
			}
			body, err := json.Marshal(payload)
			if err != nil {
				return nil, err
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(body))),
			}, nil
		}),
	}

	gateway := NewOmiseGateway(client, config.Config{
		OmiseSecretKey: "secret",
		OmisePublicKey: "public",
	})
	gateway.baseURL = "https://omise.test"

	providerMethodCode := "promptpay"
	result, err := gateway.CreateCheckout(context.Background(), model.PaymentProvider{
		Code: "OMISE",
		Name: "Omise",
	}, model.PaymentMethod{
		MethodType:         "gateway",
		ProviderMethodCode: &providerMethodCode,
		CheckoutFlow:       "qr_display",
	}, GatewayCheckoutRequest{
		TransactionID: 1,
		Amount:        149.50,
		Currency:      "THB",
		BranchName:    "Siam",
		Description:   "Order payment",
	})
	if err != nil {
		t.Fatalf("CreateCheckout() error = %v", err)
	}
	if result.ProviderReference != "chrg_test" {
		t.Fatalf("ProviderReference = %q, want chrg_test", result.ProviderReference)
	}
	if result.ProviderStatus != "pending" {
		t.Fatalf("ProviderStatus = %q, want pending", result.ProviderStatus)
	}
	if got := result.PaymentAction["qrImageUrl"]; got != "https://example.com/qr.png" {
		t.Fatalf("PaymentAction[qrImageUrl] = %v, want QR image url", got)
	}
	if got := result.PaymentAction["authorizeUri"]; got != "https://omise.test/authorize" {
		t.Fatalf("PaymentAction[authorizeUri] = %v, want authorize URI", got)
	}
}

func TestOmiseGatewayParseWebhook(t *testing.T) {
	gateway := NewOmiseGateway(http.DefaultClient, config.Config{})
	body := []byte(`{
		"id":"evt_test",
		"key":"charge.complete",
		"data":{
			"id":"chrg_live",
			"status":"successful",
			"paid_at":"2026-03-20T08:45:00Z"
		}
	}`)

	result, err := gateway.ParseWebhook(context.Background(), model.PaymentProvider{Code: "OMISE"}, http.Header{}, body)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if result.Status != "accepted" {
		t.Fatalf("Status = %q, want accepted", result.Status)
	}
	if result.ProviderReference != "chrg_live" {
		t.Fatalf("ProviderReference = %q, want chrg_live", result.ProviderReference)
	}
	if result.PaidAt == nil {
		t.Fatal("PaidAt = nil, want parsed timestamp")
	}
}

func TestOmiseGatewayParseWebhookFailure(t *testing.T) {
	gateway := NewOmiseGateway(http.DefaultClient, config.Config{})
	body := []byte(`{
		"id":"evt_test_failed",
		"key":"charge.failed",
		"data":{
			"id":"chrg_fail",
			"status":"failed",
			"failure_code":"invalid_card",
			"failure_message":"Card was declined"
		}
	}`)

	result, err := gateway.ParseWebhook(context.Background(), model.PaymentProvider{Code: "OMISE"}, http.Header{}, body)
	if err != nil {
		t.Fatalf("ParseWebhook() error = %v", err)
	}
	if result.Status != "rejected" {
		t.Fatalf("Status = %q, want rejected", result.Status)
	}
	if result.FailedReason == nil || *result.FailedReason != "invalid_card: Card was declined" {
		t.Fatalf("FailedReason = %v, want combined failure reason", result.FailedReason)
	}
}

func TestOmiseGatewayFetchStatusMapsExpiredPendingCharge(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			payload := map[string]any{
				"id":         "chrg_expired",
				"status":     "pending",
				"paid":       false,
				"authorized": false,
				"expires_at": "2026-03-21T08:00:00Z",
				"source": map[string]any{
					"id":            "src_promptpay",
					"charge_status": "pending",
					"scannable_code": map[string]any{
						"image": map[string]any{
							"download_uri": "https://example.com/expired-qr.png",
						},
					},
				},
			}
			body, err := json.Marshal(payload)
			if err != nil {
				return nil, err
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(body))),
			}, nil
		}),
	}

	gateway := NewOmiseGateway(client, config.Config{OmiseSecretKey: "secret"})
	gateway.baseURL = "https://omise.test"

	result, err := gateway.FetchStatus(context.Background(), model.PaymentProvider{
		Code: "OMISE",
		Name: "Omise",
	}, "chrg_expired")
	if err != nil {
		t.Fatalf("FetchStatus() error = %v", err)
	}
	if result.Status != "expired" {
		t.Fatalf("Status = %q, want expired", result.Status)
	}
	if result.ExpiresAt == nil {
		t.Fatal("ExpiresAt = nil, want parsed timestamp")
	}
	if got := result.PaymentAction["qrImageUrl"]; got != "https://example.com/expired-qr.png" {
		t.Fatalf("PaymentAction[qrImageUrl] = %v, want QR image url", got)
	}
}
