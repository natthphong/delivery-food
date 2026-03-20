package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type RefreshTokenRecord struct {
	ID         int64
	UserID     int64
	TokenHash  string
	ExpiresAt  time.Time
	RevokedAt  *time.Time
	CreatedAt  time.Time
}

func (s *Store) UpsertUser(ctx context.Context, authProvider string, claims model.IdentityClaims) (model.User, error) {
	query := `
		INSERT INTO users (
			auth_provider,
			auth_subject,
			email,
			phone,
			display_name,
			provider_label,
			is_email_verified,
			is_phone_verified,
			last_login_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (auth_provider, auth_subject)
		DO UPDATE SET
			email = COALESCE(EXCLUDED.email, users.email),
			phone = COALESCE(EXCLUDED.phone, users.phone),
			display_name = COALESCE(EXCLUDED.display_name, users.display_name),
			provider_label = COALESCE(EXCLUDED.provider_label, users.provider_label),
			is_email_verified = users.is_email_verified OR EXCLUDED.is_email_verified,
			is_phone_verified = users.is_phone_verified OR EXCLUDED.is_phone_verified,
			last_login_at = NOW()
		RETURNING
			id,
			auth_provider,
			auth_subject,
			email,
			phone,
			display_name,
			provider_label,
			is_email_verified,
			is_phone_verified,
			wallet_balance,
			last_login_at,
			created_at,
			updated_at
	`

	row := s.Pool.QueryRow(
		ctx,
		query,
		authProvider,
		claims.AuthSubject,
		claims.Email,
		claims.Phone,
		claims.DisplayName,
		claims.ProviderLabel,
		claims.IsEmailVerified,
		claims.IsPhoneVerified,
	)
	return scanUser(row)
}

func (s *Store) GetUserByID(ctx context.Context, userID int64) (model.User, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			id,
			auth_provider,
			auth_subject,
			email,
			phone,
			display_name,
			provider_label,
			is_email_verified,
			is_phone_verified,
			wallet_balance,
			last_login_at,
			created_at,
			updated_at
		FROM users
		WHERE id = $1
	`, userID)
	return scanUser(row)
}

func (s *Store) GetUserByAuth(ctx context.Context, authProvider, authSubject string) (model.User, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			id,
			auth_provider,
			auth_subject,
			email,
			phone,
			display_name,
			provider_label,
			is_email_verified,
			is_phone_verified,
			wallet_balance,
			last_login_at,
			created_at,
			updated_at
		FROM users
		WHERE auth_provider = $1 AND auth_subject = $2
	`, authProvider, authSubject)
	return scanUser(row)
}

func (s *Store) InsertRefreshToken(ctx context.Context, tx DBTX, userID int64, tokenHash string, expiresAt time.Time, userAgent, ipAddress string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, tokenHash, expiresAt, emptyToNil(userAgent), emptyToNil(ipAddress))
	return err
}

func (s *Store) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (RefreshTokenRecord, error) {
	var revokedAt sql.NullTime
	var record RefreshTokenRecord
	err := s.Pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`, tokenHash).Scan(
		&record.ID,
		&record.UserID,
		&record.TokenHash,
		&record.ExpiresAt,
		&revokedAt,
		&record.CreatedAt,
	)
	if err != nil {
		return RefreshTokenRecord{}, err
	}
	record.RevokedAt = nullTime(revokedAt)
	return record, nil
}

func (s *Store) RevokeRefreshToken(ctx context.Context, tx DBTX, tokenHash, replacedByHash string) error {
	_, err := tx.Exec(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = NOW(), replaced_by_hash = $2
		WHERE token_hash = $1
	`, tokenHash, emptyToNil(replacedByHash))
	return err
}

func (s *Store) UpdateUserProfile(
	ctx context.Context,
	userID int64,
	displayName *string,
	email *string,
	phone *string,
	isEmailVerified *bool,
	isPhoneVerified *bool,
) (model.User, error) {
	row := s.Pool.QueryRow(ctx, `
		UPDATE users
		SET
			display_name = COALESCE($2, display_name),
			email = COALESCE($3, email),
			phone = COALESCE($4, phone),
			is_email_verified = COALESCE($5, is_email_verified),
			is_phone_verified = COALESCE($6, is_phone_verified),
			updated_at = NOW()
		WHERE id = $1
		RETURNING
			id,
			auth_provider,
			auth_subject,
			email,
			phone,
			display_name,
			provider_label,
			is_email_verified,
			is_phone_verified,
			wallet_balance::double precision,
			last_login_at,
			created_at,
			updated_at
	`, userID, emptyStringPtr(displayName), emptyStringPtr(email), emptyStringPtr(phone), isEmailVerified, isPhoneVerified)
	return scanUser(row)
}

func (s *Store) AdjustWalletBalance(ctx context.Context, tx DBTX, userID int64, delta float64) (float64, error) {
	var balance float64
	err := tx.QueryRow(ctx, `
		UPDATE users
		SET wallet_balance = wallet_balance + $2,
			updated_at = NOW()
		WHERE id = $1
			AND wallet_balance + $2 >= 0
		RETURNING wallet_balance::double precision
	`, userID, delta).Scan(&balance)
	if err != nil {
		return 0, err
	}
	return balance, nil
}

func scanUser(row pgx.Row) (model.User, error) {
	var (
		email         sql.NullString
		phone         sql.NullString
		displayName   sql.NullString
		providerLabel sql.NullString
		lastLoginAt   sql.NullTime
		user          model.User
	)

	err := row.Scan(
		&user.ID,
		&user.AuthProvider,
		&user.AuthSubject,
		&email,
		&phone,
		&displayName,
		&providerLabel,
		&user.IsEmailVerified,
		&user.IsPhoneVerified,
		&user.WalletBalance,
		&lastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return model.User{}, err
	}
	user.Email = nullString(email)
	user.Phone = nullString(phone)
	user.DisplayName = nullString(displayName)
	user.ProviderLabel = nullString(providerLabel)
	user.LastLoginAt = nullTime(lastLoginAt)
	return user, nil
}

func emptyToNil(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}

func emptyStringPtr(value *string) interface{} {
	if value == nil {
		return nil
	}
	trimmed := *value
	if trimmed == "" {
		return ""
	}
	return trimmed
}

func IsNotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
