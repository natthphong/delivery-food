package model

import "time"

type AdminSession struct {
	SessionType    string   `json:"sessionType"`
	ActorType      string   `json:"actorType"`
	ActorLabel     string   `json:"actorLabel"`
	StaffAccountID *int64   `json:"staffAccountId,omitempty"`
	EmployeeID     *int64   `json:"employeeId,omitempty"`
	Roles          []string `json:"roles"`
	Permissions    []string `json:"permissions"`
	BranchIDs      []int64  `json:"branchIds"`
}

type AdminAuthResponse struct {
	AccessToken  string       `json:"accessToken"`
	RefreshToken string       `json:"refreshToken"`
	Session      AdminSession `json:"session"`
}

type EmployeeRole struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type EmployeeBranchAssignment struct {
	BranchID   int64  `json:"branchId"`
	BranchName string `json:"branchName"`
	IsPrimary  bool   `json:"isPrimary"`
}

type Employee struct {
	ID                int64                    `json:"id"`
	UserID            *int64                   `json:"userId,omitempty"`
	EmployeeCode      string                   `json:"employeeCode"`
	FullName          string                   `json:"fullName"`
	Email             *string                  `json:"email,omitempty"`
	Phone             *string                  `json:"phone,omitempty"`
	EmploymentType    string                   `json:"employmentType"`
	CompensationType  string                   `json:"compensationType"`
	HourlyWage        *float64                 `json:"hourlyWage,omitempty"`
	MonthlySalary     *float64                 `json:"monthlySalary,omitempty"`
	OTEligible        bool                     `json:"otEligible"`
	OTMultiplier      float64                  `json:"otMultiplier"`
	PayrollVisibility bool                     `json:"payrollVisibility"`
	Status            string                   `json:"status"`
	JoinedAt          *time.Time               `json:"joinedAt,omitempty"`
	Roles             []EmployeeRole           `json:"roles"`
	Branches          []EmployeeBranchAssignment `json:"branches"`
	Username          *string                  `json:"username,omitempty"`
	LastLoginAt       *time.Time               `json:"lastLoginAt,omitempty"`
	CreatedAt         time.Time                `json:"createdAt"`
	UpdatedAt         time.Time                `json:"updatedAt"`
}

type AttendanceSession struct {
	ID                 int64      `json:"id"`
	EmployeeID         int64      `json:"employeeId"`
	EmployeeName       string     `json:"employeeName"`
	BranchID           int64      `json:"branchId"`
	BranchName         string     `json:"branchName"`
	ClockInAt          time.Time  `json:"clockInAt"`
	ClockOutAt         *time.Time `json:"clockOutAt,omitempty"`
	Status             string     `json:"status"`
	WorkedMinutes      int        `json:"workedMinutes"`
	Note               *string    `json:"note,omitempty"`
	CorrectionNote     *string    `json:"correctionNote,omitempty"`
	CorrectedByEmployeeID *int64  `json:"correctedByEmployeeId,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

type OTRequest struct {
	ID                int64      `json:"id"`
	EmployeeID        int64      `json:"employeeId"`
	EmployeeName      string     `json:"employeeName"`
	BranchID          int64      `json:"branchId"`
	BranchName        string     `json:"branchName"`
	AttendanceSessionID *int64   `json:"attendanceSessionId,omitempty"`
	RequestedMinutes  int        `json:"requestedMinutes"`
	ApprovedMinutes   *int       `json:"approvedMinutes,omitempty"`
	Reason            string     `json:"reason"`
	Status            string     `json:"status"`
	RequestedAt       time.Time  `json:"requestedAt"`
	ReviewedAt        *time.Time `json:"reviewedAt,omitempty"`
	ReviewedByEmployeeID *int64  `json:"reviewedByEmployeeId,omitempty"`
	ReviewNote        *string    `json:"reviewNote,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type PayrollSettings struct {
	ID                    int64     `json:"id"`
	CompanyID             int64     `json:"companyId"`
	StandardDailyMinutes  int       `json:"standardDailyMinutes"`
	StandardMonthlyMinutes int      `json:"standardMonthlyMinutes"`
	OvertimeRoundingMinutes int     `json:"overtimeRoundingMinutes"`
	DefaultOTMultiplier   float64   `json:"defaultOtMultiplier"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}

type PayrollPeriod struct {
	ID        int64      `json:"id"`
	CompanyID int64      `json:"companyId"`
	Code      string     `json:"code"`
	StartsAt  time.Time  `json:"startsAt"`
	EndsAt    time.Time  `json:"endsAt"`
	Status    string     `json:"status"`
	Note      *string    `json:"note,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type PayrollEntry struct {
	ID               int64     `json:"id"`
	PayrollPeriodID  int64     `json:"payrollPeriodId"`
	EmployeeID       int64     `json:"employeeId"`
	EmployeeName     string    `json:"employeeName"`
	BranchID         *int64    `json:"branchId,omitempty"`
	BranchName       *string   `json:"branchName,omitempty"`
	AttendanceMinutes int      `json:"attendanceMinutes"`
	RegularMinutes   int       `json:"regularMinutes"`
	OvertimeMinutes  int       `json:"overtimeMinutes"`
	RegularAmount    float64   `json:"regularAmount"`
	OvertimeAmount   float64   `json:"overtimeAmount"`
	AdjustmentAmount float64   `json:"adjustmentAmount"`
	GrossAmount      float64   `json:"grossAmount"`
	Note             *string   `json:"note,omitempty"`
	GeneratedAt      *time.Time `json:"generatedAt,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type BranchStockMovement struct {
	ID                  int64     `json:"id"`
	BranchID            int64     `json:"branchId"`
	ProductID           int64     `json:"productId"`
	ProductName         string    `json:"productName"`
	DeltaQty            int       `json:"deltaQty"`
	Reason              string    `json:"reason"`
	Note                *string   `json:"note,omitempty"`
	CreatedByEmployeeID *int64    `json:"createdByEmployeeId,omitempty"`
	CreatedAt           time.Time `json:"createdAt"`
}

type AdminBranchProduct struct {
	BranchID             int64    `json:"branchId"`
	ProductID            int64    `json:"productId"`
	ProductName          string   `json:"productName"`
	ImageURL             *string  `json:"imageUrl,omitempty"`
	Price                float64  `json:"price"`
	StockQty             *int     `json:"stockQty,omitempty"`
	IsEnabled            bool     `json:"isEnabled"`
	IsTemporarilyClosed  bool     `json:"isTemporarilyClosed"`
	AvailabilityNote     *string  `json:"availabilityNote,omitempty"`
	ReorderLevel         *int     `json:"reorderLevel,omitempty"`
	IsLowStock           bool     `json:"isLowStock"`
}

type PaymentProvider struct {
	ID        int64          `json:"id"`
	Code      string         `json:"code"`
	Name      string         `json:"name"`
	IsActive  bool           `json:"isActive"`
	PublicKey *string        `json:"publicKey,omitempty"`
	Settings  map[string]any `json:"settings,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type PaymentWebhookEvent struct {
	ID             int64          `json:"id"`
	ProviderID     int64          `json:"providerId"`
	ExternalEventID *string       `json:"externalEventId,omitempty"`
	EventType      string         `json:"eventType"`
	Payload        map[string]any `json:"payload,omitempty"`
	Status         string         `json:"status"`
	ErrorMessage   *string        `json:"errorMessage,omitempty"`
	ReceivedAt     time.Time      `json:"receivedAt"`
	ProcessedAt    *time.Time     `json:"processedAt,omitempty"`
}

type DeliveryJob struct {
	ID                    int64      `json:"id"`
	OrderID               int64      `json:"orderId"`
	BranchID              int64      `json:"branchId"`
	BranchName            *string    `json:"branchName,omitempty"`
	Status                string     `json:"status"`
	DeliveryFee           float64    `json:"deliveryFee"`
	AssignedRiderEmployeeID *int64   `json:"assignedRiderEmployeeId,omitempty"`
	AssignedRiderName     *string    `json:"assignedRiderName,omitempty"`
	ClaimedAt             *time.Time `json:"claimedAt,omitempty"`
	PickedUpAt            *time.Time `json:"pickedUpAt,omitempty"`
	DeliveredAt           *time.Time `json:"deliveredAt,omitempty"`
	FailedReason          *string    `json:"failedReason,omitempty"`
	CreatedAt             time.Time  `json:"createdAt"`
	UpdatedAt             time.Time  `json:"updatedAt"`
}

type AdminDashboard struct {
	EmployeesActive        int `json:"employeesActive"`
	AttendanceOpen         int `json:"attendanceOpen"`
	PendingOTRequests      int `json:"pendingOtRequests"`
	LowStockItems          int `json:"lowStockItems"`
	PendingOrders          int `json:"pendingOrders"`
	WaitingRiderJobs       int `json:"waitingRiderJobs"`
	PendingPayments        int `json:"pendingPayments"`
}

type AdminOrder struct {
	Order
	CustomerName      *string `json:"customerName,omitempty"`
	CustomerPhone     *string `json:"customerPhone,omitempty"`
	PaymentMethodName *string `json:"paymentMethodName,omitempty"`
}

type AdminPaymentRecord struct {
	ID                int64      `json:"id"`
	UserID            int64      `json:"userId"`
	CustomerName      *string    `json:"customerName,omitempty"`
	BranchID          *int64     `json:"branchId,omitempty"`
	BranchName        *string    `json:"branchName,omitempty"`
	OrderID           *int64     `json:"orderId,omitempty"`
	PaymentMethodName *string    `json:"paymentMethodName,omitempty"`
	ProviderCode      *string    `json:"providerCode,omitempty"`
	Status            string     `json:"status"`
	ProviderStatus    *string    `json:"providerStatus,omitempty"`
	Amount            float64    `json:"amount"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	PaidAt            *time.Time `json:"paidAt,omitempty"`
}
