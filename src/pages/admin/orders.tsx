import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminInputClass,
    adminSelectClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import { fetchAdminOrders, updateAdminOrderStatus } from "@/services/admin";
import type { AdminOrder } from "@/types/adminOrder";

export default function AdminOrdersPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["orders.read", "orders.manage"]);
    const canManage = hasAdminPermission(session, "orders.manage");
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [nextStatus, setNextStatus] = useState("PREPARE");
    const [note, setNote] = useState("");

    const selectedOrder = useMemo(
        () => orders.find((item) => item.id === selectedOrderId) || null,
        [orders, selectedOrderId]
    );

    const reload = useCallback(async () => {
        if (!canRead) return;
        const nextOrders = await fetchAdminOrders(statusFilter || undefined).catch(() => []);
        setOrders(nextOrders);
    }, [canRead, statusFilter]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (!selectedOrder) return;
        setNextStatus(selectedOrder.status);
        setNote(selectedOrder.customerNote || "");
    }, [selectedOrder]);

    const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedOrderId || !canManage) return;
        try {
            await updateAdminOrderStatus(selectedOrderId, { status: nextStatus, note });
            notify("Order status updated.", "success");
            await reload();
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to update order status.", "error");
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Orders" title="Orders" description="This session does not have permission to access branch orders." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Orders"
                    title="Preparation and fulfillment queue"
                    description="Monitor pickup and rider-delivery orders, inspect branch/customer context, and advance order statuses with backend validation."
                />

                <AdminSectionCard title="Filter" description="Focus on a specific operational stage.">
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={adminSelectClass}>
                        <option value="">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="PREPARE">Prepare</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </AdminSectionCard>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
                    <AdminSectionCard title="Orders" description="Select an order to inspect its payload and update its next status.">
                        <div className="space-y-3">
                            {orders.length === 0 ? (
                                <p className="text-sm text-slate-500">No orders match the selected filter.</p>
                            ) : (
                                orders.map((order) => (
                                    <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => setSelectedOrderId(order.id)}
                                        className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                            selectedOrderId === order.id
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Order #{order.id} · {order.branch?.name || "Branch"}</p>
                                                <p className="mt-1 text-sm text-slate-500">{order.customerName || "Customer"} · {order.fulfillmentMode.replace("_", " ")}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>{order.status}</span>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                            <p>Total: {formatTHB(order.totalAmount)}</p>
                                            <p>Payment: {order.paymentMethodName || order.transaction?.method?.name || "-"}</p>
                                            <p>Created: {formatAdminDate(order.createdAt)}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Order detail" description="Orders with rider delivery expose delivery fee and rider job metadata on the same record.">
                        {!selectedOrder ? (
                            <p className="text-sm text-slate-500">Select an order to inspect it.</p>
                        ) : (
                            <div className="space-y-5">
                                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-900">Order #{selectedOrder.id}</p>
                                    <p className="mt-1 text-sm text-slate-500">{selectedOrder.branch?.name || "Branch"} · {selectedOrder.customerName || "Customer"}</p>
                                    <p className="mt-2 text-xs text-slate-500">{formatAdminDate(selectedOrder.createdAt)}</p>
                                </div>

                                <div className="grid gap-3 text-sm text-slate-600">
                                    <p>Fulfillment: {selectedOrder.fulfillmentMode.replace("_", " ")}</p>
                                    <p>Delivery fee: {formatTHB(selectedOrder.deliveryFee || 0)}</p>
                                    <p>Payment status: {selectedOrder.transaction?.status || "-"}</p>
                                    <p>Rider job: {selectedOrder.deliveryJob?.status || "not created"}</p>
                                </div>

                                <div className="space-y-3">
                                    {selectedOrder.items.map((item) => (
                                        <div key={item.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                                    <p className="mt-1 text-xs text-slate-500">Qty {item.quantity}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-900">{formatTHB(item.lineTotal)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {canManage ? (
                                    <form className="space-y-4" onSubmit={handleUpdate}>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Next status</span>
                                            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className={adminSelectClass}>
                                                <option value="PENDING">Pending</option>
                                                <option value="PREPARE">Prepare</option>
                                                <option value="DELIVERY">Delivery</option>
                                                <option value="COMPLETED">Completed</option>
                                                <option value="REJECTED">Rejected</option>
                                            </select>
                                        </label>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operational note</span>
                                            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className={adminInputClass} />
                                        </label>
                                        <button type="submit" className={adminButtonPrimaryClass}>
                                            Update order status
                                        </button>
                                    </form>
                                ) : null}
                            </div>
                        )}
                    </AdminSectionCard>
                </div>
            </div>
        </AdminLayout>
    );
}
