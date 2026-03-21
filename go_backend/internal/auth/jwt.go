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
	UserID       int64  `json:"userId"`
	AuthProvider string `json:"authProvider"`
	AuthSubject  string `json:"authSubject"`
	jwt.RegisteredClaims
}

func NewTokenManager(secret string) *TokenManager {
	return &TokenManager{secret: []byte(secret)}
}

func (m *TokenManager) SignAccessToken(userID int64, authProvider, authSubject string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := AccessClaims{
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
