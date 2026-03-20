import { selectCartCount, selectCartGroups, selectCartItems } from "@/store/selectors";
import type { RootState } from "@/store";

const state = {
    auth: { accessToken: null, refreshToken: null, user: null },
    notifications: { items: [] },
    config: { values: {} },
    cart: {
        value: {
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
        },
    },
} as RootState;

describe("cart selectors", () => {
    it("returns branch groups when the cart has content", () => {
        expect(selectCartGroups(state)).toHaveLength(1);
        expect(selectCartGroups(state)[0].branchName).toBe("BaanFoodie Siam");
    });

    it("flattens line items from all cart groups", () => {
        expect(selectCartItems(state)).toHaveLength(1);
        expect(selectCartItems(state)[0].productName).toBe("Baan Kaprao");
    });

    it("returns the quantity total for the cart badge", () => {
        expect(selectCartCount(state)).toBe(2);
    });
});
