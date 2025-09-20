import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "@pages/search";
import apiClient from "@utils/apiClient";
import { getCurrentPositionWithPermission } from "@utils/geo";

jest.mock("@utils/apiClient");
jest.mock("@utils/geo");
jest.mock("next/router", () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedGeo = getCurrentPositionWithPermission as jest.MockedFunction<typeof getCurrentPositionWithPermission>;

const sampleResponse = {
    data: {
        code: "OK",
        message: "OK",
        body: { branches: [], categories: [] },
    },
};

describe("SearchPage", () => {
    beforeEach(() => {
        mockedGet.mockResolvedValue(sampleResponse as any);
        mockedGeo.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("renders search inputs", async () => {
        render(<SearchPage />);
        expect(await screen.findByLabelText(/search dishes/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it("queries API with search text and geolocation", async () => {
        mockedGeo.mockResolvedValue({ lat: 13.75, lng: 100.5 });
        render(<SearchPage />);
        await waitFor(() => expect(mockedGet).toHaveBeenCalled());
        mockedGet.mockClear();

        await userEvent.type(screen.getByLabelText(/search dishes/i), "sushi");
        await userEvent.click(screen.getByRole("button", { name: /search/i }));

        await waitFor(() => expect(mockedGet).toHaveBeenCalled());
        const [, config] = mockedGet.mock.calls[0];
        expect(config?.params).toMatchObject({ q: "sushi", lat: 13.75, lng: 100.5 });
    });

    it("renders branches sorted by distance", async () => {
        mockedGeo.mockResolvedValue({ lat: 13, lng: 100 });
        mockedGet.mockResolvedValue({
            data: {
                code: "OK",
                message: "OK",
                body: {
                    branches: [
                        { id: 1, name: "Far Branch", is_open: true, is_force_closed: false, distance_km: 5.2 },
                        { id: 2, name: "Near Branch", is_open: true, is_force_closed: false, distance_km: 1.1 },
                    ],
                    categories: [],
                },
            },
        } as any);

        render(<SearchPage />);
        const headings = await screen.findAllByRole("heading", { level: 3 });
        expect(headings[0]).toHaveTextContent("Near Branch");
        expect(headings[1]).toHaveTextContent("Far Branch");
    });
});
