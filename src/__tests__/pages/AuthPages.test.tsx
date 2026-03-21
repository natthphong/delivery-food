import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

let pathname = "/login";

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname,
        query: { lang: "en" },
        replace: jest.fn(),
        push: jest.fn(),
        isReady: true,
    }),
}));

jest.mock("@utils/firebaseClient", () => ({
    auth: {},
    googleProvider: {},
    makeRecaptcha: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
    createUserWithEmailAndPassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signInWithPhoneNumber: jest.fn(),
    signInWithPopup: jest.fn(),
}));

jest.mock("@/services/auth", () => ({
    loginWithFirebase: jest.fn(),
}));

jest.mock("@/utils/tokenStorage", () => ({
    clearCart: jest.fn(),
    clearConfig: jest.fn(),
    clearTokens: jest.fn(),
    clearUser: jest.fn(),
    saveTokens: jest.fn(),
    saveUser: jest.fn(),
}));

function renderWithStore(node: React.ReactNode) {
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

    return render(<Provider store={store}>{node}</Provider>);
}

describe("Auth pages", () => {
    it("renders login without the customer navbar and without the removed marketing copy", () => {
        pathname = "/login";
        renderWithStore(<LoginPage />);

        expect(screen.queryByText("Home")).not.toBeInTheDocument();
        expect(screen.queryByText("Search")).not.toBeInTheDocument();
        expect(screen.queryByText("Fast checkout stack")).not.toBeInTheDocument();
        expect(screen.queryByText("Sign in once and keep your cart, wallet, and orders in sync.")).not.toBeInTheDocument();
        expect(screen.queryByText("On Firebase free plan, use test numbers (Auth → Phone → Testing).")).not.toBeInTheDocument();
        expect(screen.getByText("Sign in to keep ordering without interruption.")).toBeInTheDocument();
    });

    it("renders signup as a dedicated auth screen", () => {
        pathname = "/signup";
        renderWithStore(<SignupPage />);

        expect(screen.queryByText("Home")).not.toBeInTheDocument();
        expect(screen.getByText("Create an account to start ordering faster.")).toBeInTheDocument();
    });
});
