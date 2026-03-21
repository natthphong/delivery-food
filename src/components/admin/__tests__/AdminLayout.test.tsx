import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLayout from "@/components/admin/AdminLayout";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const replace = jest.fn();
const setLocale = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/admin",
        replace,
        query: {},
        isReady: true,
    }),
}));

jest.mock("@/utils/i18n", () => {
    const translate = (key: string) => key;
    return {
        useI18n: () => ({
            locale: "en",
            t: translate,
            setLocale,
        }),
        t: translate,
    };
});

function renderLayout(session: any) {
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
            <AdminLayout>
                <div>Admin content</div>
            </AdminLayout>
        </Provider>
    );
}

describe("AdminLayout", () => {
    beforeEach(() => {
        replace.mockReset();
        setLocale.mockReset();
    });

    it("shows only navigation items allowed by the session permissions", () => {
        renderLayout({
            sessionType: "admin",
            actorType: "staff",
            actorLabel: "Branch Manager",
            staffAccountId: 2,
            employeeId: 10,
            roles: ["manager_branch"],
            permissions: ["dashboard.read", "orders.manage", "rider.jobs.read"],
            branchIds: [1],
        });

        expect(screen.getByText("admin.nav.overview")).toBeInTheDocument();
        expect(screen.getByText("admin.nav.orders")).toBeInTheDocument();
        expect(screen.getByText("admin.nav.riders")).toBeInTheDocument();
        expect(screen.queryByText("admin.nav.employees")).not.toBeInTheDocument();
        expect(screen.queryByText("admin.nav.payroll")).not.toBeInTheDocument();
    });

    it("persists the admin locale switch through router state", async () => {
        const user = userEvent.setup();

        renderLayout({
            sessionType: "admin",
            actorType: "bootstrap_admin",
            actorLabel: "Owner",
            staffAccountId: null,
            employeeId: null,
            roles: ["owner"],
            permissions: ["dashboard.read"],
            branchIds: [],
        });

        await user.click(screen.getByRole("button", { name: "TH" }));

        expect(setLocale).toHaveBeenCalledWith("th");
        expect(replace).toHaveBeenCalled();
    });
});
