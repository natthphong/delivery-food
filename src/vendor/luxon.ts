export class DateTime {
    private constructor(private readonly baseDate: Date, private readonly zone: string) {}

    static now(): DateTime {
        return new DateTime(new Date(), "UTC");
    }

    setZone(zone: string): DateTime {
        return new DateTime(new Date(this.baseDate.getTime()), zone || "UTC");
    }

    get weekday(): number {
        const { weekday } = this.resolveParts();
        switch (weekday) {
            case "mon":
                return 1;
            case "tue":
                return 2;
            case "wed":
                return 3;
            case "thu":
                return 4;
            case "fri":
                return 5;
            case "sat":
                return 6;
            case "sun":
                return 7;
            default:
                return 1;
        }
    }

    toFormat(format: string): string {
        if (format !== "HH:mm:ss") {
            throw new Error("Unsupported format");
        }
        const { hour, minute, second } = this.resolveParts();
        return `${hour}:${minute}:${second}`;
    }

    private resolveParts(): { weekday: string; hour: string; minute: string; second: string } {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: this.zone || "UTC",
            hour12: false,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        const parts = formatter.formatToParts(this.baseDate);
        let weekday = "mon";
        let hour = "00";
        let minute = "00";
        let second = "00";

        for (const part of parts) {
            if (part.type === "weekday") {
                weekday = part.value.toLowerCase().slice(0, 3);
            } else if (part.type === "hour") {
                hour = part.value.padStart(2, "0");
            } else if (part.type === "minute") {
                minute = part.value.padStart(2, "0");
            } else if (part.type === "second") {
                second = part.value.padStart(2, "0");
            }
        }

        return { weekday, hour, minute, second };
    }
}

export default { DateTime };
