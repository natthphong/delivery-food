import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDateOnly, formatMinutesLabel, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminInputClass,
    adminSelectClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import {
    createOTRequest,
    createPayrollPeriod,
    fetchAdminBranches,
    fetchOTRequests,
    fetchPayrollPeriodDetail,
    fetchPayrollPeriods,
    fetchPayrollSettings,
    generatePayrollPeriod,
    reviewOTRequest,
    updatePayrollSettings,
} from "@/services/admin";
import type { BranchSummary } from "@/types";
import type { OTRequest, PayrollEntry, PayrollPeriod, PayrollSettings } from "@/types/admin";

const emptySettings: PayrollSettings = {
    id: 0,
    companyId: 0,
    standardDailyMinutes: 480,
    standardMonthlyMinutes: 9600,
    overtimeRoundingMinutes: 30,
    defaultOtMultiplier: 1.5,
    createdAt: "",
    updatedAt: "",
};

export default function AdminPayrollPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canPayrollRead = hasAnyAdminPermission(session, ["payroll.read", "payroll.manage"]);
    const canPayrollManage = hasAdminPermission(session, "payroll.manage");
    const canOTSelf = hasAdminPermission(session, "ot.self");
    const canOTReview = hasAdminPermission(session, "ot.review");
    const canViewPage = canPayrollRead || canOTSelf || canOTReview;
    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [, setSettings] = useState<PayrollSettings>(emptySettings);
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [entries, setEntries] = useState<PayrollEntry[]>([]);
    const [requests, setRequests] = useState<OTRequest[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
    const [settingsForm, setSettingsForm] = useState({
        standardDailyMinutes: "480",
        standardMonthlyMinutes: "9600",
        overtimeRoundingMinutes: "30",
        defaultOtMultiplier: "1.5",
    });
    const [periodForm, setPeriodForm] = useState({
        code: "",
        startsAt: "",
        endsAt: "",
        note: "",
    });
    const [generateAdjustment, setGenerateAdjustment] = useState("0");
    const [otForm, setOtForm] = useState({
        branchId: "",
        requestedMinutes: "60",
        reason: "",
    });
    const [reviewState, setReviewState] = useState<Record<number, { status: string; approvedMinutes: string; reviewNote: string }>>({});

    const selectedPeriod = useMemo(
        () => periods.find((period) => period.id === selectedPeriodId) || null,
        [periods, selectedPeriodId]
    );

    const reload = useCallback(async () => {
        const tasks: Promise<void>[] = [];
        tasks.push(fetchAdminBranches().then(setBranches).catch(() => setBranches([])));
        if (canPayrollRead) {
            tasks.push(
                fetchPayrollSettings()
                    .then((item) => {
                        setSettings(item);
                        setSettingsForm({
                            standardDailyMinutes: String(item.standardDailyMinutes),
                            standardMonthlyMinutes: String(item.standardMonthlyMinutes),
                            overtimeRoundingMinutes: String(item.overtimeRoundingMinutes),
                            defaultOtMultiplier: String(item.defaultOtMultiplier),
                        });
                    })
                    .catch(() => setSettings(emptySettings))
            );
            tasks.push(fetchPayrollPeriods().then(setPeriods).catch(() => setPeriods([])));
        }
        if (canOTSelf || canOTReview) {
            tasks.push(fetchOTRequests().then(setRequests).catch(() => setRequests([])));
        }
        await Promise.all(tasks);
    }, [canOTReview, canOTSelf, canPayrollRead]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (!selectedPeriodId || !canPayrollRead) {
            setEntries([]);
            return;
        }
        void fetchPayrollPeriodDetail(selectedPeriodId)
            .then((detail) => setEntries(detail.entries))
            .catch(() => setEntries([]));
    }, [selectedPeriodId, canPayrollRead]);

    const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canPayrollManage) return;
        try {
            const next = await updatePayrollSettings({
                standardDailyMinutes: Number(settingsForm.standardDailyMinutes),
                standardMonthlyMinutes: Number(settingsForm.standardMonthlyMinutes),
                overtimeRoundingMinutes: Number(settingsForm.overtimeRoundingMinutes),
                defaultOtMultiplier: Number(settingsForm.defaultOtMultiplier),
            });
            setSettings(next);
            notify("Payroll settings updated.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to update payroll settings.", "error");
        }
    };

    const handleCreatePeriod = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canPayrollManage) return;
        try {
            const period = await createPayrollPeriod(periodForm);
            notify("Payroll period created.", "success");
            setPeriods((current) => [period, ...current]);
            setSelectedPeriodId(period.id);
            setPeriodForm({ code: "", startsAt: "", endsAt: "", note: "" });
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to create payroll period.", "error");
        }
    };

    const handleGeneratePeriod = async () => {
        if (!selectedPeriodId || !canPayrollManage) return;
        try {
            const detail = await generatePayrollPeriod(selectedPeriodId, { adjustmentDefault: Number(generateAdjustment) || 0 });
            setEntries(detail.entries);
            notify("Payroll period generated.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to generate payroll period.", "error");
        }
    };

    const handleCreateOT = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canOTSelf) return;
        try {
            const request = await createOTRequest({
                branchId: Number(otForm.branchId),
                requestedMinutes: Number(otForm.requestedMinutes),
                reason: otForm.reason,
            });
            setRequests((current) => [request, ...current]);
            setOtForm({ branchId: "", requestedMinutes: "60", reason: "" });
            notify("OT request submitted.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to submit OT request.", "error");
        }
    };

    const handleReviewRequest = async (requestId: number) => {
        if (!canOTReview) return;
        const review = reviewState[requestId];
        try {
            const updated = await reviewOTRequest(requestId, {
                status: review?.status || "approved",
                approvedMinutes: review?.approvedMinutes ? Number(review.approvedMinutes) : null,
                reviewNote: review?.reviewNote || "",
            });
            setRequests((current) => current.map((item) => (item.id === requestId ? updated : item)));
            notify("OT request updated.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to review OT request.", "error");
        }
    };

    if (!canViewPage) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Payroll" title="Payroll" description="This session does not have permission to access payroll or OT workflows." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Payroll and overtime"
                    title="Periods, OT policies, and computed pay"
                    description="Full-time salary summaries, part-time hourly totals, and approved OT are computed in the backend from attendance + payroll settings."
                />

                {canPayrollRead ? (
                    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                        <AdminSectionCard title="Payroll settings" description="Owner-managed defaults used for hourly and salary payroll computation.">
                            <form className="space-y-4" onSubmit={handleSaveSettings}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Standard daily minutes</span>
                                        <input value={settingsForm.standardDailyMinutes} onChange={(event) => setSettingsForm((current) => ({ ...current, standardDailyMinutes: event.target.value }))} className={adminInputClass} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Standard monthly minutes</span>
                                        <input value={settingsForm.standardMonthlyMinutes} onChange={(event) => setSettingsForm((current) => ({ ...current, standardMonthlyMinutes: event.target.value }))} className={adminInputClass} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">OT rounding minutes</span>
                                        <input value={settingsForm.overtimeRoundingMinutes} onChange={(event) => setSettingsForm((current) => ({ ...current, overtimeRoundingMinutes: event.target.value }))} className={adminInputClass} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Default OT multiplier</span>
                                        <input value={settingsForm.defaultOtMultiplier} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultOtMultiplier: event.target.value }))} className={adminInputClass} />
                                    </label>
                                </div>
                                <button type="submit" disabled={!canPayrollManage} className={adminButtonPrimaryClass}>
                                    Save settings
                                </button>
                            </form>
                        </AdminSectionCard>

                        <AdminSectionCard title="Create payroll period" description="Define a payroll window before generating entries.">
                            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreatePeriod}>
                                <label className="space-y-2 md:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Code</span>
                                    <input value={periodForm.code} onChange={(event) => setPeriodForm((current) => ({ ...current, code: event.target.value }))} placeholder="2026-03-A" className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Starts at</span>
                                    <input type="date" value={periodForm.startsAt} onChange={(event) => setPeriodForm((current) => ({ ...current, startsAt: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ends at</span>
                                    <input type="date" value={periodForm.endsAt} onChange={(event) => setPeriodForm((current) => ({ ...current, endsAt: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2 md:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Note</span>
                                    <input value={periodForm.note} onChange={(event) => setPeriodForm((current) => ({ ...current, note: event.target.value }))} className={adminInputClass} />
                                </label>
                                <button type="submit" disabled={!canPayrollManage} className={adminButtonPrimaryClass}>
                                    Create period
                                </button>
                            </form>
                        </AdminSectionCard>
                    </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    {canPayrollRead ? (
                        <AdminSectionCard title="Payroll periods" description="Select a period to inspect computed entries or generate new ones.">
                            <div className="space-y-3">
                                {periods.length === 0 ? (
                                    <p className="text-sm text-slate-500">No payroll periods created yet.</p>
                                ) : (
                                    periods.map((period) => (
                                        <button
                                            key={period.id}
                                            type="button"
                                            onClick={() => setSelectedPeriodId(period.id)}
                                            className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                                selectedPeriodId === period.id
                                                    ? "border-emerald-300 bg-emerald-50"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{period.code}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{formatAdminDateOnly(period.startsAt)} - {formatAdminDateOnly(period.endsAt)}</p>
                                                </div>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(period.status)}`}>{period.status}</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </AdminSectionCard>
                    ) : null}

                    {canPayrollRead ? (
                        <AdminSectionCard
                            title={selectedPeriod ? `Payroll entries · ${selectedPeriod.code}` : "Payroll entries"}
                            description="Entries are generated server-side from attendance minutes, approved OT, pay model, and owner-defined payroll settings."
                            actions={
                                canPayrollManage && selectedPeriod ? (
                                    <div className="flex flex-wrap gap-2">
                                        <input
                                            value={generateAdjustment}
                                            onChange={(event) => setGenerateAdjustment(event.target.value)}
                                            placeholder="Default adjustment"
                                            className={`${adminInputClass} w-40`}
                                        />
                                        <button type="button" onClick={() => void handleGeneratePeriod()} className={adminButtonPrimaryClass}>
                                            Generate
                                        </button>
                                    </div>
                                ) : null
                            }
                        >
                            {entries.length === 0 ? (
                                <p className="text-sm text-slate-500">Select a payroll period and generate it to see entries.</p>
                            ) : (
                                <div className="space-y-3">
                                    {entries.map((entry) => (
                                        <div key={entry.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{entry.employeeName}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{entry.branchName || "Shared scope"}</p>
                                                </div>
                                                <p className="text-lg font-semibold text-slate-950">{formatTHB(entry.grossAmount)}</p>
                                            </div>
                                            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                                <p>Attendance: {formatMinutesLabel(entry.attendanceMinutes)}</p>
                                                <p>Regular: {formatTHB(entry.regularAmount)}</p>
                                                <p>OT: {formatTHB(entry.overtimeAmount)}</p>
                                                <p>OT minutes: {formatMinutesLabel(entry.overtimeMinutes)}</p>
                                                <p>Adjustment: {formatTHB(entry.adjustmentAmount)}</p>
                                                <p>Generated: {formatAdminDateOnly(entry.generatedAt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </AdminSectionCard>
                    ) : null}
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
                    {canOTSelf ? (
                        <AdminSectionCard title="Submit OT request" description="Employees can request OT for a branch, and reviewers can approve or reject it later.">
                            <form className="space-y-4" onSubmit={handleCreateOT}>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Branch</span>
                                    <select value={otForm.branchId} onChange={(event) => setOtForm((current) => ({ ...current, branchId: event.target.value }))} className={adminSelectClass}>
                                        <option value="">Select branch</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Requested minutes</span>
                                    <input value={otForm.requestedMinutes} onChange={(event) => setOtForm((current) => ({ ...current, requestedMinutes: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reason</span>
                                    <input value={otForm.reason} onChange={(event) => setOtForm((current) => ({ ...current, reason: event.target.value }))} className={adminInputClass} />
                                </label>
                                <button type="submit" className={adminButtonPrimaryClass}>
                                    Submit OT request
                                </button>
                            </form>
                        </AdminSectionCard>
                    ) : null}

                    {(canOTSelf || canOTReview) ? (
                        <AdminSectionCard title="OT requests" description="Reviewers can approve OT minutes; employees can monitor request outcomes.">
                            <div className="space-y-3">
                                {requests.length === 0 ? (
                                    <p className="text-sm text-slate-500">No OT requests in your scope.</p>
                                ) : (
                                    requests.map((request) => {
                                        const review = reviewState[request.id] || {
                                            status: request.status === "pending" ? "approved" : request.status,
                                            approvedMinutes: request.approvedMinutes != null ? String(request.approvedMinutes) : String(request.requestedMinutes),
                                            reviewNote: request.reviewNote || "",
                                        };
                                        return (
                                            <div key={request.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{request.employeeName}</p>
                                                        <p className="mt-1 text-sm text-slate-500">{request.branchName} · Requested {formatMinutesLabel(request.requestedMinutes)}</p>
                                                    </div>
                                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(request.status)}`}>{request.status}</span>
                                                </div>
                                                <p className="mt-3 text-sm text-slate-600">{request.reason}</p>
                                                <p className="mt-2 text-xs text-slate-400">Requested {formatAdminDateOnly(request.requestedAt)}</p>
                                                {canOTReview ? (
                                                    <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_0.8fr_1.3fr_auto]">
                                                        <select
                                                            value={review.status}
                                                            onChange={(event) => setReviewState((current) => ({ ...current, [request.id]: { ...review, status: event.target.value } }))}
                                                            className={adminSelectClass}
                                                        >
                                                            <option value="approved">Approved</option>
                                                            <option value="rejected">Rejected</option>
                                                        </select>
                                                        <input
                                                            value={review.approvedMinutes}
                                                            onChange={(event) => setReviewState((current) => ({ ...current, [request.id]: { ...review, approvedMinutes: event.target.value } }))}
                                                            className={adminInputClass}
                                                        />
                                                        <input
                                                            value={review.reviewNote}
                                                            onChange={(event) => setReviewState((current) => ({ ...current, [request.id]: { ...review, reviewNote: event.target.value } }))}
                                                            placeholder="Review note"
                                                            className={adminInputClass}
                                                        />
                                                        <button type="button" onClick={() => void handleReviewRequest(request.id)} className={adminButtonSecondaryClass}>
                                                            Review
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </AdminSectionCard>
                    ) : null}
                </div>
            </div>
        </AdminLayout>
    );
}
