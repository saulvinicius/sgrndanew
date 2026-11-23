import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb } from '@/src/lib/server/store';
import { utcIsoToLocalParts } from '@/src/lib/server/timezone';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const business = db.businesses.find((b) => b.id === businessId)!;
  const workingHours = db.working_hours.filter(
    (w) => w.business_id === businessId && w.professional_id === null,
  );
  const blockedTimes = db.blocked_times
    .filter((b) => b.business_id === businessId)
    .map((b) => ({
      ...b,
      localStart: utcIsoToLocalParts(b.start_at, business.timezone),
      localEnd: utcIsoToLocalParts(b.end_at, business.timezone),
      professional_name: b.professional_id
        ? db.professionals.find((p) => p.id === b.professional_id)?.name ?? 'Profissional'
        : 'Todo o estabelecimento',
    }));
  const exceptions = db.business_date_exceptions.filter((e) => e.business_id === businessId);
  const professionals = db.professionals.filter((p) => p.business_id === businessId);

  return NextResponse.json({ business, workingHours, blockedTimes, exceptions, professionals });
}
