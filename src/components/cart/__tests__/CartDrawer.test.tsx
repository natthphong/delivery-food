import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import auth from "@/store/authSlice";
import cart from "@/store/cartSlice";
import config from "@/store/configSlice";
import notifications from "@/store/notificationsSlice";
import CartDrawer, { CHECKOUT_DRAFT_KEY } from "@/components/cart/CartDrawer";

const push = jest.fn();
const notify = jest.fn();

jest.mock("next/router", () => ({
    useRouter: () => ({
        push,
    }),
}));

jest.mock("@/utils/i18n", () => ({
    useI18n: () => ({
        locale: "en",
        t: (key: string) => key,
        setLocale: jest.fn(),
    }),
}));

jest.mock("@/utils/notify", () => ({
    notify: (...args: unknown[]) => notify(...args),
}));

function renderDrawer(cartState: {
    groups: Array<{
        branchId: number;
        companyId: number;
        branchName: string;
        branchImage: string | null;
        subTotal: number;
        items: Array<{
            id: number;
            branchId: number;
            productId: number;
            productName: string;
            imageUrl: string | null;
            quantity: number;
            unitPrice: number;
            stockQty: number | null;
            addOns: Array<{ name: string; price: number }>;
            lineTotal: number;
            variantKey: string;
            createdAt: string;
            updatedAt: string;
        }>;
    }>;
    totalAmount: number;
    totalItems: number;
    totalQuantity: number;
    lastSyncedAt: string;
}) {
    const store = configureStore({
        reducer: { auth, cart, config, notifications },
        preloadedState: {
            auth: { accessToken: "access", refreshToken: "refresh", user: null },
            cart: { value: cartState },
            config: { values: {} },
            notifications: { items: [] },
        },
    });

    return render(
        <Provider store={store}>
            <CartDrawer open onClose={jest.fn()} />
        </Provider>
    );
}

describe("CartDrawer", () => {
    beforeEach(() => {
        push.mockReset();
        push.mockResolvedValue(true);
        notify.mockReset();
        window.localStorage.clear();
    });

    it("stores a checkout draft and routes to checkout for single-branch selections", async () => {
        const user = userEvent.setup();

        renderDrawer({
            groups: [
                {
                    branchId: 1,
                    companyId: 1,
                    branchName: "BaanFoodie Siam",
                    branchImage: null,
                    subTotal: 179,
                    items: [
                        {
                            id: 10,
                            branchId: 1,
                            productId: 1,
                            productName: "Baan Kaprao",
                            imageUrl: null,
                            quantity: 2,
                            unitPrice: 89.5,
                            stockQty: 10,
                            addOns: [],
                            lineTotal: 179,
                            variantKey: "1:[]",
                            createdAt: "2024-01-01T00:00:00.000Z",
                            updatedAt: "2024-01-01T00:00:00.000Z",
                        },
                    ],
                },
            ],
            totalAmount: 179,
            totalItems: 1,
            totalQuantity: 2,
            lastSyncedAt: "2024-01-01T00:00:00.000Z",
        });

        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: /Proceed to checkout/i }));

        await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout"));
        expect(JSON.parse(window.localStorage.getItem(CHECKOUT_DRAFT_KEY) || "null")).toEqual({
            branchId: 1,
            itemIds: [10],
        });
    });

    it("blocks checkout when the selection spans multiple branches", async () => {
        const user = userEvent.setup();

        renderDrawer({
            groups: [
                {
                    branchId: 1,
                    companyId: 1,
                    branchName: "BaanFoodie Siam",
                    branchImage: null,
                    subTotal: 89,
                    items: [
                        {
                            id: 10,
                            branchId: 1,
                            productId: 1,
                            productName: "Baan Kaprao",
                            imageUrl: null,
                            quantity: 1,
                            unitPrice: 89,
                            stockQty: 10,
                            addOns: [],
                            lineTotal: 89,
                            variantKey: "1:[]",
                            createdAt: "2024-01-01T00:00:00.000Z",
                            updatedAt: "2024-01-01T00:00:00.000Z",
                        },
                    ],
                },
                {
                    branchId: 2,
                    companyId: 1,
                    branchName: "BaanFoodie Ari",
                    branchImage: null,
                    subTotal: 99,
                    items: [
                        {
                            id: 11,
                            branchId: 2,
                            productId: 3,
                            productName: "Boat Noodle Bowl",
                            imageUrl: null,
                            quantity: 1,
                            unitPrice: 99,
                            stockQty: 10,
                            addOns: [],
                            lineTotal: 99,
                            variantKey: "3:[]",
                            createdAt: "2024-01-01T00:00:00.000Z",
                            updatedAt: "2024-01-01T00:00:00.000Z",
                        },
                    ],
                },
            ],
            totalAmount: 188,
            totalItems: 2,
            totalQuantity: 2,
            lastSyncedAt: "2024-01-01T00:00:00.000Z",
        });

        const checkboxes = screen.getAllByRole("checkbox");
        await user.click(checkboxes[0]);
        await user.click(checkboxes[1]);
        await user.click(screen.getByRole("button", { name: /Proceed to checkout/i }));

        expect(notify).toHaveBeenCalledWith("Select items from a single branch before checkout.", "warning");
        expect(push).not.toHaveBeenCalled();
        expect(window.localStorage.getItem(CHECKOUT_DRAFT_KEY)).toBeNull();
    });
});
