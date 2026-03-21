import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MethodPicker from "@/components/payment/MethodPicker";

jest.mock("@/utils/i18n", () => ({
    useI18n: () => ({
        locale: "en",
        t: (key: string) => key,
        setLocale: jest.fn(),
    }),
}));

describe("MethodPicker", () => {
    it("renders available methods and allows selecting another option", async () => {
        const onSelect = jest.fn();
        const user = userEvent.setup();

        render(
            <MethodPicker
                methods={[
                    { id: 1, code: "QR_SLIP", name: "PromptPay QR Slip", methodType: "qr", sortOrder: 1 },
                    { id: 2, code: "WALLET", name: "Wallet Balance", methodType: "balance", sortOrder: 2 },
                ]}
                selectedId={1}
                onSelect={onSelect}
                title="Payment method"
                subtitle="Choose how to pay"
            />
        );

        expect(screen.getByText("Payment method")).toBeInTheDocument();
        expect(screen.getByText("PromptPay QR Slip")).toBeInTheDocument();
        expect(screen.getByText("Wallet Balance")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Wallet Balance/i }));
        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("renders the empty state when no methods are available", () => {
        render(<MethodPicker methods={[]} selectedId={null} onSelect={jest.fn()} />);
        expect(screen.getByText("payment.method.empty")).toBeInTheDocument();
    });
});
