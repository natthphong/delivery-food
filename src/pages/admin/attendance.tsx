import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDate, formatMinutesLabel, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminInputClass,
    adminSelectClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { clockIn, clockOut, correctAttendance, fetchAdminBranches, fetchAttendance, fetchEmployees } from "@/services/admin";
import type { BranchSummary } from "@/types";
import type { AttendanceSession, Employee } from "@/types/admin";

export default function AdminAttendancePage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["attendance.read", "attendance.manage", "attendance.self"]);
    const canReadAll = hasAnyAdminPermission(session, ["attendance.read", "attendance.manage"]);
    const canManage = hasAdminPermission(session, "attendance.manage");
    const canSelf = hasAdminPermission(session, "attendance.self");
    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
    const [selectedAttendanceId, setSelectedAttendanceId] = useState<number | null>(null);
    const [branchFilter, setBranchFilter] = useState("");
    const [employeeFilter, setEmployeeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [selfBranchId, setSelfBranchId] = useState("");
    const [selfNote, setSelfNote] = useState("");
    const [correctionClockInAt, setCorrectionClockInAt] = useState("");
    const [correctionClockOutAt, setCorrectionClockOutAt] = useState("");
    const [correctionStatus, setCorrectionStatus] = useState("closed");
    const [correctionNote, setCorrectionNote] = useState("");

    const selectedAttendance = useMemo(
        () => attendance.find((item) => item.id === selectedAttendanceId) || null,
        [attendance, selectedAttendanceId]
    );
    const ownOpenSession = useMemo(
        () => attendance.find((item) => item.employeeId === session?.employeeId && item.status === "open") || null,
        [attendance, session?.employeeId]
    );

    const reload = useCallback(async () => {
        if (!canRead) return;
        const [nextBranches, nextAttendance] = await Promise.all([
            fetchAdminBranches().catch(() => []),
            fetchAttendance({
                branchId: branchFilter ? Number(branchFilter) : undefined,
                employeeId: employeeFilter ? Number(employeeFilter) : undefined,
                status: statusFilter || undefined,
            }).catch(() => []),
        ]);
        setBranches(nextBranches);
        setAttendance(nextAttendance);
        if (canReadAll) {
            const nextEmployees = await fetchEmployees().catch(() => []);
            setEmployees(nextEmployees);
        }
    }, [branchFilter, canRead, canReadAll, employeeFilter, statusFilter]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (!selectedAttendance) return;
        setCorrectionClockInAt(selectedAttendance.clockInAt.slice(0, 16));
        setCorrectionClockOutAt(selectedAttendance.clockOutAt ? selectedAttendance.clockOutAt.slice(0, 16) : "");
        setCorrectionStatus(selectedAttendance.status);
        setCorrectionNote(selectedAttendance.correctionNote || "");
    }, [selectedAttendance]);

    const handleSelfClock = async (mode: "in" | "out") => {
        if (!selfBranchId) {
            notify("Select a branch before clocking.", "warning");
            return;
        }
        try {
            if (mode === "in") {
                await clockIn({ branchId: Number(selfBranchId), note: selfNote });
                notify("Clock-in recorded.", "success");
            } else {
                await clockOut({ branchId: Number(selfBranchId), note: selfNote });
                notify("Clock-out recorded.", "success");
            }
            setSelfNote("");
            await reload();
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to update attendance.", "error");
        }
    };

    const handleCorrection = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedAttendance || !canManage) return;
        try {
            await correctAttendance(selectedAttendance.id, {
                clockInAt: correctionClockInAt ? new Date(correctionClockInAt).toISOString() : null,
                clockOutAt: correctionClockOutAt ? new Date(correctionClockOutAt).toISOString() : null,
                status: correctionStatus,
                correctionNote,
            });
            notify("Attendance corrected.", "success");
            await reload();
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to correct attendance.", "error");
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Attendance" title="Attendance" description="This session does not have permission to view attendance." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Attendance and timekeeping"
                    title="Clock sessions, corrections, and live branch presence"
                    description="Attendance stays branch-aware and is used downstream for OT and payroll computation. Corrections should always include a note."
                />

                {canSelf ? (
                    <AdminSectionCard title="Self service clock" description="Employees and riders can clock in/out against an allowed branch from this panel.">
                        <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr_auto_auto]">
                            <select value={selfBranchId} onChange={(event) => setSelfBranchId(event.target.value)} className={adminSelectClass}>
                                <option value="">Select branch</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </option>
                                ))}
                            </select>
                            <input value={selfNote} onChange={(event) => setSelfNote(event.target.value)} placeholder="Shift note (optional)" className={adminInputClass} />
                            <button type="button" className={adminButtonPrimaryClass} onClick={() => void handleSelfClock("in")} disabled={!!ownOpenSession}>
                                Clock in
                            </button>
                            <button type="button" className={adminButtonSecondaryClass} onClick={() => void handleSelfClock("out")} disabled={!ownOpenSession}>
                                Clock out
                            </button>
                        </div>
                    </AdminSectionCard>
                ) : null}

                <AdminSectionCard title="Attendance filters" description="Filter by branch, employee, or status to review current and historical sessions.">
                    <div className="grid gap-3 md:grid-cols-3">
                        <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className={adminSelectClass}>
                            <option value="">All branches</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                        <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className={adminSelectClass} disabled={!canReadAll}>
                            <option value="">All employees</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.fullName}
                                </option>
                            ))}
                        </select>
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={adminSelectClass}>
                            <option value="">All statuses</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="corrected">Corrected</option>
                        </select>
                    </div>
                </AdminSectionCard>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
                    <AdminSectionCard title="Attendance sessions" description="Tap a row to inspect or correct the session.">
                        <div className="space-y-3">
                            {attendance.length === 0 ? (
                                <p className="text-sm text-slate-500">No attendance sessions match the current filters.</p>
                            ) : (
                                attendance.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedAttendanceId(item.id)}
                                        className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                            selectedAttendanceId === item.id
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
                                                <p className="mt-1 text-sm text-slate-500">{item.branchName}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                            <p>Clock in: {formatAdminDate(item.clockInAt)}</p>
                                            <p>Clock out: {formatAdminDate(item.clockOutAt)}</p>
                                            <p>Worked: {formatMinutesLabel(item.workedMinutes)}</p>
                                            <p>Note: {item.note || "-"}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Correction panel" description="Managers can patch times and statuses with an audit note.">
                        {!selectedAttendance ? (
                            <p className="text-sm text-slate-500">Select an attendance session to inspect or correct it.</p>
                        ) : (
                            <div className="space-y-5">
                                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                                    <p className="text-sm font-semibold text-slate-900">{selectedAttendance.employeeName}</p>
                                    <p className="mt-1 text-sm text-slate-500">{selectedAttendance.branchName}</p>
                                    <p className="mt-2 text-xs text-slate-500">Created {formatAdminDate(selectedAttendance.createdAt)}</p>
                                </div>
                                {canManage ? (
                                    <form className="space-y-4" onSubmit={handleCorrection}>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clock in</span>
                                            <input type="datetime-local" value={correctionClockInAt} onChange={(event) => setCorrectionClockInAt(event.target.value)} className={adminInputClass} />
                                        </label>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clock out</span>
                                            <input type="datetime-local" value={correctionClockOutAt} onChange={(event) => setCorrectionClockOutAt(event.target.value)} className={adminInputClass} />
                                        </label>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</span>
                                            <select value={correctionStatus} onChange={(event) => setCorrectionStatus(event.target.value)} className={adminSelectClass}>
                                                <option value="open">Open</option>
                                                <option value="closed">Closed</option>
                                                <option value="corrected">Corrected</option>
                                            </select>
                                        </label>
                                        <label className="block space-y-2">
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Correction note</span>
                                            <textarea value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} rows={4} className={adminInputClass} />
                                        </label>
                                        <button type="submit" className={adminButtonPrimaryClass}>
                                            Save correction
                                        </button>
                                    </form>
                                ) : (
                                    <p className="text-sm text-slate-500">This session can view attendance but cannot correct it.</p>
                                )}
                            </div>
                        )}
                    </AdminSectionCard>
                </div>
            </div>
        </AdminLayout>
    );
}
