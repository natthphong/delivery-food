import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import { adminSelectClass } from "@/components/admin/ui";
import { useAdminText } from "@/components/admin/useAdminText";
import { hasAnyAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { formatTHB } from "@/utils/currency";
import { parseApiError } from "@/utils/apiErrors";
import { fetchAdminPayments, fetchPaymentProviders, fetchWebhookEvents } from "@/services/admin";
import type { AdminPaymentRecord, PaymentProvider, PaymentWebhookEvent } from "@/types/admin";

function translateStatus(value: string, tx: (key: string, params?: Record<string, string | number>) => string) {
    const keyMap: Record<string, string> = {
        pending: "admin.status.pending",
        accepted: "admin.status.accepted",
        rejected: "admin.status.rejectedShort",
        expired: "payment.status.expired",
        active: "admin.payments.providerActive",
        inactive: "admin.payments.providerInactive",
        processed: "admin.status.accepted",
        failed: "admin.status.rejectedShort",
    };
    return tx(keyMap[value] || "admin.status.fallback", { status: value });
}

export default function AdminPaymentsPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["payments.read", "payments.manage"]);
    const tx = useAdminText();
    const [statusFilter, setStatusFilter] = useState("");
    const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
    const [providers, setProviders] = useState<PaymentProvider[]>([]);
    const [events, setEvents] = useState<PaymentWebhookEvent[]>([]);
    const [paymentsError, setPaymentsError] = useState("");

    useEffect(() => {
        if (!canRead) return;
        fetchAdminPayments(statusFilter || undefined)
            .then((items) => {
                setPayments(items);
                setPaymentsError("");
            })
            .catch((error) => {
                setPayments([]);
                setPaymentsError(parseApiError(error, tx("admin.payments.loadError")).message);
            });
    }, [canRead, statusFilter, tx]);

    useEffect(() => {
        if (!canRead) return;
        void Promise.all([
            fetchPaymentProviders().then(setProviders).catch(() => setProviders([])),
            fetchWebhookEvents().then((items) => setEvents(items.slice(0, 10))).catch(() => setEvents([])),
        ]);
    }, [canRead]);

    const statusOptions = useMemo(
        () => [
            { value: "", label: tx("admin.payments.filter.all") },
            { value: "pending", label: translateStatus("pending", tx) },
            { value: "accepted", label: translateStatus("accepted", tx) },
            { value: "rejected", label: translateStatus("rejected", tx) },
            { value: "expired", label: translateStatus("expired", tx) },
        ],
        [tx]
    );

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader
                    eyebrow={tx("admin.payments.pageEyebrow")}
                    title={tx("admin.payments.pageTitle")}
                    description={tx("admin.payments.noAccess")}
                />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow={tx("admin.payments.pageEyebrow")}
                    title={tx("admin.payments.pageTitle")}
                    description={tx("admin.payments.pageDescription")}
                />

                <AdminSectionCard title={tx("admin.payments.filterTitle")} description={tx("admin.payments.filterDescription")}>
                    <select
                        aria-label={tx("admin.payments.filterTitle")}
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className={adminSelectClass}
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value || "all"} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </AdminSectionCard>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
                    <AdminSectionCard title={tx("admin.payments.recordsTitle")} description={tx("admin.payments.recordsDescription")}>
                        <div className="space-y-3">
                            {paymentsError ? <p className="text-sm font-medium text-rose-600">{paymentsError}</p> : null}
                            {!paymentsError && payments.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.payments.recordsEmpty")}</p>
                            ) : null}
                            {!paymentsError
                                ? payments.map((payment) => (
                                    <div key={payment.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {payment.referenceCode || `#${payment.id}`} · {payment.paymentMethodName || tx("admin.payments.methodFallback")}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {payment.customerName || tx("admin.payments.customerFallback")} · {payment.branchName || tx("admin.payments.accountFlow")}
                                                </p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payment.status)}`}>
                                                {translateStatus(payment.status, tx)}
                                            </span>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                            <p>{tx("admin.payments.amountLabel")}: {formatTHB(payment.amount)}</p>
                                            <p>{tx("admin.payments.providerLabel")}: {payment.providerCode || "-"}</p>
                                            <p>{tx("admin.payments.providerStatusLabel")}: {payment.providerStatus || "-"}</p>
                                            <p>{tx("admin.payments.createdLabel")}: {formatAdminDate(payment.createdAt)}</p>
                                            <p>{tx("admin.payments.paidAtLabel")}: {formatAdminDate(payment.paidAt)}</p>
                                            <p>{tx("admin.payments.orderReferenceLabel")}: {payment.orderReferenceCode || "-"}</p>
                                        </div>
                                    </div>
                                ))
                                : null}
                        </div>
                    </AdminSectionCard>

                    <div className="space-y-6">
                        <AdminSectionCard title={tx("admin.payments.providersTitle")} description={tx("admin.payments.providersDescription")}>
                            <div className="space-y-3">
                                {providers.length === 0 ? (
                                    <p className="text-sm text-slate-500">{tx("admin.payments.providersEmpty")}</p>
                                ) : (
                                    providers.map((provider) => (
                                        <div key={provider.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{provider.name}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{provider.code}</p>
                                                </div>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(provider.isActive ? "active" : "inactive")}`}>
                                                    {provider.isActive ? tx("admin.payments.providerActive") : tx("admin.payments.providerInactive")}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </AdminSectionCard>

                        <AdminSectionCard title={tx("admin.payments.webhooksTitle")} description={tx("admin.payments.webhooksDescription")}>
                            <div className="space-y-3">
                                {events.length === 0 ? (
                                    <p className="text-sm text-slate-500">{tx("admin.payments.webhooksEmpty")}</p>
                                ) : (
                                    events.map((event) => (
                                        <div key={event.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{event.eventType}</p>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {event.externalEventId || tx("admin.payments.webhookInternalEvent")}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(event.status)}`}>
                                                    {translateStatus(event.status, tx)}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs text-slate-500">
                                                {tx("admin.payments.webhookReceivedLabel")} {formatAdminDate(event.receivedAt)} · {tx("admin.payments.webhookProcessedLabel")}{" "}
                                                {formatAdminDate(event.processedAt)}
                                            </p>
                                            {event.errorMessage ? <p className="mt-2 text-xs text-rose-600">{event.errorMessage}</p> : null}
                                        </div>
                                    ))
                                )}
                            </div>
                        </AdminSectionCard>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
