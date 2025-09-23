export function appendIdWithTrim(
    arr: number[] | null | undefined,
    id: number,
    maxLen: number
): number[] {
    const base = Array.isArray(arr) ? arr.filter((value) => typeof value === "number") : [];
    const next = [...base, id];
    const overflow = Math.max(0, next.length - maxLen);
    return overflow > 0 ? next.slice(overflow) : next;
}
