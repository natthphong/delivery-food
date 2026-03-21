package service

import (
	"context"
	"net/http"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type GatewayCheckoutRequest struct {
	TransactionID int64
	Amount        float64
	Currency      string
	BranchName    string
	Description   string
}

type GatewayCheckoutResult struct {
	ProviderReference       string
	ProviderSourceReference *string
	ProviderStatus          string
	ProviderFailureCode     *string
	ProviderFailureMessage  *string
	PaymentAction           map[string]any
	ExpiresAt               *time.Time
	PaidAt                  *time.Time
}

type GatewayWebhookResult struct {
	EventID                 *string
	EventType               string
	ProviderCode            string
	ProviderReference       string
	ProviderStatus          string
	ProviderSourceReference *string
	ProviderFailureCode     *string
	ProviderFailureMessage  *string
	Status                  string
	PaidAt                  *time.Time
	ExpiresAt               *time.Time
	PaymentAction           map[string]any
	FailedReason            *string
	Payload                 map[string]any
}

type GatewayStatusResult = GatewayWebhookResult

type PaymentGateway interface {
	Code() string
	CreateCheckout(ctx context.Context, provider model.PaymentProvider, method model.PaymentMethod, request GatewayCheckoutRequest) (GatewayCheckoutResult, error)
	ParseWebhook(ctx context.Context, provider model.PaymentProvider, headers http.Header, body []byte) (GatewayWebhookResult, error)
	FetchStatus(ctx context.Context, provider model.PaymentProvider, reference string) (GatewayStatusResult, error)
}
