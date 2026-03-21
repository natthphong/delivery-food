package service

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/dto"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

var branchSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)

type PayrollPeriodDetail struct {
	Period  model.PayrollPeriod  `json:"period"`
	Entries []model.PayrollEntry `json:"entries"`
}

type OperationsService struct {
	store    *repository.Store
	notifier *NotificationService
}

func NewOperationsService(store *repository.Store, notifier *NotificationService) *OperationsService {
	return &OperationsService{store: store, notifier: notifier}
}

func (s *OperationsService) Dashboard(ctx context.Context, claims *backendauth.AccessClaims) (model.AdminDashboard, error) {
	if !hasPermission(claims, "dashboard.read") {
		return model.AdminDashboard{}, apperror.Forbidden("dashboard access is not allowed")
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return model.AdminDashboard{}, err
	}
	item, err := s.store.GetAdminDashboard(ctx, branchIDs)
	if err != nil {
		return model.AdminDashboard{}, apperror.Internal("failed to load dashboard", err)
	}
	return item, nil
}

func (s *OperationsService) ListEmployees(ctx context.Context, claims *backendauth.AccessClaims, search string, status string, branchID *int64) ([]model.Employee, error) {
	if !hasPermission(claims, "employees.read") && !hasPermission(claims, "employees.manage") {
		return nil, apperror.Forbidden("employee access is not allowed")
	}
	var requested []int64
	if branchID != nil {
		requested = []int64{*branchID}
	}
	branchIDs, err := scopedBranchIDs(claims, requested)
	if err != nil {
		return nil, err
	}
	items, err := s.store.ListEmployees(ctx, repository.EmployeeListFilter{
		Search:    search,
		Status:    status,
		BranchIDs: branchIDs,
	})
	if err != nil {
		return nil, apperror.Internal("failed to load employees", err)
	}
	return items, nil
}

func (s *OperationsService) UpsertEmployee(ctx context.Context, claims *backendauth.AccessClaims, employeeID *int64, request dto.EmployeeUpsertRequest) (model.Employee, error) {
	if !hasPermission(claims, "employees.manage") {
		return model.Employee{}, apperror.Forbidden("employee management is not allowed")
	}

	fieldErrors := make(map[string]string)
	if strings.TrimSpace(request.EmployeeCode) == "" {
		fieldErrors["employeeCode"] = "Employee code is required."
	}
	if strings.TrimSpace(request.FullName) == "" {
		fieldErrors["fullName"] = "Full name is required."
	}
	if len(request.RoleCodes) == 0 {
		fieldErrors["roleCodes"] = "Select at least one role."
	}
	if len(request.BranchIDs) == 0 {
		fieldErrors["branchIds"] = "Assign at least one branch."
	}
	if strings.TrimSpace(request.CompensationType) == "hourly" {
		if request.HourlyWage == nil || *request.HourlyWage <= 0 {
			fieldErrors["hourlyWage"] = "Hourly wage must be greater than 0."
		}
	}
	if strings.TrimSpace(request.CompensationType) == "salary" {
		if request.MonthlySalary == nil || *request.MonthlySalary <= 0 {
			fieldErrors["monthlySalary"] = "Monthly salary must be greater than 0."
		}
	}
	if employeeID == nil && request.Username != nil && strings.TrimSpace(*request.Username) != "" && (request.Password == nil || strings.TrimSpace(*request.Password) == "") {
		fieldErrors["password"] = "Password is required when creating a staff login."
	}
	if len(fieldErrors) > 0 {
		return model.Employee{}, apperror.Validation("Please review the employee form.", fieldErrors)
	}

	branchIDs, err := scopedBranchIDs(claims, request.BranchIDs)
	if err != nil {
		return model.Employee{}, err
	}
	if len(branchIDs) != len(uniqueInt64s(request.BranchIDs)) {
		return model.Employee{}, apperror.Forbidden("employee branch assignment is outside your scope")
	}

	joinedAt, err := parseOptionalDate(request.JoinedAt)
	if err != nil {
		return model.Employee{}, apperror.Validation("Please review the employee form.", map[string]string{
			"joinedAt": "Joined date must use YYYY-MM-DD.",
		})
	}

	roleCodes := normalizeRoleCodes(request.RoleCodes, request.EmploymentType)
	primaryBranchID := request.PrimaryBranchID
	if primaryBranchID == nil {
		value := branchIDs[0]
		primaryBranchID = &value
	}
	if !containsInt64(branchIDs, *primaryBranchID) {
		return model.Employee{}, apperror.Validation("Please review the employee form.", map[string]string{
			"primaryBranchId": "Primary branch must match one of the assigned branches.",
		})
	}

	params := repository.EmployeeRecordParams{
		EmployeeCode:      request.EmployeeCode,
		FullName:          request.FullName,
		Email:             request.Email,
		Phone:             request.Phone,
		EmploymentType:    request.EmploymentType,
		CompensationType:  request.CompensationType,
		HourlyWage:        request.HourlyWage,
		MonthlySalary:     request.MonthlySalary,
		OTEligible:        request.OTEligible,
		OTMultiplier:      request.OTMultiplier,
		PayrollVisibility: request.PayrollVisibility,
		Status:            request.Status,
		JoinedAt:          joinedAt,
	}

	var existing *model.Employee
	if employeeID != nil {
		item, err := s.store.GetEmployee(ctx, *employeeID)
		if err != nil {
			if repository.IsNotFound(err) {
				return model.Employee{}, apperror.NotFound("employee not found")
			}
			return model.Employee{}, apperror.Internal("failed to load employee", err)
		}
		existing = &item
	}

	var passwordHash *string
	if request.Password != nil && strings.TrimSpace(*request.Password) != "" {
		hash, err := HashStaffPassword(*request.Password)
		if err != nil {
			return model.Employee{}, apperror.Internal("failed to hash staff password", err)
		}
		passwordHash = &hash
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.Employee{}, apperror.Internal("failed to begin employee update", err)
	}
	defer tx.Rollback(ctx)

	var targetEmployeeID int64
	switch {
	case employeeID == nil:
		targetEmployeeID, err = s.store.InsertEmployee(ctx, tx, params)
	default:
		targetEmployeeID = *employeeID
		err = s.store.UpdateEmployee(ctx, tx, targetEmployeeID, params)
	}
	if err != nil {
		if repository.IsUniqueViolation(err, "employees_employee_code_key") {
			return model.Employee{}, apperror.Validation("Please review the employee form.", map[string]string{
				"employeeCode": "This employee code is already in use.",
			})
		}
		return model.Employee{}, apperror.Internal("failed to persist employee", err)
	}
	if err := s.store.ReplaceEmployeeRoles(ctx, tx, targetEmployeeID, roleCodes); err != nil {
		return model.Employee{}, apperror.Internal("failed to persist employee roles", err)
	}

	assignments := make([]repository.EmployeeBranchAssignmentParams, 0, len(branchIDs))
	for _, branchID := range branchIDs {
		assignments = append(assignments, repository.EmployeeBranchAssignmentParams{
			BranchID:  branchID,
			IsPrimary: branchID == *primaryBranchID,
		})
	}
	if err := s.store.ReplaceEmployeeBranches(ctx, tx, targetEmployeeID, assignments); err != nil {
		return model.Employee{}, apperror.Internal("failed to persist employee branches", err)
	}

	username := resolveStaffUsername(existing, request.Username)
	shouldManageStaffAccount := username != nil || passwordHash != nil || (existing != nil && existing.Username != nil)
	if shouldManageStaffAccount {
		if employeeID == nil && (username == nil || strings.TrimSpace(*username) == "") {
			return model.Employee{}, apperror.Validation("Please review the employee form.", map[string]string{
				"username": "Username is required when creating a staff login.",
			})
		}
		if employeeID == nil && passwordHash == nil {
			return model.Employee{}, apperror.Validation("Please review the employee form.", map[string]string{
				"password": "Password is required when creating a staff login.",
			})
		}
		if _, err := s.store.UpsertStaffAccount(ctx, tx, repository.StaffAccountUpsertParams{
			EmployeeID:         targetEmployeeID,
			Username:           stringValue(username),
			PasswordHash:       passwordHash,
			MustResetPassword:  request.MustResetPassword,
			StaffAccountStatus: mapEmployeeStatusToStaffStatus(request.Status),
		}); err != nil {
			if repository.IsUniqueViolation(err, "staff_accounts_username_key") {
				return model.Employee{}, apperror.Validation("Please review the employee form.", map[string]string{
					"username": "This username is already in use.",
				})
			}
			return model.Employee{}, apperror.Internal("failed to persist staff account", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return model.Employee{}, apperror.Internal("failed to commit employee update", err)
	}

	item, err := s.store.GetEmployee(ctx, targetEmployeeID)
	if err != nil {
		return model.Employee{}, apperror.Internal("failed to reload employee", err)
	}
	return item, nil
}

func (s *OperationsService) ListAttendance(ctx context.Context, claims *backendauth.AccessClaims, employeeID *int64, branchID *int64, status string) ([]model.AttendanceSession, error) {
	canReadAll := hasPermission(claims, "attendance.read")
	canReadSelf := hasPermission(claims, "attendance.self") && claims.EmployeeID != nil
	if !canReadAll && !canReadSelf {
		return nil, apperror.Forbidden("attendance access is not allowed")
	}
	if !canReadAll {
		employeeID = claims.EmployeeID
	}
	branchIDs, err := scopedBranchIDs(claims, pointerBranchSlice(branchID))
	if err != nil {
		return nil, err
	}
	items, err := s.store.ListAttendance(ctx, repository.AttendanceListFilter{
		EmployeeID: employeeID,
		BranchIDs:  branchIDs,
		Status:     status,
		Limit:      100,
	})
	if err != nil {
		return nil, apperror.Internal("failed to load attendance", err)
	}
	if !canReadAll && claims.EmployeeID != nil {
		items = filterAttendanceByEmployee(items, *claims.EmployeeID)
	}
	return items, nil
}

func (s *OperationsService) ClockIn(ctx context.Context, claims *backendauth.AccessClaims, request dto.ClockActionRequest) (model.AttendanceSession, error) {
	employeeID, err := selfEmployeeID(claims, "attendance.self")
	if err != nil {
		return model.AttendanceSession{}, err
	}
	if request.BranchID <= 0 {
		return model.AttendanceSession{}, apperror.BadRequest("branchId is required")
	}
	if _, err := scopedBranchIDs(claims, []int64{request.BranchID}); err != nil {
		return model.AttendanceSession{}, err
	}
	if _, err := s.store.GetOpenAttendanceSession(ctx, *employeeID); err == nil {
		return model.AttendanceSession{}, apperror.Conflict("employee is already clocked in")
	} else if !repository.IsNotFound(err) {
		return model.AttendanceSession{}, apperror.Internal("failed to inspect open attendance", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to begin attendance update", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.CreateAttendanceSession(ctx, tx, *employeeID, request.BranchID, optionalString(request.Note))
	if err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to create attendance session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to commit attendance session", err)
	}
	return item, nil
}

func (s *OperationsService) ClockOut(ctx context.Context, claims *backendauth.AccessClaims, request dto.ClockActionRequest) (model.AttendanceSession, error) {
	employeeID, err := selfEmployeeID(claims, "attendance.self")
	if err != nil {
		return model.AttendanceSession{}, err
	}
	openSession, err := s.store.GetOpenAttendanceSession(ctx, *employeeID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.AttendanceSession{}, apperror.Conflict("employee is not clocked in")
		}
		return model.AttendanceSession{}, apperror.Internal("failed to inspect open attendance", err)
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to begin attendance update", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.CloseAttendanceSession(ctx, tx, openSession.ID, optionalString(request.Note))
	if err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to close attendance session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to commit attendance session", err)
	}
	return item, nil
}

func (s *OperationsService) CorrectAttendance(ctx context.Context, claims *backendauth.AccessClaims, attendanceID int64, request dto.AttendanceCorrectionRequest) (model.AttendanceSession, error) {
	if !hasPermission(claims, "attendance.manage") {
		return model.AttendanceSession{}, apperror.Forbidden("attendance correction is not allowed")
	}
	current, err := s.store.GetAttendanceSession(ctx, attendanceID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.AttendanceSession{}, apperror.NotFound("attendance session not found")
		}
		return model.AttendanceSession{}, apperror.Internal("failed to load attendance session", err)
	}
	if _, err := scopedBranchIDs(claims, []int64{current.BranchID}); err != nil {
		return model.AttendanceSession{}, err
	}

	var clockInAt *time.Time
	var clockOutAt *time.Time
	if request.ClockInAt != nil && strings.TrimSpace(*request.ClockInAt) != "" {
		parsed, err := parseISODateTime(strings.TrimSpace(*request.ClockInAt))
		if err != nil {
			return model.AttendanceSession{}, apperror.BadRequest("clockInAt must be RFC3339")
		}
		clockInAt = &parsed
	}
	if request.ClockOutAt != nil && strings.TrimSpace(*request.ClockOutAt) != "" {
		parsed, err := parseISODateTime(strings.TrimSpace(*request.ClockOutAt))
		if err != nil {
			return model.AttendanceSession{}, apperror.BadRequest("clockOutAt must be RFC3339")
		}
		clockOutAt = &parsed
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to begin attendance correction", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.CorrectAttendanceSession(ctx, tx, attendanceID, repository.AttendanceCorrectionParams{
		ClockInAt:      clockInAt,
		ClockOutAt:     clockOutAt,
		Status:         request.Status,
		CorrectionNote: request.CorrectionNote,
		ReviewerID:     claims.EmployeeID,
	})
	if err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to correct attendance session", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.AttendanceSession{}, apperror.Internal("failed to commit attendance correction", err)
	}
	return item, nil
}

func (s *OperationsService) ListOTRequests(ctx context.Context, claims *backendauth.AccessClaims, status string) ([]model.OTRequest, error) {
	canReview := hasPermission(claims, "ot.review")
	canSelf := hasPermission(claims, "ot.self") && claims.EmployeeID != nil
	if !canReview && !canSelf {
		return nil, apperror.Forbidden("OT access is not allowed")
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return nil, err
	}
	filter := repository.OTRequestListFilter{
		BranchIDs: branchIDs,
		Status:    status,
		Limit:     100,
	}
	if !canReview {
		filter.EmployeeID = claims.EmployeeID
	}
	items, err := s.store.ListOTRequests(ctx, filter)
	if err != nil {
		return nil, apperror.Internal("failed to load OT requests", err)
	}
	return items, nil
}

func (s *OperationsService) CreateOTRequest(ctx context.Context, claims *backendauth.AccessClaims, request dto.OTRequestCreate) (model.OTRequest, error) {
	employeeID, err := selfEmployeeID(claims, "ot.self")
	if err != nil {
		return model.OTRequest{}, err
	}
	if request.BranchID <= 0 || request.RequestedMinutes <= 0 || strings.TrimSpace(request.Reason) == "" {
		return model.OTRequest{}, apperror.BadRequest("branchId, requestedMinutes, and reason are required")
	}
	if _, err := scopedBranchIDs(claims, []int64{request.BranchID}); err != nil {
		return model.OTRequest{}, err
	}
	configs, err := loadConfigValues(ctx, s.store)
	if err != nil {
		return model.OTRequest{}, err
	}
	minOTMinutes := configInt(configs, "MIN_OT_REQUEST_MINUTES", 30)
	if request.RequestedMinutes < minOTMinutes {
		return model.OTRequest{}, apperror.BadRequest("requestedMinutes is below the configured OT minimum")
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.OTRequest{}, apperror.Internal("failed to begin OT request", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.CreateOTRequest(ctx, tx, *employeeID, request.BranchID, request.AttendanceSessionID, request.RequestedMinutes, request.Reason)
	if err != nil {
		return model.OTRequest{}, apperror.Internal("failed to create OT request", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.OTRequest{}, apperror.Internal("failed to commit OT request", err)
	}
	return item, nil
}

func (s *OperationsService) ReviewOTRequest(ctx context.Context, claims *backendauth.AccessClaims, requestID int64, request dto.OTReviewRequest) (model.OTRequest, error) {
	if !hasPermission(claims, "ot.review") {
		return model.OTRequest{}, apperror.Forbidden("OT review is not allowed")
	}
	current, err := s.store.GetOTRequest(ctx, requestID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.OTRequest{}, apperror.NotFound("OT request not found")
		}
		return model.OTRequest{}, apperror.Internal("failed to load OT request", err)
	}
	if _, err := scopedBranchIDs(claims, []int64{current.BranchID}); err != nil {
		return model.OTRequest{}, err
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.OTRequest{}, apperror.Internal("failed to begin OT review", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.ReviewOTRequest(ctx, tx, requestID, request.Status, request.ApprovedMinutes, request.ReviewNote, claims.EmployeeID)
	if err != nil {
		return model.OTRequest{}, apperror.Internal("failed to review OT request", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.OTRequest{}, apperror.Internal("failed to commit OT review", err)
	}
	return item, nil
}

func (s *OperationsService) GetPayrollSettings(ctx context.Context, claims *backendauth.AccessClaims) (model.PayrollSettings, error) {
	if !hasPermission(claims, "payroll.read") && !hasPermission(claims, "payroll.manage") {
		return model.PayrollSettings{}, apperror.Forbidden("payroll access is not allowed")
	}
	companyID, err := s.store.GetDefaultCompanyID(ctx)
	if err != nil {
		return model.PayrollSettings{}, apperror.Internal("failed to resolve company", err)
	}
	item, err := s.store.GetPayrollSettings(ctx, companyID)
	if err != nil {
		return model.PayrollSettings{}, apperror.Internal("failed to load payroll settings", err)
	}
	return item, nil
}

func (s *OperationsService) UpdatePayrollSettings(ctx context.Context, claims *backendauth.AccessClaims, request dto.PayrollSettingsUpdateRequest) (model.PayrollSettings, error) {
	if !hasPermission(claims, "payroll.manage") && !hasPermission(claims, "settings.manage") {
		return model.PayrollSettings{}, apperror.Forbidden("payroll settings management is not allowed")
	}
	companyID, err := s.store.GetDefaultCompanyID(ctx)
	if err != nil {
		return model.PayrollSettings{}, apperror.Internal("failed to resolve company", err)
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.PayrollSettings{}, apperror.Internal("failed to begin payroll settings update", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.UpdatePayrollSettings(ctx, tx, companyID, model.PayrollSettings{
		StandardDailyMinutes:    request.StandardDailyMinutes,
		StandardMonthlyMinutes:  request.StandardMonthlyMinutes,
		OvertimeRoundingMinutes: request.OvertimeRoundingMinutes,
		DefaultOTMultiplier:     request.DefaultOTMultiplier,
	}); err != nil {
		return model.PayrollSettings{}, apperror.Internal("failed to update payroll settings", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.PayrollSettings{}, apperror.Internal("failed to commit payroll settings update", err)
	}
	return s.GetPayrollSettings(ctx, claims)
}

func (s *OperationsService) ListPayrollPeriods(ctx context.Context, claims *backendauth.AccessClaims) ([]model.PayrollPeriod, error) {
	if !hasPermission(claims, "payroll.read") && !hasPermission(claims, "payroll.manage") {
		return nil, apperror.Forbidden("payroll access is not allowed")
	}
	companyID, err := s.store.GetDefaultCompanyID(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to resolve company", err)
	}
	items, err := s.store.ListPayrollPeriods(ctx, companyID, 50)
	if err != nil {
		return nil, apperror.Internal("failed to load payroll periods", err)
	}
	return items, nil
}

func (s *OperationsService) CreatePayrollPeriod(ctx context.Context, claims *backendauth.AccessClaims, request dto.PayrollPeriodCreateRequest) (model.PayrollPeriod, error) {
	if !hasPermission(claims, "payroll.manage") {
		return model.PayrollPeriod{}, apperror.Forbidden("payroll period management is not allowed")
	}
	startsAt, err := parseISODate(strings.TrimSpace(request.StartsAt))
	if err != nil {
		return model.PayrollPeriod{}, apperror.BadRequest("startsAt must be YYYY-MM-DD")
	}
	endsAt, err := parseISODate(strings.TrimSpace(request.EndsAt))
	if err != nil {
		return model.PayrollPeriod{}, apperror.BadRequest("endsAt must be YYYY-MM-DD")
	}
	companyID, err := s.store.GetDefaultCompanyID(ctx)
	if err != nil {
		return model.PayrollPeriod{}, apperror.Internal("failed to resolve company", err)
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.PayrollPeriod{}, apperror.Internal("failed to begin payroll period creation", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.CreatePayrollPeriod(ctx, tx, companyID, request.Code, startsAt, endsAt, optionalString(request.Note))
	if err != nil {
		return model.PayrollPeriod{}, apperror.Internal("failed to create payroll period", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.PayrollPeriod{}, apperror.Internal("failed to commit payroll period", err)
	}
	return item, nil
}

func (s *OperationsService) GetPayrollPeriodDetail(ctx context.Context, claims *backendauth.AccessClaims, periodID int64) (PayrollPeriodDetail, error) {
	if !hasPermission(claims, "payroll.read") && !hasPermission(claims, "payroll.manage") {
		return PayrollPeriodDetail{}, apperror.Forbidden("payroll access is not allowed")
	}
	period, err := s.store.GetPayrollPeriod(ctx, periodID)
	if err != nil {
		if repository.IsNotFound(err) {
			return PayrollPeriodDetail{}, apperror.NotFound("payroll period not found")
		}
		return PayrollPeriodDetail{}, apperror.Internal("failed to load payroll period", err)
	}
	entries, err := s.store.ListPayrollEntries(ctx, periodID)
	if err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to load payroll entries", err)
	}
	return PayrollPeriodDetail{Period: period, Entries: entries}, nil
}

func (s *OperationsService) GeneratePayrollPeriod(ctx context.Context, claims *backendauth.AccessClaims, periodID int64, request dto.PayrollGenerateRequest) (PayrollPeriodDetail, error) {
	if !hasPermission(claims, "payroll.manage") {
		return PayrollPeriodDetail{}, apperror.Forbidden("payroll generation is not allowed")
	}
	period, err := s.store.GetPayrollPeriod(ctx, periodID)
	if err != nil {
		if repository.IsNotFound(err) {
			return PayrollPeriodDetail{}, apperror.NotFound("payroll period not found")
		}
		return PayrollPeriodDetail{}, apperror.Internal("failed to load payroll period", err)
	}
	settings, err := s.store.GetPayrollSettings(ctx, period.CompanyID)
	if err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to load payroll settings", err)
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return PayrollPeriodDetail{}, err
	}
	inputs, err := s.store.ListPayrollInputs(ctx, period, branchIDs)
	if err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to prepare payroll inputs", err)
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to begin payroll generation", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.DeletePayrollEntriesByPeriod(ctx, tx, periodID); err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to clear payroll entries", err)
	}
	generatedAt := time.Now()
	for _, input := range inputs {
		calculation := ComputePayrollCalculation(input, period, settings, request.AdjustmentDefault)
		if err := s.store.InsertPayrollEntry(ctx, tx, repository.PayrollEntryInsertParams{
			PayrollPeriodID:   periodID,
			EmployeeID:        input.EmployeeID,
			BranchID:          input.BranchID,
			AttendanceMinutes: calculation.AttendanceMinutes,
			RegularMinutes:    calculation.RegularMinutes,
			OvertimeMinutes:   calculation.OvertimeMinutes,
			RegularAmount:     calculation.RegularAmount,
			OvertimeAmount:    calculation.OvertimeAmount,
			AdjustmentAmount:  calculation.AdjustmentAmount,
			GrossAmount:       calculation.GrossAmount,
			GeneratedAt:       &generatedAt,
		}); err != nil {
			return PayrollPeriodDetail{}, apperror.Internal("failed to insert payroll entry", err)
		}
	}
	if err := s.store.UpdatePayrollPeriodStatus(ctx, tx, periodID, "calculated"); err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to update payroll period status", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return PayrollPeriodDetail{}, apperror.Internal("failed to commit payroll generation", err)
	}
	return s.GetPayrollPeriodDetail(ctx, claims, periodID)
}

func (s *OperationsService) ListBranches(ctx context.Context, claims *backendauth.AccessClaims) ([]model.BranchSummary, error) {
	if !hasPermission(claims, "branches.read") && !hasPermission(claims, "branches.manage") {
		return nil, apperror.Forbidden("branch access is not allowed")
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return nil, err
	}
	items, err := s.store.ListBranchSummaries(ctx, branchIDs)
	if err != nil {
		return nil, apperror.Internal("failed to load branches", err)
	}
	return items, nil
}

func (s *OperationsService) CreateBranch(ctx context.Context, claims *backendauth.AccessClaims, request dto.BranchCreateRequest) (model.BranchSummary, error) {
	if !hasPermission(claims, "branches.manage") || !canCreateBranch(claims) {
		return model.BranchSummary{}, apperror.Forbidden("branch creation is not allowed")
	}

	fieldErrors := make(map[string]string)
	if strings.TrimSpace(request.Name) == "" {
		fieldErrors["name"] = "Branch name is required."
	}
	if request.RiderDeliveryFee < 0 {
		fieldErrors["riderDeliveryFee"] = "Rider delivery fee cannot be negative."
	}
	copyMode := normalizeCopyMode(request.CopyMode)
	if copyMode == "invalid" {
		fieldErrors["copyMode"] = "Copy mode must be none, all, or selected."
	}
	if copyMode != "none" && request.CopyFromBranchID == nil {
		fieldErrors["copyFromBranchId"] = "Select a source branch before copying menu items."
	}
	if copyMode == "selected" && len(request.CategoryIDs) == 0 && len(request.ProductIDs) == 0 {
		fieldErrors["productIds"] = "Choose at least one category or menu item to copy."
	}
	if len(fieldErrors) > 0 {
		return model.BranchSummary{}, apperror.Validation("Please review the branch form.", fieldErrors)
	}

	companyID, err := s.store.GetDefaultCompanyID(ctx)
	if err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to resolve company", err)
	}

	slug := buildBranchSlug(request.Name, request.Slug)
	var copiedProductIDs []int64
	if copyMode != "none" && request.CopyFromBranchID != nil {
		if _, err := scopedBranchIDs(claims, []int64{*request.CopyFromBranchID}); err != nil {
			return model.BranchSummary{}, err
		}
		sourceProducts, err := s.store.ListAdminBranchProducts(ctx, *request.CopyFromBranchID)
		if err != nil {
			return model.BranchSummary{}, apperror.Internal("failed to inspect source branch menu", err)
		}
		copiedProductIDs = selectBranchCopyProductIDs(sourceProducts, copyMode, request.CategoryIDs, request.ProductIDs)
		if copyMode == "selected" && len(copiedProductIDs) == 0 {
			return model.BranchSummary{}, apperror.Validation("Please review the branch form.", map[string]string{
				"productIds": "No menu items matched the selected categories or products.",
			})
		}
	}

	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to begin branch creation", err)
	}
	defer tx.Rollback(ctx)

	branchID, err := s.store.CreateBranch(ctx, tx, repository.BranchCreateParams{
		CompanyID:             companyID,
		Slug:                  slug,
		Name:                  request.Name,
		Description:           request.Description,
		ImageURL:              request.ImageURL,
		AddressLine:           request.AddressLine,
		Lat:                   request.Lat,
		Lng:                   request.Lng,
		IsForceClosed:         request.IsForceClosed,
		AcceptingOrders:       request.AcceptingOrders,
		SupportsPickup:        request.SupportsPickup,
		SupportsRiderDelivery: request.SupportsRiderDelivery,
		RiderDeliveryFee:      request.RiderDeliveryFee,
		OperationalNote:       request.OperationalNote,
	})
	if err != nil {
		if repository.IsUniqueViolation(err, "branches_company_slug_unique") {
			return model.BranchSummary{}, apperror.Validation("Please review the branch form.", map[string]string{
				"slug": "This branch slug is already in use.",
			})
		}
		return model.BranchSummary{}, apperror.Internal("failed to create branch", err)
	}

	if copyMode != "none" && request.CopyFromBranchID != nil {
		if err := s.store.CopyBranchProducts(ctx, tx, *request.CopyFromBranchID, branchID, copiedProductIDs); err != nil {
			return model.BranchSummary{}, apperror.Internal("failed to copy source branch menu", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to commit branch creation", err)
	}

	item, err := s.store.GetBranchSummary(ctx, branchID)
	if err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to reload created branch", err)
	}
	return item, nil
}

func (s *OperationsService) UpdateBranch(ctx context.Context, claims *backendauth.AccessClaims, branchID int64, request dto.BranchOperationsUpdateRequest) (model.BranchSummary, error) {
	if !hasPermission(claims, "branches.manage") {
		return model.BranchSummary{}, apperror.Forbidden("branch management is not allowed")
	}
	if _, err := scopedBranchIDs(claims, []int64{branchID}); err != nil {
		return model.BranchSummary{}, err
	}
	if request.RiderDeliveryFee != nil && *request.RiderDeliveryFee < 0 {
		return model.BranchSummary{}, apperror.Validation("Please review the branch form.", map[string]string{
			"riderDeliveryFee": "Rider delivery fee cannot be negative.",
		})
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to begin branch update", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.UpdateBranchOperations(ctx, tx, branchID, repository.BranchOperationsUpdateParams{
		Name:                  request.Name,
		IsForceClosed:         request.IsForceClosed,
		AcceptingOrders:       request.AcceptingOrders,
		SupportsPickup:        request.SupportsPickup,
		SupportsRiderDelivery: request.SupportsRiderDelivery,
		RiderDeliveryFee:      request.RiderDeliveryFee,
		OperationalNote:       request.OperationalNote,
	}); err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to update branch", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to commit branch update", err)
	}
	item, err := s.store.GetBranchSummary(ctx, branchID)
	if err != nil {
		return model.BranchSummary{}, apperror.Internal("failed to reload branch", err)
	}
	return item, nil
}

func (s *OperationsService) ListBranchProducts(ctx context.Context, claims *backendauth.AccessClaims, branchID int64) ([]model.AdminBranchProduct, error) {
	if !hasPermission(claims, "stock.read") && !hasPermission(claims, "stock.manage") {
		return nil, apperror.Forbidden("stock access is not allowed")
	}
	if _, err := scopedBranchIDs(claims, []int64{branchID}); err != nil {
		return nil, err
	}
	items, err := s.store.ListAdminBranchProducts(ctx, branchID)
	if err != nil {
		return nil, apperror.Internal("failed to load branch products", err)
	}
	return items, nil
}

func (s *OperationsService) UpdateBranchProduct(ctx context.Context, claims *backendauth.AccessClaims, branchID int64, productID int64, request dto.BranchProductOperationsUpdateRequest) ([]model.AdminBranchProduct, error) {
	if !hasPermission(claims, "stock.manage") {
		return nil, apperror.Forbidden("stock management is not allowed")
	}
	if _, err := scopedBranchIDs(claims, []int64{branchID}); err != nil {
		return nil, err
	}
	if request.StockQty != nil && *request.StockQty < 0 {
		return nil, apperror.Validation("Please review the product override.", map[string]string{
			"stockQty": "Stock quantity cannot be negative.",
		})
	}
	if request.ReorderLevel != nil && *request.ReorderLevel < 0 {
		return nil, apperror.Validation("Please review the product override.", map[string]string{
			"reorderLevel": "Reorder level cannot be negative.",
		})
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to begin stock update", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.UpdateBranchProductOperations(ctx, tx, branchID, productID, repository.BranchProductOperationsUpdateParams{
		IsEnabled:           request.IsEnabled,
		IsTemporarilyClosed: request.IsTemporarilyClosed,
		StockQty:            request.StockQty,
		ReorderLevel:        request.ReorderLevel,
		AvailabilityNote:    request.AvailabilityNote,
	}); err != nil {
		return nil, apperror.Internal("failed to update branch product", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperror.Internal("failed to commit stock update", err)
	}
	return s.ListBranchProducts(ctx, claims, branchID)
}

func (s *OperationsService) AdjustStock(ctx context.Context, claims *backendauth.AccessClaims, branchID int64, request dto.StockAdjustmentRequest) ([]model.AdminBranchProduct, error) {
	if !hasPermission(claims, "stock.manage") {
		return nil, apperror.Forbidden("stock management is not allowed")
	}
	if _, err := scopedBranchIDs(claims, []int64{branchID}); err != nil {
		return nil, err
	}
	fieldErrors := make(map[string]string)
	if request.ProductID <= 0 {
		fieldErrors["productId"] = "Select a product before recording stock movement."
	}
	if request.DeltaQty == 0 {
		fieldErrors["deltaQty"] = "Change quantity cannot be 0."
	}
	if strings.TrimSpace(request.Reason) == "" {
		fieldErrors["reason"] = "Select a stock movement reason."
	}
	if len(fieldErrors) > 0 {
		return nil, apperror.Validation("Please review the stock adjustment.", fieldErrors)
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to begin stock adjustment", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.AdjustBranchStock(ctx, tx, branchID, request.ProductID, request.DeltaQty, request.Reason, optionalString(request.Note), claims.EmployeeID); err != nil {
		if repository.IsNotFound(err) || err == sql.ErrNoRows {
			return nil, apperror.Conflict("stock adjustment would make quantity negative or product was not found")
		}
		return nil, apperror.Internal("failed to adjust stock", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperror.Internal("failed to commit stock adjustment", err)
	}
	return s.ListBranchProducts(ctx, claims, branchID)
}

func (s *OperationsService) ListOrders(ctx context.Context, claims *backendauth.AccessClaims, status string) ([]model.AdminOrder, error) {
	if !hasPermission(claims, "orders.read") && !hasPermission(claims, "orders.manage") {
		return nil, apperror.Forbidden("order access is not allowed")
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return nil, err
	}
	items, err := s.store.ListAdminOrders(ctx, repository.AdminOrderListFilter{
		BranchIDs: branchIDs,
		Status:    status,
		Limit:     100,
	})
	if err != nil {
		return nil, apperror.Internal("failed to load orders", err)
	}
	for index := range items {
		items[index] = enrichAdminOrder(items[index])
	}
	return items, nil
}

func (s *OperationsService) GetOrderDetail(ctx context.Context, claims *backendauth.AccessClaims, orderID int64) (model.AdminOrder, error) {
	if !hasPermission(claims, "orders.read") && !hasPermission(claims, "orders.manage") {
		return model.AdminOrder{}, apperror.Forbidden("order access is not allowed")
	}
	item, err := s.store.GetAdminOrderDetail(ctx, orderID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.AdminOrder{}, apperror.NotFound("order not found")
		}
		return model.AdminOrder{}, apperror.Internal("failed to load order detail", err)
	}
	if _, err := scopedBranchIDs(claims, []int64{item.BranchID}); err != nil {
		return model.AdminOrder{}, err
	}
	return enrichAdminOrder(item), nil
}

func (s *OperationsService) UpdateOrderStatus(ctx context.Context, claims *backendauth.AccessClaims, orderID int64, request dto.OrderStatusUpdateRequest) error {
	if !hasPermission(claims, "orders.manage") {
		return apperror.Forbidden("order management is not allowed")
	}
	target, err := s.store.GetAdminOrderDetail(ctx, orderID)
	if err != nil {
		if repository.IsNotFound(err) {
			return apperror.NotFound("order not found")
		}
		return apperror.Internal("failed to inspect order scope", err)
	}
	if _, err := scopedBranchIDs(claims, []int64{target.BranchID}); err != nil {
		return err
	}
	target = enrichAdminOrder(target)
	nextStatus := strings.TrimSpace(request.Status)
	if nextStatus == "" {
		return apperror.Validation("Please review the order action.", map[string]string{
			"status": "Choose the next status before saving.",
		})
	}
	if nextStatus == target.Status {
		return nil
	}
	if !containsString(target.AllowedStatuses, nextStatus) {
		return apperror.Validation("Please review the order action.", map[string]string{
			"status": fmt.Sprintf("Status %s is not allowed from %s for this order.", nextStatus, target.Status),
		})
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return apperror.Internal("failed to begin order update", err)
	}
	defer tx.Rollback(ctx)
	if err := s.store.UpdateOrderStatus(ctx, tx, orderID, nextStatus); err != nil {
		return apperror.Internal("failed to update order status", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return apperror.Internal("failed to commit order update", err)
	}
	if s.notifier != nil && nextStatus == "READY" {
		user, userErr := s.store.GetUserByID(ctx, target.UserID)
		order, orderErr := s.store.GetOrderByTransaction(ctx, target.UserID, target.TransactionID)
		if userErr == nil && orderErr == nil {
			_ = s.notifier.NotifyOrderReady(ctx, user, order)
		}
	}
	return nil
}

func (s *OperationsService) ListDeliveryJobs(ctx context.Context, claims *backendauth.AccessClaims, status string) ([]model.DeliveryJob, error) {
	canRead := hasPermission(claims, "rider.jobs.read") || hasPermission(claims, "orders.manage")
	if !canRead {
		return nil, apperror.Forbidden("rider job access is not allowed")
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return nil, err
	}
	filter := repository.DeliveryJobListFilter{
		BranchIDs: branchIDs,
		Status:    status,
		Limit:     100,
	}
	if hasRole(claims, "rider") && claims.EmployeeID != nil && !hasPermission(claims, "orders.manage") {
		filter.AssignedEmployeeID = claims.EmployeeID
	}
	items, err := s.store.ListDeliveryJobs(ctx, filter)
	if err != nil {
		return nil, apperror.Internal("failed to load rider jobs", err)
	}
	return items, nil
}

func (s *OperationsService) ClaimDeliveryJob(ctx context.Context, claims *backendauth.AccessClaims, jobID int64) (model.DeliveryJob, error) {
	employeeID, err := selfEmployeeID(claims, "rider.jobs.claim")
	if err != nil {
		return model.DeliveryJob{}, err
	}
	job, err := s.store.GetDeliveryJob(ctx, jobID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.DeliveryJob{}, apperror.NotFound("delivery job not found")
		}
		return model.DeliveryJob{}, apperror.Internal("failed to load delivery job", err)
	}
	if _, err := scopedBranchIDs(claims, []int64{job.BranchID}); err != nil {
		return model.DeliveryJob{}, err
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to begin rider claim", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.ClaimDeliveryJob(ctx, tx, jobID, *employeeID)
	if err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to claim delivery job", err)
	}
	if err := s.store.UpdateOrderStatus(ctx, tx, item.OrderID, "DELIVERY"); err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to sync order status", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to commit rider claim", err)
	}
	if s.notifier != nil {
		target, targetErr := s.store.GetAdminOrderByID(ctx, item.OrderID)
		if targetErr == nil {
			user, userErr := s.store.GetUserByID(ctx, target.UserID)
			order, orderErr := s.store.GetOrderByTransaction(ctx, target.UserID, target.TransactionID)
			if userErr == nil && orderErr == nil {
				_ = s.notifier.NotifyRiderAssigned(ctx, user, order)
			}
		}
	}
	return item, nil
}

func (s *OperationsService) UpdateDeliveryJobStatus(ctx context.Context, claims *backendauth.AccessClaims, jobID int64, request dto.RiderJobStatusRequest) (model.DeliveryJob, error) {
	canManageJobs := hasPermission(claims, "rider.jobs.claim") || hasPermission(claims, "orders.manage")
	if !canManageJobs {
		return model.DeliveryJob{}, apperror.Forbidden("rider job updates are not allowed")
	}
	job, err := s.store.GetDeliveryJob(ctx, jobID)
	if err != nil {
		if repository.IsNotFound(err) {
			return model.DeliveryJob{}, apperror.NotFound("delivery job not found")
		}
		return model.DeliveryJob{}, apperror.Internal("failed to load delivery job", err)
	}
	if _, err := scopedBranchIDs(claims, []int64{job.BranchID}); err != nil {
		return model.DeliveryJob{}, err
	}
	if hasRole(claims, "rider") && claims.EmployeeID != nil && !hasPermission(claims, "orders.manage") {
		if job.AssignedRiderEmployeeID == nil || *job.AssignedRiderEmployeeID != *claims.EmployeeID {
			return model.DeliveryJob{}, apperror.Forbidden("delivery job is not assigned to this rider")
		}
	}
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to begin rider update", err)
	}
	defer tx.Rollback(ctx)
	item, err := s.store.UpdateDeliveryJobStatus(ctx, tx, jobID, request.Status, optionalString(request.FailedReason))
	if err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to update delivery job", err)
	}
	nextOrderStatus := mapDeliveryJobStatusToOrderStatus(item.Status)
	if nextOrderStatus != "" {
		if err := s.store.UpdateOrderStatus(ctx, tx, item.OrderID, nextOrderStatus); err != nil {
			return model.DeliveryJob{}, apperror.Internal("failed to sync order status", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return model.DeliveryJob{}, apperror.Internal("failed to commit rider update", err)
	}
	if s.notifier != nil && item.Status == "picked_up" {
		target, targetErr := s.store.GetAdminOrderByID(ctx, item.OrderID)
		if targetErr == nil {
			user, userErr := s.store.GetUserByID(ctx, target.UserID)
			order, orderErr := s.store.GetOrderByTransaction(ctx, target.UserID, target.TransactionID)
			if userErr == nil && orderErr == nil {
				_ = s.notifier.NotifyRiderOnTheWay(ctx, user, order)
			}
		}
	}
	return item, nil
}

func (s *OperationsService) ListPayments(ctx context.Context, claims *backendauth.AccessClaims, status string) ([]model.AdminPaymentRecord, error) {
	if !hasPermission(claims, "payments.read") && !hasPermission(claims, "payments.manage") {
		return nil, apperror.Forbidden("payment access is not allowed")
	}
	branchIDs, err := scopedBranchIDs(claims, nil)
	if err != nil {
		return nil, err
	}
	items, err := s.store.ListAdminPayments(ctx, repository.PaymentRecordListFilter{
		BranchIDs: branchIDs,
		Status:    status,
		Limit:     100,
	})
	if err != nil {
		return nil, apperror.Internal("failed to load payments", err)
	}
	return items, nil
}

func (s *OperationsService) ListPaymentProviders(ctx context.Context, claims *backendauth.AccessClaims) ([]model.PaymentProvider, error) {
	if !hasPermission(claims, "payments.read") && !hasPermission(claims, "payments.manage") {
		return nil, apperror.Forbidden("payment access is not allowed")
	}
	items, err := s.store.ListPaymentProviders(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to load payment providers", err)
	}
	return items, nil
}

func (s *OperationsService) ListWebhookEvents(ctx context.Context, claims *backendauth.AccessClaims) ([]model.PaymentWebhookEvent, error) {
	if !hasPermission(claims, "payments.read") && !hasPermission(claims, "payments.manage") {
		return nil, apperror.Forbidden("payment access is not allowed")
	}
	items, err := s.store.ListPaymentWebhookEvents(ctx, 100)
	if err != nil {
		return nil, apperror.Internal("failed to load payment webhook events", err)
	}
	return items, nil
}

func hasPermission(claims *backendauth.AccessClaims, permission string) bool {
	if claims == nil {
		return false
	}
	for _, item := range claims.Permissions {
		if item == permission {
			return true
		}
	}
	return false
}

func hasRole(claims *backendauth.AccessClaims, role string) bool {
	if claims == nil {
		return false
	}
	for _, item := range claims.Roles {
		if item == role {
			return true
		}
	}
	return false
}

func scopedBranchIDs(claims *backendauth.AccessClaims, requested []int64) ([]int64, error) {
	requested = uniqueInt64s(requested)
	if claims == nil {
		return nil, apperror.Unauthorized("admin session is required")
	}
	if hasRole(claims, "owner") || hasRole(claims, "manager") || claims.ActorType == "bootstrap_admin" {
		return requested, nil
	}
	if len(requested) == 0 {
		return append([]int64(nil), claims.BranchIDs...), nil
	}
	for _, branchID := range requested {
		if !containsInt64(claims.BranchIDs, branchID) {
			return nil, apperror.Forbidden("branch access is outside your scope")
		}
	}
	return requested, nil
}

func selfEmployeeID(claims *backendauth.AccessClaims, permission string) (*int64, error) {
	if !hasPermission(claims, permission) {
		return nil, apperror.Forbidden("employee self-service access is not allowed")
	}
	if claims == nil || claims.EmployeeID == nil {
		return nil, apperror.Forbidden("employee account is not linked")
	}
	return claims.EmployeeID, nil
}

func parseOptionalDate(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	parsed, err := parseISODate(strings.TrimSpace(*value))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func normalizeRoleCodes(values []string, employmentType string) []string {
	set := make(map[string]struct{}, len(values)+1)
	for _, item := range values {
		code := strings.TrimSpace(item)
		if code == "" {
			continue
		}
		set[code] = struct{}{}
	}
	if employmentType == "rider" {
		set["rider"] = struct{}{}
	}
	result := make([]string, 0, len(set))
	for item := range set {
		result = append(result, item)
	}
	sort.Strings(result)
	return result
}

func mapEmployeeStatusToStaffStatus(status string) string {
	if strings.TrimSpace(status) == "inactive" {
		return "disabled"
	}
	return "active"
}

func resolveStaffUsername(existing *model.Employee, requested *string) *string {
	if requested != nil {
		value := strings.TrimSpace(*requested)
		return &value
	}
	if existing != nil && existing.Username != nil {
		value := strings.TrimSpace(*existing.Username)
		return &value
	}
	return nil
}

func uniqueInt64s(values []int64) []int64 {
	set := make(map[int64]struct{}, len(values))
	for _, value := range values {
		set[value] = struct{}{}
	}
	result := make([]int64, 0, len(set))
	for value := range set {
		result = append(result, value)
	}
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}

func containsInt64(values []int64, target int64) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func pointerBranchSlice(branchID *int64) []int64 {
	if branchID == nil {
		return nil
	}
	return []int64{*branchID}
}

func canCreateBranch(claims *backendauth.AccessClaims) bool {
	return claims != nil && (claims.ActorType == "bootstrap_admin" || hasRole(claims, "owner") || hasRole(claims, "manager"))
}

func normalizeCopyMode(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "", "none":
		return "none"
	case "all":
		return "all"
	case "selected":
		return "selected"
	default:
		return "invalid"
	}
}

func buildBranchSlug(name string, requested *string) string {
	source := name
	if requested != nil && strings.TrimSpace(*requested) != "" {
		source = *requested
	}
	normalized := strings.ToLower(strings.TrimSpace(source))
	normalized = branchSlugPattern.ReplaceAllString(normalized, "-")
	normalized = strings.Trim(normalized, "-")
	if normalized == "" {
		return fmt.Sprintf("branch-%d", time.Now().Unix())
	}
	return normalized
}

func selectBranchCopyProductIDs(products []model.AdminBranchProduct, copyMode string, categoryIDs []int64, productIDs []int64) []int64 {
	if copyMode == "none" {
		return nil
	}
	if copyMode == "all" {
		return nil
	}
	productSet := make(map[int64]struct{}, len(productIDs))
	for _, productID := range productIDs {
		productSet[productID] = struct{}{}
	}
	categorySet := make(map[int64]struct{}, len(categoryIDs))
	for _, categoryID := range categoryIDs {
		categorySet[categoryID] = struct{}{}
	}
	selected := make([]int64, 0)
	for _, product := range products {
		if _, ok := productSet[product.ProductID]; ok {
			selected = append(selected, product.ProductID)
			continue
		}
		for _, category := range product.Categories {
			if _, ok := categorySet[category.ID]; ok {
				selected = append(selected, product.ProductID)
				break
			}
		}
	}
	return uniqueInt64s(selected)
}

func filterAttendanceByEmployee(items []model.AttendanceSession, employeeID int64) []model.AttendanceSession {
	filtered := make([]model.AttendanceSession, 0, len(items))
	for _, item := range items {
		if item.EmployeeID == employeeID {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func enrichAdminOrder(item model.AdminOrder) model.AdminOrder {
	if item.Items == nil {
		item.Items = make([]model.OrderItem, 0)
	}
	item.AllowedStatuses = allowedOrderStatusTransitions(item)
	return item
}

func allowedOrderStatusTransitions(item model.AdminOrder) []string {
	current := strings.TrimSpace(item.Status)
	mode := strings.TrimSpace(item.FulfillmentMode)
	switch current {
	case "PENDING":
		if mode == "pickup" {
			return []string{"PREPARE", "READY", "REJECTED"}
		}
		return []string{"PREPARE", "READY", "REJECTED"}
	case "PREPARE":
		return []string{"READY", "REJECTED"}
	case "READY":
		if mode == "pickup" {
			return []string{"COMPLETED", "REJECTED"}
		}
		return []string{"DELIVERY", "REJECTED"}
	case "DELIVERY":
		return []string{"COMPLETED", "REJECTED"}
	default:
		return []string{}
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func mapDeliveryJobStatusToOrderStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "assigned_to_rider", "picked_up":
		return "DELIVERY"
	case "delivered":
		return "COMPLETED"
	case "failed_delivery", "cancelled":
		return "REJECTED"
	default:
		return ""
	}
}
