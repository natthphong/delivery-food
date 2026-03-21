package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type EmployeeListFilter struct {
	Search    string
	Status    string
	BranchIDs []int64
}

type EmployeeRecordParams struct {
	UserID            *int64
	EmployeeCode      string
	FullName          string
	Email             *string
	Phone             *string
	EmploymentType    string
	CompensationType  string
	HourlyWage        *float64
	MonthlySalary     *float64
	OTEligible        bool
	OTMultiplier      float64
	PayrollVisibility bool
	Status            string
	JoinedAt          *time.Time
}

type EmployeeBranchAssignmentParams struct {
	BranchID  int64
	IsPrimary bool
}

type StaffAccountUpsertParams struct {
	EmployeeID         int64
	Username           string
	PasswordHash       *string
	MustResetPassword  bool
	StaffAccountStatus string
}

func (s *Store) ListEmployees(ctx context.Context, filter EmployeeListFilter) ([]model.Employee, error) {
	search := "%" + strings.TrimSpace(strings.ToLower(filter.Search)) + "%"
	status := strings.TrimSpace(strings.ToLower(filter.Status))
	rows, err := s.Pool.Query(ctx, employeeSelectQuery+`
		WHERE ($1 = '%%' OR LOWER(e.employee_code || ' ' || e.full_name || ' ' || COALESCE(e.email, '') || ' ' || COALESCE(e.phone, '')) LIKE $1)
			AND ($2 = '' OR LOWER(e.status) = $2)
			AND (COALESCE(array_length($3::bigint[], 1), 0) = 0 OR EXISTS (
				SELECT 1
				FROM employee_branch_assignments eba
				WHERE eba.employee_id = e.id
					AND eba.branch_id = ANY($3)
			))
		ORDER BY e.status = 'active' DESC, e.full_name, e.id
	`, search, status, filter.BranchIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.Employee, 0)
	for rows.Next() {
		item, err := scanEmployee(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) GetEmployee(ctx context.Context, employeeID int64) (model.Employee, error) {
	row := s.Pool.QueryRow(ctx, employeeSelectQuery+` WHERE e.id = $1`, employeeID)
	return scanEmployee(row)
}

func (s *Store) InsertEmployee(ctx context.Context, tx DBTX, params EmployeeRecordParams) (int64, error) {
	var (
		userID        sql.NullInt64
		email         sql.NullString
		phone         sql.NullString
		hourlyWage    sql.NullFloat64
		monthlySalary sql.NullFloat64
		joinedAt      sql.NullTime
		employeeID    int64
	)
	if params.UserID != nil {
		userID = sql.NullInt64{Int64: *params.UserID, Valid: true}
	}
	if params.Email != nil {
		email = sql.NullString{String: strings.TrimSpace(*params.Email), Valid: strings.TrimSpace(*params.Email) != ""}
	}
	if params.Phone != nil {
		phone = sql.NullString{String: strings.TrimSpace(*params.Phone), Valid: strings.TrimSpace(*params.Phone) != ""}
	}
	if params.HourlyWage != nil {
		hourlyWage = sql.NullFloat64{Float64: *params.HourlyWage, Valid: true}
	}
	if params.MonthlySalary != nil {
		monthlySalary = sql.NullFloat64{Float64: *params.MonthlySalary, Valid: true}
	}
	if params.JoinedAt != nil {
		joinedAt = sql.NullTime{Time: *params.JoinedAt, Valid: true}
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO employees (
			user_id, employee_code, full_name, email, phone, employment_type, compensation_type,
			hourly_wage, monthly_salary, ot_eligible, ot_multiplier, payroll_visibility, status, joined_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`, userID, strings.TrimSpace(params.EmployeeCode), strings.TrimSpace(params.FullName), email, phone, params.EmploymentType, params.CompensationType, hourlyWage, monthlySalary, params.OTEligible, params.OTMultiplier, params.PayrollVisibility, params.Status, joinedAt).Scan(&employeeID)
	return employeeID, err
}

func (s *Store) UpdateEmployee(ctx context.Context, tx DBTX, employeeID int64, params EmployeeRecordParams) error {
	var (
		userID        sql.NullInt64
		email         sql.NullString
		phone         sql.NullString
		hourlyWage    sql.NullFloat64
		monthlySalary sql.NullFloat64
		joinedAt      sql.NullTime
	)
	if params.UserID != nil {
		userID = sql.NullInt64{Int64: *params.UserID, Valid: true}
	}
	if params.Email != nil {
		email = sql.NullString{String: strings.TrimSpace(*params.Email), Valid: strings.TrimSpace(*params.Email) != ""}
	}
	if params.Phone != nil {
		phone = sql.NullString{String: strings.TrimSpace(*params.Phone), Valid: strings.TrimSpace(*params.Phone) != ""}
	}
	if params.HourlyWage != nil {
		hourlyWage = sql.NullFloat64{Float64: *params.HourlyWage, Valid: true}
	}
	if params.MonthlySalary != nil {
		monthlySalary = sql.NullFloat64{Float64: *params.MonthlySalary, Valid: true}
	}
	if params.JoinedAt != nil {
		joinedAt = sql.NullTime{Time: *params.JoinedAt, Valid: true}
	}
	_, err := tx.Exec(ctx, `
		UPDATE employees
		SET
			user_id = $2,
			employee_code = $3,
			full_name = $4,
			email = $5,
			phone = $6,
			employment_type = $7,
			compensation_type = $8,
			hourly_wage = $9,
			monthly_salary = $10,
			ot_eligible = $11,
			ot_multiplier = $12,
			payroll_visibility = $13,
			status = $14,
			joined_at = $15,
			updated_at = NOW()
		WHERE id = $1
	`, employeeID, userID, strings.TrimSpace(params.EmployeeCode), strings.TrimSpace(params.FullName), email, phone, params.EmploymentType, params.CompensationType, hourlyWage, monthlySalary, params.OTEligible, params.OTMultiplier, params.PayrollVisibility, params.Status, joinedAt)
	return err
}

func (s *Store) ReplaceEmployeeRoles(ctx context.Context, tx DBTX, employeeID int64, roleCodes []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM employee_role_assignments WHERE employee_id = $1`, employeeID); err != nil {
		return err
	}
	for _, roleCode := range roleCodes {
		if _, err := tx.Exec(ctx, `
			INSERT INTO employee_role_assignments (employee_id, role_code)
			VALUES ($1, $2)
		`, employeeID, strings.TrimSpace(roleCode)); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) ReplaceEmployeeBranches(ctx context.Context, tx DBTX, employeeID int64, assignments []EmployeeBranchAssignmentParams) error {
	if _, err := tx.Exec(ctx, `DELETE FROM employee_branch_assignments WHERE employee_id = $1`, employeeID); err != nil {
		return err
	}
	for _, assignment := range assignments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO employee_branch_assignments (employee_id, branch_id, is_primary)
			VALUES ($1, $2, $3)
		`, employeeID, assignment.BranchID, assignment.IsPrimary); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) UpsertStaffAccount(ctx context.Context, tx DBTX, params StaffAccountUpsertParams) (*int64, error) {
	if strings.TrimSpace(params.Username) == "" {
		if _, err := tx.Exec(ctx, `DELETE FROM staff_accounts WHERE employee_id = $1`, params.EmployeeID); err != nil {
			return nil, err
		}
		return nil, nil
	}

	var (
		passwordHash sql.NullString
		accountID    int64
	)
	if params.PasswordHash != nil {
		passwordHash = sql.NullString{String: *params.PasswordHash, Valid: true}
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO staff_accounts (employee_id, username, password_hash, must_reset_password, status)
		VALUES ($1, $2, COALESCE($3, ''), $4, $5)
		ON CONFLICT (employee_id)
		DO UPDATE SET
			username = EXCLUDED.username,
			password_hash = CASE
				WHEN EXCLUDED.password_hash = '' THEN staff_accounts.password_hash
				ELSE EXCLUDED.password_hash
			END,
			must_reset_password = EXCLUDED.must_reset_password,
			status = EXCLUDED.status,
			updated_at = NOW()
		RETURNING id
	`, params.EmployeeID, strings.TrimSpace(params.Username), passwordHash, params.MustResetPassword, params.StaffAccountStatus).Scan(&accountID)
	if err != nil {
		return nil, err
	}
	return &accountID, nil
}

const employeeSelectQuery = `
	SELECT
		e.id,
		e.user_id,
		e.employee_code,
		e.full_name,
		e.email,
		e.phone,
		e.employment_type,
		e.compensation_type,
		e.hourly_wage::double precision,
		e.monthly_salary::double precision,
		e.ot_eligible,
		e.ot_multiplier::double precision,
		e.payroll_visibility,
		e.status,
		e.joined_at,
		sa.username,
		sa.last_login_at,
		e.created_at,
		e.updated_at,
		COALESCE(roles.roles_json, '[]'::json),
		COALESCE(branches.branches_json, '[]'::json)
	FROM employees e
	LEFT JOIN staff_accounts sa ON sa.employee_id = e.id
	LEFT JOIN LATERAL (
		SELECT json_agg(json_build_object('code', r.code, 'name', r.name) ORDER BY r.code) AS roles_json
		FROM employee_role_assignments era
		JOIN roles r ON r.code = era.role_code
		WHERE era.employee_id = e.id
	) roles ON TRUE
	LEFT JOIN LATERAL (
		SELECT json_agg(
			json_build_object(
				'branchId', b.id,
				'branchName', b.name,
				'isPrimary', eba.is_primary
			)
			ORDER BY eba.is_primary DESC, b.name, b.id
		) AS branches_json
		FROM employee_branch_assignments eba
		JOIN branches b ON b.id = eba.branch_id
		WHERE eba.employee_id = e.id
	)
	branches ON TRUE
`

func scanEmployee(scanner interface{ Scan(dest ...interface{}) error }) (model.Employee, error) {
	var (
		userID        sql.NullInt64
		email         sql.NullString
		phone         sql.NullString
		hourlyWage    sql.NullFloat64
		monthlySalary sql.NullFloat64
		joinedAt      sql.NullTime
		username      sql.NullString
		lastLoginAt   sql.NullTime
		rolesJSON     []byte
		branchesJSON  []byte
		item          model.Employee
	)
	if err := scanner.Scan(
		&item.ID,
		&userID,
		&item.EmployeeCode,
		&item.FullName,
		&email,
		&phone,
		&item.EmploymentType,
		&item.CompensationType,
		&hourlyWage,
		&monthlySalary,
		&item.OTEligible,
		&item.OTMultiplier,
		&item.PayrollVisibility,
		&item.Status,
		&joinedAt,
		&username,
		&lastLoginAt,
		&item.CreatedAt,
		&item.UpdatedAt,
		&rolesJSON,
		&branchesJSON,
	); err != nil {
		return model.Employee{}, err
	}
	item.UserID = nullInt64(userID)
	item.Email = nullString(email)
	item.Phone = nullString(phone)
	if hourlyWage.Valid {
		value := hourlyWage.Float64
		item.HourlyWage = &value
	}
	if monthlySalary.Valid {
		value := monthlySalary.Float64
		item.MonthlySalary = &value
	}
	item.JoinedAt = nullTime(joinedAt)
	item.Username = nullString(username)
	item.LastLoginAt = nullTime(lastLoginAt)
	if len(rolesJSON) > 0 {
		if err := json.Unmarshal(rolesJSON, &item.Roles); err != nil {
			return model.Employee{}, err
		}
	}
	if len(branchesJSON) > 0 {
		if err := json.Unmarshal(branchesJSON, &item.Branches); err != nil {
			return model.Employee{}, err
		}
	}
	if item.Roles == nil {
		item.Roles = []model.EmployeeRole{}
	}
	if item.Branches == nil {
		item.Branches = []model.EmployeeBranchAssignment{}
	}
	return item, nil
}
