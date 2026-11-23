import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { isBusinessPubliclyActive } from '@/src/lib/server/availability';
import { loadDb } from '@/src/lib/server/store';
import { utcIsoToLocalParts } from '@/src/lib/server/timezone';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const business = db.businesses.find((b) => b.id === businessId)!;
  const subscription = db.subscriptions.find((s) => s.business_id === businessId) ?? null;
  const services = db.services.filter((s) => s.business_id === businessId);
  const professionals = db.professionals.filter((p) => p.business_id === businessId);
  const customers = db.customers.filter((c) => c.business_id === businessId);
  const appointments = db.appointments
    .filter((a) => a.business_id === businessId)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const activePublic = isBusinessPubliclyActive(db, businessId);
  return NextResponse.json({
    business,
    subscription,
    publicBookingActive: activePublic.allowed,
    publicBookingBlockedReason: activePublic.reason ?? null,
    counts: {
      services: services.filter((s) => s.active).length,
      professionals: professionals.filter((p) => p.active).length,
      customers: customers.length,
      appointments: appointments.length,
    },
    appointments: appointments.map((a) => ({
      ...a,
      customer_name: customers.find((c) => c.id === a.customer_id)?.name ?? 'Cliente',
      customer_phone: customers.find((c) => c.id === a.customer_id)?.phone ?? '',
      professional_name: professionals.find((p) => p.id === a.professional_id)?.name ?? 'Profissional',
      local: utcIsoToLocalParts(a.start_at, business.timezone),
    })),
  });
}
