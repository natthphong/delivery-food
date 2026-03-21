import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentDetailPage from "@/pages/payment/[txnId]";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const replace = jest.fn();
const back = jest.fn();
const fetchTransactionDetail = jest.fn();
const retryTransactionPayment = jest.fn();
const notify = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        query: { txnId: "42" },
        replace,
        back,
    }),
}));

jest.mock("@components/Layout", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

jest.mock("@/services/payment", () => ({
    fetchTransactionDetail: (...args: unknown[]) => fetchTransactionDetail(...args),
    retryTransactionPayment: (...args: unknown[]) => retryTransactionPayment(...args),
}));

jest.mock("@/utils/notify", () => ({
    notify: (...args: unknown[]) => notify(...args),
}));

function renderPage() {
    const store = configureStore({
        reducer: { auth, adminAuth, cart, config, notifications },
        preloadedState: {
            auth: { accessToken: "access", refreshToken: "refresh", user: null },
            adminAuth: { accessToken: null, refreshToken: null, session: null },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <PaymentDetailPage />
        </Provider>
    );
}

describe("PaymentDetailPage", () => {
    beforeEach(() => {
        replace.mockReset();
        back.mockReset();
        fetchTransactionDetail.mockReset();
        retryTransactionPayment.mockReset();
        notify.mockReset();
    });

    it("shows an expired payment state and allows creating a new payment attempt", async () => {
        fetchTransactionDetail.mockResolvedValue({
            transaction: {
                id: 42,
                userId: 1,
                companyId: 1,
                paymentMethodId: 9,
                txnType: "payment",
                amount: 149,
                status: "expired",
                expiresAt: "2026-03-21T10:00:00.000Z",
                slipReference: null,
                slipDate: null,
                slipTimestamp: null,
                providerId: 1,
                providerReference: "chrg_123",
                providerStatus: "expired",
                paymentAction: {
                    type: "gateway_qr",
                    qrImageUrl: "https://example.com/qr.png",
                },
                paidAt: null,
                failedReason: null,
                createdAt: "2026-03-21T09:45:00.000Z",
                updatedAt: "2026-03-21T10:00:00.000Z",
                method: {
                    id: 9,
                    code: "OMISE_PROMPTPAY",
                    name: "Omise PromptPay",
                    methodType: "gateway",
                    sortOrder: 1,
                    checkoutFlow: "qr_display",
                },
                orderId: 77,
                isExpired: true,
            },
            order: null,
            user: null,
        });
        retryTransactionPayment.mockResolvedValue({
            transaction: { id: 99 },
        });

        renderPage();

        expect(await screen.findByText("payment.expiredTitle")).toBeInTheDocument();
        const retryButtons = screen.getAllByRole("button", { name: "payment.retry" });
        expect(retryButtons).toHaveLength(2);
        expect(screen.queryByText("payment.slip.label")).not.toBeInTheDocument();

        await userEvent.click(retryButtons[0]);

        await waitFor(() => expect(retryTransactionPayment).toHaveBeenCalledWith(42, { paymentMethodId: 9 }));
        expect(replace).toHaveBeenCalledWith("/payment/99");
    });
});
