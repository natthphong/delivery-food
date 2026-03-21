import adminAxios from "@/utils/adminApiClient";
import { unwrapResponse } from "@/services/api";
import type { ApiResponse } from "@/utils/apiClient";
import type {
    AdminBranchProduct,
    AdminDashboard,
    AdminPaymentRecord,
    AttendanceCorrectionRequest,
    AttendanceSession,
    BranchOperationsUpdateRequest,
    BranchProductOperationsUpdateRequest,
    DeliveryJob,
    Employee,
    EmployeeUpsertRequest,
    OTRequest,
    OTRequestCreate,
    OTReviewRequest,
    PaymentProvider,
    PaymentWebhookEvent,
    PayrollEntry,
    PayrollGenerateRequest,
    PayrollPeriod,
    PayrollPeriodCreateRequest,
    PayrollSettings,
    PayrollSettingsUpdateRequest,
    RiderJobStatusRequest,
    StockAdjustmentRequest,
} from "@/types/admin";
import type { BranchSummary } from "@/types";
import type { AdminOrder } from "@/types/adminOrder";

export async function fetchAdminDashboard() {
    const { data } = await adminAxios.get<ApiResponse<AdminDashboard>>("/v1/admin/dashboard");
    return unwrapResponse(data);
}

export async function fetchEmployees(params: { q?: string; status?: string; branchId?: number | null } = {}) {
    const { data } = await adminAxios.get<ApiResponse<{ employees: Employee[] }>>("/v1/admin/employees", { params });
    return unwrapResponse(data).employees;
}

export async function createEmployee(payload: EmployeeUpsertRequest) {
    const { data } = await adminAxios.post<ApiResponse<{ employee: Employee }>>("/v1/admin/employees", payload);
    return unwrapResponse(data).employee;
}

export async function updateEmployee(employeeId: number, payload: EmployeeUpsertRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ employee: Employee }>>(`/v1/admin/employees/${employeeId}`, payload);
    return unwrapResponse(data).employee;
}

export async function fetchAttendance(params: { employeeId?: number | null; branchId?: number | null; status?: string } = {}) {
    const { data } = await adminAxios.get<ApiResponse<{ attendance: AttendanceSession[] }>>("/v1/admin/attendance", { params });
    return unwrapResponse(data).attendance;
}

export async function clockIn(payload: { branchId: number; note?: string }) {
    const { data } = await adminAxios.post<ApiResponse<{ attendance: AttendanceSession }>>("/v1/admin/attendance/clock-in", payload);
    return unwrapResponse(data).attendance;
}

export async function clockOut(payload: { branchId: number; note?: string }) {
    const { data } = await adminAxios.post<ApiResponse<{ attendance: AttendanceSession }>>("/v1/admin/attendance/clock-out", payload);
    return unwrapResponse(data).attendance;
}

export async function correctAttendance(attendanceId: number, payload: AttendanceCorrectionRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ attendance: AttendanceSession }>>(`/v1/admin/attendance/${attendanceId}`, payload);
    return unwrapResponse(data).attendance;
}

export async function fetchOTRequests(status?: string) {
    const { data } = await adminAxios.get<ApiResponse<{ requests: OTRequest[] }>>("/v1/admin/ot-requests", { params: { status } });
    return unwrapResponse(data).requests;
}

export async function createOTRequest(payload: OTRequestCreate) {
    const { data } = await adminAxios.post<ApiResponse<{ request: OTRequest }>>("/v1/admin/ot-requests", payload);
    return unwrapResponse(data).request;
}

export async function reviewOTRequest(requestId: number, payload: OTReviewRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ request: OTRequest }>>(`/v1/admin/ot-requests/${requestId}`, payload);
    return unwrapResponse(data).request;
}

export async function fetchPayrollSettings() {
    const { data } = await adminAxios.get<ApiResponse<{ settings: PayrollSettings }>>("/v1/admin/payroll/settings");
    return unwrapResponse(data).settings;
}

export async function updatePayrollSettings(payload: PayrollSettingsUpdateRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ settings: PayrollSettings }>>("/v1/admin/payroll/settings", payload);
    return unwrapResponse(data).settings;
}

export async function fetchPayrollPeriods() {
    const { data } = await adminAxios.get<ApiResponse<{ periods: PayrollPeriod[] }>>("/v1/admin/payroll/periods");
    return unwrapResponse(data).periods;
}

export async function createPayrollPeriod(payload: PayrollPeriodCreateRequest) {
    const { data } = await adminAxios.post<ApiResponse<{ period: PayrollPeriod }>>("/v1/admin/payroll/periods", payload);
    return unwrapResponse(data).period;
}

export async function fetchPayrollPeriodDetail(periodId: number) {
    const { data } = await adminAxios.get<ApiResponse<{ period: PayrollPeriod; entries: PayrollEntry[] }>>(`/v1/admin/payroll/periods/${periodId}`);
    return unwrapResponse(data);
}

export async function generatePayrollPeriod(periodId: number, payload: PayrollGenerateRequest) {
    const { data } = await adminAxios.post<ApiResponse<{ period: PayrollPeriod; entries: PayrollEntry[] }>>(
        `/v1/admin/payroll/periods/${periodId}/generate`,
        payload
    );
    return unwrapResponse(data);
}

export async function fetchAdminBranches() {
    const { data } = await adminAxios.get<ApiResponse<{ branches: BranchSummary[] }>>("/v1/admin/branches");
    return unwrapResponse(data).branches;
}

export async function updateAdminBranch(branchId: number, payload: BranchOperationsUpdateRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ branch: BranchSummary }>>(`/v1/admin/branches/${branchId}`, payload);
    return unwrapResponse(data).branch;
}

export async function fetchBranchProducts(branchId: number) {
    const { data } = await adminAxios.get<ApiResponse<{ products: AdminBranchProduct[] }>>(`/v1/admin/branches/${branchId}/products`);
    return unwrapResponse(data).products;
}

export async function updateBranchProduct(branchId: number, productId: number, payload: BranchProductOperationsUpdateRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ products: AdminBranchProduct[] }>>(
        `/v1/admin/branches/${branchId}/products/${productId}`,
        payload
    );
    return unwrapResponse(data).products;
}

export async function adjustBranchStock(branchId: number, payload: StockAdjustmentRequest) {
    const { data } = await adminAxios.post<ApiResponse<{ products: AdminBranchProduct[] }>>(`/v1/admin/branches/${branchId}/stock`, payload);
    return unwrapResponse(data).products;
}

export async function fetchAdminOrders(status?: string) {
    const { data } = await adminAxios.get<ApiResponse<{ orders: AdminOrder[] }>>("/v1/admin/orders", { params: { status } });
    return unwrapResponse(data).orders;
}

export async function updateAdminOrderStatus(orderId: number, payload: { status: string; note: string }) {
    const { data } = await adminAxios.patch<ApiResponse<{ updated: boolean }>>(`/v1/admin/orders/${orderId}/status`, payload);
    return unwrapResponse(data).updated;
}

export async function fetchRiderJobs(status?: string) {
    const { data } = await adminAxios.get<ApiResponse<{ jobs: DeliveryJob[] }>>("/v1/admin/rider/jobs", { params: { status } });
    return unwrapResponse(data).jobs;
}

export async function claimRiderJob(jobId: number) {
    const { data } = await adminAxios.post<ApiResponse<{ job: DeliveryJob }>>(`/v1/admin/rider/jobs/${jobId}/claim`);
    return unwrapResponse(data).job;
}

export async function updateRiderJobStatus(jobId: number, payload: RiderJobStatusRequest) {
    const { data } = await adminAxios.patch<ApiResponse<{ job: DeliveryJob }>>(`/v1/admin/rider/jobs/${jobId}/status`, payload);
    return unwrapResponse(data).job;
}

export async function fetchAdminPayments(status?: string) {
    const { data } = await adminAxios.get<ApiResponse<{ payments: AdminPaymentRecord[] }>>("/v1/admin/payments", { params: { status } });
    return unwrapResponse(data).payments;
}

export async function fetchPaymentProviders() {
    const { data } = await adminAxios.get<ApiResponse<{ providers: PaymentProvider[] }>>("/v1/admin/payments/providers");
    return unwrapResponse(data).providers;
}

export async function fetchWebhookEvents() {
    const { data } = await adminAxios.get<ApiResponse<{ events: PaymentWebhookEvent[] }>>("/v1/admin/payments/webhooks");
    return unwrapResponse(data).events;
}
