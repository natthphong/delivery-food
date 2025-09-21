import type { NextApiRequest, NextApiResponse } from "next";
import type { CartAddOn, CartBranchGroup, CartItem, UserRecord } from "@/types";
import { resolveAuth } from "@utils/authMiddleware";
import { getConfigValue, getNumberConfig } from "@repository/config";
import { getUserByFirebaseUid, saveUserCard } from "@repository/user";
import { logError } from "@utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type SaveCardRequest = { add?: unknown; card?: unknown; replace?: boolean };

const DEFAULT_MAX_QTY_PER_ITEM = 10;

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

function sanitizeAddOns(input: unknown): CartAddOn[] {
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

function sortAddOns(addOns: CartAddOn[]): CartAddOn[] {
    return [...addOns].sort((a, b) => {
        if (a.name === b.name) {
            return a.price - b.price;
        }
        return a.name.localeCompare(b.name);
    });
}

function sanitizeProduct(raw: unknown, index: number): CartItem {
    if (!raw || typeof raw !== "object") {
        throw new Error(`Invalid product at index ${index}`);
    }
    const productId = toId((raw as any).productId, "productId");
    const productName = toName((raw as any).productName, "productName");
    const price = toNumber((raw as any).price, "price");
    const qty = toQuantity((raw as any).qty);
    const productAddOns = sortAddOns(sanitizeAddOns((raw as any).productAddOns));
    return { productId, productName, price, qty, productAddOns };
}

function sanitizeBranch(raw: unknown, index: number): CartBranchGroup {
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
    const productList = productListRaw.map((item: unknown, productIndex: number) => sanitizeProduct(item, productIndex));
    return { branchId, companyId, branchName, branchImage, productList };
}

function sanitizeCardStrict(input: unknown): CartBranchGroup[] {
    if (!Array.isArray(input)) {
        throw new Error("card must be an array");
    }
    return input.map((raw, index) => sanitizeBranch(raw, index));
}

function sanitizeExistingCard(input: unknown): CartBranchGroup[] {
    try {
        return sanitizeCardStrict(input);
    } catch {
        return [];
    }
}

function sanitizeAddRequest(raw: unknown): CartBranchGroup[] {
    if (!raw || typeof raw !== "object") {
        throw new Error("Invalid add payload");
    }

    const branchId = toId((raw as any).branchId, "branchId");
    const companyId = toId((raw as any).companyId, "companyId");
    const branchName = toName((raw as any).branchName, "branchName");
    const branchImage = toNullableString((raw as any).branchImage);

    const productSources: unknown[] = [];
    if ((raw as any).item) {
        productSources.push((raw as any).item);
    }
    if (Array.isArray((raw as any).items)) {
        productSources.push(...((raw as any).items as unknown[]));
    }
    if (Array.isArray((raw as any).productList)) {
        productSources.push(...((raw as any).productList as unknown[]));
    }

    if (productSources.length === 0) {
        throw new Error("add.item required");
    }

    const productList = productSources.map((item, index) => sanitizeProduct(item, index));
    return [
        {
            branchId,
            companyId,
            branchName,
            branchImage,
            productList,
        },
    ];
}

function clampQty(qty: number, maxQty: number): number {
    return Math.min(Math.max(qty, 1), maxQty);
}

function cloneItem(item: CartItem, maxQty: number): CartItem {
    return {
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        qty: clampQty(item.qty, maxQty),
        productAddOns: item.productAddOns.map((addon) => ({ ...addon })),
    };
}

function cloneBranch(branch: CartBranchGroup, maxQty: number): CartBranchGroup {
    return {
        branchId: branch.branchId,
        companyId: branch.companyId,
        branchName: branch.branchName,
        branchImage: branch.branchImage,
        productList: branch.productList.map((item) => cloneItem(item, maxQty)),
    };
}

function canonicalizeAddOns(addOns: CartAddOn[]): string {
    const sorted = sortAddOns(addOns);
    return JSON.stringify(sorted);
}

function variantKey(branchId: string, item: CartItem): string {
    return `${branchId}|${item.productId}|${canonicalizeAddOns(item.productAddOns)}`;
}

function mergeCards(base: CartBranchGroup[], patch: CartBranchGroup[], maxQty: number): CartBranchGroup[] {
    const branchMap = new Map<string, CartBranchGroup>();

    for (const branch of base) {
        branchMap.set(branch.branchId, cloneBranch(branch, maxQty));
    }

    for (const branch of patch) {
        const existing = branchMap.get(branch.branchId);
        if (!existing) {
            branchMap.set(branch.branchId, cloneBranch(branch, maxQty));
            continue;
        }

        existing.branchName = branch.branchName;
        existing.branchImage = branch.branchImage;

        for (const product of branch.productList) {
            const normalized = cloneItem(product, maxQty);
            const key = variantKey(branch.branchId, normalized);
            const match = existing.productList.find(
                (item) => item.productId === normalized.productId && variantKey(branch.branchId, item) === key
            );

            if (match) {
                match.qty = Math.min(match.qty + normalized.qty, maxQty);
                match.price = normalized.price;
                match.productName = normalized.productName;
                match.productAddOns = normalized.productAddOns.map((addon) => ({ ...addon }));
            } else {
                existing.productList.push({
                    productId: normalized.productId,
                    productName: normalized.productName,
                    price: normalized.price,
                    qty: normalized.qty,
                    productAddOns: normalized.productAddOns.map((addon) => ({ ...addon })),
                });
            }
        }
    }

    return Array.from(branchMap.values());
}

function filterEmptyBranches(card: CartBranchGroup[]): CartBranchGroup[] {
    return card
        .map((branch) => ({
            ...branch,
            productList: branch.productList.filter((item) => item.qty > 0),
        }))
        .filter((branch) => branch.productList.length > 0);
}

function totalUniqueItems(card: CartBranchGroup[]): number {
    return card.reduce((acc, branch) => acc + branch.productList.length, 0);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<JsonResponse<{ user: UserRecord } | null>>
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
        const replace = body?.replace === true;

        const currentUser = await getUserByFirebaseUid(auth.uid);
        const existingCard = sanitizeExistingCard(currentUser?.card ?? []);
        const maxQtyPerItem = await getNumberConfig("MAX_QTY_PER_ITEM", DEFAULT_MAX_QTY_PER_ITEM);

        let nextCard: CartBranchGroup[] = existingCard;

        if (replace) {
            const sanitized = sanitizeCardStrict(body?.card ?? []);
            nextCard = mergeCards([], sanitized, maxQtyPerItem);
        } else {
            let additions: CartBranchGroup[] = [];
            if (body?.add) {
                additions = sanitizeAddRequest(body.add);
            } else if (body?.card) {
                const sanitizedLegacy = sanitizeCardStrict(body.card);
                additions = sanitizedLegacy.length > 0 ? [sanitizedLegacy[0]] : [];
            }

            if (additions.length === 0) {
                if (currentUser) {
                    return res.status(200).json({ code: "OK", message: "No changes", body: { user: currentUser } });
                }
                const persisted = await saveUserCard(auth.uid, existingCard);
                return res.status(200).json({ code: "OK", message: "No changes", body: { user: persisted } });
            }

            nextCard = mergeCards(existingCard, additions, maxQtyPerItem);
        }

        nextCard = filterEmptyBranches(nextCard);

        const rawLimit = await getConfigValue("MAXIMUM_CARD");
        const parsedLimit = Number(rawLimit);
        const maximumItems = Number.isFinite(parsedLimit) ? parsedLimit : 100;
        const uniqueItems = totalUniqueItems(nextCard);

        if (uniqueItems > maximumItems) {
            return res
                .status(400)
                .json({ code: "CARD_LIMIT_EXCEEDED", message: "Cart item limit exceeded", body: null });
        }

        const savedUser = await saveUserCard(auth.uid, nextCard);
        return res.status(200).json({ code: "OK", message: "Saved", body: { user: savedUser } });
    } catch (error: any) {
        if (error instanceof Error) {
            if (error.message === "Quantity must be at least 1") {
                return res.status(400).json({ code: "INVALID_QTY", message: error.message, body: null });
            }
            if (error.message.startsWith("Invalid") || error.message.includes("must")) {
                return res.status(400).json({ code: "BAD_REQUEST", message: error.message, body: null });
            }
        }
        logError("card save error", { message: error?.message });
        return res
            .status(500)
            .json({ code: "INTERNAL_ERROR", message: "Failed to save card", body: null });
    }
}
