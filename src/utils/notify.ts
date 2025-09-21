import { pushNotice } from "@/store/notificationsSlice";
import { store } from "@/store";

export function notify(
    message: string,
    kind: "info" | "success" | "warning" | "error" = "info",
    title?: string
) {
    store.dispatch(
        pushNotice({
            message,
            kind,
            title,
        })
    );
}
