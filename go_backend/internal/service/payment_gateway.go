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
	ProviderReference string
	ProviderStatus    string
	PaymentAction     map[string]any
}

type GatewayWebhookResult struct {
	EventID          *string
	EventType        string
	ProviderCode     string
	ProviderReference string
	ProviderStatus   string
	Status           string
	PaidAt           *time.Time
	FailedReason     *string
	Payload          map[string]any
}

type PaymentGateway interface {
	Code() string
	CreateCheckout(ctx context.Context, provider model.PaymentProvider, method model.PaymentMethod, request GatewayCheckoutRequest) (GatewayCheckoutResult, error)
	ParseWebhook(ctx context.Context, provider model.PaymentProvider, headers http.Header, body []byte) (GatewayWebhookResult, error)
}
