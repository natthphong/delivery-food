import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountPage from "@/pages/account";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";
import { __resetLocaleForTests } from "@/utils/i18n";

const push = jest.fn();
const replace = jest.fn();
const updateProfile = jest.fn();
const fetchTransactions = jest.fn();
const fetchOrders = jest.fn();
const sendVerificationEmail = jest.fn();
const notify = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/account",
        query: { tab: "profile", lang: "en" },
        push,
        replace,
        isReady: true,
    }),
}));

jest.mock("@components/Layout", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/services/app", () => ({
    updateProfile: (...args: unknown[]) => updateProfile(...args),
    fetchTransactions: (...args: unknown[]) => fetchTransactions(...args),
    fetchOrders: (...args: unknown[]) => fetchOrders(...args),
    sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
}));

jest.mock("@/utils/notify", () => ({
    notify: (...args: unknown[]) => notify(...args),
}));

jest.mock("@/utils/logout", () => ({
    logoutCustomer: jest.fn(),
}));

function renderPage() {
    const store = configureStore({
        reducer: { auth, adminAuth, cart, config, notifications },
        preloadedState: {
            auth: {
                accessToken: "access",
                refreshToken: "refresh",
                user: {
                    id: 1,
                    authProvider: "firebase",
                    email: "old@example.com",
                    phone: "+66123456789",
                    displayName: "Customer",
                    providerLabel: "Email",
                    isEmailVerified: true,
                    isPhoneVerified: true,
                    walletBalance: 240,
                    createdAt: "2024-01-01T00:00:00.000Z",
                    updatedAt: "2024-01-01T00:00:00.000Z",
                },
            },
            adminAuth: { accessToken: null, refreshToken: null, session: null },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <AccountPage />
        </Provider>
    );
}

describe("AccountPage", () => {
    beforeEach(() => {
        __resetLocaleForTests();
        push.mockReset();
        replace.mockReset();
        updateProfile.mockReset();
        fetchTransactions.mockReset();
        fetchOrders.mockReset();
        sendVerificationEmail.mockReset();
        notify.mockReset();
    });

    it("maps profile conflicts to friendly localized copy instead of the raw backend message", async () => {
        const user = userEvent.setup();

        updateProfile.mockRejectedValue({
            response: {
                status: 409,
                data: {
                    code: "CONFLICT",
                    message: "email is already used",
                    body: null,
                },
            },
        });

        renderPage();
        await user.click(screen.getByRole("button", { name: "Save profile" }));

        await waitFor(() => {
            expect(screen.getAllByText("This email is already in use.").length).toBeGreaterThan(0);
        });
        expect(screen.queryByText("email is already used")).not.toBeInTheDocument();
        expect(notify).toHaveBeenCalledWith("This email is already in use.", "error");
    });
});
