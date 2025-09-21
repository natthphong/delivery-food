import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuth } from "@utils/authMiddleware";
import { getConfigValue } from "@repository/config";
import { getUserCard, saveUserCard } from "@repository/user";
import { logError } from "@utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type CardAddOn = { name: string; price: number };

type CardProduct = {
    productId: string;
    productName: string;
    productAddOns: CardAddOn[];
    qty: number;
    price: number;
};

type CardBranch = {
    branchId: string;
    companyId: string;
    branchName: string;
    branchImage: string | null;
    productList: CardProduct[];
};

type SaveCardRequest = { card: unknown };

function toId(value: unknown, field: string): string {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    throw new Error(`Invalid value for ${field}`);
}

function toName(value: unknown, field: string): string {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    throw new Error(`Invalid value for ${field}`);
}

function toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "string") {
        return value || null;
    }
    throw new Error("Invalid branchImage");
}

function toNumber(value: unknown, field: string): number {
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) {
        throw new Error(`Invalid value for ${field}`);
    }
    return num;
}

function toQuantity(value: unknown): number {
    const qty = toNumber(value, "qty");
    const rounded = Math.floor(qty);
    if (rounded < 1) {
        throw new Error("Quantity must be at least 1");
    }
    return rounded;
}

function sanitizeAddOns(input: unknown): CardAddOn[] {
    if (!Array.isArray(input)) {
        return [];
    }
    return input.map((raw, index) => {
        if (!raw || typeof raw !== "object") {
            throw new Error(`Invalid add-on at index ${index}`);
        }
        const name = toName((raw as any).name, "productAddOns.name");
        const price = toNumber((raw as any).price, "productAddOns.price");
        return { name, price };
    });
}

function sanitizeProduct(raw: unknown, index: number): CardProduct {
    if (!raw || typeof raw !== "object") {
        throw new Error(`Invalid product at index ${index}`);
    }
    const productId = toId((raw as any).productId, "productId");
    const productName = toName((raw as any).productName, "productName");
    const price = toNumber((raw as any).price, "price");
    const qty = toQuantity((raw as any).qty);
    const productAddOns = sanitizeAddOns((raw as any).productAddOns);
    return { productId, productName, productAddOns, price, qty };
}

function sanitizeBranch(raw: unknown, index: number): CardBranch {
    if (!raw || typeof raw !== "object") {
        throw new Error(`Invalid branch at index ${index}`);
    }
    const branchId = toId((raw as any).branchId, "branchId");
    const companyId = toId((raw as any).companyId, "companyId");
    const branchName = toName((raw as any).branchName, "branchName");
    const branchImage = toNullableString((raw as any).branchImage);
    const productListRaw = (raw as any).productList;
    if (!Array.isArray(productListRaw) || productListRaw.length === 0) {
        throw new Error("productList must contain at least one product");
    }
    const productList = productListRaw.map((item: unknown, productIndex: number) =>
        sanitizeProduct(item, productIndex)
    );
    return { branchId, companyId, branchName, branchImage, productList };
}

function sanitizeCard(input: unknown): CardBranch[] {
    if (!Array.isArray(input)) {
        throw new Error("card must be an array");
    }
    return input.map((raw, index) => sanitizeBranch(raw, index));
}

function cloneBranch(branch: CardBranch): CardBranch {
    return {
        branchId: branch.branchId,
        companyId: branch.companyId,
        branchName: branch.branchName,
        branchImage: branch.branchImage,
        productList: branch.productList.map((product) => ({
            productId: product.productId,
            productName: product.productName,
            price: product.price,
            qty: product.qty,
            productAddOns: product.productAddOns.map((addon) => ({ ...addon })),
        })),
    };
}

function mergeCards(base: CardBranch[], patch: CardBranch[]): CardBranch[] {
    const resultMap = new Map<string, CardBranch>();

    for (const branch of base) {
        resultMap.set(`${branch.companyId}:${branch.branchId}`, cloneBranch(branch));
    }

    for (const branch of patch) {
        const key = `${branch.companyId}:${branch.branchId}`;
        const existing = resultMap.get(key);
        if (!existing) {
            resultMap.set(key, cloneBranch(branch));
            continue;
        }
        existing.branchName = branch.branchName;
        existing.branchImage = branch.branchImage;
        for (const product of branch.productList) {
            existing.productList.push({
                productId: product.productId,
                productName: product.productName,
                price: product.price,
                qty: product.qty,
                productAddOns: product.productAddOns.map((addon) => ({ ...addon })),
            });
        }
    }

    return Array.from(resultMap.values());
}

function totalQuantity(card: CardBranch[]): number {
    return card.reduce((acc, branch) => {
        const branchQty = branch.productList.reduce((sum, product) => sum + product.qty, 0);
        return acc + branchQty;
    }, 0);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<JsonResponse<{ card: CardBranch[] } | null>>
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res
            .status(405)
            .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
    }

    try {
        const auth = await resolveAuth(req);
        if (!auth?.uid) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Missing or invalid token", body: null });
        }

        const body = req.body as SaveCardRequest;
        const incomingCard = sanitizeCard(body?.card);

        const existingRaw = await getUserCard(auth.uid);
        const existingCard = existingRaw.length ? sanitizeCard(existingRaw) : [];

        const merged = mergeCards(existingCard, incomingCard);

        const configValue = await getConfigValue("MAXIMUM_CARD");
        const parsedLimit = Number(configValue);
        const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
        const totalQty = totalQuantity(merged);

        if (totalQty > limit) {
            return res
                .status(400)
                .json({ code: "CARD_LIMIT_EXCEEDED", message: "Card item limit exceeded", body: null });
        }

        const savedRaw = await saveUserCard(auth.uid, merged);
        const savedCard = savedRaw.length ? sanitizeCard(savedRaw) : [];

        return res.status(200).json({ code: "OK", message: "success", body: { card: savedCard } });
    } catch (error: any) {
        if (error instanceof Error &&
            (error.message.includes("Invalid") || error.message.includes("Quantity"))) {
            return res.status(400).json({ code: "BAD_REQUEST", message: error.message, body: null });
        }
        logError("card save error", { message: error?.message });
        return res
            .status(500)
            .json({ code: "INTERNAL_ERROR", message: "Failed to save card", body: null });
    }
}
