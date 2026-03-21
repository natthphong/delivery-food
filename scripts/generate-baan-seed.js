const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BRANCH_SOURCE_PATH = path.join(ROOT, "tmp", "baan-branch.json");
const MENU_SOURCE_PATH = path.join(ROOT, "tmp", "baan-menu.json");
const DEFAULT_OUTPUT_PATH = path.join(ROOT, "sql", "V9__baan_json_preset_seed.sql");

const IMAGE_BY_CATEGORY = {
    1: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
    2: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
    3: "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80",
    4: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
    5: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80",
    6: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    7: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
    8: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_DEFS = [
    {
        id: 1,
        slug: "kaprao-signatures",
        name: "Kaprao Signatures",
        description: "BAAN-style basil rice signatures and spicy basil variations.",
        matcher: (text) => /กะเพรา|โหระภา/.test(text),
    },
    {
        id: 2,
        slug: "fried-rice-and-kua",
        name: "Fried Rice & Kua Rice",
        description: "Fried rice, kua-style rice, and wok-fired rice comfort dishes.",
        matcher: (text) => /ข้าวผัด|ข้าวคั่ว|ผัดจักรพรรดิ|ต้มยำ|ลงเรือ|สับปะรด|โบราณ|ซอส/.test(text),
    },
    {
        id: 3,
        slug: "curries-and-spicy-rice",
        name: "Curries & Spicy Rice",
        description: "Green curry, red curry, tai pla, and stronger spice-led rice plates.",
        matcher: (text) => /พริกแกง|เขียวหวาน|คั่วกลิ้ง|ไตปลา|แกง/.test(text),
    },
    {
        id: 4,
        slug: "stir-fried-over-rice",
        name: "Stir-fried Over Rice",
        description: "Rice plates built around stir-fried toppings and wok mains.",
        matcher: (text) => /ข้าวราด|ราดข้าว|ผัดขิง|น้ำมันหอย|ผัดผัก/.test(text),
    },
    {
        id: 5,
        slug: "grill-and-fried-favorites",
        name: "Grill & Fried Favorites",
        description: "Grilled pork neck, fried chicken, and heavier comfort mains.",
        matcher: (text) => /ทอด|ย่าง|คอหมู|หมูสามชั้น|ขาหมู/.test(text),
    },
    {
        id: 6,
        slug: "vegetables-and-light",
        name: "Vegetable & Light",
        description: "Vegetable-forward, tofu, mushroom, and lighter rice dishes.",
        matcher: (text) => /ผัก|เห็ด|เต้าหู้|คะน้า|ผักบุ้ง/.test(text),
    },
    {
        id: 7,
        slug: "kid-favorites",
        name: "Kid Favorites",
        description: "Milder rice dishes and sausage or egg-forward comfort picks.",
        matcher: (text) => /#kidlove|ไส้กรอก|ไข่|ซอส/.test(text),
    },
    {
        id: 8,
        slug: "baan-specialties",
        name: "BAAN Specialties",
        description: "House-only combinations and one-off BAAN comfort plates.",
        matcher: () => true,
    },
];

const BRANCH_META = {
    "BAAN - สวนหลวง": {
        slug: "suan-luang",
        lat: 7.8819,
        lng: 98.3636,
        imageUrl: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: 35,
        hours: buildHours("10:00", "21:30"),
    },
    "BAAN - วิชิต": {
        slug: "wichit",
        lat: 7.8727,
        lng: 98.3656,
        imageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: 35,
        hours: buildHours("10:00", "21:00"),
    },
    "BAAN - กะทู้": {
        slug: "kathu",
        lat: 7.9179,
        lng: 98.3332,
        imageUrl: "https://images.unsplash.com/photo-1521831407885-5dfb36d4d1ec?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: 39,
        hours: buildHours("10:30", "21:30"),
    },
    "BAAN - Old town": {
        slug: "old-town",
        lat: 7.8846,
        lng: 98.3923,
        imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: 30,
        hours: buildHours("11:00", "22:00"),
    },
    "BAAN - สามกอง": {
        slug: "sam-kong",
        lat: 7.9006,
        lng: 98.3856,
        imageUrl: "https://images.unsplash.com/photo-1521831407885-5dfb36d4d1ec?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: 32,
        hours: buildHours("10:00", "21:30"),
    },
    "BAAN - ไวน์แอนด์สปิริต": {
        slug: "wine-spirits",
        lat: 7.8896,
        lng: 98.3725,
        imageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: false,
        riderDeliveryFee: 0,
        hours: buildHours("11:00", "20:30"),
    },
    "BAAN - บางใหญ่": {
        slug: "bang-yai",
        lat: 7.8681,
        lng: 98.3486,
        imageUrl: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80",
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: 37,
        hours: buildHours("10:30", "21:00"),
    },
};

function buildHours(openTime, closeTime) {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTime,
        closeTime,
    }));
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sqlString(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableString(value) {
    if (value == null || value === "") {
        return "NULL";
    }
    return sqlString(value);
}

function sqlNullableNumber(value) {
    return value == null ? "NULL" : Number(value).toFixed(2);
}

function sqlBool(value) {
    return value ? "TRUE" : "FALSE";
}

function normalizeDescription(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\(เมนูของรูปภาพ\)/g, "")
        .trim();
}

function makeSearchTerms(title, description) {
    return [title, description.replace(/#/g, "")]
        .join(", ")
        .replace(/\s+/g, " ")
        .trim();
}

function categorizeProduct(item) {
    const text = `${item.title} ${item.description || ""}`;
    const matched = CATEGORY_DEFS.filter((category) => category.matcher(text)).map((category) => category.id);
    const unique = Array.from(new Set(matched));
    if (unique.length === 0) {
        return [8];
    }
    const primary = unique[0];
    const secondary = unique.filter((id) => id !== primary && id !== 8).slice(0, 2);
    return [primary, ...secondary];
}

function inferAddOns(item) {
    const text = `${item.title} ${item.description || ""}`;
    const addOns = [];
    const seen = new Set();

    const push = (groupName, name, price) => {
        if (seen.has(name)) {
            return;
        }
        seen.add(name);
        addOns.push({
            groupName,
            name,
            price,
            isRequired: false,
        });
    };

    if (/ข้าว/.test(text) && !/ไข่ดาว|ไข่เจียว|ไข่ต้ม/.test(text)) {
        push("extras", "ไข่ดาว", 12);
    }
    if (/ไข่ต้ม|boiled egg/i.test(text) && !/ไข่ต้ม/.test(item.title)) {
        push("extras", "ไข่ต้ม", 12);
    }
    if (/ไข่เจียว|omelette/i.test(text) && !/ไข่เจียว/.test(item.title)) {
        push("extras", "ไข่เจียว", 15);
    }
    if (/กุ้ง|shrimp|seafood/i.test(text) && !/กุ้ง/.test(item.title)) {
        push("protein", "กุ้ง", 25);
    }
    if (/หมูกรอบ|crispy pork/i.test(text) && !/หมูกรอบ/.test(item.title)) {
        push("protein", "หมูกรอบ", 18);
    }
    if (/เนื้อ|beef|brisket/i.test(text) && !/เนื้อ/.test(item.title)) {
        push("protein", "เนื้อ", 22);
    }
    if (/ไส้กรอก|sausage/i.test(text) && !/ไส้กรอก/.test(item.title)) {
        push("extras", "ไส้กรอก", 15);
    }
    if (/คอหมูย่าง|grilled pork neck/i.test(text) && !/คอหมูย่าง/.test(item.title)) {
        push("protein", "คอหมูย่าง", 24);
    }

    return addOns.slice(0, 3).map((addOn, index) => ({
        ...addOn,
        sortOrder: index + 1,
    }));
}

function branchSpecificMatch(item, branch) {
    const text = item.description || "";
    if (/Old town/i.test(text) || /Old Town/i.test(text)) {
        return /old-town/.test(branch.slug);
    }
    return true;
}

function buildPresetData(branchesSource, menuSource) {
    const branches = branchesSource.map((branch, index) => {
        const meta = BRANCH_META[branch.branchName];
        if (!meta) {
            throw new Error(`Missing branch metadata for ${branch.branchName}`);
        }
        return {
            id: index + 1,
            companyId: 1,
            slug: meta.slug,
            name: branch.branchName,
            description: `BAAN Phuket preset branch for ${branch.branchLocaltion}.`,
            imageUrl: meta.imageUrl,
            addressLine: branch.branchLocaltion,
            lat: meta.lat,
            lng: meta.lng,
            isForceClosed: false,
            acceptingOrders: meta.acceptingOrders,
            supportsPickup: meta.supportsPickup,
            supportsRiderDelivery: meta.supportsRiderDelivery,
            riderDeliveryFee: meta.riderDeliveryFee,
            operationalNote: `โทร ${branch.branchPhone}`,
            openHours: meta.hours,
        };
    });

    const products = [];
    const productCategories = [];
    const addOns = [];
    const branchProducts = [];
    const branchAddOnOverrides = [];
    let addOnID = 1;
    let branchProductID = 1;

    menuSource.forEach((rawItem, index) => {
        const productID = index + 1;
        const categoryIDs = categorizeProduct(rawItem);
        const description = normalizeDescription(rawItem.description);
        const product = {
            id: productID,
            companyId: 1,
            slug: `baan-item-${String(productID).padStart(3, "0")}`,
            name: rawItem.title.trim(),
            description,
            imageUrl: IMAGE_BY_CATEGORY[categoryIDs[0]] || IMAGE_BY_CATEGORY[8],
            basePrice: Number(rawItem.price),
            searchTerms: makeSearchTerms(rawItem.title, description),
            isActive: true,
            isRecommended: /#recommended/i.test(rawItem.description || "") || /#BAAN/i.test(rawItem.description || ""),
        };
        products.push(product);

        categoryIDs.forEach((categoryID) => {
            productCategories.push({ productID, categoryID });
        });

        const productAddOns = inferAddOns(rawItem).map((addOn) => ({
            id: addOnID++,
            productID,
            ...addOn,
        }));
        addOns.push(...productAddOns);

        branches.forEach((branch, branchIndex) => {
            if (!branchSpecificMatch(rawItem, branch)) {
                return;
            }
            const priceOverride =
                (branchIndex + 1 + productID) % 9 === 0 ? Number((product.basePrice + ((branchIndex % 2) + 1) * 5).toFixed(2)) : null;

            branchProducts.push({
                id: branchProductID++,
                branchID: branch.id,
                productID,
                isEnabled: true,
                stockQty: 12 + ((productID * 7 + branch.id * 5) % 28),
                priceOverride,
                isRecommended: product.isRecommended,
                sortOrder: productID,
                isTemporarilyClosed: false,
                availabilityNote: null,
                reorderLevel: 6 + ((productID + branch.id) % 5),
            });

            productAddOns.forEach((addOn) => {
                if (branch.slug === "old-town" && addOn.name === "ไข่ดาว") {
                    branchAddOnOverrides.push({
                        branchID: branch.id,
                        addOnID: addOn.id,
                        isEnabled: true,
                        isTemporarilyClosed: false,
                        priceOverride: addOn.price + 2,
                        availabilityNote: null,
                    });
                }
                if (branch.slug === "kathu" && addOn.name === "กุ้ง") {
                    branchAddOnOverrides.push({
                        branchID: branch.id,
                        addOnID: addOn.id,
                        isEnabled: true,
                        isTemporarilyClosed: true,
                        priceOverride: null,
                        availabilityNote: "วัตถุดิบทะเลเข้าช่วงบ่าย",
                    });
                }
                if (branch.slug === "bang-yai" && addOn.name === "หมูกรอบ") {
                    branchAddOnOverrides.push({
                        branchID: branch.id,
                        addOnID: addOn.id,
                        isEnabled: true,
                        isTemporarilyClosed: false,
                        priceOverride: addOn.price + 3,
                        availabilityNote: null,
                    });
                }
            });
        });
    });

    return {
        branches,
        categories: CATEGORY_DEFS.map(({ id, slug, name, description }) => ({
            id,
            companyId: 1,
            slug,
            name,
            description,
            sortOrder: id,
            isActive: true,
        })),
        products,
        productCategories,
        addOns,
        branchProducts,
        branchAddOnOverrides,
    };
}

function buildValues(rows, mapper) {
    return rows.map(mapper).join(",\n");
}

function generateSeedSql(preset) {
    const branchIDs = preset.branches.map((branch) => branch.id).join(", ");
    const productIDs = preset.products.map((product) => product.id).join(", ");
    const categoryValues = buildValues(
        preset.categories,
        (category) =>
            `  (${category.id}, ${category.companyId}, ${sqlString(category.slug)}, ${sqlString(category.name)}, ${sqlString(category.description)}, ${category.sortOrder}, ${sqlBool(category.isActive)})`
    );
    const productValues = buildValues(
        preset.products,
        (product) =>
            `  (${product.id}, ${product.companyId}, ${sqlString(product.slug)}, ${sqlString(product.name)}, ${sqlString(product.description)}, ${sqlString(product.imageUrl)}, ${product.basePrice.toFixed(2)}, ${sqlString(product.searchTerms)}, ${sqlBool(product.isActive)})`
    );
    const branchValues = buildValues(
        preset.branches,
        (branch) =>
            `  (${branch.id}, ${branch.companyId}, ${sqlString(branch.slug)}, ${sqlString(branch.name)}, ${sqlString(branch.description)}, ${sqlString(branch.imageUrl)}, ${sqlString(branch.addressLine)}, ${branch.lat.toFixed(6)}, ${branch.lng.toFixed(6)}, ${sqlBool(branch.isForceClosed)}, ${sqlBool(branch.acceptingOrders)}, ${sqlBool(branch.supportsPickup)}, ${sqlBool(branch.supportsRiderDelivery)}, ${branch.riderDeliveryFee.toFixed(2)}, ${sqlString(branch.operationalNote)})`
    );
    const hoursValues = buildValues(
        preset.branches.flatMap((branch) => branch.openHours.map((slot) => ({ branchID: branch.id, ...slot }))),
        (slot) => `  (${slot.branchID}, ${slot.dayOfWeek}, ${sqlString(slot.openTime)}, ${sqlString(slot.closeTime)})`
    );
    const productCategoryValues = buildValues(
        preset.productCategories,
        (row) => `  (${row.productID}, ${row.categoryID})`
    );
    const addOnValues = buildValues(
        preset.addOns,
        (addOn) =>
            `  (${addOn.id}, ${addOn.productID}, ${sqlString(addOn.groupName)}, ${sqlString(addOn.name)}, ${addOn.price.toFixed(2)}, ${sqlBool(addOn.isRequired)}, ${addOn.sortOrder})`
    );
    const branchProductValues = buildValues(
        preset.branchProducts,
        (row) =>
            `  (${row.id}, ${row.branchID}, ${row.productID}, ${sqlBool(row.isEnabled)}, ${row.stockQty}, ${sqlNullableNumber(row.priceOverride)}, ${sqlBool(row.isRecommended)}, ${row.sortOrder}, ${sqlBool(row.isTemporarilyClosed)}, ${sqlNullableString(row.availabilityNote)}, ${row.reorderLevel})`
    );
    const addOnOverrideValues = buildValues(
        preset.branchAddOnOverrides,
        (row) =>
            `  (${row.branchID}, ${row.addOnID}, ${sqlBool(row.isEnabled)}, ${sqlBool(row.isTemporarilyClosed)}, ${sqlNullableNumber(row.priceOverride)}, ${sqlNullableString(row.availabilityNote)})`
    );

    return `-- V9__baan_json_preset_seed.sql
-- Refresh local/demo BAAN preset data from tmp/baan-branch.json and tmp/baan-menu.json.

BEGIN;

INSERT INTO categories (id, company_id, slug, name, description, sort_order, is_active)
VALUES
${categoryValues}
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('categories', 'id'), GREATEST((SELECT MAX(id) FROM categories), 1), TRUE);

INSERT INTO products (id, company_id, slug, name, description, image_url, base_price, search_terms, is_active)
VALUES
${productValues}
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    base_price = EXCLUDED.base_price,
    search_terms = EXCLUDED.search_terms,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1), TRUE);

DELETE FROM product_categories
WHERE product_id IN (${productIDs});

INSERT INTO product_categories (product_id, category_id)
VALUES
${productCategoryValues}
ON CONFLICT (product_id, category_id) DO NOTHING;

DELETE FROM product_add_ons
WHERE product_id IN (${productIDs});

INSERT INTO product_add_ons (id, product_id, group_name, name, price, is_required, sort_order)
VALUES
${addOnValues}
ON CONFLICT (id) DO UPDATE
SET product_id = EXCLUDED.product_id,
    group_name = EXCLUDED.group_name,
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    is_required = EXCLUDED.is_required,
    sort_order = EXCLUDED.sort_order;

SELECT setval(pg_get_serial_sequence('product_add_ons', 'id'), GREATEST((SELECT MAX(id) FROM product_add_ons), 1), TRUE);

INSERT INTO branches (
  id,
  company_id,
  slug,
  name,
  description,
  image_url,
  address_line,
  lat,
  lng,
  is_force_closed,
  accepting_orders,
  supports_pickup,
  supports_rider_delivery,
  rider_delivery_fee,
  operational_note
)
VALUES
${branchValues}
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    address_line = EXCLUDED.address_line,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    is_force_closed = EXCLUDED.is_force_closed,
    accepting_orders = EXCLUDED.accepting_orders,
    supports_pickup = EXCLUDED.supports_pickup,
    supports_rider_delivery = EXCLUDED.supports_rider_delivery,
    rider_delivery_fee = EXCLUDED.rider_delivery_fee,
    operational_note = EXCLUDED.operational_note;

SELECT setval(pg_get_serial_sequence('branches', 'id'), GREATEST((SELECT MAX(id) FROM branches), 1), TRUE);

DELETE FROM branch_operating_hours
WHERE branch_id IN (${branchIDs});

INSERT INTO branch_operating_hours (branch_id, day_of_week, open_time, close_time)
VALUES
${hoursValues};

DELETE FROM branch_product_add_ons
WHERE branch_id IN (${branchIDs});

DELETE FROM branch_products
WHERE branch_id IN (${branchIDs});

INSERT INTO branch_products (
  id,
  branch_id,
  product_id,
  is_enabled,
  stock_qty,
  price_override,
  is_recommended,
  sort_order,
  is_temporarily_closed,
  availability_note,
  reorder_level
)
VALUES
${branchProductValues}
ON CONFLICT (id) DO UPDATE
SET branch_id = EXCLUDED.branch_id,
    product_id = EXCLUDED.product_id,
    is_enabled = EXCLUDED.is_enabled,
    stock_qty = EXCLUDED.stock_qty,
    price_override = EXCLUDED.price_override,
    is_recommended = EXCLUDED.is_recommended,
    sort_order = EXCLUDED.sort_order,
    is_temporarily_closed = EXCLUDED.is_temporarily_closed,
    availability_note = EXCLUDED.availability_note,
    reorder_level = EXCLUDED.reorder_level;

SELECT setval(pg_get_serial_sequence('branch_products', 'id'), GREATEST((SELECT MAX(id) FROM branch_products), 1), TRUE);

${preset.branchAddOnOverrides.length > 0 ? `INSERT INTO branch_product_add_ons (
  branch_id,
  product_add_on_id,
  is_enabled,
  is_temporarily_closed,
  price_override,
  availability_note
)
VALUES
${addOnOverrideValues}
ON CONFLICT (branch_id, product_add_on_id) DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    is_temporarily_closed = EXCLUDED.is_temporarily_closed,
    price_override = EXCLUDED.price_override,
    availability_note = EXCLUDED.availability_note,
    updated_at = NOW();

` : ""}COMMIT;
`;
}

function parseArgs(argv) {
    const options = { write: null };
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--write") {
            options.write = argv[index + 1] ? path.resolve(argv[index + 1]) : DEFAULT_OUTPUT_PATH;
            index += 1;
        }
    }
    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const preset = buildPresetData(readJson(BRANCH_SOURCE_PATH), readJson(MENU_SOURCE_PATH));
    const sql = generateSeedSql(preset);
    if (options.write) {
        fs.writeFileSync(options.write, sql);
        process.stdout.write(`Wrote ${path.relative(ROOT, options.write)}\n`);
        return;
    }
    process.stdout.write(sql);
}

if (require.main === module) {
    main();
}

module.exports = {
    BRANCH_SOURCE_PATH,
    MENU_SOURCE_PATH,
    DEFAULT_OUTPUT_PATH,
    CATEGORY_DEFS,
    buildPresetData,
    branchSpecificMatch,
    categorizeProduct,
    generateSeedSql,
    inferAddOns,
};
