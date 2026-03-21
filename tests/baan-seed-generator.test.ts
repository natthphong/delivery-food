import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildPresetData, inferAddOns, categorizeProduct } = require(path.resolve(__dirname, "../../scripts/generate-baan-seed.js"));

test("categorizeProduct maps kaprao titles into the kaprao category first", () => {
    const categories = categorizeProduct({
        title: "ข้าวกะเพราบ้านบ้าน",
        description: "ข้าวกะเพราบ้านบ้าน หมู/ไก่ | ทะเล/หมูกรอบ/เนื้อ #BAAN",
    });

    assert.equal(categories[0], 1);
});

test("inferAddOns only creates practical optional add-ons", () => {
    const addOns = inferAddOns({
        title: "ข้าวคั่วพริกเกลือ",
        description: "ข้าวคั่วพริกเกลือ หมู/ไก่ | ทะเล/กุ้ง #recommended",
    });

    assert.ok(addOns.some((addOn: { name: string }) => addOn.name === "ไข่ดาว"));
    assert.ok(addOns.some((addOn: { name: string }) => addOn.name === "กุ้ง"));
    assert.ok(addOns.every((addOn: { isRequired: boolean }) => addOn.isRequired === false));
});

test("buildPresetData keeps Old Town-only dishes scoped to the Old Town branch", () => {
    const preset = buildPresetData(
        [
            { branchName: "BAAN - Old town", branchLocaltion: "Old Town, ภูเก็ต", branchPhone: "000" },
            { branchName: "BAAN - กะทู้", branchLocaltion: "กะทู้, ภูเก็ต", branchPhone: "111" },
        ],
        [
            {
                title: "ข้าวผัดซอส",
                description: "ข้าวผัดซอส (สาขา Old town) Fried rice with tomato sauce, fried egg and sausage #kidlove",
                price: 30,
                imageUrl: "",
            },
        ]
    );

    const product = preset.products[0];
    const branchProductRows = preset.branchProducts.filter((row: { productID: number }) => row.productID === product.id);

    assert.equal(branchProductRows.length, 1);
    assert.equal(branchProductRows[0].branchID, 1);
});
