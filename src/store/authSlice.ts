// src/store/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type State = { accessToken: string | null; refreshToken: string | null };
const initialState: State = { accessToken: null, refreshToken: null };

const slice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
        },
        logout(state) {
            state.accessToken = null;
            state.refreshToken = null;
        },
    },
});

export const { setTokens, logout } = slice.actions;
export default slice.reducer;
