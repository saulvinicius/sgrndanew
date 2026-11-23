import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const appts = db.appointments.filter((a) => a.business_id === businessId);
  const pros = db.professionals.filter((p) => p.business_id === businessId);

  const totalRevenueCents = appts
    .filter((a) => a.status === 'completed' || a.status === 'confirmed')
    .reduce((sum, a) => sum + a.price_cents_snapshot, 0);
  const completedCount = appts.filter((a) => a.status === 'completed').length;
  const cancelledCount = appts.filter((a) => a.status === 'cancelled').length;
  const noShowCount = appts.filter((a) => a.status === 'no_show').length;

  const byProfessional = pros.map((p) => {
    const pAppts = appts.filter((a) => a.professional_id === p.id && a.status !== 'cancelled');
    return {
      professional_id: p.id,
      name: p.name,
      bookings: pAppts.length,
      revenue_cents: pAppts.reduce((s, a) => s + a.price_cents_snapshot, 0),
    };
  });

  return NextResponse.json({
    totalBookings: appts.length,
    totalRevenueCents,
    completedCount,
    cancelledCount,
    noShowCount,
    byProfessional,
  });
}
