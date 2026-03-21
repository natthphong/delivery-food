import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
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

export default function AdminDashboardPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
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

    const quickLinks = [
        { href: "/admin/employees", label: "Employees", description: "Provision staff accounts, branch assignments, and compensation." },
        { href: "/admin/attendance", label: "Attendance", description: "Monitor live clocks and apply branch-safe attendance corrections." },
        { href: "/admin/payroll", label: "Payroll", description: "Manage OT rules, payroll periods, and employee breakdowns." },
        { href: "/admin/branches", label: "Branches", description: "Control store availability, menu overrides, and stock." },
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Operations overview"
                    title="Live branch and team snapshot"
                    description="Track staffing, order pressure, payment backlog, low-stock products, and rider demand from a single dashboard."
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard label="Active employees" value={dashboard.employeesActive} />
                    <AdminStatCard label="Clocked in now" value={dashboard.attendanceOpen} tone="slate" />
                    <AdminStatCard label="Pending OT" value={dashboard.pendingOtRequests} tone="amber" />
                    <AdminStatCard label="Low stock items" value={dashboard.lowStockItems} tone="rose" />
                    <AdminStatCard label="Pending orders" value={dashboard.pendingOrders} />
                    <AdminStatCard label="Waiting riders" value={dashboard.waitingRiderJobs} tone="amber" />
                    <AdminStatCard label="Pending payments" value={dashboard.pendingPayments} tone="slate" />
                    <AdminStatCard label="Branch scope" value={session?.branchIds?.length || "All"} hint="Assigned branches in this admin session" />
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <AdminSectionCard title="Action lanes" description="Jump into the operations areas that drive the daily branch workflow.">
                        <div className="grid gap-4 md:grid-cols-2">
                            {quickLinks.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
                                >
                                    <p className="text-base font-semibold text-slate-900">{item.label}</p>
                                    <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                                </Link>
                            ))}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Session scope" description="This session stays backend-authoritative for roles, permissions, and branch assignment.">
                        <div className="space-y-4">
                            <div className="rounded-[1.5rem] bg-slate-950 p-4 text-white">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Actor</p>
                                <p className="mt-2 text-lg font-semibold">{session?.actorLabel || "-"}</p>
                                <p className="mt-2 text-sm text-slate-300">Roles: {session?.roles.join(", ") || "-"}</p>
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
                    <AdminSectionCard title="Open attendance" description="Recent team members who are currently clocked in.">
                        <div className="space-y-3">
                            {attendance.length === 0 ? (
                                <p className="text-sm text-slate-500">No open attendance sessions in your scope.</p>
                            ) : (
                                attendance.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
                                                <p className="mt-1 text-sm text-slate-500">{item.branchName}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">Clocked in {formatAdminDate(item.clockInAt)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Pending orders" description="Orders waiting on branch preparation or approval.">
                        <div className="space-y-3">
                            {orders.length === 0 ? (
                                <p className="text-sm text-slate-500">No pending orders right now.</p>
                            ) : (
                                orders.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Order #{item.id} · {item.branch?.name || "Branch"}</p>
                                                <p className="mt-1 text-sm text-slate-500">{item.customerName || "Customer"} · {item.fulfillmentMode.replace("_", " ")}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">{formatAdminDate(item.createdAt)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <AdminSectionCard title="Rider queue" description="Rider-delivery jobs that still need a branch rider to claim them.">
                        <div className="space-y-3">
                            {jobs.length === 0 ? (
                                <p className="text-sm text-slate-500">No waiting rider jobs.</p>
                            ) : (
                                jobs.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Job #{item.id} · Order #{item.orderId}</p>
                                                <p className="mt-1 text-sm text-slate-500">{item.branchName || `Branch ${item.branchId}`} · Fee {formatTHB(item.deliveryFee)}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">{formatAdminDate(item.createdAt)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Payment backlog" description="Pending or recently refreshed payment records from the provider-backed checkout flow.">
                        <div className="space-y-3">
                            {payments.length === 0 ? (
                                <p className="text-sm text-slate-500">No pending payment records.</p>
                            ) : (
                                payments.map((item) => (
                                    <div key={item.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Transaction #{item.id} · {item.paymentMethodName || "Payment method"}</p>
                                                <p className="mt-1 text-sm text-slate-500">{item.customerName || "Customer"} · {item.branchName || "Account flow"}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">{formatTHB(item.amount)} · {formatAdminDate(item.createdAt)}</p>
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
