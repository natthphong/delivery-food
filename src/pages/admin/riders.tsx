import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminInputClass,
    adminSelectClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission, hasAdminRole } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import { claimRiderJob, fetchRiderJobs, updateRiderJobStatus } from "@/services/admin";
import type { DeliveryJob } from "@/types/admin";
import { useI18n } from "@/utils/i18n";
import { parseApiError } from "@/utils/apiErrors";

export default function AdminRidersPage() {
    const { t } = useI18n();
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["rider.jobs.read", "rider.jobs.claim", "orders.manage"]);
    const canClaim = hasAdminPermission(session, "rider.jobs.claim");
    const canManageOrders = hasAdminPermission(session, "orders.manage");
    const isRider = hasAdminRole(session, "rider");
    const [jobs, setJobs] = useState<DeliveryJob[]>([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [nextStatus, setNextStatus] = useState("picked_up");
    const [failedReason, setFailedReason] = useState("");

    const selectedJob = useMemo(
        () => jobs.find((job) => job.id === selectedJobId) || null,
        [jobs, selectedJobId]
    );

    const reload = useCallback(async () => {
        if (!canRead) return;
        const nextJobs = await fetchRiderJobs(statusFilter || undefined).catch(() => []);
        setJobs(nextJobs);
    }, [canRead, statusFilter]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (!selectedJob) return;
        setNextStatus(selectedJob.status === "waiting_for_rider" ? "assigned_to_rider" : selectedJob.status);
        setFailedReason(selectedJob.failedReason || "");
    }, [selectedJob]);

    const handleClaim = async () => {
        if (!selectedJob || !canClaim) return;
        try {
            const updated = await claimRiderJob(selectedJob.id);
            setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)));
            setSelectedJobId(updated.id);
            notify(t("common.notifications.claimed" as any), "success");
        } catch (error: any) {
            notify(parseApiError(error, t("common.errors.riderClaimFailed" as any)).message, "error");
        }
    };

    const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedJob || !(canClaim || canManageOrders)) return;
        try {
            const updated = await updateRiderJobStatus(selectedJob.id, { status: nextStatus, failedReason });
            setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)));
            setSelectedJobId(updated.id);
            notify(t("common.notifications.updated" as any), "success");
        } catch (error: any) {
            notify(parseApiError(error, t("common.errors.riderUpdateFailed" as any)).message, "error");
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Rider jobs" title="Riders" description="This session does not have permission to access rider jobs." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Rider delivery"
                    title="Branch rider queue and task progression"
                    description="Rider delivery is intentionally branch-local: riders claim jobs from their assigned branch, then move them through pickup and completion without requiring map-heavy realtime tracking."
                />

                <AdminSectionCard title="Filter" description="Track rider workloads by status.">
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={adminSelectClass}>
                        <option value="">All statuses</option>
                        <option value="waiting_for_rider">Waiting for rider</option>
                        <option value="assigned_to_rider">Assigned</option>
                        <option value="picked_up">Picked up</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed_delivery">Failed delivery</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </AdminSectionCard>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
                    <AdminSectionCard title="Rider jobs" description={isRider ? "As a rider, you will primarily see jobs in your own branch scope." : "Managers can monitor and intervene across the scoped rider queue."}>
                        <div className="space-y-3">
                            {jobs.length === 0 ? (
                                <p className="text-sm text-slate-500">No rider jobs match the selected filter.</p>
                            ) : (
                                jobs.map((job) => (
                                    <button
                                        key={job.id}
                                        type="button"
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                            selectedJobId === job.id
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Job #{job.id} · Order #{job.orderId}</p>
                                                <p className="mt-1 text-sm text-slate-500">{job.branchName || `Branch ${job.branchId}`} · Fee {formatTHB(job.deliveryFee)}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(job.status)}`}>{job.status}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">
                                            Rider: {job.assignedRiderName || "Unassigned"} · Created {formatAdminDate(job.createdAt)}
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Job detail" description="Claim waiting jobs or update delivery status as riders progress through the fulfillment flow.">
                        {!selectedJob ? (
                            <p className="text-sm text-slate-500">Select a rider job to inspect it.</p>
                        ) : (
                            <div className="space-y-5">
                                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-900">Job #{selectedJob.id}</p>
                                    <p className="mt-1 text-sm text-slate-500">{selectedJob.branchName || `Branch ${selectedJob.branchId}`}</p>
                                    <p className="mt-2 text-xs text-slate-500">Created {formatAdminDate(selectedJob.createdAt)}</p>
                                </div>
                                <div className="grid gap-2 text-sm text-slate-600">
                                    <p>Status: {selectedJob.status}</p>
                                    <p>Assigned rider: {selectedJob.assignedRiderName || "Unassigned"}</p>
                                    <p>Delivery fee: {formatTHB(selectedJob.deliveryFee)}</p>
                                    <p>Failed reason: {selectedJob.failedReason || "-"}</p>
                                </div>
                                {selectedJob.status === "waiting_for_rider" && canClaim ? (
                                    <button type="button" className={adminButtonPrimaryClass} onClick={() => void handleClaim()}>
                                        Claim job
                                    </button>
                                ) : null}
                                {(canClaim || canManageOrders) ? (
                                    <form className="space-y-4" onSubmit={handleUpdate}>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Next status</span>
                                            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className={adminSelectClass}>
                                                <option value="assigned_to_rider">Assigned to rider</option>
                                                <option value="picked_up">Picked up</option>
                                                <option value="delivered">Delivered</option>
                                                <option value="failed_delivery">Failed delivery</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </label>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Failed reason</span>
                                            <input value={failedReason} onChange={(event) => setFailedReason(event.target.value)} className={adminInputClass} />
                                        </label>
                                        <button type="submit" className={adminButtonSecondaryClass}>
                                            Update rider job
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
