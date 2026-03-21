package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type OTRequestListFilter struct {
	EmployeeID *int64
	BranchIDs  []int64
	Status     string
	Limit      int
}

type PayrollComputationInput struct {
	EmployeeID        int64
	EmployeeName      string
	CompensationType  string
	HourlyWage        *float64
	MonthlySalary     *float64
	OTEligible        bool
	OTMultiplier      float64
	BranchID          *int64
	BranchName        *string
	AttendanceMinutes int
	ApprovedOTMinutes int
}

type PayrollEntryInsertParams struct {
	PayrollPeriodID   int64
	EmployeeID        int64
	BranchID          *int64
	AttendanceMinutes int
	RegularMinutes    int
	OvertimeMinutes   int
	RegularAmount     float64
	OvertimeAmount    float64
	AdjustmentAmount  float64
	GrossAmount       float64
	Note              *string
	GeneratedAt       *time.Time
}

func (s *Store) ListOTRequests(ctx context.Context, filter OTRequestListFilter) ([]model.OTRequest, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	status := strings.TrimSpace(filter.Status)
	rows, err := s.Pool.Query(ctx, `
		SELECT
			r.id,
			r.employee_id,
			e.full_name,
			r.branch_id,
			b.name,
			r.attendance_session_id,
			r.requested_minutes,
			r.approved_minutes,
			r.reason,
			r.status,
			r.requested_at,
			r.reviewed_at,
			r.reviewed_by_employee_id,
			r.review_note,
			r.created_at,
			r.updated_at
		FROM ot_requests r
		JOIN employees e ON e.id = r.employee_id
		JOIN branches b ON b.id = r.branch_id
		WHERE ($1::bigint IS NULL OR r.employee_id = $1)
			AND (COALESCE(array_length($2::bigint[], 1), 0) = 0 OR r.branch_id = ANY($2))
			AND ($3 = '' OR r.status = $3)
		ORDER BY r.requested_at DESC, r.id DESC
		LIMIT $4
	`, filter.EmployeeID, filter.BranchIDs, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.OTRequest, 0)
	for rows.Next() {
		item, err := scanOTRequest(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) GetOTRequest(ctx context.Context, requestID int64) (model.OTRequest, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			r.id,
			r.employee_id,
			e.full_name,
			r.branch_id,
			b.name,
			r.attendance_session_id,
			r.requested_minutes,
			r.approved_minutes,
			r.reason,
			r.status,
			r.requested_at,
			r.reviewed_at,
			r.reviewed_by_employee_id,
			r.review_note,
			r.created_at,
			r.updated_at
		FROM ot_requests r
		JOIN employees e ON e.id = r.employee_id
		JOIN branches b ON b.id = r.branch_id
		WHERE r.id = $1
	`, requestID)
	return scanOTRequest(row)
}

func (s *Store) CreateOTRequest(
	ctx context.Context,
	tx DBTX,
	employeeID int64,
	branchID int64,
	attendanceSessionID *int64,
	requestedMinutes int,
	reason string,
) (model.OTRequest, error) {
	var attendanceID sql.NullInt64
	if attendanceSessionID != nil {
		attendanceID = sql.NullInt64{Int64: *attendanceSessionID, Valid: true}
	}
	var requestID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO ot_requests (employee_id, branch_id, attendance_session_id, requested_minutes, reason)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, employeeID, branchID, attendanceID, requestedMinutes, strings.TrimSpace(reason)).Scan(&requestID); err != nil {
		return model.OTRequest{}, err
	}
	return s.GetOTRequest(ctx, requestID)
}

func (s *Store) ReviewOTRequest(
	ctx context.Context,
	tx DBTX,
	requestID int64,
	status string,
	approvedMinutes *int,
	reviewNote string,
	reviewerID *int64,
) (model.OTRequest, error) {
	var approved sql.NullInt32
	var reviewer sql.NullInt64
	if approvedMinutes != nil {
		approved = sql.NullInt32{Int32: int32(*approvedMinutes), Valid: true}
	}
	if reviewerID != nil {
		reviewer = sql.NullInt64{Int64: *reviewerID, Valid: true}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ot_requests
		SET
			status = $2,
			approved_minutes = $3,
			review_note = $4,
			reviewed_by_employee_id = $5,
			reviewed_at = NOW(),
			updated_at = NOW()
		WHERE id = $1
	`, requestID, strings.TrimSpace(status), approved, emptyToNil(strings.TrimSpace(reviewNote)), reviewer); err != nil {
		return model.OTRequest{}, err
	}
	return s.GetOTRequest(ctx, requestID)
}

func (s *Store) GetPayrollSettings(ctx context.Context, companyID int64) (model.PayrollSettings, error) {
	var item model.PayrollSettings
	err := s.Pool.QueryRow(ctx, `
		SELECT id, company_id, standard_daily_minutes, standard_monthly_minutes, overtime_rounding_minutes, default_ot_multiplier::double precision, created_at, updated_at
		FROM payroll_settings
		WHERE company_id = $1
	`, companyID).Scan(
		&item.ID,
		&item.CompanyID,
		&item.StandardDailyMinutes,
		&item.StandardMonthlyMinutes,
		&item.OvertimeRoundingMinutes,
		&item.DefaultOTMultiplier,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	return item, err
}

func (s *Store) UpdatePayrollSettings(ctx context.Context, tx DBTX, companyID int64, settings model.PayrollSettings) error {
	_, err := tx.Exec(ctx, `
		UPDATE payroll_settings
		SET
			standard_daily_minutes = $2,
			standard_monthly_minutes = $3,
			overtime_rounding_minutes = $4,
			default_ot_multiplier = $5,
			updated_at = NOW()
		WHERE company_id = $1
	`, companyID, settings.StandardDailyMinutes, settings.StandardMonthlyMinutes, settings.OvertimeRoundingMinutes, settings.DefaultOTMultiplier)
	return err
}

func (s *Store) ListPayrollPeriods(ctx context.Context, companyID int64, limit int) ([]model.PayrollPeriod, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, company_id, code, starts_at, ends_at, status, note, created_at, updated_at
		FROM payroll_periods
		WHERE company_id = $1
		ORDER BY starts_at DESC, id DESC
		LIMIT $2
	`, companyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.PayrollPeriod, 0)
	for rows.Next() {
		item, err := scanPayrollPeriod(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) GetPayrollPeriod(ctx context.Context, periodID int64) (model.PayrollPeriod, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, company_id, code, starts_at, ends_at, status, note, created_at, updated_at
		FROM payroll_periods
		WHERE id = $1
	`, periodID)
	return scanPayrollPeriod(row)
}

func (s *Store) CreatePayrollPeriod(ctx context.Context, tx DBTX, companyID int64, code string, startsAt time.Time, endsAt time.Time, note *string) (model.PayrollPeriod, error) {
	var noteValue sql.NullString
	if note != nil {
		noteValue = sql.NullString{String: strings.TrimSpace(*note), Valid: strings.TrimSpace(*note) != ""}
	}
	var periodID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO payroll_periods (company_id, code, starts_at, ends_at, note)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, companyID, strings.TrimSpace(code), startsAt, endsAt, noteValue).Scan(&periodID); err != nil {
		return model.PayrollPeriod{}, err
	}
	return s.GetPayrollPeriod(ctx, periodID)
}

func (s *Store) UpdatePayrollPeriodStatus(ctx context.Context, tx DBTX, periodID int64, status string) error {
	_, err := tx.Exec(ctx, `
		UPDATE payroll_periods
		SET status = $2, updated_at = NOW()
		WHERE id = $1
	`, periodID, strings.TrimSpace(status))
	return err
}

func (s *Store) DeletePayrollEntriesByPeriod(ctx context.Context, tx DBTX, periodID int64) error {
	_, err := tx.Exec(ctx, `DELETE FROM payroll_entries WHERE payroll_period_id = $1`, periodID)
	return err
}

func (s *Store) InsertPayrollEntry(ctx context.Context, tx DBTX, params PayrollEntryInsertParams) error {
	var (
		branchID    sql.NullInt64
		note        sql.NullString
		generatedAt sql.NullTime
	)
	if params.BranchID != nil {
		branchID = sql.NullInt64{Int64: *params.BranchID, Valid: true}
	}
	if params.Note != nil {
		note = sql.NullString{String: strings.TrimSpace(*params.Note), Valid: strings.TrimSpace(*params.Note) != ""}
	}
	if params.GeneratedAt != nil {
		generatedAt = sql.NullTime{Time: *params.GeneratedAt, Valid: true}
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO payroll_entries (
			payroll_period_id, employee_id, branch_id, attendance_minutes, regular_minutes, overtime_minutes,
			regular_amount, overtime_amount, adjustment_amount, gross_amount, note, generated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, params.PayrollPeriodID, params.EmployeeID, branchID, params.AttendanceMinutes, params.RegularMinutes, params.OvertimeMinutes, params.RegularAmount, params.OvertimeAmount, params.AdjustmentAmount, params.GrossAmount, note, generatedAt)
	return err
}

func (s *Store) ListPayrollEntries(ctx context.Context, periodID int64) ([]model.PayrollEntry, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			pe.id,
			pe.payroll_period_id,
			pe.employee_id,
			e.full_name,
			pe.branch_id,
			b.name,
			pe.attendance_minutes,
			pe.regular_minutes,
			pe.overtime_minutes,
			pe.regular_amount::double precision,
			pe.overtime_amount::double precision,
			pe.adjustment_amount::double precision,
			pe.gross_amount::double precision,
			pe.note,
			pe.generated_at,
			pe.created_at,
			pe.updated_at
		FROM payroll_entries pe
		JOIN employees e ON e.id = pe.employee_id
		LEFT JOIN branches b ON b.id = pe.branch_id
		WHERE pe.payroll_period_id = $1
		ORDER BY e.full_name, pe.id
	`, periodID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.PayrollEntry, 0)
	for rows.Next() {
		item, err := scanPayrollEntry(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListPayrollInputs(ctx context.Context, period model.PayrollPeriod, branchIDs []int64) ([]PayrollComputationInput, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			e.id,
			e.full_name,
			e.compensation_type,
			e.hourly_wage::double precision,
			e.monthly_salary::double precision,
			e.ot_eligible,
			e.ot_multiplier::double precision,
			COALESCE(primary_attendance.branch_id, primary_assignment.branch_id),
			COALESCE(primary_attendance.branch_name, primary_assignment.branch_name),
			COALESCE(attendance.attendance_minutes, 0)::int,
			COALESCE(ot.approved_ot_minutes, 0)::int
		FROM employees e
		LEFT JOIN LATERAL (
			SELECT
				a.branch_id,
				b.name AS branch_name
			FROM attendance_sessions a
			JOIN branches b ON b.id = a.branch_id
			WHERE a.employee_id = e.id
				AND a.clock_in_at::date BETWEEN $1 AND $2
				AND a.clock_out_at IS NOT NULL
			GROUP BY a.branch_id, b.name
			ORDER BY SUM(GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (a.clock_out_at - a.clock_in_at)) / 60))) DESC, a.branch_id
			LIMIT 1
		) primary_attendance ON TRUE
		LEFT JOIN LATERAL (
			SELECT eba.branch_id, b.name AS branch_name
			FROM employee_branch_assignments eba
			JOIN branches b ON b.id = eba.branch_id
			WHERE eba.employee_id = e.id
			ORDER BY eba.is_primary DESC, eba.branch_id
			LIMIT 1
		) primary_assignment ON TRUE
		LEFT JOIN LATERAL (
			SELECT SUM(GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (a.clock_out_at - a.clock_in_at)) / 60)))::bigint AS attendance_minutes
			FROM attendance_sessions a
			WHERE a.employee_id = e.id
				AND a.clock_in_at::date BETWEEN $1 AND $2
				AND a.clock_out_at IS NOT NULL
		) attendance ON TRUE
		LEFT JOIN LATERAL (
			SELECT SUM(COALESCE(r.approved_minutes, r.requested_minutes))::bigint AS approved_ot_minutes
			FROM ot_requests r
			WHERE r.employee_id = e.id
				AND r.status = 'approved'
				AND r.requested_at::date BETWEEN $1 AND $2
		) ot ON TRUE
		WHERE e.status = 'active'
			AND (COALESCE(array_length($3::bigint[], 1), 0) = 0 OR EXISTS (
				SELECT 1
				FROM employee_branch_assignments eba
				WHERE eba.employee_id = e.id
					AND eba.branch_id = ANY($3)
			))
		ORDER BY e.full_name, e.id
	`, period.StartsAt, period.EndsAt, branchIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]PayrollComputationInput, 0)
	for rows.Next() {
		var (
			hourlyWage     sql.NullFloat64
			monthlySalary  sql.NullFloat64
			branchID       sql.NullInt64
			branchName     sql.NullString
			attendanceMins int
			otMinutes      int
			item           PayrollComputationInput
		)
		if err := rows.Scan(
			&item.EmployeeID,
			&item.EmployeeName,
			&item.CompensationType,
			&hourlyWage,
			&monthlySalary,
			&item.OTEligible,
			&item.OTMultiplier,
			&branchID,
			&branchName,
			&attendanceMins,
			&otMinutes,
		); err != nil {
			return nil, err
		}
		if hourlyWage.Valid {
			value := hourlyWage.Float64
			item.HourlyWage = &value
		}
		if monthlySalary.Valid {
			value := monthlySalary.Float64
			item.MonthlySalary = &value
		}
		item.BranchID = nullInt64(branchID)
		item.BranchName = nullString(branchName)
		item.AttendanceMinutes = attendanceMins
		item.ApprovedOTMinutes = otMinutes
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanOTRequest(scanner interface{ Scan(dest ...interface{}) error }) (model.OTRequest, error) {
	var (
		attendanceSessionID sql.NullInt64
		approvedMinutes     sql.NullInt32
		reviewedAt          sql.NullTime
		reviewedBy          sql.NullInt64
		reviewNote          sql.NullString
		item                model.OTRequest
	)
	if err := scanner.Scan(
		&item.ID,
		&item.EmployeeID,
		&item.EmployeeName,
		&item.BranchID,
		&item.BranchName,
		&attendanceSessionID,
		&item.RequestedMinutes,
		&approvedMinutes,
		&item.Reason,
		&item.Status,
		&item.RequestedAt,
		&reviewedAt,
		&reviewedBy,
		&reviewNote,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return model.OTRequest{}, err
	}
	item.AttendanceSessionID = nullInt64(attendanceSessionID)
	if approvedMinutes.Valid {
		value := int(approvedMinutes.Int32)
		item.ApprovedMinutes = &value
	}
	item.ReviewedAt = nullTime(reviewedAt)
	item.ReviewedByEmployeeID = nullInt64(reviewedBy)
	item.ReviewNote = nullString(reviewNote)
	return item, nil
}

func scanPayrollPeriod(scanner interface{ Scan(dest ...interface{}) error }) (model.PayrollPeriod, error) {
	var (
		note sql.NullString
		item model.PayrollPeriod
	)
	if err := scanner.Scan(
		&item.ID,
		&item.CompanyID,
		&item.Code,
		&item.StartsAt,
		&item.EndsAt,
		&item.Status,
		&note,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return model.PayrollPeriod{}, err
	}
	item.Note = nullString(note)
	return item, nil
}

func scanPayrollEntry(scanner interface{ Scan(dest ...interface{}) error }) (model.PayrollEntry, error) {
	var (
		branchID    sql.NullInt64
		branchName  sql.NullString
		note        sql.NullString
		generatedAt sql.NullTime
		item        model.PayrollEntry
	)
	if err := scanner.Scan(
		&item.ID,
		&item.PayrollPeriodID,
		&item.EmployeeID,
		&item.EmployeeName,
		&branchID,
		&branchName,
		&item.AttendanceMinutes,
		&item.RegularMinutes,
		&item.OvertimeMinutes,
		&item.RegularAmount,
		&item.OvertimeAmount,
		&item.AdjustmentAmount,
		&item.GrossAmount,
		&note,
		&generatedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return model.PayrollEntry{}, err
	}
	item.BranchID = nullInt64(branchID)
	item.BranchName = nullString(branchName)
	item.Note = nullString(note)
	item.GeneratedAt = nullTime(generatedAt)
	return item, nil
}
