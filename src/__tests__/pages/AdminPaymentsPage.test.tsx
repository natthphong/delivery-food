import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import AdminPaymentsPage from "@/pages/admin/payments";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const fetchAdminPayments = jest.fn();
const fetchPaymentProviders = jest.fn();
const fetchWebhookEvents = jest.fn();

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

jest.mock("@/services/admin", () => ({
    fetchAdminPayments: (...args: unknown[]) => fetchAdminPayments(...args),
    fetchPaymentProviders: (...args: unknown[]) => fetchPaymentProviders(...args),
    fetchWebhookEvents: (...args: unknown[]) => fetchWebhookEvents(...args),
}));

function renderPage() {
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
                    actorLabel: "Manager",
                    staffAccountId: 2,
                    employeeId: 10,
                    roles: ["manager"],
                    permissions: ["payments.read"],
                    branchIds: [1],
                },
            },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <AdminPaymentsPage />
        </Provider>
    );
}

describe("AdminPaymentsPage", () => {
    beforeEach(() => {
        fetchAdminPayments.mockReset();
        fetchPaymentProviders.mockReset();
        fetchWebhookEvents.mockReset();
        fetchAdminPayments.mockResolvedValue([
            {
                id: 41,
                referenceCode: "TX260321000041",
                userId: 1,
                customerName: "Customer",
                branchId: 1,
                branchName: "Siam",
                orderId: 77,
                orderReferenceCode: "OD260321000077",
                paymentMethodName: "PromptPay",
                providerCode: "omise",
                status: "pending",
                providerStatus: "pending",
                amount: 145,
                createdAt: "2026-03-21T09:45:00.000Z",
                updatedAt: "2026-03-21T09:45:00.000Z",
                paidAt: null,
            },
        ]);
        fetchPaymentProviders.mockResolvedValue([]);
        fetchWebhookEvents.mockResolvedValue([]);
    });

    it("renders transaction and order reference codes from the admin payment records", async () => {
        renderPage();

        expect(await screen.findByText((content) => content.includes("TX260321000041"))).toBeInTheDocument();
        expect(screen.getByText(/OD260321000077/)).toBeInTheDocument();
    });
});
