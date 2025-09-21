// src/store/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { UserRecord } from "@/types";

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
            state.user = action.payload ?? null;
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
