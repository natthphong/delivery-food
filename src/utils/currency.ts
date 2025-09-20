export function formatTHB(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "-";
    }

    const formatter = new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return formatter.format(value);
}

export default formatTHB;
