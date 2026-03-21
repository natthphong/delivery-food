import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import { hasAdminPermission, hasAdminRole, hasAnyAdminPermission } from "@/components/admin/permissions";
import { useAdminText } from "@/components/admin/useAdminText";
import { fetchAdminBranches, fetchAdminDashboard } from "@/services/admin";
import type { AdminDashboard, AdminDashboardSalesPoint, AdminDashboardStaffCountPoint, CustomerComplaint, OTRequest } from "@/types/admin";
import type { BranchSummary } from "@/types";
import { useAppSelector } from "@/store";
import { formatTHB } from "@/utils/currency";
import { parseApiError } from "@/utils/apiErrors";
import { useI18n } from "@/utils/i18n";

const emptyDashboard: AdminDashboard = {
    employeesActive: 0,
    attendanceOpen: 0,
    pendingOtRequests: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    waitingRiderJobs: 0,
    pendingPayments: 0,
    openComplaints: 0,
    salesTotal: 0,
    appliedBranchId: null,
    days: 14,
    salesSeries: [],
    branchSales: [],
    recentComplaints: [],
    recentOtRequests: [],
    staffCounts: [],
    workSchedule: [],
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
        open: "admin.status.pending",
        in_review: "admin.status.pending",
        resolved: "admin.status.accepted",
    };
    return tx(keyMap[value] || "admin.status.fallback", { status: value });
}

function translateRoleCode(roleCode: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    const keyMap: Record<string, string> = {
        employee: "admin.employees.role.employee",
        manager_branch: "admin.employees.role.managerBranch",
        manager: "admin.employees.role.manager",
        owner: "admin.employees.role.owner",
        rider: "admin.employees.role.rider",
    };
    return tx(keyMap[roleCode] || "admin.status.fallback", { status: roleCode });
}

function formatShortDate(value: string, locale: string) {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
        month: "short",
        day: "numeric",
    }).format(date);
}

function formatTimeLabel(value: string | null | undefined, locale: string) {
    if (!value) return null;
    const date = new Date(value.includes("T") ? value : `1970-01-01T${value}:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function MetricBarChart({
    points,
    locale,
    barClassName,
    valueLabel,
    getValue,
    getSecondary,
}: {
    points: Array<AdminDashboardSalesPoint | AdminDashboardStaffCountPoint>;
    locale: string;
    barClassName: string;
    valueLabel: string;
    getValue: (point: AdminDashboardSalesPoint | AdminDashboardStaffCountPoint) => number;
    getSecondary?: (point: AdminDashboardSalesPoint | AdminDashboardStaffCountPoint) => string | null;
}) {
    const maxValue = Math.max(1, ...points.map((point) => getValue(point)));

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(3.25rem,1fr))] gap-3">
            {points.map((point) => {
                const value = getValue(point);
                const height = Math.max(10, Math.round((value / maxValue) * 100));
                return (
                    <div key={point.date} className="min-w-0">
                        <div className="flex h-32 items-end rounded-[1.5rem] border border-slate-200 bg-slate-50 px-2 py-2">
                            <div className={`w-full rounded-xl ${barClassName}`} style={{ height: `${height}%` }} />
                        </div>
                        <div className="mt-2 text-center">
                            <p className="text-[11px] font-semibold text-slate-700">{formatShortDate(point.date, locale)}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                {valueLabel}: {getSecondary ? getSecondary(point) : value}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ComplaintCard({
    complaint,
    tx,
}: {
    complaint: CustomerComplaint;
    tx: (key: string, params?: Record<string, string | number>) => string;
}) {
    return (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">{complaint.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                        {complaint.branchName} · {complaint.category}
                    </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(complaint.status)}`}>
                    {translateStatus(complaint.status, tx)}
                </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{complaint.message}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {complaint.orderReferenceCode ? <p>{tx("admin.dashboard.complaintOrderLabel")}: {complaint.orderReferenceCode}</p> : null}
                <p>{formatAdminDate(complaint.createdAt)}</p>
            </div>
        </div>
    );
}

function OTRequestCard({
    request,
    tx,
}: {
    request: OTRequest;
    tx: (key: string, params?: Record<string, string | number>) => string;
}) {
    return (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">{request.employeeName}</p>
                    <p className="mt-1 text-sm text-slate-500">{request.branchName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(request.status)}`}>
                    {translateStatus(request.status, tx)}
                </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <p>{request.requestedMinutes} min</p>
                <p>{formatAdminDate(request.requestedAt)}</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{request.reason}</p>
        </div>
    );
}

export default function AdminDashboardPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const tx = useAdminText();
    const { locale } = useI18n();
    const canRead = hasAdminPermission(session, "dashboard.read");
    const canChooseBranch =
        session?.actorType === "bootstrap_admin" ||
        hasAdminRole(session, "owner") ||
        hasAdminRole(session, "manager");

    const [dashboard, setDashboard] = useState<AdminDashboard>(emptyDashboard);
    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [days, setDays] = useState(14);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!canRead) return;
        if (!canChooseBranch && !(session?.branchIds?.length ?? 0)) return;
        fetchAdminBranches()
            .then(setBranches)
            .catch(() => setBranches([]));
    }, [canChooseBranch, canRead, session?.branchIds]);

    useEffect(() => {
        if (!canRead) return;
        setLoading(true);
        setError("");
        fetchAdminDashboard({ branchId: selectedBranchId, days })
            .then((payload) => setDashboard(payload))
            .catch((reason) => {
                setDashboard({ ...emptyDashboard, days });
                setError(parseApiError(reason, tx("admin.dashboard.loadError")).message);
            })
            .finally(() => setLoading(false));
    }, [canRead, days, selectedBranchId, tx]);

    const branchOptions = useMemo(() => branches.slice().sort((a, b) => a.name.localeCompare(b.name)), [branches]);
    const selectedBranch = branchOptions.find((item) => item.id === selectedBranchId) || null;

    const scopeLabel = useMemo(() => {
        if (selectedBranch) {
            return tx("admin.dashboard.scopeSingleBranch", { name: selectedBranch.name });
        }
        const branchCount = branchOptions.length || session?.branchIds?.length || 0;
        if (branchCount === 0) {
            return tx("admin.dashboard.scopeGlobal");
        }
        if (branchCount === 1 && branchOptions[0]) {
            return tx("admin.dashboard.scopeSingleBranch", { name: branchOptions[0].name });
        }
        return tx("admin.dashboard.scopeMultipleBranches", { count: branchCount });
    }, [branchOptions, selectedBranch, session?.branchIds, tx]);

    const quickLinks = useMemo(() => {
        const items = [];
        if (hasAnyAdminPermission(session, ["orders.read", "orders.manage"])) {
            items.push({ href: "/admin/orders", title: tx("admin.dashboard.quick.ordersTitle"), description: tx("admin.dashboard.quick.ordersDescription") });
        }
        if (hasAnyAdminPermission(session, ["branches.read", "branches.manage", "stock.manage"])) {
            items.push({ href: "/admin/branches", title: tx("admin.dashboard.quick.branchesTitle"), description: tx("admin.dashboard.quick.branchesDescription") });
        }
        if (hasAnyAdminPermission(session, ["employees.read", "employees.manage"])) {
            items.push({ href: "/admin/employees", title: tx("admin.dashboard.quick.employeesTitle"), description: tx("admin.dashboard.quick.employeesDescription") });
        }
        if (hasAnyAdminPermission(session, ["attendance.read", "attendance.manage"])) {
            items.push({ href: "/admin/attendance", title: tx("admin.dashboard.quick.attendanceTitle"), description: tx("admin.dashboard.quick.attendanceDescription") });
        }
        return items;
    }, [session, tx]);

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader
                    eyebrow={tx("admin.dashboard.pageEyebrow")}
                    title={tx("admin.dashboard.pageTitle")}
                    description={tx("admin.dashboard.noAccess")}
                />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow={tx("admin.dashboard.pageEyebrow")}
                    title={tx("admin.dashboard.pageTitle")}
                    description={tx("admin.dashboard.pageDescription")}
                />

                <AdminSectionCard title={tx("admin.dashboard.filtersTitle")} description={tx("admin.dashboard.filtersDescription")}>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,12rem)_minmax(0,1fr)]">
                        {canChooseBranch ? (
                            <label className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {tx("admin.dashboard.branchFilterLabel")}
                                </span>
                                <select
                                    aria-label={tx("admin.dashboard.branchFilterLabel")}
                                    value={selectedBranchId ?? ""}
                                    onChange={(event) => setSelectedBranchId(event.target.value ? Number(event.target.value) : null)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                >
                                    <option value="">{tx("admin.dashboard.branchFilterAll")}</option>
                                    {branchOptions.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : (
                            <div className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tx("admin.dashboard.scopeLabel")}</span>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                                    {scopeLabel}
                                </div>
                            </div>
                        )}
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tx("admin.dashboard.daysFilterLabel")}</span>
                            <select
                                aria-label={tx("admin.dashboard.daysFilterLabel")}
                                value={days}
                                onChange={(event) => setDays(Number(event.target.value))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            >
                                <option value={7}>{tx("admin.dashboard.range7")}</option>
                                <option value={14}>{tx("admin.dashboard.range14")}</option>
                                <option value={30}>{tx("admin.dashboard.range30")}</option>
                            </select>
                        </label>
                        <div className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tx("admin.dashboard.scopeLabel")}</span>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                                {scopeLabel}
                            </div>
                        </div>
                    </div>
                </AdminSectionCard>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard label={tx("admin.dashboard.stat.salesTotal")} value={formatTHB(dashboard.salesTotal)} />
                    <AdminStatCard label={tx("admin.dashboard.stat.openComplaints")} value={dashboard.openComplaints} tone="rose" />
                    <AdminStatCard label={tx("admin.dashboard.stat.pendingOt")} value={dashboard.pendingOtRequests} tone="amber" />
                    <AdminStatCard label={tx("admin.dashboard.stat.activeEmployees")} value={dashboard.employeesActive} tone="slate" />
                    <AdminStatCard label={tx("admin.dashboard.stat.clockedIn")} value={dashboard.attendanceOpen} tone="slate" />
                    <AdminStatCard label={tx("admin.dashboard.stat.pendingOrders")} value={dashboard.pendingOrders} />
                    <AdminStatCard label={tx("admin.dashboard.stat.waitingRiders")} value={dashboard.waitingRiderJobs} tone="amber" />
                    <AdminStatCard label={tx("admin.dashboard.stat.pendingPayments")} value={dashboard.pendingPayments} tone="slate" />
                </div>

                {loading ? <p className="text-sm text-slate-500">{tx("admin.dashboard.loading")}</p> : null}
                {!loading && error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
                                    {tx("admin.dashboard.sessionRoles")}: {(session?.roles || []).map((role) => translateRoleCode(role, tx)).join(", ") || "-"}
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
                    <AdminSectionCard title={tx("admin.dashboard.salesTrendTitle")} description={tx("admin.dashboard.salesTrendDescription")}>
                        {dashboard.salesSeries.length === 0 ? (
                            <p className="text-sm text-slate-500">{tx("admin.dashboard.salesTrendEmpty")}</p>
                        ) : (
                            <MetricBarChart
                                points={dashboard.salesSeries}
                                locale={locale}
                                barClassName="bg-emerald-400"
                                valueLabel={tx("admin.dashboard.salesAxisSales")}
                                getValue={(point) => (point as AdminDashboardSalesPoint).totalSales}
                                getSecondary={(point) => formatTHB((point as AdminDashboardSalesPoint).totalSales)}
                            />
                        )}
                    </AdminSectionCard>

                    <AdminSectionCard title={tx("admin.dashboard.staffCountTitle")} description={tx("admin.dashboard.staffCountDescription")}>
                        {dashboard.staffCounts.length === 0 ? (
                            <p className="text-sm text-slate-500">{tx("admin.dashboard.staffCountEmpty")}</p>
                        ) : (
                            <MetricBarChart
                                points={dashboard.staffCounts}
                                locale={locale}
                                barClassName="bg-slate-700"
                                valueLabel={tx("admin.dashboard.scheduleEmployee")}
                                getValue={(point) => (point as AdminDashboardStaffCountPoint).employeeCount}
                            />
                        )}
                    </AdminSectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <AdminSectionCard title={tx("admin.dashboard.branchSalesTitle")} description={tx("admin.dashboard.branchSalesDescription")}>
                        {dashboard.branchSales.length === 0 ? (
                            <p className="text-sm text-slate-500">{tx("admin.dashboard.branchSalesEmpty")}</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.branchSalesBranch")}</th>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.salesAxisSales")}</th>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.branchSalesOrders")}</th>
                                            <th className="pb-3">{tx("admin.dashboard.branchSalesComplaints")}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dashboard.branchSales.map((item) => (
                                            <tr key={item.branchId}>
                                                <td className="py-3 pr-4 font-medium text-slate-900">{item.branchName}</td>
                                                <td className="py-3 pr-4 text-slate-600">{formatTHB(item.totalSales)}</td>
                                                <td className="py-3 pr-4 text-slate-600">{item.orderCount}</td>
                                                <td className="py-3 text-slate-600">{item.complaintCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </AdminSectionCard>

                    <AdminSectionCard title={tx("admin.dashboard.scheduleTitle")} description={tx("admin.dashboard.scheduleDescription")}>
                        {dashboard.workSchedule.length === 0 ? (
                            <p className="text-sm text-slate-500">{tx("admin.dashboard.scheduleEmpty")}</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.scheduleBranch")}</th>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.scheduleEmployee")}</th>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.scheduleRoles")}</th>
                                            <th className="pb-3 pr-4">{tx("admin.dashboard.scheduleShift")}</th>
                                            <th className="pb-3">{tx("admin.dashboard.scheduleAttendance")}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dashboard.workSchedule.map((item) => {
                                            const shiftLabel =
                                                item.plannedStart && item.plannedEnd
                                                    ? `${formatTimeLabel(item.plannedStart, locale)} - ${formatTimeLabel(item.plannedEnd, locale)}`
                                                    : tx("admin.dashboard.scheduleNoShift");
                                            const attendanceLabel = item.attendanceStatus
                                                ? translateStatus(item.attendanceStatus, tx)
                                                : tx("admin.dashboard.scheduleNoAttendance");
                                            const attendanceTime = item.clockInAt ? formatAdminDate(item.clockInAt) : null;
                                            return (
                                                <tr key={`${item.branchId}-${item.employeeId}`}>
                                                    <td className="py-3 pr-4 font-medium text-slate-900">{item.branchName}</td>
                                                    <td className="py-3 pr-4 text-slate-600">{item.employeeName}</td>
                                                    <td className="py-3 pr-4 text-slate-600">
                                                        {item.roleCodes.map((role) => translateRoleCode(role, tx)).join(", ") || "-"}
                                                    </td>
                                                    <td className="py-3 pr-4 text-slate-600">{shiftLabel}</td>
                                                    <td className="py-3 text-slate-600">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.attendanceStatus || "pending")}`}>
                                                                {attendanceLabel}
                                                            </span>
                                                            {attendanceTime ? <span className="text-xs text-slate-500">{attendanceTime}</span> : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </AdminSectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <AdminSectionCard title={tx("admin.dashboard.complaintsTitle")} description={tx("admin.dashboard.complaintsDescription")}>
                        <div className="space-y-3">
                            {dashboard.recentComplaints.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.dashboard.complaintsEmpty")}</p>
                            ) : (
                                dashboard.recentComplaints.map((complaint) => (
                                    <ComplaintCard key={complaint.id} complaint={complaint} tx={tx} />
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title={tx("admin.dashboard.otTitle")} description={tx("admin.dashboard.otDescription")}>
                        <div className="space-y-3">
                            {dashboard.recentOtRequests.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.dashboard.otEmpty")}</p>
                            ) : (
                                dashboard.recentOtRequests.map((request) => <OTRequestCard key={request.id} request={request} tx={tx} />)
                            )}
                        </div>
                    </AdminSectionCard>
                </div>
            </div>
        </AdminLayout>
    );
}
