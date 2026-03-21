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
	mapped := mapOmiseCharge(sourceBody, chargeBody)
	sourceReference := sourceID

	action := map[string]any{
		"type":               "gateway_qr",
		"provider":           g.Code(),
		"providerName":       provider.Name,
		"publicKey":          g.public,
		"checkoutFlow":       method.CheckoutFlow,
		"amount":             request.Amount,
		"currency":           "THB",
		"sourceId":           sourceID,
		"chargeId":           chargeID,
		"providerStatus":     mapped.ProviderStatus,
		"branchName":         request.BranchName,
		"qrImageUrl":         mapped.QRImageURL,
		"authorizeUri":       mapped.AuthorizeURI,
		"paymentMethodCode":  method.ProviderMethodCode,
		"sourceChargeStatus": mapped.SourceChargeStatus,
		"status":             mapped.ProviderStatus,
		"paid":               mapped.Paid,
		"authorized":         mapped.Authorized,
	}
	if mapped.PaidAt != nil {
		action["paidAt"] = mapped.PaidAt.Format(time.RFC3339)
	}
	if mapped.ExpiresAt != nil {
		action["expiresAt"] = mapped.ExpiresAt.Format(time.RFC3339)
	}
	if mapped.FailureCode != nil {
		action["failureCode"] = *mapped.FailureCode
	}
	if mapped.FailureMessage != nil {
		action["failureMessage"] = *mapped.FailureMessage
	}
	return GatewayCheckoutResult{
		ProviderReference:       chargeID,
		ProviderSourceReference: &sourceReference,
		ProviderStatus:          mapped.ProviderStatus,
		ProviderFailureCode:     mapped.FailureCode,
		ProviderFailureMessage:  mapped.FailureMessage,
		PaymentAction:           action,
		ExpiresAt:               mapped.ExpiresAt,
		PaidAt:                  mapped.PaidAt,
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
	mapped := mapOmiseCharge(nil, data)
	failedReason := combineFailureReason(stringValue(mapped.FailureCode), stringValue(mapped.FailureMessage))
	status := normalizeGatewayStatus(mapped.ProviderStatus, mapped.Paid, mapped.Authorized, mapped.ExpiresAt)
	sourceReference := optionalString(mapped.SourceReference)

	return GatewayWebhookResult{
		EventID:                 optionalString(eventID),
		EventType:               defaultString(eventType, "omise.unknown"),
		ProviderCode:            g.Code(),
		ProviderReference:       mapped.Reference,
		ProviderStatus:          mapped.ProviderStatus,
		ProviderSourceReference: sourceReference,
		ProviderFailureCode:     mapped.FailureCode,
		ProviderFailureMessage:  mapped.FailureMessage,
		Status:                  status,
		PaidAt:                  mapped.PaidAt,
		ExpiresAt:               mapped.ExpiresAt,
		PaymentAction:           mapped.PaymentAction(),
		FailedReason:            failedReason,
		Payload:                 payload,
	}, nil
}

func (g *OmiseGateway) FetchStatus(ctx context.Context, provider model.PaymentProvider, reference string) (GatewayStatusResult, error) {
	body, err := g.getJSON(ctx, "/charges/"+strings.TrimSpace(reference))
	if err != nil {
		return GatewayStatusResult{}, err
	}
	mapped := mapOmiseCharge(nil, body)
	return GatewayStatusResult{
		EventType:               "charge.status",
		ProviderCode:            g.Code(),
		ProviderReference:       mapped.Reference,
		ProviderStatus:          mapped.ProviderStatus,
		ProviderSourceReference: optionalString(mapped.SourceReference),
		ProviderFailureCode:     mapped.FailureCode,
		ProviderFailureMessage:  mapped.FailureMessage,
		Status:                  normalizeGatewayStatus(mapped.ProviderStatus, mapped.Paid, mapped.Authorized, mapped.ExpiresAt),
		PaidAt:                  mapped.PaidAt,
		ExpiresAt:               mapped.ExpiresAt,
		PaymentAction:           mapped.PaymentAction(),
		FailedReason:            combineFailureReason(stringValue(mapped.FailureCode), stringValue(mapped.FailureMessage)),
		Payload:                 body,
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

func pickBool(source map[string]any, key string) (bool, bool) {
	value, ok := source[key]
	if !ok || value == nil {
		return false, false
	}
	switch typed := value.(type) {
	case bool:
		return typed, true
	case string:
		switch strings.ToLower(strings.TrimSpace(typed)) {
		case "true", "1", "yes":
			return true, true
		case "false", "0", "no":
			return false, true
		}
	}
	return false, false
}

type omiseChargeMapping struct {
	Reference          string
	SourceReference    string
	ProviderStatus     string
	SourceChargeStatus string
	QRImageURL         string
	AuthorizeURI       string
	FailureCode        *string
	FailureMessage     *string
	ExpiresAt          *time.Time
	PaidAt             *time.Time
	Paid               bool
	Authorized         bool
}

func (m omiseChargeMapping) PaymentAction() map[string]any {
	action := map[string]any{
		"type":               "gateway_qr",
		"provider":           "OMISE",
		"providerStatus":     m.ProviderStatus,
		"sourceChargeStatus": m.SourceChargeStatus,
		"qrImageUrl":         m.QRImageURL,
		"authorizeUri":       m.AuthorizeURI,
		"sourceId":           m.SourceReference,
		"chargeId":           m.Reference,
		"paid":               m.Paid,
		"authorized":         m.Authorized,
	}
	if m.ExpiresAt != nil {
		action["expiresAt"] = m.ExpiresAt.Format(time.RFC3339)
	}
	if m.PaidAt != nil {
		action["paidAt"] = m.PaidAt.Format(time.RFC3339)
	}
	if m.FailureCode != nil {
		action["failureCode"] = *m.FailureCode
	}
	if m.FailureMessage != nil {
		action["failureMessage"] = *m.FailureMessage
	}
	return action
}

func mapOmiseCharge(sourceBody map[string]any, chargeBody map[string]any) omiseChargeMapping {
	source := sourceBody
	if len(source) == 0 {
		source = mapValue(chargeBody, "source")
	}
	reference, _ := pickString(chargeBody, "id")
	sourceReference, _ := pickString(source, "id")
	providerStatus, _ := pickString(chargeBody, "status")
	sourceChargeStatus, _ := pickString(source, "charge_status")
	qrImageURL, _ := pickNestedString(chargeBody, "source", "scannable_code", "image", "download_uri")
	if qrImageURL == "" {
		qrImageURL, _ = pickNestedString(chargeBody, "source", "scannable_code", "download_uri")
	}
	if qrImageURL == "" {
		qrImageURL, _ = pickNestedString(source, "scannable_code", "image", "download_uri")
	}
	if qrImageURL == "" {
		qrImageURL, _ = pickNestedString(source, "scannable_code", "download_uri")
	}
	authorizeURI, _ := pickString(chargeBody, "authorize_uri")
	paidAt, _ := parseTimeField(chargeBody, "paid_at")
	expiresAt, ok := parseTimeField(chargeBody, "expires_at")
	if !ok {
		expiresAt, _ = parseTimeField(source, "expires_at")
	}
	paid, _ := pickBool(chargeBody, "paid")
	authorized, _ := pickBool(chargeBody, "authorized")
	failureCode := optionalString(pickStringValue(chargeBody, "failure_code"))
	failureMessage := optionalString(pickStringValue(chargeBody, "failure_message"))
	if providerStatus == "" {
		providerStatus = defaultString(sourceChargeStatus, "pending")
	}
	return omiseChargeMapping{
		Reference:          reference,
		SourceReference:    sourceReference,
		ProviderStatus:     providerStatus,
		SourceChargeStatus: defaultString(sourceChargeStatus, providerStatus),
		QRImageURL:         qrImageURL,
		AuthorizeURI:       authorizeURI,
		FailureCode:        failureCode,
		FailureMessage:     failureMessage,
		ExpiresAt:          expiresAt,
		PaidAt:             paidAt,
		Paid:               paid,
		Authorized:         authorized,
	}
}

func pickStringValue(source map[string]any, key string) string {
	value, _ := pickString(source, key)
	return value
}

func normalizeGatewayStatus(providerStatus string, paid bool, authorized bool, expiresAt *time.Time) string {
	status := strings.ToLower(strings.TrimSpace(providerStatus))
	switch {
	case paid || authorized || status == "successful":
		return "accepted"
	case status == "failed" || status == "canceled" || status == "cancelled":
		return "rejected"
	case expiresAt != nil && expiresAt.Before(time.Now()):
		return "expired"
	default:
		return "pending"
	}
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
