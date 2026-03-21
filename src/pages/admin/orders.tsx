import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminFieldHelperClass,
    adminSurfaceMutedClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import { fetchAdminOrderDetail, fetchAdminOrders, updateAdminOrderStatus } from "@/services/admin";
import type { AdminOrder } from "@/types/adminOrder";
import { useI18n } from "@/utils/i18n";
import { parseApiError } from "@/utils/apiErrors";

function useAdminText() {
    const { t } = useI18n();
    return useCallback((key: string, params?: Record<string, string | number>) => t(key as any, params as any), [t]);
}

function translateOrderStatus(status: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    const keyMap: Record<string, string> = {
        PENDING: "order.status.pending",
        PREPARE: "order.status.prepare",
        READY: "order.status.ready",
        DELIVERY: "order.status.delivery",
        COMPLETED: "order.status.completed",
        REJECTED: "order.status.rejected",
    };
    return tx(keyMap[status] || "admin.orders.status.fallback", { status });
}

function translateAdminStatus(status: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    const keyMap: Record<string, string> = {
        waiting_for_rider: "admin.status.waitingForRider",
        assigned_to_rider: "admin.status.assignedToRider",
        picked_up: "admin.status.pickedUp",
        delivered: "admin.status.delivered",
        failed_delivery: "admin.status.failedDelivery",
        cancelled: "admin.status.cancelled",
        pending: "admin.status.pending",
        accepted: "admin.status.accepted",
        rejected: "admin.status.rejectedShort",
        expired: "payment.status.expired",
    };
    return tx(keyMap[status] || "admin.status.fallback", { status });
}

function translateFulfillment(mode: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    return mode === "rider_delivery" ? tx("admin.orders.fulfillment.delivery") : tx("admin.orders.fulfillment.pickup");
}

function mapStatusAction(status: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    const keyMap: Record<string, string> = {
        PREPARE: "admin.orders.action.prepare",
        READY: "admin.orders.action.ready",
        DELIVERY: "admin.orders.action.delivery",
        COMPLETED: "admin.orders.action.completed",
        REJECTED: "admin.orders.action.rejected",
    };
    return tx(keyMap[status] || "admin.orders.action.update", { status });
}

export default function AdminOrdersPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["orders.read", "orders.manage"]);
    const canManage = hasAdminPermission(session, "orders.manage");
    const tx = useAdminText();
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
    const [listError, setListError] = useState("");
    const [detailError, setDetailError] = useState("");
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

    const statusOptions = useMemo(
        () => [
            { value: "", label: tx("admin.orders.filter.all") },
            { value: "PENDING", label: translateOrderStatus("PENDING", tx) },
            { value: "PREPARE", label: translateOrderStatus("PREPARE", tx) },
            { value: "READY", label: translateOrderStatus("READY", tx) },
            { value: "DELIVERY", label: translateOrderStatus("DELIVERY", tx) },
            { value: "COMPLETED", label: translateOrderStatus("COMPLETED", tx) },
            { value: "REJECTED", label: translateOrderStatus("REJECTED", tx) },
        ],
        [tx]
    );

    const reload = useCallback(async () => {
        if (!canRead) return;
        setLoading(true);
        setListError("");
        try {
            const nextOrders = await fetchAdminOrders(statusFilter || undefined);
            setOrders(nextOrders);
        } catch (error: any) {
            setOrders([]);
            setListError(parseApiError(error, tx("admin.orders.loadError")).message);
        } finally {
            setLoading(false);
        }
    }, [canRead, statusFilter, tx]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const openOrder = async (orderId: number) => {
        setSelectedOrderId(orderId);
        setDetailLoading(true);
        setDetailError("");
        setSelectedOrder(null);
        try {
            const detail = await fetchAdminOrderDetail(orderId);
            setSelectedOrder(detail);
        } catch (error: any) {
            setDetailError(parseApiError(error, tx("admin.orders.detailLoadError")).message);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedOrderId(null);
        setSelectedOrder(null);
        setDetailError("");
        setDetailLoading(false);
        setUpdatingStatus(null);
    };

    const handleStatusUpdate = async (nextStatus: string) => {
        if (!selectedOrderId || !canManage) return;
        setUpdatingStatus(nextStatus);
        try {
            await updateAdminOrderStatus(selectedOrderId, { status: nextStatus, note: "" });
            notify(tx("admin.orders.updateSuccess"), "success");
            const [nextOrders, detail] = await Promise.all([
                fetchAdminOrders(statusFilter || undefined),
                fetchAdminOrderDetail(selectedOrderId),
            ]);
            setOrders(nextOrders);
            setSelectedOrder(detail);
        } catch (error: any) {
            notify(parseApiError(error, tx("admin.orders.updateError")).message, "error");
        } finally {
            setUpdatingStatus(null);
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader
                    eyebrow={tx("admin.orders.pageEyebrow")}
                    title={tx("admin.orders.pageTitle")}
                    description={tx("admin.orders.noAccess")}
                />
            </AdminLayout>
        );
    }

    const orderItems = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow={tx("admin.orders.pageEyebrow")}
                    title={tx("admin.orders.pageTitle")}
                    description={tx("admin.orders.pageDescription")}
                />

                <AdminSectionCard title={tx("admin.orders.filterTitle")} description={tx("admin.orders.filterDescription")}>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,18rem)_auto] md:items-center">
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value || "all"} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className={adminFieldHelperClass}>{tx("admin.orders.filterHint")}</p>
                    </div>
                </AdminSectionCard>

                <AdminSectionCard title={tx("admin.orders.listTitle")} description={tx("admin.orders.listDescription")}>
                    <div className="space-y-3">
                        {loading ? <p className="text-sm text-slate-500">{tx("common.loading")}</p> : null}
                        {!loading && listError ? <p className="text-sm font-medium text-rose-600">{listError}</p> : null}
                        {!loading && !listError && orders.length === 0 ? (
                            <p className="text-sm text-slate-500">{tx("admin.orders.empty")}</p>
                        ) : null}
                        {!loading && !listError
                            ? orders.map((order) => (
                                <button
                                    key={order.id}
                                    type="button"
                                    onClick={() => void openOrder(order.id)}
                                    className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {tx("admin.orders.orderNumber", { id: order.id })} · {order.branch?.name || tx("admin.orders.branchFallback")}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {order.customerName || tx("admin.orders.customerFallback")} · {translateFulfillment(order.fulfillmentMode, tx)}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>
                                            {translateOrderStatus(order.status, tx)}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                        <p>{tx("admin.orders.totalLabel")}: {formatTHB(order.totalAmount)}</p>
                                        <p>{tx("admin.orders.paymentLabel")}: {order.paymentMethodName || order.transaction?.method?.name || "-"}</p>
                                        <p>{tx("admin.orders.createdLabel")}: {formatAdminDate(order.createdAt)}</p>
                                    </div>
                                </button>
                            ))
                            : null}
                    </div>
                </AdminSectionCard>

                <Modal
                    open={selectedOrderId != null}
                    onClose={closeModal}
                    title={tx("admin.orders.detailTitle")}
                    size="lg"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeModal} className={adminButtonSecondaryClass}>
                                {tx("common.close")}
                            </button>
                        </div>
                    }
                >
                    {detailLoading ? <p className="text-sm text-slate-500">{tx("common.loading")}</p> : null}
                    {!detailLoading && detailError ? <p className="text-sm font-medium text-rose-600">{detailError}</p> : null}
                    {!detailLoading && !detailError && selectedOrder ? (
                        <div className="space-y-5">
                            <div className={adminSurfaceMutedClass}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-lg font-semibold text-slate-950">{tx("admin.orders.orderNumber", { id: selectedOrder.id })}</p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {selectedOrder.branch?.name || tx("admin.orders.branchFallback")} · {selectedOrder.customerName || tx("admin.orders.customerFallback")}
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selectedOrder.status)}`}>
                                        {translateOrderStatus(selectedOrder.status, tx)}
                                    </span>
                                </div>
                                <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                                    <p>{tx("admin.orders.fulfillmentLabel")}: {translateFulfillment(selectedOrder.fulfillmentMode, tx)}</p>
                                    <p>
                                        {tx("admin.orders.paymentStatusLabel")}:{" "}
                                        {selectedOrder.transaction?.status ? translateAdminStatus(selectedOrder.transaction.status, tx) : "-"}
                                    </p>
                                    <p>{tx("admin.orders.deliveryFeeLabel")}: {formatTHB(selectedOrder.deliveryFee || 0)}</p>
                                    <p>
                                        {tx("admin.orders.deliveryJobLabel")}:{" "}
                                        {selectedOrder.deliveryJob?.status ? translateAdminStatus(selectedOrder.deliveryJob.status, tx) : tx("admin.orders.deliveryJobNone")}
                                    </p>
                                    <p>{tx("admin.orders.createdLabel")}: {formatAdminDate(selectedOrder.createdAt)}</p>
                                    <p>{tx("admin.orders.totalLabel")}: {formatTHB(selectedOrder.totalAmount)}</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900">{tx("admin.orders.itemsTitle")}</h3>
                                        <p className={adminFieldHelperClass}>{tx("admin.orders.itemsDescription")}</p>
                                    </div>
                                </div>
                                <div className="mt-3 space-y-3">
                                    {orderItems.length === 0 ? (
                                        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                            {tx("admin.orders.itemsEmpty")}
                                        </div>
                                    ) : (
                                        orderItems.map((item) => (
                                            <div key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {tx("admin.orders.itemQuantity", { count: item.quantity })}
                                                        </p>
                                                        {item.addOns.length > 0 ? (
                                                            <p className="mt-2 text-xs text-slate-500">
                                                                {item.addOns.map((addOn) => addOn.name).join(", ")}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-900">{formatTHB(item.lineTotal)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {canManage ? (
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{tx("admin.orders.actionsTitle")}</h3>
                                    <p className={adminFieldHelperClass}>{tx("admin.orders.actionsDescription")}</p>
                                    <div className="mt-3 flex flex-wrap gap-3">
                                        {selectedOrder.allowedStatuses.length === 0 ? (
                                            <p className="text-sm text-slate-500">{tx("admin.orders.noActions")}</p>
                                        ) : (
                                            selectedOrder.allowedStatuses.map((status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => void handleStatusUpdate(status)}
                                                    disabled={updatingStatus != null}
                                                    className={status === "REJECTED" ? adminButtonSecondaryClass : adminButtonPrimaryClass}
                                                >
                                                    {updatingStatus === status ? tx("common.updating") : mapStatusAction(status, tx)}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </Modal>
            </div>
        </AdminLayout>
    );
}
