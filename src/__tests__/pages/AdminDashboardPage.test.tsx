import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import AdminDashboardPage from "@/pages/admin";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const fetchAdminDashboard = jest.fn();
const fetchAdminBranches = jest.fn();

jest.mock("@/utils/i18n", () => {
    const translate = (key: string) => key;
    return {
        useI18n: () => ({
            locale: "en",
            t: translate,
            setLocale: jest.fn(),
        }),
        t: translate,
    };
});

jest.mock("@/components/admin/AdminLayout", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/admin/AdminPageHeader", () => ({
    __esModule: true,
    default: ({ title, description }: { title: string; description?: string }) => (
        <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
        </div>
    ),
}));

jest.mock("@/components/admin/AdminSectionCard", () => ({
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
}));

jest.mock("@/components/admin/AdminStatCard", () => ({
    __esModule: true,
    default: ({ label, value }: { label: string; value: string | number }) => (
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    ),
}));

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

jest.mock("@/services/admin", () => ({
    fetchAdminDashboard: (...args: unknown[]) => fetchAdminDashboard(...args),
    fetchAdminBranches: (...args: unknown[]) => fetchAdminBranches(...args),
}));

function makeDashboard() {
    return {
        employeesActive: 8,
        attendanceOpen: 4,
        pendingOtRequests: 2,
        lowStockItems: 3,
        pendingOrders: 6,
        waitingRiderJobs: 1,
        pendingPayments: 2,
        openComplaints: 1,
        salesTotal: 2450,
        appliedBranchId: null,
        days: 14,
        salesSeries: [
            { date: "2026-03-20", totalSales: 900, orderCount: 8 },
            { date: "2026-03-21", totalSales: 1550, orderCount: 12 },
        ],
        branchSales: [{ branchId: 1, branchName: "Siam", totalSales: 2450, orderCount: 20, complaintCount: 1 }],
        recentComplaints: [
            {
                id: 1,
                userId: 1,
                orderId: 88,
                orderReferenceCode: "OD260321000088",
                branchId: 1,
                branchName: "Siam",
                category: "late_order",
                status: "open",
                title: "Late handoff",
                message: "Pickup took longer than expected.",
                resolvedNote: null,
                resolvedAt: null,
                createdAt: "2026-03-21T09:45:00.000Z",
                updatedAt: "2026-03-21T09:45:00.000Z",
            },
        ],
        recentOtRequests: [
            {
                id: 1,
                employeeId: 1,
                employeeName: "Pat",
                branchId: 1,
                branchName: "Siam",
                attendanceSessionId: null,
                requestedMinutes: 60,
                approvedMinutes: null,
                reason: "Closing shift handover",
                status: "pending",
                requestedAt: "2026-03-21T08:00:00.000Z",
                reviewedAt: null,
                reviewedByEmployeeId: null,
                reviewNote: null,
                createdAt: "2026-03-21T08:00:00.000Z",
                updatedAt: "2026-03-21T08:00:00.000Z",
            },
        ],
        staffCounts: [
            { date: "2026-03-20", employeeCount: 7 },
            { date: "2026-03-21", employeeCount: 8 },
        ],
        workSchedule: [
            {
                workDate: "2026-03-21",
                branchId: 1,
                branchName: "Siam",
                employeeId: 1,
                employeeName: "Pat",
                roleCodes: ["manager_branch"],
                plannedStart: "09:00",
                plannedEnd: "18:00",
                attendanceStatus: "clocked_in",
                clockInAt: "2026-03-21T09:02:00.000Z",
                clockOutAt: null,
            },
        ],
    };
}

function renderPage(session: any) {
    const store = configureStore({
        reducer: { auth, adminAuth, cart, config, notifications },
        preloadedState: {
            auth: { accessToken: null, refreshToken: null, user: null },
            adminAuth: {
                accessToken: "admin-access",
                refreshToken: "admin-refresh",
                session,
            },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <AdminDashboardPage />
        </Provider>
    );
}

describe("AdminDashboardPage", () => {
    beforeEach(() => {
        fetchAdminDashboard.mockReset();
        fetchAdminBranches.mockReset();
        fetchAdminDashboard.mockResolvedValue(makeDashboard());
        fetchAdminBranches.mockResolvedValue([
            { id: 1, companyId: 1, name: "Siam", slug: "siam", description: null, imageUrl: null, addressLine: null, lat: null, lng: null, isForceClosed: false, acceptingOrders: true, supportsPickup: true, supportsRiderDelivery: true, riderDeliveryFee: 35, operationalNote: null, isOpen: true, openHours: [] },
            { id: 2, companyId: 1, name: "Ari", slug: "ari", description: null, imageUrl: null, addressLine: null, lat: null, lng: null, isForceClosed: false, acceptingOrders: true, supportsPickup: true, supportsRiderDelivery: true, riderDeliveryFee: 35, operationalNote: null, isOpen: true, openHours: [] },
        ]);
    });

    it("shows a branch filter for owner and manager sessions", async () => {
        renderPage({
            sessionType: "admin",
            actorType: "staff",
            actorLabel: "Owner",
            staffAccountId: 1,
            employeeId: 1,
            roles: ["owner"],
            permissions: ["dashboard.read", "branches.read"],
            branchIds: [],
        });

        expect(await screen.findByText("admin.dashboard.salesTrendTitle")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "admin.dashboard.branchFilterLabel" })).toBeInTheDocument();
        expect(fetchAdminDashboard).toHaveBeenCalledWith({ branchId: null, days: 14 });
    });

    it("keeps manager_branch scoped to their assigned branches and hides the branch selector", async () => {
        renderPage({
            sessionType: "admin",
            actorType: "staff",
            actorLabel: "Branch Manager",
            staffAccountId: 2,
            employeeId: 8,
            roles: ["manager_branch"],
            permissions: ["dashboard.read"],
            branchIds: [1],
        });

        expect(await screen.findByText("admin.dashboard.scheduleTitle")).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "admin.dashboard.branchFilterLabel" })).not.toBeInTheDocument();
        expect(screen.getByText("Late handoff")).toBeInTheDocument();
        expect(screen.getByText("Closing shift handover")).toBeInTheDocument();
        await waitFor(() => expect(fetchAdminDashboard).toHaveBeenCalledWith({ branchId: null, days: 14 }));
    });
});
