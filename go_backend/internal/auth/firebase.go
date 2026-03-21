package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type IdentityVerifier interface {
	VerifyFirebaseIDToken(ctx context.Context, idToken string) (model.IdentityClaims, error)
}

type FirebaseLookupVerifier struct {
	apiKey string
	client *http.Client
}

func NewFirebaseLookupVerifier(apiKey string, timeout time.Duration) *FirebaseLookupVerifier {
	return &FirebaseLookupVerifier{
		apiKey: apiKey,
		client: &http.Client{Timeout: timeout},
	}
}

type firebaseLookupRequest struct {
	IDToken string `json:"idToken"`
}

type firebaseLookupResponse struct {
	Users []struct {
		LocalID       string `json:"localId"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"emailVerified"`
		PhoneNumber   string `json:"phoneNumber"`
		DisplayName   string `json:"displayName"`
		ProviderUserInfo []struct {
			ProviderID string `json:"providerId"`
		} `json:"providerUserInfo"`
	} `json:"users"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (v *FirebaseLookupVerifier) VerifyFirebaseIDToken(ctx context.Context, idToken string) (model.IdentityClaims, error) {
	if strings.TrimSpace(idToken) == "" {
		return model.IdentityClaims{}, apperror.BadRequest("idToken is required")
	}
	if strings.TrimSpace(v.apiKey) == "" {
		return model.IdentityClaims{}, apperror.Internal("firebase api key is not configured", nil)
	}

	body, err := json.Marshal(firebaseLookupRequest{IDToken: idToken})
	if err != nil {
		return model.IdentityClaims{}, apperror.Internal("failed to encode firebase lookup request", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=%s", v.apiKey),
		bytes.NewReader(body),
	)
	if err != nil {
		return model.IdentityClaims{}, apperror.Internal("failed to create firebase lookup request", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := v.client.Do(request)
	if err != nil {
		return model.IdentityClaims{}, apperror.Unauthorized("unable to validate firebase session")
	}
	defer response.Body.Close()

	var payload firebaseLookupResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return model.IdentityClaims{}, apperror.Unauthorized("unable to decode firebase session")
	}

	if response.StatusCode >= http.StatusBadRequest || payload.Error != nil {
		message := "unable to validate firebase session"
		if payload.Error != nil && payload.Error.Message != "" {
			message = payload.Error.Message
		}
		return model.IdentityClaims{}, apperror.Unauthorized(message)
	}
	if len(payload.Users) == 0 || strings.TrimSpace(payload.Users[0].LocalID) == "" {
		return model.IdentityClaims{}, apperror.Unauthorized("firebase user was not found")
	}

	user := payload.Users[0]
	claims := model.IdentityClaims{
		AuthSubject:     user.LocalID,
		ProviderLabel:   resolveProviderLabel(user.ProviderUserInfo),
		IsEmailVerified: user.EmailVerified,
		IsPhoneVerified: strings.TrimSpace(user.PhoneNumber) != "",
	}
	if strings.TrimSpace(user.Email) != "" {
		value := strings.TrimSpace(user.Email)
		claims.Email = &value
	}
	if strings.TrimSpace(user.PhoneNumber) != "" {
		value := strings.TrimSpace(user.PhoneNumber)
		claims.Phone = &value
	}
	if strings.TrimSpace(user.DisplayName) != "" {
		value := strings.TrimSpace(user.DisplayName)
		claims.DisplayName = &value
	}

	return claims, nil
}

func resolveProviderLabel(providers []struct{ ProviderID string `json:"providerId"` }) string {
	for _, provider := range providers {
		if strings.TrimSpace(provider.ProviderID) != "" {
			return provider.ProviderID
		}
	}
	return "firebase"
}
