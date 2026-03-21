package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type AttendanceListFilter struct {
	EmployeeID *int64
	BranchIDs  []int64
	Status     string
	From       *time.Time
	To         *time.Time
	Limit      int
}

type AttendanceCorrectionParams struct {
	ClockInAt      *time.Time
	ClockOutAt     *time.Time
	Status         string
	CorrectionNote string
	ReviewerID     *int64
}

func (s *Store) ListAttendance(ctx context.Context, filter AttendanceListFilter) ([]model.AttendanceSession, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	status := strings.TrimSpace(filter.Status)
	rows, err := s.Pool.Query(ctx, `
		SELECT
			a.id,
			a.employee_id,
			e.full_name,
			a.branch_id,
			b.name,
			a.clock_in_at,
			a.clock_out_at,
			a.status,
			GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(a.clock_out_at, NOW()) - a.clock_in_at)) / 60))::int,
			a.note,
			a.correction_note,
			a.corrected_by_employee_id,
			a.created_at,
			a.updated_at
		FROM attendance_sessions a
		JOIN employees e ON e.id = a.employee_id
		JOIN branches b ON b.id = a.branch_id
		WHERE ($1::bigint IS NULL OR a.employee_id = $1)
			AND (COALESCE(array_length($2::bigint[], 1), 0) = 0 OR a.branch_id = ANY($2))
			AND ($3 = '' OR a.status = $3)
			AND ($4::timestamptz IS NULL OR a.clock_in_at >= $4)
			AND ($5::timestamptz IS NULL OR a.clock_in_at <= $5)
		ORDER BY a.clock_in_at DESC, a.id DESC
		LIMIT $6
	`, filter.EmployeeID, filter.BranchIDs, status, filter.From, filter.To, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.AttendanceSession, 0)
	for rows.Next() {
		item, err := scanAttendanceSession(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) GetAttendanceSession(ctx context.Context, attendanceID int64) (model.AttendanceSession, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			a.id,
			a.employee_id,
			e.full_name,
			a.branch_id,
			b.name,
			a.clock_in_at,
			a.clock_out_at,
			a.status,
			GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(a.clock_out_at, NOW()) - a.clock_in_at)) / 60))::int,
			a.note,
			a.correction_note,
			a.corrected_by_employee_id,
			a.created_at,
			a.updated_at
		FROM attendance_sessions a
		JOIN employees e ON e.id = a.employee_id
		JOIN branches b ON b.id = a.branch_id
		WHERE a.id = $1
	`, attendanceID)
	return scanAttendanceSession(row)
}

func (s *Store) GetOpenAttendanceSession(ctx context.Context, employeeID int64) (model.AttendanceSession, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT
			a.id,
			a.employee_id,
			e.full_name,
			a.branch_id,
			b.name,
			a.clock_in_at,
			a.clock_out_at,
			a.status,
			GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(a.clock_out_at, NOW()) - a.clock_in_at)) / 60))::int,
			a.note,
			a.correction_note,
			a.corrected_by_employee_id,
			a.created_at,
			a.updated_at
		FROM attendance_sessions a
		JOIN employees e ON e.id = a.employee_id
		JOIN branches b ON b.id = a.branch_id
		WHERE a.employee_id = $1 AND a.clock_out_at IS NULL
		ORDER BY a.clock_in_at DESC
		LIMIT 1
	`, employeeID)
	return scanAttendanceSession(row)
}

func (s *Store) CreateAttendanceSession(ctx context.Context, tx DBTX, employeeID, branchID int64, note *string) (model.AttendanceSession, error) {
	var noteValue sql.NullString
	if note != nil {
		noteValue = sql.NullString{String: strings.TrimSpace(*note), Valid: strings.TrimSpace(*note) != ""}
	}
	row := tx.QueryRow(ctx, `
		INSERT INTO attendance_sessions (employee_id, branch_id, clock_in_at, status, note)
		VALUES ($1, $2, NOW(), 'clocked_in', $3)
		RETURNING id
	`, employeeID, branchID, noteValue)
	var id int64
	if err := row.Scan(&id); err != nil {
		return model.AttendanceSession{}, err
	}
	return s.GetAttendanceSession(ctx, id)
}

func (s *Store) CloseAttendanceSession(ctx context.Context, tx DBTX, attendanceID int64, note *string) (model.AttendanceSession, error) {
	var noteValue sql.NullString
	if note != nil {
		noteValue = sql.NullString{String: strings.TrimSpace(*note), Valid: strings.TrimSpace(*note) != ""}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE attendance_sessions
		SET
			clock_out_at = NOW(),
			status = 'clocked_out',
			note = COALESCE($2, note),
			updated_at = NOW()
		WHERE id = $1
	`, attendanceID, noteValue); err != nil {
		return model.AttendanceSession{}, err
	}
	return s.GetAttendanceSession(ctx, attendanceID)
}

func (s *Store) CorrectAttendanceSession(ctx context.Context, tx DBTX, attendanceID int64, params AttendanceCorrectionParams) (model.AttendanceSession, error) {
	var (
		clockInAt       sql.NullTime
		clockOutAt      sql.NullTime
		correctionNote  sql.NullString
		reviewerID      sql.NullInt64
		status          = strings.TrimSpace(params.Status)
	)
	if params.ClockInAt != nil {
		clockInAt = sql.NullTime{Time: *params.ClockInAt, Valid: true}
	}
	if params.ClockOutAt != nil {
		clockOutAt = sql.NullTime{Time: *params.ClockOutAt, Valid: true}
	}
	if strings.TrimSpace(params.CorrectionNote) != "" {
		correctionNote = sql.NullString{String: strings.TrimSpace(params.CorrectionNote), Valid: true}
	}
	if params.ReviewerID != nil {
		reviewerID = sql.NullInt64{Int64: *params.ReviewerID, Valid: true}
	}
	if status == "" {
		status = "corrected"
	}
	if _, err := tx.Exec(ctx, `
		UPDATE attendance_sessions
		SET
			clock_in_at = COALESCE($2, clock_in_at),
			clock_out_at = COALESCE($3, clock_out_at),
			status = $4,
			correction_note = $5,
			corrected_by_employee_id = $6,
			updated_at = NOW()
		WHERE id = $1
	`, attendanceID, clockInAt, clockOutAt, status, correctionNote, reviewerID); err != nil {
		return model.AttendanceSession{}, err
	}
	return s.GetAttendanceSession(ctx, attendanceID)
}

func scanAttendanceSession(scanner interface{ Scan(dest ...interface{}) error }) (model.AttendanceSession, error) {
	var (
		clockOutAt         sql.NullTime
		note               sql.NullString
		correctionNote     sql.NullString
		correctedBy        sql.NullInt64
		item               model.AttendanceSession
	)
	if err := scanner.Scan(
		&item.ID,
		&item.EmployeeID,
		&item.EmployeeName,
		&item.BranchID,
		&item.BranchName,
		&item.ClockInAt,
		&clockOutAt,
		&item.Status,
		&item.WorkedMinutes,
		&note,
		&correctionNote,
		&correctedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return model.AttendanceSession{}, err
	}
	item.ClockOutAt = nullTime(clockOutAt)
	item.Note = nullString(note)
	item.CorrectionNote = nullString(correctionNote)
	item.CorrectedByEmployeeID = nullInt64(correctedBy)
	return item, nil
}
