import { NextResponse } from 'next/server';
import { isBusinessPubliclyActive } from '@/src/lib/server/availability';
import { loadDb } from '@/src/lib/server/store';

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const db = loadDb();
  const slug = String(rawSlug ?? '').trim().toLowerCase();
  const business = db.businesses.find((b) => b.slug === slug && b.status !== 'deleted');
  if (!business) {
    return NextResponse.json({ error: 'Estabelecimento não encontrado.' }, { status: 404 });
  }

  const access = isBusinessPubliclyActive(db, business.id);
  const services = db.services.filter((s) => s.business_id === business.id && s.active);
  const professionals = db.professionals.filter((p) => p.business_id === business.id && p.active);
  const links = db.professional_services.filter((ps) => ps.business_id === business.id);
  const workingHours = db.working_hours.filter(
    (wh) => wh.business_id === business.id && wh.professional_id === null,
  );

  return NextResponse.json({
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      segment: business.segment,
      phone: business.phone,
      address: business.address,
      logo_url: business.logo_url,
      description: business.description,
      timezone: business.timezone,
      max_future_days: business.max_future_days,
      min_advance_minutes: business.min_advance_minutes,
    },
    bookingEnabled: access.allowed,
    bookingDisabledReason: access.reason ?? null,
    services,
    professionals,
    links,
    workingHours,
  });
}
