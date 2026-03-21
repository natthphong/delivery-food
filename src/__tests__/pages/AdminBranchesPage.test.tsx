import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminBranchesPage from "@/pages/admin/branches";
import auth from "@/store/authSlice";
import adminAuth from "@/store/adminAuthSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";

const fetchAdminBranches = jest.fn();
const fetchBranchProducts = jest.fn();
const createAdminBranch = jest.fn();
const updateAdminBranch = jest.fn();
const updateBranchProduct = jest.fn();
const updateBranchProductAddOn = jest.fn();
const adjustBranchStock = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        pathname: "/admin/branches",
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
    fetchBranchProducts: (...args: unknown[]) => fetchBranchProducts(...args),
    createAdminBranch: (...args: unknown[]) => createAdminBranch(...args),
    updateAdminBranch: (...args: unknown[]) => updateAdminBranch(...args),
    updateBranchProduct: (...args: unknown[]) => updateBranchProduct(...args),
    updateBranchProductAddOn: (...args: unknown[]) => updateBranchProductAddOn(...args),
    adjustBranchStock: (...args: unknown[]) => adjustBranchStock(...args),
}));

jest.mock("@/utils/notify", () => ({
    notify: jest.fn(),
}));

function makeBranch(id: number, name: string) {
    return {
        id,
        companyId: 1,
        name,
        slug: name.toLowerCase(),
        description: null,
        imageUrl: null,
        addressLine: `${name} address`,
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
    };
}

function makeProduct(productId: number, productName: string, categoryId: number, categoryName: string) {
    return {
        branchId: 1,
        productId,
        productName,
        imageUrl: null,
        price: 89,
        basePrice: 89,
        priceOverride: null,
        stockQty: 8,
        isEnabled: true,
        isTemporarilyClosed: false,
        availabilityNote: null,
        reorderLevel: 4,
        isLowStock: false,
        categories: [{ id: categoryId, name: categoryName }],
        addOns: [
            {
                branchId: 1,
                productId,
                addOnId: productId * 10,
                groupName: "extras",
                name: "Fried Egg",
                price: 12,
                basePrice: 12,
                priceOverride: null,
                isEnabled: true,
                isTemporarilyClosed: false,
                availabilityNote: null,
                isRequired: false,
                sortOrder: 1,
            },
        ],
    };
}

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
                    permissions: ["branches.read", "branches.manage", "stock.read", "stock.manage"],
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
            <AdminBranchesPage />
        </Provider>
    );
}

describe("AdminBranchesPage", () => {
    beforeEach(() => {
        fetchAdminBranches.mockReset();
        fetchBranchProducts.mockReset();
        createAdminBranch.mockReset();
        updateAdminBranch.mockReset();
        updateBranchProduct.mockReset();
        updateBranchProductAddOn.mockReset();
        adjustBranchStock.mockReset();

        fetchAdminBranches.mockResolvedValue([makeBranch(1, "Siam"), makeBranch(2, "Ari")]);
        fetchBranchProducts.mockImplementation(async (branchId: number) => {
            if (branchId === 2) {
                return [
                    makeProduct(21, "Green Curry Fried Rice", 201, "Fried rice"),
                    makeProduct(22, "Kaprao Crispy Pork", 202, "Kaprao"),
                ];
            }
            return [makeProduct(11, "Baan Kaprao", 202, "Kaprao")];
        });
        createAdminBranch.mockResolvedValue(makeBranch(3, "New branch"));
        updateBranchProductAddOn.mockImplementation(async () => [makeProduct(11, "Baan Kaprao", 202, "Kaprao")]);
    });

    it("creates a branch with menu copy selections from an existing branch", async () => {
        renderPage();

        await userEvent.click(await screen.findByRole("button", { name: "admin.branches.newAction" }));

        await userEvent.type(screen.getByLabelText("admin.branches.field.name"), "Bangna");
        await userEvent.click(screen.getByRole("button", { name: "admin.branches.copyMode.selected" }));
        await userEvent.selectOptions(screen.getByLabelText("admin.branches.field.copyFromBranch"), "2");

        await waitFor(() => expect(fetchBranchProducts).toHaveBeenCalledWith(2));

        await userEvent.click(await screen.findByRole("button", { name: "Fried rice" }));
        await userEvent.click(screen.getByLabelText(/Green Curry Fried Rice/));
        await userEvent.click(screen.getByRole("button", { name: "admin.branches.createAction" }));

        await waitFor(() => expect(createAdminBranch).toHaveBeenCalled());

        expect(createAdminBranch).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Bangna",
                copyMode: "selected",
                copyFromBranchId: 2,
                categoryIds: [201],
                productIds: [21],
            })
        );
    });

    it("updates an add-on override from the product modal", async () => {
        renderPage();

        await userEvent.click(await screen.findByRole("button", { name: "admin.branches.productEditAction" }));
        await userEvent.click(await screen.findByRole("button", { name: "admin.branches.addOnEditAction" }));
        const addOnModal = await screen.findByText("admin.branches.addOnModalTitle");
        const addOnScope = within(addOnModal.parentElement as HTMLElement);

        await userEvent.click(addOnScope.getByRole("button", { name: "admin.branches.priceMode.override" }));
        const addOnPriceInput = addOnScope.getAllByRole("textbox")[0];
        await userEvent.clear(addOnPriceInput);
        await userEvent.type(addOnPriceInput, "18");
        await userEvent.click(addOnScope.getAllByRole("checkbox")[1]);
        await userEvent.click(addOnScope.getByRole("button", { name: "admin.branches.addOnSaveAction" }));

        await waitFor(() => expect(updateBranchProductAddOn).toHaveBeenCalledWith(
            1,
            11,
            110,
            expect.objectContaining({
                priceOverride: 18,
                clearPriceOverride: false,
                isTemporarilyClosed: true,
            })
        ));
    });
});
