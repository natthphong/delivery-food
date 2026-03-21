import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "@/components/Navbar";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const push = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        push,
        replace: jest.fn(),
        pathname: "/",
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
            setLocale: jest.fn(),
        }),
        t: translate,
    };
});

jest.mock("@/utils/logout", () => ({
    logoutCustomer: jest.fn(),
}));

function renderNavbar(adminSession: any = null) {
    const store = configureStore({
        reducer: { auth, adminAuth, cart, config, notifications },
        preloadedState: {
            auth: {
                accessToken: "access",
                refreshToken: "refresh",
                user: {
                    id: 1,
                    displayName: "Customer",
                    walletBalance: 120,
                },
            },
            adminAuth: { accessToken: null, refreshToken: null, session: adminSession },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <Navbar />
        </Provider>
    );
}

describe("Navbar", () => {
    it("does not show the admin entry for a normal customer", async () => {
        const user = userEvent.setup();
        renderNavbar();

        await user.click(screen.getByRole("button", { name: "nav.account" }));

        expect(screen.queryByText("admin.entry")).not.toBeInTheDocument();
    });

    it("shows the admin entry inside the account menu for staff sessions", async () => {
        const user = userEvent.setup();
        renderNavbar({
            sessionType: "admin",
            actorType: "staff",
            actorLabel: "Manager",
            staffAccountId: 1,
            employeeId: 1,
            roles: ["manager"],
            permissions: ["dashboard.read"],
            branchIds: [1],
        });

        await user.click(screen.getByRole("button", { name: "nav.account" }));

        expect(screen.getByText("admin.entry")).toBeInTheDocument();
    });
});
