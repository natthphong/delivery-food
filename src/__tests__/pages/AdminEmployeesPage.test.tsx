import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminEmployeesPage from "@/pages/admin/employees";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const fetchAdminBranches = jest.fn();
const fetchEmployees = jest.fn();
const createEmployee = jest.fn();
const updateEmployee = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/admin/employees",
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
    default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
        <div>
            <h1>{title}</h1>
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
    fetchAdminBranches: (...args: unknown[]) => fetchAdminBranches(...args),
    fetchEmployees: (...args: unknown[]) => fetchEmployees(...args),
    createEmployee: (...args: unknown[]) => createEmployee(...args),
    updateEmployee: (...args: unknown[]) => updateEmployee(...args),
}));

jest.mock("@/utils/notify", () => ({
    notify: jest.fn(),
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
                    actorType: "bootstrap_admin",
                    actorLabel: "Owner",
                    staffAccountId: null,
                    employeeId: null,
                    roles: ["owner"],
                    permissions: ["employees.read", "employees.manage"],
                    branchIds: [],
                },
            },
            cart: { value: { groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() } },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <AdminEmployeesPage />
        </Provider>
    );
}

describe("AdminEmployeesPage", () => {
    beforeEach(() => {
        fetchAdminBranches.mockReset();
        fetchEmployees.mockReset();
        createEmployee.mockReset();
        updateEmployee.mockReset();
        fetchAdminBranches.mockResolvedValue([
            {
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
        ]);
        fetchEmployees.mockResolvedValue([]);
    });

    it("shows backend validation errors inline inside the employee modal", async () => {
        createEmployee.mockRejectedValue({
            response: {
                data: {
                    message: "Please review the employee form.",
                    body: {
                        fieldErrors: {
                            employeeCode: "Employee code is required.",
                            fullName: "Full name is required.",
                            branchIds: "Assign at least one branch.",
                        },
                    },
                },
            },
        });

        renderPage();

        await userEvent.click(await screen.findByRole("button", { name: "admin.employees.newAction" }));
        await userEvent.click(screen.getByRole("button", { name: "admin.employees.createAction" }));

        await waitFor(() => expect(createEmployee).toHaveBeenCalled());
        expect(await screen.findAllByText("common.validation.required")).toHaveLength(2);
        expect(screen.getByText("common.validation.selectAtLeastOne")).toBeInTheDocument();
    });
});
