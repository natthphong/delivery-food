import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import AdminLayout from "@/components/admin/AdminLayout";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/admin",
        replace: jest.fn(),
    }),
}));

describe("AdminLayout", () => {
    it("shows only navigation items allowed by the session permissions", () => {
        const store = configureStore({
            reducer: { auth, adminAuth, cart, config, notifications },
            preloadedState: {
                auth: { accessToken: null, refreshToken: null, user: null },
                adminAuth: {
                    accessToken: "admin-access",
                    refreshToken: "admin-refresh",
                    session: {
                        sessionType: "admin",
                        actorType: "staff",
                        actorLabel: "Branch Manager",
                        staffAccountId: 2,
                        employeeId: 10,
                        roles: ["manager_branch"],
                        permissions: ["dashboard.read", "orders.manage", "rider.jobs.read"],
                        branchIds: [1],
                    },
                },
                cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
                config: { values: {} },
                notifications: { items: [] },
            },
        });

        render(
            <Provider store={store}>
                <AdminLayout>
                    <div>Admin content</div>
                </AdminLayout>
            </Provider>
        );

        expect(screen.getByText("Overview")).toBeInTheDocument();
        expect(screen.getByText("Orders")).toBeInTheDocument();
        expect(screen.getByText("Riders")).toBeInTheDocument();
        expect(screen.queryByText("Employees")).not.toBeInTheDocument();
        expect(screen.queryByText("Payroll")).not.toBeInTheDocument();
    });
});
