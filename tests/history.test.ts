import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { appendIdWithTrim } from "../src/utils/history";

describe("appendIdWithTrim", () => {
    it("appends id to undefined input", () => {
        const result = appendIdWithTrim(undefined, 5, 5);
        assert.deepEqual(result, [5]);
    });

    it("trims array to the latest values when exceeding max length", () => {
        const result = appendIdWithTrim([1, 2, 3, 4], 5, 3);
        assert.deepEqual(result, [3, 4, 5]);
    });

    it("filters out non-number entries before appending", () => {
        const result = appendIdWithTrim([1, Number.NaN, 2, 3, "4" as unknown as number], 9, 10);
        assert.equal(result.length, 5);
        assert.equal(result[result.length - 1], 9);
        assert.ok(result.every((value) => typeof value === "number"));
    });
});
