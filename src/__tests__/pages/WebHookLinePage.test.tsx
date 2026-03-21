import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import WebHookLinePage from "@/pages/web-hook-line";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const replace = jest.fn();
const liffInit = jest.fn();
const liffIsLoggedIn = jest.fn();
const liffLogin = jest.fn();
const liffGetProfile = jest.fn();
const loginWithLineProfile = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/web-hook-line",
        query: {},
        replace,
        push: jest.fn(),
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

jest.mock("@line/liff", () => ({
    __esModule: true,
    default: {
        init: (...args: unknown[]) => liffInit(...args),
        isLoggedIn: (...args: unknown[]) => liffIsLoggedIn(...args),
        login: (...args: unknown[]) => liffLogin(...args),
        getProfile: (...args: unknown[]) => liffGetProfile(...args),
    },
}));

jest.mock("@/services/auth", () => ({
    loginWithLineProfile: (...args: unknown[]) => loginWithLineProfile(...args),
}));

jest.mock("@/utils/tokenStorage", () => ({
    saveTokens: jest.fn(),
    saveUser: jest.fn(),
}));

function renderPage() {
    const store = configureStore({
        reducer: { auth, adminAuth, cart, config, notifications },
        preloadedState: {
            auth: { accessToken: null, refreshToken: null, user: null },
            adminAuth: { accessToken: null, refreshToken: null, session: null },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <WebHookLinePage />
        </Provider>
    );
}

describe("WebHookLinePage", () => {
    beforeEach(() => {
        replace.mockReset();
        liffInit.mockReset();
        liffIsLoggedIn.mockReset();
        liffLogin.mockReset();
        liffGetProfile.mockReset();
        loginWithLineProfile.mockReset();

        liffInit.mockResolvedValue(undefined);
        liffIsLoggedIn.mockReturnValue(true);
        liffGetProfile.mockResolvedValue({
            userId: "line-user-1",
            displayName: "LINE User",
            pictureUrl: null,
        });
        loginWithLineProfile.mockResolvedValue({
            accessToken: "access",
            refreshToken: "refresh",
            user: {
                id: 1,
                authProvider: "line",
                email: null,
                phone: null,
                displayName: "LINE User",
                providerLabel: "LINE",
                isEmailVerified: false,
                isPhoneVerified: false,
                walletBalance: 0,
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            },
        });
    });

    it("renders a minimal callback shell without the customer navbar", async () => {
        renderPage();

        expect(screen.getByText("line.pageTitle")).toBeInTheDocument();
        expect(screen.queryByText("nav.home")).not.toBeInTheDocument();
        expect(screen.queryByText("nav.account")).not.toBeInTheDocument();
        expect(screen.queryByText("cart.openCart")).not.toBeInTheDocument();
        await waitFor(() => expect(loginWithLineProfile).toHaveBeenCalled());
    });
});
