import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import Axios from "axios";
import apiClient from "../src/utils/apiClient";
import { store } from "../src/store";
import { setTokens, logout } from "../src/store/authSlice";
import * as tokenStorage from "../src/utils/tokenStorage";

describe("apiClient refresh interceptor", () => {
    beforeEach(() => {
        store.dispatch(logout());
    });

    afterEach(() => {
        mock.restoreAll();
        store.dispatch(logout());
    });

    test("persists tokens when refresh succeeds", async () => {
        store.dispatch(setTokens({ accessToken: "old", refreshToken: "refresh-token" }));
        const saveMock = mock.method(tokenStorage, "saveTokens", () => {});
        const postMock = mock.method(Axios, "post", async () => ({
            data: { accessToken: "new", refreshToken: "new-refresh" },
        }));

        const handler = (apiClient.interceptors.response as any).handlers[0].rejected;
        let retried = false;
        const error = {
            response: { status: 401 },
            config: {
                headers: {} as Record<string, string>,
                _retry: false,
                url: "/protected",
                adapter: async (config: unknown) => {
                    retried = true;
                    return {
                        data: { ok: true },
                        status: 200,
                        statusText: "OK",
                        headers: {},
                        config,
                    };
                },
            },
        };

        await handler(error);

        assert.equal(postMock.mock.callCount(), 1);
        assert.deepEqual(postMock.mock.calls[0].arguments, ["/api/refresh-token", { refreshToken: "refresh-token" }]);
        assert.equal(saveMock.mock.callCount(), 1);
        assert.deepEqual(saveMock.mock.calls[0].arguments[0], { accessToken: "new", refreshToken: "new-refresh" });
        assert.equal(error.config.headers.Authorization, "Bearer new");
        assert.equal(retried, true);
    });
});
