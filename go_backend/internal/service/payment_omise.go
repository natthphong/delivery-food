package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type OmiseGateway struct {
	client  *http.Client
	baseURL string
	secret  string
	public  string
}

func NewOmiseGateway(client *http.Client, cfg config.Config) *OmiseGateway {
	return &OmiseGateway{
		client:  client,
		baseURL: "https://api.omise.co",
		secret:  strings.TrimSpace(cfg.OmiseSecretKey),
		public:  strings.TrimSpace(cfg.OmisePublicKey),
	}
}

func (g *OmiseGateway) Code() string {
	return "OMISE"
}

func (g *OmiseGateway) CreateCheckout(ctx context.Context, provider model.PaymentProvider, method model.PaymentMethod, request GatewayCheckoutRequest) (GatewayCheckoutResult, error) {
	if g.secret == "" {
		return GatewayCheckoutResult{}, apperror.Conflict("Omise is not configured")
	}
	amountSatang := int64(request.Amount * 100)
	if amountSatang <= 0 {
		return GatewayCheckoutResult{}, apperror.BadRequest("gateway payment amount must be positive")
	}

	sourceBody, err := g.postForm(ctx, "/sources", url.Values{
		"amount":   {fmt.Sprintf("%d", amountSatang)},
		"currency": {"thb"},
		"type":     {resolveOmiseMethodType(method)},
	})
	if err != nil {
		return GatewayCheckoutResult{}, err
	}

	sourceID, ok := pickString(sourceBody, "id")
	if !ok || sourceID == "" {
		return GatewayCheckoutResult{}, apperror.Internal("Omise source response did not include an id", nil)
	}
	qrImageURL, _ := pickNestedString(sourceBody, "scannable_code", "image", "download_uri")
	if qrImageURL == "" {
		qrImageURL, _ = pickNestedString(sourceBody, "scannable_code", "download_uri")
	}

	chargeBody, err := g.postForm(ctx, "/charges", url.Values{
		"amount":      {fmt.Sprintf("%d", amountSatang)},
		"currency":    {"thb"},
		"source":      {sourceID},
		"description": {strings.TrimSpace(request.Description)},
	})
	if err != nil {
		return GatewayCheckoutResult{}, err
	}

	chargeID, ok := pickString(chargeBody, "id")
	if !ok || chargeID == "" {
		return GatewayCheckoutResult{}, apperror.Internal("Omise charge response did not include an id", nil)
	}
	chargeStatus, _ := pickString(chargeBody, "status")
	authorizeURI, _ := pickString(chargeBody, "authorize_uri")

	action := map[string]any{
		"type":              "gateway_qr",
		"provider":          g.Code(),
		"providerName":      provider.Name,
		"publicKey":         g.public,
		"checkoutFlow":      method.CheckoutFlow,
		"amount":            request.Amount,
		"currency":          "THB",
		"sourceId":          sourceID,
		"chargeId":          chargeID,
		"providerStatus":    chargeStatus,
		"branchName":        request.BranchName,
		"qrImageUrl":        qrImageURL,
		"authorizeUri":      authorizeURI,
		"paymentMethodCode": method.ProviderMethodCode,
	}
	return GatewayCheckoutResult{
		ProviderReference: chargeID,
		ProviderStatus:    defaultString(chargeStatus, "pending"),
		PaymentAction:     action,
	}, nil
}

func (g *OmiseGateway) ParseWebhook(ctx context.Context, provider model.PaymentProvider, headers http.Header, body []byte) (GatewayWebhookResult, error) {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return GatewayWebhookResult{}, apperror.BadRequest("invalid Omise webhook payload")
	}

	eventID, _ := pickString(payload, "id")
	if eventID != "" && g.secret != "" {
		eventBody, err := g.getJSON(ctx, "/events/"+eventID)
		if err == nil {
			payload = eventBody
		}
	}

	data := mapValue(payload, "data")
	eventType, _ := pickString(payload, "key")
	if eventType == "" {
		eventType, _ = pickString(data, "status")
	}
	reference, _ := pickString(data, "id")
	providerStatus, _ := pickString(data, "status")
	paidAt, _ := parseTimeField(data, "paid_at")
	failureCode, _ := pickString(data, "failure_code")
	failureMessage, _ := pickString(data, "failure_message")
	failedReason := combineFailureReason(failureCode, failureMessage)

	status := "pending"
	switch {
	case strings.Contains(eventType, "successful") || providerStatus == "successful":
		status = "accepted"
	case strings.Contains(eventType, "failed") || providerStatus == "failed":
		status = "rejected"
	}

	return GatewayWebhookResult{
		EventID:           optionalString(eventID),
		EventType:         defaultString(eventType, "omise.unknown"),
		ProviderCode:      g.Code(),
		ProviderReference: reference,
		ProviderStatus:    defaultString(providerStatus, "pending"),
		Status:            status,
		PaidAt:            paidAt,
		FailedReason:      failedReason,
		Payload:           payload,
	}, nil
}

func (g *OmiseGateway) postForm(ctx context.Context, path string, form url.Values) (map[string]any, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+path, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, apperror.Internal("failed to build Omise request", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.SetBasicAuth(g.secret, "")
	response, err := g.client.Do(request)
	if err != nil {
		return nil, apperror.Internal("failed to call Omise", err)
	}
	defer response.Body.Close()
	return decodeGatewayJSON(response)
}

func (g *OmiseGateway) getJSON(ctx context.Context, path string) (map[string]any, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, g.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	request.SetBasicAuth(g.secret, "")
	response, err := g.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	return decodeGatewayJSON(response)
}

func decodeGatewayJSON(response *http.Response) (map[string]any, error) {
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, apperror.Internal("failed to read payment provider response", err)
	}
	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, apperror.Internal("failed to decode payment provider response", err)
	}
	if response.StatusCode >= 400 {
		message, _ := pickString(body, "message")
		if message == "" {
			message = fmt.Sprintf("payment provider returned status %d", response.StatusCode)
		}
		return nil, apperror.Conflict(message)
	}
	return body, nil
}

func resolveOmiseMethodType(method model.PaymentMethod) string {
	if method.ProviderMethodCode != nil && strings.TrimSpace(*method.ProviderMethodCode) != "" {
		return strings.TrimSpace(*method.ProviderMethodCode)
	}
	return "promptpay"
}

func mapValue(source map[string]any, key string) map[string]any {
	value, ok := source[key]
	if !ok {
		return map[string]any{}
	}
	result, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return result
}

func pickString(source map[string]any, key string) (string, bool) {
	value, ok := source[key]
	if !ok || value == nil {
		return "", false
	}
	switch typed := value.(type) {
	case string:
		return typed, true
	case fmt.Stringer:
		return typed.String(), true
	default:
		return fmt.Sprintf("%v", typed), true
	}
}

func pickNestedString(source map[string]any, keys ...string) (string, bool) {
	current := source
	for index, key := range keys {
		value, ok := current[key]
		if !ok {
			return "", false
		}
		if index == len(keys)-1 {
			switch typed := value.(type) {
			case string:
				return typed, true
			default:
				return fmt.Sprintf("%v", typed), true
			}
		}
		next, ok := value.(map[string]any)
		if !ok {
			return "", false
		}
		current = next
	}
	return "", false
}

func parseTimeField(source map[string]any, key string) (*time.Time, bool) {
	value, ok := pickString(source, key)
	if !ok || strings.TrimSpace(value) == "" {
		return nil, false
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, false
	}
	return &parsed, true
}

func combineFailureReason(code string, message string) *string {
	code = strings.TrimSpace(code)
	message = strings.TrimSpace(message)
	switch {
	case code != "" && message != "":
		value := code + ": " + message
		return &value
	case code != "":
		return &code
	case message != "":
		return &message
	default:
		return nil
	}
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
