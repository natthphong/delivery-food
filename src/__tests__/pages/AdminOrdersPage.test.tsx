import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrdersPage from "@/pages/admin/orders";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const fetchAdminOrders = jest.fn();
const fetchAdminOrderDetail = jest.fn();
const updateAdminOrderStatus = jest.fn();
const notify = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/admin/orders",
        query: {},
        replace: jest.fn(),
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

jest.mock("@/components/admin/AdminLayout", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/admin/AdminPageHeader", () => ({
    __esModule: true,
    default: ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
        <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
            {actions}
        </div>
    ),
}));

jest.mock("@/components/admin/AdminSectionCard", () => ({
    __esModule: true,
    default: ({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {actions}
            {children}
        </section>
    ),
}));

jest.mock("@/components/common/Modal", () => ({
    __esModule: true,
    default: ({ open, title, children, footer }: { open: boolean; title?: string; children: React.ReactNode; footer?: React.ReactNode }) =>
        open ? (
            <div>
                {title ? <h2>{title}</h2> : null}
                {children}
                {footer}
            </div>
        ) : null,
}));

jest.mock("@/services/admin", () => ({
    fetchAdminOrders: (...args: unknown[]) => fetchAdminOrders(...args),
    fetchAdminOrderDetail: (...args: unknown[]) => fetchAdminOrderDetail(...args),
    updateAdminOrderStatus: (...args: unknown[]) => updateAdminOrderStatus(...args),
}));

jest.mock("@/utils/notify", () => ({
    notify: (...args: unknown[]) => notify(...args),
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
                    staffAccountId: 1,
                    employeeId: 1,
                    roles: ["manager"],
                    permissions: ["orders.read", "orders.manage"],
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
            <AdminOrdersPage />
        </Provider>
    );
}

function makeOrder(overrides: Record<string, unknown> = {}) {
    return {
        id: 77,
        referenceCode: "OD260321000077",
        userId: 9,
        branchId: 1,
        transactionId: 41,
        status: "PENDING",
        fulfillmentMode: "pickup",
        deliveryFee: 0,
        customerNote: null,
        deliveryLat: null,
        deliveryLng: null,
        deliveryDistanceKm: null,
        createdAt: "2026-03-21T10:00:00.000Z",
        updatedAt: "2026-03-21T10:00:00.000Z",
        items: [],
        branch: {
            id: 1,
            companyId: 1,
            name: "Siam",
            slug: "siam",
            description: null,
            imageUrl: null,
            addressLine: null,
            lat: null,
            lng: null,
            isForceClosed: false,
            acceptingOrders: true,
            supportsPickup: true,
            supportsRiderDelivery: true,
            riderDeliveryFee: 35,
            operationalNote: null,
            isOpen: true,
            openHours: [],
        },
        transaction: {
            id: 41,
            referenceCode: "TX260321000041",
            userId: 9,
            companyId: 1,
            paymentMethodId: 1,
            txnType: "payment",
            amount: 145,
            status: "pending",
            expiresAt: null,
            slipReference: null,
            slipDate: null,
            slipTimestamp: null,
            createdAt: "2026-03-21T10:00:00.000Z",
            updatedAt: "2026-03-21T10:00:00.000Z",
            method: { id: 1, code: "OMISE", name: "PromptPay", methodType: "gateway", sortOrder: 1, checkoutFlow: "gateway_qr" },
            orderId: 77,
            isExpired: false,
        },
        deliveryJob: null,
        totalAmount: 145,
        customerName: "Pat",
        customerPhone: null,
        paymentMethodName: "PromptPay",
        allowedStatuses: ["READY"],
        ...overrides,
    } as any;
}

describe("AdminOrdersPage", () => {
    beforeEach(() => {
        fetchAdminOrders.mockReset();
        fetchAdminOrderDetail.mockReset();
        updateAdminOrderStatus.mockReset();
        notify.mockReset();
    });

    it("renders order detail safely when the API returns null items and still allows status updates", async () => {
        fetchAdminOrders.mockResolvedValue([makeOrder()]);
        fetchAdminOrderDetail.mockResolvedValue(makeOrder({ items: null, allowedStatuses: ["READY"] }));
        updateAdminOrderStatus.mockResolvedValue(true);

        renderPage();

        const orderButton = await screen.findByRole("button", { name: /Siam/ });
        await userEvent.click(orderButton);

        expect(screen.getAllByText("OD260321000077").length).toBeGreaterThan(0);
        expect(await screen.findByText("admin.orders.itemsEmpty")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "admin.orders.action.ready" }));

        await waitFor(() => expect(updateAdminOrderStatus).toHaveBeenCalledWith(77, { status: "READY", note: "" }));
    });
});
