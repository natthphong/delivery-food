export type AdminSession = {
    sessionType: string;
    actorType: string;
    actorLabel: string;
    staffAccountId?: number | null;
    employeeId?: number | null;
    roles: string[];
    permissions: string[];
    branchIds: number[];
};

export type AdminAuthPayload = {
    accessToken: string;
    refreshToken: string;
    session: AdminSession;
};

export type EmployeeRole = {
    code: string;
    name: string;
};

export type EmployeeBranchAssignment = {
    branchId: number;
    branchName: string;
    isPrimary: boolean;
};

export type Employee = {
    id: number;
    userId?: number | null;
    employeeCode: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    employmentType: "part_time" | "full_time" | "rider" | string;
    compensationType: "hourly" | "salary" | string;
    hourlyWage?: number | null;
    monthlySalary?: number | null;
    otEligible: boolean;
    otMultiplier: number;
    payrollVisibility: boolean;
    status: string;
    joinedAt?: string | null;
    roles: EmployeeRole[];
    branches: EmployeeBranchAssignment[];
    username?: string | null;
    lastLoginAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type AttendanceSession = {
    id: number;
    employeeId: number;
    employeeName: string;
    branchId: number;
    branchName: string;
    clockInAt: string;
    clockOutAt?: string | null;
    status: string;
    workedMinutes: number;
    note?: string | null;
    correctionNote?: string | null;
    correctedByEmployeeId?: number | null;
    createdAt: string;
    updatedAt: string;
};

export type OTRequest = {
    id: number;
    employeeId: number;
    employeeName: string;
    branchId: number;
    branchName: string;
    attendanceSessionId?: number | null;
    requestedMinutes: number;
    approvedMinutes?: number | null;
    reason: string;
    status: string;
    requestedAt: string;
    reviewedAt?: string | null;
    reviewedByEmployeeId?: number | null;
    reviewNote?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type PayrollSettings = {
    id: number;
    companyId: number;
    standardDailyMinutes: number;
    standardMonthlyMinutes: number;
    overtimeRoundingMinutes: number;
    defaultOtMultiplier: number;
    createdAt: string;
    updatedAt: string;
};

export type PayrollPeriod = {
    id: number;
    companyId: number;
    code: string;
    startsAt: string;
    endsAt: string;
    status: string;
    note?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type PayrollEntry = {
    id: number;
    payrollPeriodId: number;
    employeeId: number;
    employeeName: string;
    branchId?: number | null;
    branchName?: string | null;
    attendanceMinutes: number;
    regularMinutes: number;
    overtimeMinutes: number;
    regularAmount: number;
    overtimeAmount: number;
    adjustmentAmount: number;
    grossAmount: number;
    note?: string | null;
    generatedAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BranchStockMovement = {
    id: number;
    branchId: number;
    productId: number;
    productName: string;
    deltaQty: number;
    reason: string;
    note?: string | null;
    createdByEmployeeId?: number | null;
    createdAt: string;
};

export type AdminBranchProductCategory = {
    id: number;
    name: string;
};

export type AdminBranchProduct = {
    branchId: number;
    productId: number;
    productName: string;
    imageUrl?: string | null;
    price: number;
    stockQty?: number | null;
    isEnabled: boolean;
    isTemporarilyClosed: boolean;
    availabilityNote?: string | null;
    reorderLevel?: number | null;
    isLowStock: boolean;
    categories: AdminBranchProductCategory[];
};

export type PaymentProvider = {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
    publicKey?: string | null;
    settings?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
};

export type PaymentWebhookEvent = {
    id: number;
    providerId: number;
    externalEventId?: string | null;
    eventType: string;
    payload?: Record<string, unknown> | null;
    status: string;
    errorMessage?: string | null;
    receivedAt: string;
    processedAt?: string | null;
};

export type DeliveryJob = {
    id: number;
    orderId: number;
    branchId: number;
    branchName?: string | null;
    status: string;
    deliveryFee: number;
    assignedRiderEmployeeId?: number | null;
    assignedRiderName?: string | null;
    claimedAt?: string | null;
    pickedUpAt?: string | null;
    deliveredAt?: string | null;
    failedReason?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type AdminDashboard = {
    employeesActive: number;
    attendanceOpen: number;
    pendingOtRequests: number;
    lowStockItems: number;
    pendingOrders: number;
    waitingRiderJobs: number;
    pendingPayments: number;
};

export type AdminPaymentRecord = {
    id: number;
    userId: number;
    customerName?: string | null;
    branchId?: number | null;
    branchName?: string | null;
    orderId?: number | null;
    paymentMethodName?: string | null;
    providerCode?: string | null;
    status: string;
    providerStatus?: string | null;
    amount: number;
    createdAt: string;
    updatedAt: string;
    paidAt?: string | null;
};

export type EmployeeUpsertRequest = {
    employeeCode: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    employmentType: string;
    compensationType: string;
    hourlyWage?: number | null;
    monthlySalary?: number | null;
    otEligible: boolean;
    otMultiplier: number;
    payrollVisibility: boolean;
    status: string;
    joinedAt?: string | null;
    roleCodes: string[];
    branchIds: number[];
    primaryBranchId?: number | null;
    username?: string | null;
    password?: string | null;
    mustResetPassword: boolean;
};

export type BranchCreateRequest = {
    slug?: string | null;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    addressLine?: string | null;
    lat?: number | null;
    lng?: number | null;
    isForceClosed: boolean;
    acceptingOrders: boolean;
    supportsPickup: boolean;
    supportsRiderDelivery: boolean;
    riderDeliveryFee: number;
    operationalNote?: string | null;
    copyFromBranchId?: number | null;
    copyMode: "none" | "all" | "selected";
    categoryIds: number[];
    productIds: number[];
};

export type AttendanceCorrectionRequest = {
    clockInAt?: string | null;
    clockOutAt?: string | null;
    status: string;
    correctionNote: string;
};

export type OTRequestCreate = {
    branchId: number;
    attendanceSessionId?: number | null;
    requestedMinutes: number;
    reason: string;
};

export type OTReviewRequest = {
    status: string;
    approvedMinutes?: number | null;
    reviewNote: string;
};

export type PayrollSettingsUpdateRequest = {
    standardDailyMinutes: number;
    standardMonthlyMinutes: number;
    overtimeRoundingMinutes: number;
    defaultOtMultiplier: number;
};

export type PayrollPeriodCreateRequest = {
    code: string;
    startsAt: string;
    endsAt: string;
    note: string;
};

export type PayrollGenerateRequest = {
    adjustmentDefault: number;
};

export type BranchOperationsUpdateRequest = {
    name?: string | null;
    isForceClosed?: boolean;
    acceptingOrders?: boolean;
    supportsPickup?: boolean;
    supportsRiderDelivery?: boolean;
    riderDeliveryFee?: number;
    operationalNote?: string | null;
};

export type BranchProductOperationsUpdateRequest = {
    isEnabled?: boolean;
    isTemporarilyClosed?: boolean;
    stockQty?: number | null;
    reorderLevel?: number | null;
    availabilityNote?: string | null;
};

export type StockAdjustmentRequest = {
    productId: number;
    deltaQty: number;
    reason: string;
    note: string;
};

export type OrderStatusUpdateRequest = {
    status: string;
    note: string;
};

export type RiderJobStatusRequest = {
    status: string;
    failedReason: string;
};
