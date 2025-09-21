// src/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import auth from "./authSlice";
import notifications from "./notificationsSlice";

export const store = configureStore({
    reducer: {
        auth,
        notifications,
    },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
