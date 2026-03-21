// src/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import auth from "./authSlice";
import notifications from "./notificationsSlice";
import config from "./configSlice";
import cart from "./cartSlice";

export const store = configureStore({
    reducer: {
        auth,
        notifications,
        config,
        cart,
    },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
