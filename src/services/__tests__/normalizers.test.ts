import { normalizeCart, normalizeOrder } from "@/services/normalizers";

describe("normalizers", () => {
    it("normalizes null cart item add-ons into empty arrays", () => {
        const cart = normalizeCart({
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
                            productName: "Kaprao",
                            imageUrl: null,
                            quantity: 1,
                            unitPrice: 89,
                            stockQty: 5,
                            addOns: null,
                            lineTotal: 89,
                            variantKey: "1:[]",
                            createdAt: "2024-01-01T00:00:00.000Z",
                            updatedAt: "2024-01-01T00:00:00.000Z",
                        },
                    ],
                },
            ],
            totalAmount: 89,
            totalItems: 1,
            totalQuantity: 1,
            lastSyncedAt: "2024-01-01T00:00:00.000Z",
        } as any);

        expect(cart.groups[0].items[0].addOns).toEqual([]);
    });

    it("normalizes null order item add-ons into empty arrays", () => {
        const order = normalizeOrder({
            id: 77,
            userId: 4,
            branchId: 1,
            transactionId: 9,
            status: "PENDING",
            fulfillmentMode: "pickup",
            deliveryFee: 0,
            deliveryLat: null,
            deliveryLng: null,
            deliveryDistanceKm: null,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            items: [
                {
                    id: 1,
                    productId: 1,
                    productName: "Kaprao",
                    quantity: 1,
                    unitPrice: 89,
                    addOns: null,
                    lineTotal: 89,
                },
            ],
            branch: null,
            transaction: null,
            totalAmount: 89,
        } as any);

        expect(order.items[0].addOns).toEqual([]);
    });
});
