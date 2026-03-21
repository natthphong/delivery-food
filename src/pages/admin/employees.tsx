import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDateOnly, statusTone } from "@/components/admin/formatters";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminFieldErrorClass,
    adminFieldHelperClass,
    adminFieldLabelClass,
    adminSurfaceMutedClass,
    getAdminFieldClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { notify } from "@/utils/notify";
import { createEmployee, fetchAdminBranches, fetchEmployees, updateEmployee } from "@/services/admin";
import type { BranchSummary } from "@/types";
import type { Employee, EmployeeUpsertRequest } from "@/types/admin";
import { useI18n } from "@/utils/i18n";
import { parseApiError, type FieldErrors } from "@/utils/apiErrors";

const ROLE_OPTIONS = [
    { code: "employee", key: "admin.employees.role.employee" },
    { code: "manager_branch", key: "admin.employees.role.managerBranch" },
    { code: "manager", key: "admin.employees.role.manager" },
    { code: "owner", key: "admin.employees.role.owner" },
    { code: "rider", key: "admin.employees.role.rider" },
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

function useAdminText() {
    const { t } = useI18n();
    return useCallback((key: string, params?: Record<string, string | number>) => t(key as any, params as any), [t]);
}

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

function Field({
    label,
    error,
    helper,
    children,
}: {
    label: string;
    error?: string;
    helper?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="space-y-2">
            <span className={adminFieldLabelClass}>{label}</span>
            {children}
            {error ? <p className={adminFieldErrorClass}>{error}</p> : helper ? <p className={adminFieldHelperClass}>{helper}</p> : null}
        </label>
    );
}

export default function AdminEmployeesPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["employees.read", "employees.manage"]);
    const canManage = hasAdminPermission(session, "employees.manage");
    const tx = useAdminText();
    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [branchFilter, setBranchFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [listError, setListError] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [form, setForm] = useState<EmployeeFormState>(emptyForm);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [submitError, setSubmitError] = useState("");
    const [saving, setSaving] = useState(false);

    const selectedEmployee = useMemo(
        () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
        [employees, selectedEmployeeId]
    );

    const reload = useCallback(async () => {
        if (!canRead) return;
        setLoading(true);
        setListError("");
        try {
            const [nextBranches, nextEmployees] = await Promise.all([
                fetchAdminBranches(),
                fetchEmployees({
                    q: search || undefined,
                    status: status || undefined,
                    branchId: branchFilter ? Number(branchFilter) : undefined,
                }),
            ]);
            setBranches(nextBranches);
            setEmployees(nextEmployees);
        } catch (error: any) {
            setListError(parseApiError(error, tx("admin.employees.loadError")).message);
        } finally {
            setLoading(false);
        }
    }, [branchFilter, canRead, search, status, tx]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const openCreateModal = () => {
        setSelectedEmployeeId(null);
        setForm(emptyForm());
        setFieldErrors({});
        setSubmitError("");
        setModalOpen(true);
    };

    const openEditModal = (employee: Employee) => {
        setSelectedEmployeeId(employee.id);
        setForm(mapEmployeeToForm(employee));
        setFieldErrors({});
        setSubmitError("");
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setFieldErrors({});
        setSubmitError("");
        setSaving(false);
    };

    const toggleRole = (roleCode: string) => {
        setForm((current) => ({
            ...current,
            roleCodes: current.roleCodes.includes(roleCode)
                ? current.roleCodes.filter((item) => item !== roleCode)
                : [...current.roleCodes, roleCode],
        }));
    };

    const toggleBranch = (branchId: number) => {
        setForm((current) => {
            const exists = current.branchIds.includes(branchId);
            const branchIds = exists ? current.branchIds.filter((item) => item !== branchId) : [...current.branchIds, branchId];
            const nextPrimary =
                current.primaryBranchId && branchIds.includes(Number(current.primaryBranchId))
                    ? current.primaryBranchId
                    : branchIds[0]
                        ? String(branchIds[0])
                        : "";
            return {
                ...current,
                branchIds,
                primaryBranchId: nextPrimary,
            };
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canManage) return;
        setSaving(true);
        setFieldErrors({});
        setSubmitError("");
        try {
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
            notify(selectedEmployeeId ? tx("admin.employees.updateSuccess") : tx("admin.employees.createSuccess"), "success");
            await reload();
            setSelectedEmployeeId(employee.id);
            setModalOpen(false);
        } catch (error: any) {
            const parsed = parseApiError(error, tx("admin.employees.saveError"));
            setFieldErrors(parsed.fieldErrors);
            setSubmitError(parsed.message);
        } finally {
            setSaving(false);
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader
                    eyebrow={tx("admin.employees.pageEyebrow")}
                    title={tx("admin.employees.pageTitle")}
                    description={tx("admin.employees.noAccess")}
                />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow={tx("admin.employees.pageEyebrow")}
                    title={tx("admin.employees.pageTitle")}
                    description={tx("admin.employees.pageDescription")}
                    actions={
                        canManage ? (
                            <button type="button" onClick={openCreateModal} className={adminButtonPrimaryClass}>
                                {tx("admin.employees.newAction")}
                            </button>
                        ) : null
                    }
                />

                <AdminSectionCard title={tx("admin.employees.filterTitle")} description={tx("admin.employees.filterDescription")}>
                    <div className="grid gap-3 md:grid-cols-4">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={tx("admin.employees.searchPlaceholder")}
                            className={getAdminFieldClass()}
                        />
                        <select value={status} onChange={(event) => setStatus(event.target.value)} className={getAdminFieldClass()}>
                            <option value="">{tx("admin.employees.status.all")}</option>
                            <option value="active">{tx("admin.employees.status.active")}</option>
                            <option value="inactive">{tx("admin.employees.status.inactive")}</option>
                        </select>
                        <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className={getAdminFieldClass()}>
                            <option value="">{tx("admin.employees.branchFilterAll")}</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                        <button type="button" onClick={() => void reload()} className={adminButtonSecondaryClass}>
                            {tx("admin.employees.refreshAction")}
                        </button>
                    </div>
                </AdminSectionCard>

                <AdminSectionCard title={tx("admin.employees.listTitle")} description={tx("admin.employees.listDescription")}>
                    <div className="space-y-3">
                        {loading ? <p className="text-sm text-slate-500">{tx("common.loading")}</p> : null}
                        {!loading && listError ? <p className="text-sm font-medium text-rose-600">{listError}</p> : null}
                        {!loading && !listError && employees.length === 0 ? (
                            <p className="text-sm text-slate-500">{tx("admin.employees.empty")}</p>
                        ) : null}
                        {!loading && !listError
                            ? employees.map((employee) => (
                                <button
                                    key={employee.id}
                                    type="button"
                                    onClick={() => openEditModal(employee)}
                                    className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{employee.fullName}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {employee.employeeCode} · {tx(`admin.employees.employment.${employee.employmentType}`)}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(employee.status)}`}>
                                            {tx(`admin.employees.status.${employee.status}`)}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                        <p>{tx("admin.employees.rolesLabel")}: {employee.roles.map((role) => tx(`admin.employees.role.${role.code}`)).join(", ") || "-"}</p>
                                        <p>{tx("admin.employees.branchesLabel")}: {employee.branches.map((branch) => branch.branchName).join(", ") || "-"}</p>
                                        <p>{tx("admin.employees.joinedLabel")}: {formatAdminDateOnly(employee.joinedAt)}</p>
                                    </div>
                                </button>
                            ))
                            : null}
                    </div>
                </AdminSectionCard>

                <Modal
                    open={modalOpen}
                    onClose={closeModal}
                    title={selectedEmployee ? tx("admin.employees.editTitle") : tx("admin.employees.createTitle")}
                    size="lg"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeModal} className={adminButtonSecondaryClass}>
                                {tx("common.cancel")}
                            </button>
                            <button type="submit" form="employee-form" disabled={saving} className={adminButtonPrimaryClass}>
                                {saving ? tx("common.updating") : selectedEmployee ? tx("admin.employees.updateAction") : tx("admin.employees.createAction")}
                            </button>
                        </div>
                    }
                >
                    <form id="employee-form" className="space-y-6" onSubmit={handleSubmit}>
                        {submitError ? (
                            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {submitError}
                            </div>
                        ) : null}

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.employees.sectionProfile")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.employees.sectionProfileDescription")}</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={tx("admin.employees.field.employeeCode")} error={fieldErrors.employeeCode}>
                                    <input value={form.employeeCode} onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.employeeCode)} />
                                </Field>
                                <Field label={tx("admin.employees.field.fullName")} error={fieldErrors.fullName}>
                                    <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.fullName)} />
                                </Field>
                                <Field label={tx("admin.employees.field.email")}>
                                    <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.email)} />
                                </Field>
                                <Field label={tx("admin.employees.field.phone")}>
                                    <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.phone)} />
                                </Field>
                                <Field label={tx("admin.employees.field.employmentType")}>
                                    <select value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))} className={getAdminFieldClass()}>
                                        <option value="full_time">{tx("admin.employees.employment.full_time")}</option>
                                        <option value="part_time">{tx("admin.employees.employment.part_time")}</option>
                                        <option value="rider">{tx("admin.employees.employment.rider")}</option>
                                    </select>
                                </Field>
                                <Field label={tx("admin.employees.field.joinedAt")} error={fieldErrors.joinedAt}>
                                    <input type="date" value={form.joinedAt} onChange={(event) => setForm((current) => ({ ...current, joinedAt: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.joinedAt)} />
                                </Field>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.employees.sectionCompensation")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.employees.sectionCompensationDescription")}</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={tx("admin.employees.field.compensationType")}>
                                    <select value={form.compensationType} onChange={(event) => setForm((current) => ({ ...current, compensationType: event.target.value }))} className={getAdminFieldClass()}>
                                        <option value="salary">{tx("admin.employees.compensation.salary")}</option>
                                        <option value="hourly">{tx("admin.employees.compensation.hourly")}</option>
                                    </select>
                                </Field>
                                <Field label={tx("admin.employees.field.otMultiplier")}>
                                    <input value={form.otMultiplier} onChange={(event) => setForm((current) => ({ ...current, otMultiplier: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.otMultiplier)} />
                                </Field>
                                <Field label={tx("admin.employees.field.hourlyWage")} error={fieldErrors.hourlyWage}>
                                    <input value={form.hourlyWage} onChange={(event) => setForm((current) => ({ ...current, hourlyWage: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.hourlyWage)} />
                                </Field>
                                <Field label={tx("admin.employees.field.monthlySalary")} error={fieldErrors.monthlySalary}>
                                    <input value={form.monthlySalary} onChange={(event) => setForm((current) => ({ ...current, monthlySalary: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.monthlySalary)} />
                                </Field>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={form.otEligible} onChange={(event) => setForm((current) => ({ ...current, otEligible: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.employees.field.otEligible")}</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={form.payrollVisibility} onChange={(event) => setForm((current) => ({ ...current, payrollVisibility: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.employees.field.payrollVisibility")}</span>
                                </label>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.employees.sectionAccess")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.employees.sectionAccessDescription")}</p>
                            </div>

                            <div>
                                <p className={adminFieldLabelClass}>{tx("admin.employees.field.roles")}</p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {ROLE_OPTIONS.map((role) => {
                                        const checked = form.roleCodes.includes(role.code);
                                        return (
                                            <label key={role.code} className={`flex items-center gap-3 rounded-[1.25rem] border px-4 py-3 ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleRole(role.code)} />
                                                <span className="text-sm font-medium text-slate-700">{tx(role.key)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {fieldErrors.roleCodes ? <p className={`mt-2 ${adminFieldErrorClass}`}>{fieldErrors.roleCodes}</p> : null}
                            </div>

                            <div>
                                <p className={adminFieldLabelClass}>{tx("admin.employees.field.branches")}</p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {branches.map((branch) => {
                                        const checked = form.branchIds.includes(branch.id);
                                        return (
                                            <label key={branch.id} className={`flex items-center gap-3 rounded-[1.25rem] border px-4 py-3 ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleBranch(branch.id)} />
                                                <span className="text-sm font-medium text-slate-700">{branch.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {fieldErrors.branchIds ? <p className={`mt-2 ${adminFieldErrorClass}`}>{fieldErrors.branchIds}</p> : null}
                            </div>

                            <Field label={tx("admin.employees.field.primaryBranch")} error={fieldErrors.primaryBranchId}>
                                <select value={form.primaryBranchId} onChange={(event) => setForm((current) => ({ ...current, primaryBranchId: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.primaryBranchId)}>
                                    <option value="">{tx("admin.employees.primaryBranchPlaceholder")}</option>
                                    {branches.filter((branch) => form.branchIds.includes(branch.id)).map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </section>

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.employees.sectionLogin")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.employees.sectionLoginDescription")}</p>
                            </div>
                            <div className={adminSurfaceMutedClass}>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field label={tx("admin.employees.field.username")} error={fieldErrors.username}>
                                        <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.username)} />
                                    </Field>
                                    <Field label={tx("admin.employees.field.password")} error={fieldErrors.password} helper={selectedEmployee ? tx("admin.employees.passwordHelper") : undefined}>
                                        <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className={getAdminFieldClass(!!fieldErrors.password)} />
                                    </Field>
                                    <Field label={tx("admin.employees.field.status")}>
                                        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={getAdminFieldClass()}>
                                            <option value="active">{tx("admin.employees.status.active")}</option>
                                            <option value="inactive">{tx("admin.employees.status.inactive")}</option>
                                        </select>
                                    </Field>
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={form.mustResetPassword} onChange={(event) => setForm((current) => ({ ...current, mustResetPassword: event.target.checked }))} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.employees.field.mustResetPassword")}</span>
                                    </label>
                                </div>
                            </div>
                        </section>
                    </form>
                </Modal>
            </div>
        </AdminLayout>
    );
}
