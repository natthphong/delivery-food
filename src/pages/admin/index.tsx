import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import { useAdminText } from "@/components/admin/useAdminText";
import { fetchAdminDashboard, fetchAdminOrders, fetchAttendance, fetchAdminPayments, fetchRiderJobs } from "@/services/admin";
import type { AdminDashboard, AdminPaymentRecord, AttendanceSession, DeliveryJob } from "@/types/admin";
import type { AdminOrder } from "@/types/adminOrder";
import { useAppSelector } from "@/store";
import { hasAdminPermission } from "@/components/admin/permissions";
import { formatTHB } from "@/utils/currency";

const emptyDashboard: AdminDashboard = {
    employeesActive: 0,
    attendanceOpen: 0,
    pendingOtRequests: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    waitingRiderJobs: 0,
    pendingPayments: 0,
};

function translateStatus(value: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    const keyMap: Record<string, string> = {
        PENDING: "order.status.pending",
        PREPARE: "order.status.prepare",
        READY: "order.status.ready",
        DELIVERY: "order.status.delivery",
        COMPLETED: "order.status.completed",
        REJECTED: "order.status.rejected",
        clocked_in: "admin.status.clockedIn",
        clocked_out: "admin.status.clockedOut",
        corrected: "admin.status.corrected",
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
    return tx(keyMap[value] || "admin.status.fallback", { status: value });
}

export default function AdminDashboardPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const tx = useAdminText();
    const [dashboard, setDashboard] = useState<AdminDashboard>(emptyDashboard);
    const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [jobs, setJobs] = useState<DeliveryJob[]>([]);
    const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);

    useEffect(() => {
        if (!hasAdminPermission(session, "dashboard.read")) return;
        void fetchAdminDashboard().then(setDashboard).catch(() => setDashboard(emptyDashboard));
        if (hasAdminPermission(session, "attendance.read")) {
            void fetchAttendance({ status: "open" }).then((items) => setAttendance(items.slice(0, 5))).catch(() => setAttendance([]));
        }
        if (hasAdminPermission(session, "orders.read") || hasAdminPermission(session, "orders.manage")) {
            void fetchAdminOrders("PENDING").then((items) => setOrders(items.slice(0, 5))).catch(() => setOrders([]));
        }
        if (hasAdminPermission(session, "rider.jobs.read") || hasAdminPermission(session, "orders.manage")) {
            void fetchRiderJobs("waiting_for_rider").then((items) => setJobs(items.slice(0, 5))).catch(() => setJobs([]));
        }
        if (hasAdminPermission(session, "payments.read") || hasAdminPermission(session, "payments.manage")) {
            void fetchAdminPayments("pending").then((items) => setPayments(items.slice(0, 5))).catch(() => setPayments([]));
        }
    }, [session]);

    const quickLinks = useMemo(
        () => [
            { href: "/admin/orders", title: tx("admin.dashboard.quick.ordersTitle"), description: tx("admin.dashboard.quick.ordersDescription") },
            { href: "/admin/branches", title: tx("admin.dashboard.quick.branchesTitle"), description: tx("admin.dashboard.quick.branchesDescription") },
            { href: "/admin/employees", title: tx("admin.dashboard.quick.employeesTitle"), description: tx("admin.dashboard.quick.employeesDescription") },
            { href: "/admin/attendance", title: tx("admin.dashboard.quick.attendanceTitle"), description: tx("admin.dashboard.quick.attendanceDescription") },
        ],
        [tx]
    );

    const fulfillmentLabel = (mode: string) =>
        mode === "rider_delivery" ? tx("admin.orders.fulfillment.delivery") : tx("admin.orders.fulfillment.pickup");

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow={tx("admin.dashboard.pageEyebrow")}
                    title={tx("admin.dashboard.pageTitle")}
                    description={tx("admin.dashboard.pageDescription")}
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard label={tx("admin.dashboard.stat.activeEmployees")} value={dashboard.employeesActive} />
                    <AdminStatCard label={tx("admin.dashboard.stat.clockedIn")} value={dashboard.attendanceOpen} tone="slate" />
                    <AdminStatCard label={tx("admin.dashboard.stat.pendingOt")} value={dashboard.pendingOtRequests} tone="amber" />
                    <AdminStatCard label={tx("admin.dashboard.stat.lowStock")} value={dashboard.lowStockItems} tone="rose" />
                    <AdminStatCard label={tx("admin.dashboard.stat.pendingOrders")} value={dashboard.pendingOrders} />
                    <AdminStatCard label={tx("admin.dashboard.stat.waitingRiders")} value={dashboard.waitingRiderJobs} tone="amber" />
                    <AdminStatCard label={tx("admin.dashboard.stat.pendingPayments")} value={dashboard.pendingPayments} tone="slate" />
                    <AdminStatCard
                        label={tx("admin.dashboard.stat.branchScope")}
                        value={session?.branchIds?.length || tx("admin.dashboard.branchScopeAll")}
                        hint={tx("admin.dashboard.branchScopeHint")}
                    />
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <AdminSectionCard title={tx("admin.dashboard.quickTitle")} description={tx("admin.dashboard.quickDescription")}>
                        <div className="grid gap-4 md:grid-cols-2">
                            {quickLinks.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
                                >
                                    <p className="text-base font-semibold text-slate-900">{item.title}</p>
                                    <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                                </Link>
                            ))}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title={tx("admin.dashboard.sessionTitle")} description={tx("admin.dashboard.sessionDescription")}>
                        <div className="space-y-4">
                            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tx("admin.dashboard.sessionActor")}</p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">{session?.actorLabel || "-"}</p>
                                <p className="mt-2 text-sm text-slate-600">
                                    {tx("admin.dashboard.sessionRoles")}: {session?.roles.join(", ") || "-"}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(session?.permissions || []).slice(0, 12).map((permission) => (
                                    <span key={permission} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                                        {permission}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </AdminSectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <AdminSectionCard title={tx("admin.dashboard.attendanceTitle")} description={tx("admin.dashboard.attendanceDescription")}>
                        <div className="space-y-3">
                            {attendance.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.dashboard.attendanceEmpty")}</p>
                            ) : (
                                attendance.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
                                                <p className="mt-1 text-sm text-slate-500">{item.branchName}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                                {translateStatus(item.status, tx)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">
                                            {tx("admin.dashboard.clockInLabel")} {formatAdminDate(item.clockInAt)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title={tx("admin.dashboard.ordersTitle")} description={tx("admin.dashboard.ordersDescription")}>
                        <div className="space-y-3">
                            {orders.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.dashboard.ordersEmpty")}</p>
                            ) : (
                                orders.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {tx("admin.dashboard.orderNumber", { id: item.id })} · {item.branch?.name || tx("admin.dashboard.branchFallback")}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {item.customerName || tx("admin.dashboard.customerFallback")} · {fulfillmentLabel(item.fulfillmentMode)}
                                                </p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                                {translateStatus(item.status, tx)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">{formatAdminDate(item.createdAt)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <AdminSectionCard title={tx("admin.dashboard.ridersTitle")} description={tx("admin.dashboard.ridersDescription")}>
                        <div className="space-y-3">
                            {jobs.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.dashboard.ridersEmpty")}</p>
                            ) : (
                                jobs.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {tx("admin.dashboard.jobNumber", { id: item.id, orderId: item.orderId })}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {item.branchName || tx("admin.dashboard.branchNumber", { id: item.branchId })} · {formatTHB(item.deliveryFee)}
                                                </p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                                {translateStatus(item.status, tx)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">{formatAdminDate(item.createdAt)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title={tx("admin.dashboard.paymentsTitle")} description={tx("admin.dashboard.paymentsDescription")}>
                        <div className="space-y-3">
                            {payments.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.dashboard.paymentsEmpty")}</p>
                            ) : (
                                payments.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {tx("admin.dashboard.transactionNumber", { id: item.id })} · {item.paymentMethodName || tx("admin.dashboard.paymentMethodFallback")}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {item.customerName || tx("admin.dashboard.customerFallback")} · {item.branchName || tx("admin.dashboard.accountFlow")}
                                                </p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                                                {translateStatus(item.status, tx)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">
                                            {formatTHB(item.amount)} · {formatAdminDate(item.createdAt)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>
                </div>
            </div>
        </AdminLayout>
    );
}
