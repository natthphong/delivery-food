export function last4Digits(input: string | number | null | undefined): string | null {
    if (input === null || input === undefined) {
        return null;
    }

    const digits = String(input).replace(/\D+/g, "");
    if (digits.length < 4) {
        return null;
    }

    return digits.slice(-4);
}
