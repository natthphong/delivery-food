import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type Notice = {
    id: string;
    title?: string;
    message: string;
    kind?: "info" | "success" | "warning" | "error";
    ts: number;
};

type State = {
    items: Notice[];
};

type PushPayload = Omit<Notice, "id" | "ts"> & { id?: string };

const initialState: State = {
    items: [],
};

const notificationsSlice = createSlice({
    name: "notifications",
    initialState,
    reducers: {
        pushNotice(state, action: PayloadAction<PushPayload>) {
            const payload = action.payload;
            const id = payload.id ?? Math.random().toString(36).slice(2, 10);
            const notice: Notice = {
                id,
                title: payload.title,
                message: payload.message,
                kind: payload.kind,
                ts: Date.now(),
            };
            state.items.push(notice);
        },
        removeNotice(state, action: PayloadAction<string>) {
            state.items = state.items.filter((item) => item.id !== action.payload);
        },
        clearNotices(state) {
            state.items = [];
        },
    },
});

export const { pushNotice, removeNotice, clearNotices } = notificationsSlice.actions;
export default notificationsSlice.reducer;
