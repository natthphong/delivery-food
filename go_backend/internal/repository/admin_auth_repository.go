package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"
)

type AdminRefreshTokenRecord struct {
	ID             int64
	StaffAccountID *int64
	ActorType      string
	TokenHash      string
	ExpiresAt      time.Time
	RevokedAt      *time.Time
	CreatedAt      time.Time
}

type StaffAccountSessionRecord struct {
	StaffAccountID    int64
	EmployeeID        int64
	Username          string
	PasswordHash      string
	MustResetPassword bool
	Status            string
	EmployeeStatus    string
	FullName          string
	LastLoginAt       *time.Time
	Roles             []string
	Permissions       []string
	BranchIDs         []int64
}

func (s *Store) GetRolePermissions(ctx context.Context, roleCode string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT permission_code
		FROM role_permissions
		WHERE role_code = $1
		ORDER BY permission_code
	`, strings.TrimSpace(roleCode))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		items = append(items, code)
	}
	return items, rows.Err()
}

func (s *Store) ListAllBranchIDs(ctx context.Context) ([]int64, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id FROM branches ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		items = append(items, id)
	}
	return items, rows.Err()
}

func (s *Store) GetStaffAccountSessionByUsername(ctx context.Context, username string) (StaffAccountSessionRecord, error) {
	return s.getStaffAccountSession(ctx, `
		SELECT
			sa.id,
			sa.employee_id,
			sa.username,
			sa.password_hash,
			sa.must_reset_password,
			sa.status,
			e.status,
			e.full_name,
			sa.last_login_at,
			COALESCE((
				SELECT json_agg(role_code ORDER BY role_code)
				FROM employee_role_assignments
				WHERE employee_id = e.id
			), '[]'::json),
			COALESCE((
				SELECT json_agg(permission_code ORDER BY permission_code)
				FROM (
					SELECT DISTINCT rp.permission_code AS permission_code
					FROM employee_role_assignments era
					JOIN role_permissions rp ON rp.role_code = era.role_code
					WHERE era.employee_id = e.id
				) permissions
			), '[]'::json),
			COALESCE((
				SELECT json_agg(branch_id ORDER BY is_primary DESC, branch_id)
				FROM employee_branch_assignments
				WHERE employee_id = e.id
			), '[]'::json)
		FROM staff_accounts sa
		JOIN employees e ON e.id = sa.employee_id
		WHERE LOWER(sa.username) = LOWER($1)
	`, strings.TrimSpace(username))
}

func (s *Store) GetStaffAccountSessionByID(ctx context.Context, staffAccountID int64) (StaffAccountSessionRecord, error) {
	return s.getStaffAccountSession(ctx, `
		SELECT
			sa.id,
			sa.employee_id,
			sa.username,
			sa.password_hash,
			sa.must_reset_password,
			sa.status,
			e.status,
			e.full_name,
			sa.last_login_at,
			COALESCE((
				SELECT json_agg(role_code ORDER BY role_code)
				FROM employee_role_assignments
				WHERE employee_id = e.id
			), '[]'::json),
			COALESCE((
				SELECT json_agg(permission_code ORDER BY permission_code)
				FROM (
					SELECT DISTINCT rp.permission_code AS permission_code
					FROM employee_role_assignments era
					JOIN role_permissions rp ON rp.role_code = era.role_code
					WHERE era.employee_id = e.id
				) permissions
			), '[]'::json),
			COALESCE((
				SELECT json_agg(branch_id ORDER BY is_primary DESC, branch_id)
				FROM employee_branch_assignments
				WHERE employee_id = e.id
			), '[]'::json)
		FROM staff_accounts sa
		JOIN employees e ON e.id = sa.employee_id
		WHERE sa.id = $1
	`, staffAccountID)
}

func (s *Store) InsertAdminRefreshToken(
	ctx context.Context,
	tx DBTX,
	staffAccountID *int64,
	actorType string,
	tokenHash string,
	expiresAt time.Time,
	userAgent string,
	ipAddress string,
) error {
	var accountID sql.NullInt64
	if staffAccountID != nil {
		accountID = sql.NullInt64{Int64: *staffAccountID, Valid: true}
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO admin_refresh_tokens (staff_account_id, actor_type, token_hash, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, accountID, strings.TrimSpace(actorType), tokenHash, expiresAt, emptyToNil(userAgent), emptyToNil(ipAddress))
	return err
}

func (s *Store) GetAdminRefreshTokenByHash(ctx context.Context, tokenHash string) (AdminRefreshTokenRecord, error) {
	var (
		staffAccountID sql.NullInt64
		revokedAt      sql.NullTime
		record         AdminRefreshTokenRecord
	)
	err := s.Pool.QueryRow(ctx, `
		SELECT id, staff_account_id, actor_type, token_hash, expires_at, revoked_at, created_at
		FROM admin_refresh_tokens
		WHERE token_hash = $1
	`, tokenHash).Scan(
		&record.ID,
		&staffAccountID,
		&record.ActorType,
		&record.TokenHash,
		&record.ExpiresAt,
		&revokedAt,
		&record.CreatedAt,
	)
	if err != nil {
		return AdminRefreshTokenRecord{}, err
	}
	record.StaffAccountID = nullInt64(staffAccountID)
	record.RevokedAt = nullTime(revokedAt)
	return record, nil
}

func (s *Store) RevokeAdminRefreshToken(ctx context.Context, tx DBTX, tokenHash, replacedByHash string) error {
	_, err := tx.Exec(ctx, `
		UPDATE admin_refresh_tokens
		SET revoked_at = NOW(), replaced_by_hash = $2
		WHERE token_hash = $1
	`, tokenHash, emptyToNil(replacedByHash))
	return err
}

func (s *Store) TouchStaffAccountLogin(ctx context.Context, tx DBTX, staffAccountID int64) error {
	_, err := tx.Exec(ctx, `
		UPDATE staff_accounts
		SET last_login_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, staffAccountID)
	return err
}

func (s *Store) getStaffAccountSession(ctx context.Context, query string, args ...any) (StaffAccountSessionRecord, error) {
	var (
		lastLoginAt      sql.NullTime
		rolesJSON        []byte
		permissionsJSON  []byte
		branchIDsJSON    []byte
		record           StaffAccountSessionRecord
	)
	err := s.Pool.QueryRow(ctx, query, args...).Scan(
		&record.StaffAccountID,
		&record.EmployeeID,
		&record.Username,
		&record.PasswordHash,
		&record.MustResetPassword,
		&record.Status,
		&record.EmployeeStatus,
		&record.FullName,
		&lastLoginAt,
		&rolesJSON,
		&permissionsJSON,
		&branchIDsJSON,
	)
	if err != nil {
		return StaffAccountSessionRecord{}, err
	}
	record.LastLoginAt = nullTime(lastLoginAt)
	if err := json.Unmarshal(rolesJSON, &record.Roles); err != nil {
		return StaffAccountSessionRecord{}, err
	}
	if err := json.Unmarshal(permissionsJSON, &record.Permissions); err != nil {
		return StaffAccountSessionRecord{}, err
	}
	if err := json.Unmarshal(branchIDsJSON, &record.BranchIDs); err != nil {
		return StaffAccountSessionRecord{}, err
	}
	return record, nil
}
