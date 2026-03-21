import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatAdminDate, statusTone } from "@/components/admin/formatters";
import { adminSelectClass } from "@/components/admin/ui";
import { hasAnyAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { formatTHB } from "@/utils/currency";
import { fetchAdminPayments, fetchPaymentProviders, fetchWebhookEvents } from "@/services/admin";
import type { AdminPaymentRecord, PaymentProvider, PaymentWebhookEvent } from "@/types/admin";

export default function AdminPaymentsPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["payments.read", "payments.manage"]);
    const [statusFilter, setStatusFilter] = useState("");
    const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
    const [providers, setProviders] = useState<PaymentProvider[]>([]);
    const [events, setEvents] = useState<PaymentWebhookEvent[]>([]);

    useEffect(() => {
        if (!canRead) return;
        void fetchAdminPayments(statusFilter || undefined).then(setPayments).catch(() => setPayments([]));
    }, [canRead, statusFilter]);

    useEffect(() => {
        if (!canRead) return;
        void Promise.all([
            fetchPaymentProviders().then(setProviders).catch(() => setProviders([])),
            fetchWebhookEvents().then((items) => setEvents(items.slice(0, 10))).catch(() => setEvents([])),
        ]);
    }, [canRead]);

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Payments" title="Payments" description="This session does not have permission to access payment records." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Payments and webhooks"
                    title="Gateway providers, transaction states, and webhook visibility"
                    description="The Go backend owns payment orchestration and webhook processing. This screen helps operations verify transaction state and provider health without exposing secrets to the frontend."
                />

                <AdminSectionCard title="Filter" description="Inspect payments by normalized backend status.">
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={adminSelectClass}>
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </AdminSectionCard>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
                    <AdminSectionCard title="Payment records" description="Customer-visible transaction state is normalized from provider statuses here.">
                        <div className="space-y-3">
                            {payments.length === 0 ? (
                                <p className="text-sm text-slate-500">No payment records match the selected filter.</p>
                            ) : (
                                payments.map((payment) => (
                                    <div key={payment.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Transaction #{payment.id} · {payment.paymentMethodName || "Payment method"}</p>
                                                <p className="mt-1 text-sm text-slate-500">{payment.customerName || "Customer"} · {payment.branchName || "Account flow"}</p>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payment.status)}`}>{payment.status}</span>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                            <p>Amount: {formatTHB(payment.amount)}</p>
                                            <p>Provider: {payment.providerCode || "-"}</p>
                                            <p>Provider status: {payment.providerStatus || "-"}</p>
                                            <p>Created: {formatAdminDate(payment.createdAt)}</p>
                                            <p>Paid at: {formatAdminDate(payment.paidAt)}</p>
                                            <p>Order: {payment.orderId || "-"}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </AdminSectionCard>

                    <div className="space-y-6">
                        <AdminSectionCard title="Payment providers" description="The payment gateway layer is pluggable; Omise is configured first.">
                            <div className="space-y-3">
                                {providers.length === 0 ? (
                                    <p className="text-sm text-slate-500">No payment providers configured.</p>
                                ) : (
                                    providers.map((provider) => (
                                        <div key={provider.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{provider.name}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{provider.code}</p>
                                                </div>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(provider.isActive ? "active" : "inactive")}`}>
                                                    {provider.isActive ? "active" : "inactive"}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </AdminSectionCard>

                        <AdminSectionCard title="Recent webhook events" description="Webhook processing is persisted for debugging and auditability.">
                            <div className="space-y-3">
                                {events.length === 0 ? (
                                    <p className="text-sm text-slate-500">No webhook events have been recorded yet.</p>
                                ) : (
                                    events.map((event) => (
                                        <div key={event.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{event.eventType}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{event.externalEventId || "internal event"}</p>
                                                </div>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(event.status)}`}>{event.status}</span>
                                            </div>
                                            <p className="mt-3 text-xs text-slate-500">Received {formatAdminDate(event.receivedAt)} · Processed {formatAdminDate(event.processedAt)}</p>
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
