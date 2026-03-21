package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

type TokenManager struct {
	secret []byte
}

type AccessClaims struct {
	SessionType    string   `json:"sessionType"`
	ActorType      string   `json:"actorType,omitempty"`
	UserID         int64    `json:"userId,omitempty"`
	StaffAccountID *int64   `json:"staffAccountId,omitempty"`
	EmployeeID     *int64   `json:"employeeId,omitempty"`
	AuthProvider   string   `json:"authProvider,omitempty"`
	AuthSubject    string   `json:"authSubject,omitempty"`
	Roles          []string `json:"roles,omitempty"`
	Permissions    []string `json:"permissions,omitempty"`
	BranchIDs      []int64  `json:"branchIds,omitempty"`
	jwt.RegisteredClaims
}

type EmailVerificationClaims struct {
	UserID  int64  `json:"userId"`
	Email   string `json:"email"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

type AdminTokenInput struct {
	ActorType      string
	ActorSubject   string
	StaffAccountID *int64
	EmployeeID     *int64
	Roles          []string
	Permissions    []string
	BranchIDs      []int64
}

func NewTokenManager(secret string) *TokenManager {
	return &TokenManager{secret: []byte(secret)}
}

func (m *TokenManager) SignAccessToken(userID int64, authProvider, authSubject string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := AccessClaims{
		SessionType:  "customer",
		ActorType:    "customer_user",
		UserID:       userID,
		AuthProvider: authProvider,
		AuthSubject:  authSubject,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   authSubject,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *TokenManager) SignAdminAccessToken(input AdminTokenInput, ttl time.Duration) (string, error) {
	now := time.Now()
	subject := input.ActorSubject
	if subject == "" {
		subject = input.ActorType
	}
	claims := AccessClaims{
		SessionType:    "admin",
		ActorType:      input.ActorType,
		StaffAccountID: input.StaffAccountID,
		EmployeeID:     input.EmployeeID,
		Roles:          input.Roles,
		Permissions:    input.Permissions,
		BranchIDs:      input.BranchIDs,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   subject,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *TokenManager) ParseAccessToken(token string) (*AccessClaims, error) {
	parsed, err := jwt.ParseWithClaims(token, &AccessClaims{}, func(parsed *jwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*AccessClaims)
	if !ok || !parsed.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func (m *TokenManager) SignEmailVerificationToken(userID int64, email string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := EmailVerificationClaims{
		UserID:  userID,
		Email:   email,
		Purpose: "email_verification",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   email,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *TokenManager) ParseEmailVerificationToken(token string) (*EmailVerificationClaims, error) {
	parsed, err := jwt.ParseWithClaims(token, &EmailVerificationClaims{}, func(parsed *jwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*EmailVerificationClaims)
	if !ok || !parsed.Valid || claims.Purpose != "email_verification" {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func GenerateRefreshToken() (plain string, hash string, err error) {
	buffer := make([]byte, 48)
	if _, err = rand.Read(buffer); err != nil {
		return "", "", err
	}
	plain = hex.EncodeToString(buffer)
	hashBytes := sha256.Sum256([]byte(plain))
	hash = hex.EncodeToString(hashBytes[:])
	return plain, hash, nil
}

func HashRefreshToken(token string) string {
	hashBytes := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hashBytes[:])
}
