import { NextResponse } from 'next/server';
import { requireSuperadminAuth } from '@/src/lib/server/auth';
import { loadDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireSuperadminAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businesses = db.businesses.filter((b) => b.status !== 'deleted');
  const subscriptions = db.subscriptions;
  const payments = [...db.payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const activeSubs = subscriptions.filter((s) => s.status === 'authorized');
  const mrrCents = activeSubs.reduce((sum, s) => sum + s.price_cents, 0);
  const totalRevenueCents = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount_cents, 0);

  return NextResponse.json({
    metrics: {
      totalBusinesses: businesses.length,
      activeBusinesses: businesses.filter((b) => b.status === 'active').length,
      onboardingBusinesses: businesses.filter((b) => b.status === 'onboarding').length,
      suspendedBusinesses: businesses.filter((b) => b.status === 'suspended').length,
      mrrCents,
      totalRevenueCents,
      totalAppointments: db.appointments.length,
    },
    businesses: businesses.map((b) => ({
      ...b,
      subscription: subscriptions.find((s) => s.business_id === b.id) ?? null,
      appointmentsCount: db.appointments.filter((a) => a.business_id === b.id).length,
    })),
    payments: payments.map((p) => ({
      ...p,
      business_name: businesses.find((b) => b.id === p.business_id)?.name ?? 'Estabelecimento',
    })),
    webhookEvents: db.webhook_events.slice(0, 50),
    auditLogs: db.audit_logs.slice(0, 80),
  });
}
