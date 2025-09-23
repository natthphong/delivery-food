import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { deflateSync } from "zlib";
import { withAuth } from "@/utils/authMiddleware";
import { getBranchById } from "@/repository/branch";
import { getCompanyById } from "@/repository/company";
import { logError, logInfo } from "@/utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type QrRequest = { branchId?: unknown; amount?: unknown };

type QrResponse = JsonResponse<{ pngDataUrl: string }>;

type Matrix = boolean[][];

const QUIET_ZONE = 4;
const MODULE_SIZE = 12;
const MATRIX_SIZE = 29;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value >>> 0;
    }
    return table;
})();

function crc32(buffer: Uint8Array): number {
    let crc = 0 ^ -1;
    for (let i = 0; i < buffer.length; i += 1) {
        crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0;
}

function createChunk(type: string, data: Uint8Array): Buffer {
    const typeBuffer = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcBuffer = Buffer.alloc(4);
    const crcValue = crc32(Buffer.concat([typeBuffer, Buffer.from(data)]));
    crcBuffer.writeUInt32BE(crcValue >>> 0, 0);
    return Buffer.concat([length, typeBuffer, Buffer.from(data), crcBuffer]);
}

function createMatrix(size: number): { matrix: Matrix; reserved: boolean[][] } {
    const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    return { matrix, reserved };
}

function placeFinder(
    matrix: Matrix,
    reserved: boolean[][],
    top: number,
    left: number
) {
    for (let dy = -1; dy <= 7; dy += 1) {
        for (let dx = -1; dx <= 7; dx += 1) {
            const y = top + dy;
            const x = left + dx;
            if (y < 0 || x < 0 || y >= matrix.length || x >= matrix.length) continue;
            reserved[y][x] = true;
        }
    }

    for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
            const globalY = top + y;
            const globalX = left + x;
            if (globalY < 0 || globalX < 0 || globalY >= matrix.length || globalX >= matrix.length) {
                continue;
            }
            const outer = x === 0 || x === 6 || y === 0 || y === 6;
            const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
            matrix[globalY][globalX] = outer || inner;
        }
    }
}

function placeTiming(matrix: Matrix, reserved: boolean[][]) {
    const size = matrix.length;
    for (let index = 0; index < size; index += 1) {
        const bit = index % 2 === 0;
        if (!reserved[6][index]) {
            matrix[6][index] = bit;
            reserved[6][index] = true;
        }
        if (!reserved[index][6]) {
            matrix[index][6] = bit;
            reserved[index][6] = true;
        }
    }
}

function createBitGenerator(seed: string): () => number {
    let buffer = Buffer.alloc(0);
    let bitIndex = 0;
    let counter = 0;

    const ensure = (required: number) => {
        while (buffer.length * 8 - bitIndex < required) {
            const hash = createHash("sha256");
            hash.update(seed);
            hash.update(String(counter));
            counter += 1;
            buffer = Buffer.concat([buffer, hash.digest()]);
        }
    };

    return () => {
        ensure(1);
        const byteIndex = bitIndex >> 3;
        const shift = 7 - (bitIndex & 7);
        const bit = (buffer[byteIndex] >> shift) & 1;
        bitIndex += 1;
        return bit;
    };
}

function fillData(matrix: Matrix, reserved: boolean[][], payload: string) {
    const getBit = createBitGenerator(payload);
    for (let y = 0; y < matrix.length; y += 1) {
        for (let x = 0; x < matrix.length; x += 1) {
            if (reserved[y][x]) continue;
            matrix[y][x] = getBit() === 1;
        }
    }
}

function buildMatrix(payload: string): Matrix {
    const { matrix, reserved } = createMatrix(MATRIX_SIZE);

    placeFinder(matrix, reserved, 0, 0);
    placeFinder(matrix, reserved, 0, MATRIX_SIZE - 7);
    placeFinder(matrix, reserved, MATRIX_SIZE - 7, 0);
    placeTiming(matrix, reserved);

    reserved[MATRIX_SIZE - 8][8] = true;
    matrix[MATRIX_SIZE - 8][8] = true;

    fillData(matrix, reserved, payload);
    return matrix;
}

function matrixToPng(matrix: Matrix): Buffer {
    const moduleCount = matrix.length + QUIET_ZONE * 2;
    const width = moduleCount * MODULE_SIZE;
    const height = width;
    const rowStride = width + 1;
    const raw = new Uint8Array(rowStride * height);

    for (let y = 0; y < height; y += 1) {
        const moduleY = Math.floor(y / MODULE_SIZE) - QUIET_ZONE;
        const rowOffset = y * rowStride;
        raw[rowOffset] = 0;
        for (let x = 0; x < width; x += 1) {
            const moduleX = Math.floor(x / MODULE_SIZE) - QUIET_ZONE;
            const inBounds =
                moduleX >= 0 &&
                moduleY >= 0 &&
                moduleX < matrix.length &&
                moduleY < matrix.length;
            const isDark = inBounds ? matrix[moduleY][moduleX] : false;
            raw[rowOffset + 1 + x] = isDark ? 0 : 255;
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.writeUInt8(8, 8); // bit depth
    ihdr.writeUInt8(0, 9); // grayscale
    ihdr.writeUInt8(0, 10); // compression
    ihdr.writeUInt8(0, 11); // filter
    ihdr.writeUInt8(0, 12); // interlace

    const idatData = deflateSync(Buffer.from(raw));
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrChunk = createChunk("IHDR", ihdr);
    const idatChunk = createChunk("IDAT", idatData);
    const iendChunk = createChunk("IEND", Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function renderQr(payload: string): Buffer {
    const matrix = buildMatrix(payload);
    return matrixToPng(matrix);
}

function parseNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<QrResponse | Buffer>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { pngDataUrl: "" } });
        }

        res.setHeader("Cache-Control", "no-store");

        const payload = (req.body as QrRequest) ?? {};
        const branchId = parseNumber(payload.branchId);
        const amount = parseNumber(payload.amount);

        if (branchId == null || amount == null || amount <= 0) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid payload", body: { pngDataUrl: "" } });
        }

        const auth = (req as any).auth as { uid: string; userId: number | null };
        const userId = auth?.userId ?? null;

        const branch = await getBranchById(branchId);
        if (!branch) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Branch not found", body: { pngDataUrl: "" } });
        }

        const company = await getCompanyById(branch.company_id);
        if (!company || !company.payment_id) {
            return res
                .status(400)
                .json({ code: "CONFIG_MISSING", message: "Missing payment config", body: { pngDataUrl: "" } });
        }

        const ts = Math.floor(Date.now() / 1000);
        const qrPayload = `PAYTO:PP|payment_id=${company.payment_id}|branch=${branchId}|user=${
            userId ?? "anon"
        }|amount=${amount.toFixed(2)}|ts=${ts}`;

        logInfo("qr generate: building", { reqId, branchId, companyId: branch.company_id, amount });

        const buffer = renderQr(qrPayload);

        const accept = typeof req.headers.accept === "string" ? req.headers.accept : "";
        if (accept.includes("application/json")) {
            const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
            return res.status(200).json({ code: "OK", message: "success", body: { pngDataUrl: dataUrl } });
        }

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", buffer.length.toString());
        res.status(200).send(buffer);
    } catch (error: any) {
        logError("qr generate: error", { reqId, message: error?.message });
        if (!res.headersSent) {
            res.status(500).json({ code: "ERROR", message: "Failed to generate QR", body: { pngDataUrl: "" } });
        }
    }
}

export default withAuth(handler);
