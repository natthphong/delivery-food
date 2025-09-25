import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type State = {
    values: Record<string, string>;
};

const initialState: State = {
    values: {},
};

const slice = createSlice({
    name: "config",
    initialState,
    reducers: {
        setConfig(state, action: PayloadAction<Record<string, string>>) {
            state.values = { ...action.payload };
        },
        mergeConfig(state, action: PayloadAction<Record<string, string>>) {
            state.values = { ...state.values, ...action.payload };
        },
        clearConfig(state) {
            state.values = {};
        },
    },
});

export const { setConfig, mergeConfig, clearConfig } = slice.actions;
export default slice.reducer;
