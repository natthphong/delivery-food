package dto

type AdminLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AdminRefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type EmployeeUpsertRequest struct {
	EmployeeCode      string   `json:"employeeCode"`
	FullName          string   `json:"fullName"`
	Email             *string  `json:"email"`
	Phone             *string  `json:"phone"`
	EmploymentType    string   `json:"employmentType"`
	CompensationType  string   `json:"compensationType"`
	HourlyWage        *float64 `json:"hourlyWage"`
	MonthlySalary     *float64 `json:"monthlySalary"`
	OTEligible        bool     `json:"otEligible"`
	OTMultiplier      float64  `json:"otMultiplier"`
	PayrollVisibility bool     `json:"payrollVisibility"`
	Status            string   `json:"status"`
	JoinedAt          *string  `json:"joinedAt"`
	RoleCodes         []string `json:"roleCodes"`
	BranchIDs         []int64  `json:"branchIds"`
	PrimaryBranchID   *int64   `json:"primaryBranchId"`
	Username          *string  `json:"username"`
	Password          *string  `json:"password"`
	MustResetPassword bool     `json:"mustResetPassword"`
}

type ClockActionRequest struct {
	BranchID int64  `json:"branchId"`
	Note     string `json:"note"`
}

type AttendanceCorrectionRequest struct {
	ClockInAt      *string `json:"clockInAt"`
	ClockOutAt     *string `json:"clockOutAt"`
	Status         string  `json:"status"`
	CorrectionNote string  `json:"correctionNote"`
}

type OTRequestCreate struct {
	BranchID            int64  `json:"branchId"`
	AttendanceSessionID *int64 `json:"attendanceSessionId"`
	RequestedMinutes    int    `json:"requestedMinutes"`
	Reason              string `json:"reason"`
}

type OTReviewRequest struct {
	Status          string `json:"status"`
	ApprovedMinutes *int   `json:"approvedMinutes"`
	ReviewNote      string `json:"reviewNote"`
}

type PayrollSettingsUpdateRequest struct {
	StandardDailyMinutes    int     `json:"standardDailyMinutes"`
	StandardMonthlyMinutes  int     `json:"standardMonthlyMinutes"`
	OvertimeRoundingMinutes int     `json:"overtimeRoundingMinutes"`
	DefaultOTMultiplier     float64 `json:"defaultOtMultiplier"`
}

type PayrollPeriodCreateRequest struct {
	Code     string `json:"code"`
	StartsAt string `json:"startsAt"`
	EndsAt   string `json:"endsAt"`
	Note     string `json:"note"`
}

type PayrollGenerateRequest struct {
	AdjustmentDefault float64 `json:"adjustmentDefault"`
}

type BranchOperationsUpdateRequest struct {
	Name                  *string  `json:"name"`
	IsForceClosed         *bool    `json:"isForceClosed"`
	AcceptingOrders       *bool    `json:"acceptingOrders"`
	SupportsPickup        *bool    `json:"supportsPickup"`
	SupportsRiderDelivery *bool    `json:"supportsRiderDelivery"`
	RiderDeliveryFee      *float64 `json:"riderDeliveryFee"`
	OperationalNote       *string  `json:"operationalNote"`
}

type BranchCreateRequest struct {
	Slug                  *string  `json:"slug"`
	Name                  string   `json:"name"`
	Description           *string  `json:"description"`
	ImageURL              *string  `json:"imageUrl"`
	AddressLine           *string  `json:"addressLine"`
	Lat                   *float64 `json:"lat"`
	Lng                   *float64 `json:"lng"`
	IsForceClosed         bool     `json:"isForceClosed"`
	AcceptingOrders       bool     `json:"acceptingOrders"`
	SupportsPickup        bool     `json:"supportsPickup"`
	SupportsRiderDelivery bool     `json:"supportsRiderDelivery"`
	RiderDeliveryFee      float64  `json:"riderDeliveryFee"`
	OperationalNote       *string  `json:"operationalNote"`
	CopyFromBranchID      *int64   `json:"copyFromBranchId"`
	CopyMode              string   `json:"copyMode"`
	CategoryIDs           []int64  `json:"categoryIds"`
	ProductIDs            []int64  `json:"productIds"`
}

type BranchProductOperationsUpdateRequest struct {
	IsEnabled           *bool   `json:"isEnabled"`
	IsTemporarilyClosed *bool   `json:"isTemporarilyClosed"`
	StockQty            *int    `json:"stockQty"`
	ReorderLevel        *int    `json:"reorderLevel"`
	AvailabilityNote    *string `json:"availabilityNote"`
}

type StockAdjustmentRequest struct {
	ProductID int64  `json:"productId"`
	DeltaQty  int    `json:"deltaQty"`
	Reason    string `json:"reason"`
	Note      string `json:"note"`
}

type OrderStatusUpdateRequest struct {
	Status string `json:"status"`
	Note   string `json:"note"`
}

type RiderJobStatusRequest struct {
	Status       string `json:"status"`
	FailedReason string `json:"failedReason"`
}
