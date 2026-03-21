import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckoutPage from "@/pages/checkout";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const push = jest.fn();
const fetchPaymentMethods = jest.fn();
const fetchBranchMenu = jest.fn();
const fetchCart = jest.fn();
const checkout = jest.fn();
const notify = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/checkout",
        query: {},
        push,
        replace: jest.fn(),
        isReady: true,
    }),
}));

jest.mock("next/dynamic", () => () => function MockDynamic() {
    return null;
});

jest.mock("@components/Layout", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/payment/MethodPicker", () => ({
    __esModule: true,
    default: () => <div data-testid="method-picker" />,
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

jest.mock("@/services/catalog", () => ({
    fetchPaymentMethods: (...args: unknown[]) => fetchPaymentMethods(...args),
    fetchBranchMenu: (...args: unknown[]) => fetchBranchMenu(...args),
}));

jest.mock("@/services/cart", () => ({
    fetchCart: (...args: unknown[]) => fetchCart(...args),
}));

jest.mock("@/services/payment", () => ({
    checkout: (...args: unknown[]) => checkout(...args),
}));

jest.mock("@/utils/notify", () => ({
    notify: (...args: unknown[]) => notify(...args),
}));

const baseCart = {
    groups: [
        {
            branchId: 1,
            companyId: 1,
            branchName: "Siam",
            branchImage: null,
            subTotal: 120,
            items: [
                {
                    id: 1,
                    branchId: 1,
                    productId: 101,
                    productName: "Pad Kaprao",
                    imageUrl: null,
                    quantity: 1,
                    unitPrice: 120,
                    stockQty: 10,
                    addOns: [],
                    lineTotal: 120,
                    variantKey: "101",
                    createdAt: "2026-03-21T09:45:00.000Z",
                    updatedAt: "2026-03-21T09:45:00.000Z",
                },
            ],
        },
    ],
    totalAmount: 120,
    totalItems: 1,
    totalQuantity: 1,
    lastSyncedAt: "2026-03-21T09:45:00.000Z",
};

function renderPage(cartValue = baseCart) {
    const store = configureStore({
        reducer: { auth, adminAuth, cart, config, notifications },
        preloadedState: {
            auth: {
                accessToken: "access",
                refreshToken: "refresh",
                user: {
                    id: 1,
                    authProvider: "firebase",
                    email: "customer@example.com",
                    phone: "+66123456789",
                    displayName: "Customer",
                    providerLabel: "Email",
                    isEmailVerified: true,
                    isPhoneVerified: true,
                    walletBalance: 100,
                    createdAt: "2026-03-21T09:45:00.000Z",
                    updatedAt: "2026-03-21T09:45:00.000Z",
                },
            },
            adminAuth: { accessToken: null, refreshToken: null, session: null },
            cart: { value: cartValue },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <CheckoutPage />
        </Provider>
    );
}

describe("CheckoutPage", () => {
    beforeEach(() => {
        window.localStorage.clear();
        push.mockReset();
        fetchPaymentMethods.mockReset();
        fetchBranchMenu.mockReset();
        fetchCart.mockReset();
        checkout.mockReset();
        notify.mockReset();
        fetchPaymentMethods.mockResolvedValue([
            {
                id: 9,
                code: "OMISE_PROMPTPAY",
                name: "Omise PromptPay",
                methodType: "gateway",
                sortOrder: 1,
                checkoutFlow: "qr_display",
            },
        ]);
        fetchBranchMenu.mockResolvedValue({
            branch: {
                id: 1,
                companyId: 1,
                name: "Siam",
                slug: "siam",
                description: null,
                imageUrl: null,
                addressLine: null,
                lat: 13.7,
                lng: 100.5,
                isForceClosed: false,
                acceptingOrders: true,
                supportsPickup: true,
                supportsRiderDelivery: true,
                riderDeliveryFee: 35,
                operationalNote: null,
                isOpen: true,
                openHours: [],
            },
        });
    });

    it("clears a stale checkout draft when the selected cart item no longer exists", async () => {
        window.localStorage.setItem("CHECKOUT_DRAFT", JSON.stringify({ branchId: 1, itemIds: [999] }));

        renderPage();

        await waitFor(() => expect(window.localStorage.getItem("CHECKOUT_DRAFT")).toBeNull());
        expect(notify).toHaveBeenCalledWith("cart.synced", "info");
    });

    it("re-syncs the cart from server truth after a failed checkout and clears the stale draft", async () => {
        const user = userEvent.setup();
        window.localStorage.setItem("CHECKOUT_DRAFT", JSON.stringify({ branchId: 1, itemIds: [1] }));
        checkout.mockRejectedValue({
            response: {
                status: 404,
                data: {
                    code: "NOT_FOUND",
                    message: "cart item not found",
                    body: null,
                },
            },
        });
        fetchCart.mockResolvedValue({
            groups: [],
            totalAmount: 0,
            totalItems: 0,
            totalQuantity: 0,
            lastSyncedAt: "2026-03-21T10:00:00.000Z",
        });

        renderPage();

        expect(await screen.findByText("Siam")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "payment.submit.button" }));

        await waitFor(() => expect(fetchCart).toHaveBeenCalled());
        await waitFor(() => expect(window.localStorage.getItem("CHECKOUT_DRAFT")).toBeNull());
        expect(notify).toHaveBeenCalledWith("cart.synced", "info");
        expect(notify).toHaveBeenCalledWith("common.errors.cartItemNotFound", "error");
    });
});
