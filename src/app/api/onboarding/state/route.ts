import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const business = db.businesses.find((b) => b.id === businessId);
  const services = db.services.filter((s) => s.business_id === businessId);
  const workingHours = db.working_hours.filter(
    (w) => w.business_id === businessId && w.professional_id === null,
  );
  const subscription = db.subscriptions.find((s) => s.business_id === businessId);

  return NextResponse.json({
    business,
    services,
    workingHours,
    subscription,
    mercadoPagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()),
  });
}
