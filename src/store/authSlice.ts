// src/store/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { UserRecord } from "@/types";
import { EMPTY_ARRAY } from "./constants";

type State = { accessToken: string | null; refreshToken: string | null; user: UserRecord | null };
const initialState: State = { accessToken: null, refreshToken: null, user: null };

const slice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
        },
        setUser(state, action: PayloadAction<UserRecord | null>) {
            if (!action.payload) {
                state.user = null;
                return;
            }
            const payload = action.payload;
            state.user = {
                ...payload,
                card: Array.isArray(payload.card) ? payload.card : EMPTY_ARRAY,
            };
        },
        logout(state) {
            state.accessToken = null;
            state.refreshToken = null;
            state.user = null;
        },
    },
});

export const { setTokens, setUser, logout } = slice.actions;
export default slice.reducer;
