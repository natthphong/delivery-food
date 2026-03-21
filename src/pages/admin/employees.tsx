import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDateOnly, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminInputClass,
    adminSelectClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { createEmployee, fetchAdminBranches, fetchEmployees, updateEmployee } from "@/services/admin";
import type { BranchSummary } from "@/types";
import type { Employee, EmployeeUpsertRequest } from "@/types/admin";

const ROLE_OPTIONS = [
    { code: "employee", label: "Employee" },
    { code: "manager_branch", label: "Branch Manager" },
    { code: "manager", label: "Manager" },
    { code: "owner", label: "Owner" },
    { code: "rider", label: "Rider" },
];

type EmployeeFormState = {
    employeeCode: string;
    fullName: string;
    email: string;
    phone: string;
    employmentType: string;
    compensationType: string;
    hourlyWage: string;
    monthlySalary: string;
    otEligible: boolean;
    otMultiplier: string;
    payrollVisibility: boolean;
    status: string;
    joinedAt: string;
    roleCodes: string[];
    branchIds: number[];
    primaryBranchId: string;
    username: string;
    password: string;
    mustResetPassword: boolean;
};

function emptyForm(): EmployeeFormState {
    return {
        employeeCode: "",
        fullName: "",
        email: "",
        phone: "",
        employmentType: "full_time",
        compensationType: "salary",
        hourlyWage: "",
        monthlySalary: "",
        otEligible: true,
        otMultiplier: "1.5",
        payrollVisibility: true,
        status: "active",
        joinedAt: new Date().toISOString().slice(0, 10),
        roleCodes: ["employee"],
        branchIds: [],
        primaryBranchId: "",
        username: "",
        password: "",
        mustResetPassword: false,
    };
}

function mapEmployeeToForm(employee: Employee): EmployeeFormState {
    return {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email || "",
        phone: employee.phone || "",
        employmentType: employee.employmentType,
        compensationType: employee.compensationType,
        hourlyWage: employee.hourlyWage != null ? String(employee.hourlyWage) : "",
        monthlySalary: employee.monthlySalary != null ? String(employee.monthlySalary) : "",
        otEligible: employee.otEligible,
        otMultiplier: String(employee.otMultiplier || 1.5),
        payrollVisibility: employee.payrollVisibility,
        status: employee.status,
        joinedAt: employee.joinedAt ? employee.joinedAt.slice(0, 10) : "",
        roleCodes: employee.roles.map((role) => role.code),
        branchIds: employee.branches.map((branch) => branch.branchId),
        primaryBranchId: String(employee.branches.find((branch) => branch.isPrimary)?.branchId || employee.branches[0]?.branchId || ""),
        username: employee.username || "",
        password: "",
        mustResetPassword: false,
    };
}

function parseNumber(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminEmployeesPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["employees.read", "employees.manage"]);
    const canManage = hasAdminPermission(session, "employees.manage");
    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [branchFilter, setBranchFilter] = useState("");
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [form, setForm] = useState<EmployeeFormState>(emptyForm);
    const [saving, setSaving] = useState(false);

    const selectedEmployee = useMemo(
        () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
        [employees, selectedEmployeeId]
    );

    const reload = useCallback(async () => {
        if (!canRead) return;
        const [nextBranches, nextEmployees] = await Promise.all([
            fetchAdminBranches().catch(() => []),
            fetchEmployees({
                q: search || undefined,
                status: status || undefined,
                branchId: branchFilter ? Number(branchFilter) : undefined,
            }).catch(() => []),
        ]);
        setBranches(nextBranches);
        setEmployees(nextEmployees);
    }, [branchFilter, canRead, search, status]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (selectedEmployee) {
            setForm(mapEmployeeToForm(selectedEmployee));
        } else {
            setForm(emptyForm());
        }
    }, [selectedEmployee]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canManage) return;
        try {
            setSaving(true);
            const payload: EmployeeUpsertRequest = {
                employeeCode: form.employeeCode.trim(),
                fullName: form.fullName.trim(),
                email: form.email.trim() || null,
                phone: form.phone.trim() || null,
                employmentType: form.employmentType,
                compensationType: form.compensationType,
                hourlyWage: parseNumber(form.hourlyWage),
                monthlySalary: parseNumber(form.monthlySalary),
                otEligible: form.otEligible,
                otMultiplier: parseNumber(form.otMultiplier) ?? 1.5,
                payrollVisibility: form.payrollVisibility,
                status: form.status,
                joinedAt: form.joinedAt || null,
                roleCodes: form.roleCodes,
                branchIds: form.branchIds,
                primaryBranchId: form.primaryBranchId ? Number(form.primaryBranchId) : null,
                username: form.username.trim() || null,
                password: form.password.trim() || null,
                mustResetPassword: form.mustResetPassword,
            };
            const employee = selectedEmployeeId
                ? await updateEmployee(selectedEmployeeId, payload)
                : await createEmployee(payload);
            notify(selectedEmployeeId ? "Employee updated." : "Employee created.", "success");
            await reload();
            setSelectedEmployeeId(employee.id);
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to save employee.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Employee management" title="Employees" description="This session does not have permission to access employee data." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Employee management"
                    title="People, roles, and branch scope"
                    description="Create staff accounts, assign branches, manage compensation, and keep payroll rules attached to the employee record instead of scattered operational notes."
                />

                <AdminSectionCard title="Filters" description="Search by name/code and focus by branch or employee status.">
                    <div className="grid gap-3 md:grid-cols-4">
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or employee code" className={adminInputClass} />
                        <select value={status} onChange={(event) => setStatus(event.target.value)} className={adminSelectClass}>
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className={adminSelectClass}>
                            <option value="">All branches</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedEmployeeId(null);
                                setForm(emptyForm());
                            }}
                            className={adminButtonSecondaryClass}
                        >
                            New employee
                        </button>
                    </div>
                </AdminSectionCard>

                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <AdminSectionCard title="Employee list" description="Select a record to edit account access, branch assignment, and compensation rules.">
                        <div className="space-y-3">
                            {employees.length === 0 ? (
                                <p className="text-sm text-slate-500">No employees match the current filters.</p>
                            ) : (
                                employees.map((employee) => (
                                    <button
                                        key={employee.id}
                                        type="button"
                                        onClick={() => setSelectedEmployeeId(employee.id)}
                                        className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                            selectedEmployeeId === employee.id
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{employee.fullName}</p>
                                                <p className="mt-1 text-sm text-slate-500">{employee.employeeCode} · {employee.employmentType.replace("_", " ")}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(employee.status)}`}>{employee.status}</span>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">
                                            Roles: {employee.roles.map((role) => role.name).join(", ") || "-"}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Branches: {employee.branches.map((branch) => branch.branchName).join(", ") || "-"}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">Joined {formatAdminDateOnly(employee.joinedAt)}</p>
                                    </button>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard
                        title={selectedEmployeeId ? "Edit employee" : "Create employee"}
                        description="Every managed employee can optionally receive a staff login and a branch-scoped admin role."
                    >
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Employee code</span>
                                    <input value={form.employeeCode} onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Full name</span>
                                    <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Email</span>
                                    <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Phone</span>
                                    <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Employment type</span>
                                    <select value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))} className={adminSelectClass}>
                                        <option value="full_time">Full-time</option>
                                        <option value="part_time">Part-time</option>
                                        <option value="rider">Rider</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Compensation</span>
                                    <select value={form.compensationType} onChange={(event) => setForm((current) => ({ ...current, compensationType: event.target.value }))} className={adminSelectClass}>
                                        <option value="salary">Salary</option>
                                        <option value="hourly">Hourly</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hourly wage</span>
                                    <input value={form.hourlyWage} onChange={(event) => setForm((current) => ({ ...current, hourlyWage: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Monthly salary</span>
                                    <input value={form.monthlySalary} onChange={(event) => setForm((current) => ({ ...current, monthlySalary: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">OT multiplier</span>
                                    <input value={form.otMultiplier} onChange={(event) => setForm((current) => ({ ...current, otMultiplier: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Joined date</span>
                                    <input type="date" value={form.joinedAt} onChange={(event) => setForm((current) => ({ ...current, joinedAt: event.target.value }))} className={adminInputClass} />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                    <input type="checkbox" checked={form.otEligible} onChange={(event) => setForm((current) => ({ ...current, otEligible: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">Eligible for OT</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                    <input type="checkbox" checked={form.payrollVisibility} onChange={(event) => setForm((current) => ({ ...current, payrollVisibility: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">Visible in payroll reports</span>
                                </label>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Roles</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {ROLE_OPTIONS.map((role) => {
                                        const checked = form.roleCodes.includes(role.code);
                                        return (
                                            <label key={role.code} className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            roleCodes: checked
                                                                ? current.roleCodes.filter((item) => item !== role.code)
                                                                : [...current.roleCodes, role.code],
                                                        }))
                                                    }
                                                />
                                                <span className="text-sm font-medium text-slate-700">{role.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Branch assignments</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {branches.map((branch) => {
                                        const checked = form.branchIds.includes(branch.id);
                                        return (
                                            <label key={branch.id} className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        setForm((current) => {
                                                            const branchIds = checked
                                                                ? current.branchIds.filter((item) => item !== branch.id)
                                                                : [...current.branchIds, branch.id];
                                                            return {
                                                                ...current,
                                                                branchIds,
                                                                primaryBranchId:
                                                                    current.primaryBranchId && branchIds.includes(Number(current.primaryBranchId))
                                                                        ? current.primaryBranchId
                                                                        : branchIds[0]
                                                                            ? String(branchIds[0])
                                                                            : "",
                                                            };
                                                        })
                                                    }
                                                />
                                                <span className="text-sm font-medium text-slate-700">{branch.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Primary branch</span>
                                    <select value={form.primaryBranchId} onChange={(event) => setForm((current) => ({ ...current, primaryBranchId: event.target.value }))} className={adminSelectClass}>
                                        <option value="">Select primary branch</option>
                                        {branches.filter((branch) => form.branchIds.includes(branch.id)).map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Username</span>
                                    <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Password</span>
                                    <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className={adminInputClass} />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</span>
                                    <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={adminSelectClass}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                    <input type="checkbox" checked={form.mustResetPassword} onChange={(event) => setForm((current) => ({ ...current, mustResetPassword: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">Require password reset</span>
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button type="submit" disabled={saving || !canManage} className={adminButtonPrimaryClass}>
                                    {saving ? "Saving..." : selectedEmployeeId ? "Update employee" : "Create employee"}
                                </button>
                                <button
                                    type="button"
                                    className={adminButtonSecondaryClass}
                                    onClick={() => {
                                        setSelectedEmployeeId(null);
                                        setForm(emptyForm());
                                    }}
                                >
                                    Reset form
                                </button>
                            </div>
                        </form>
                    </AdminSectionCard>
                </div>
            </div>
        </AdminLayout>
    );
}
