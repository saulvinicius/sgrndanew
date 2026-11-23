import { NextResponse } from 'next/server';
import { getAvailableSlots, isBusinessPubliclyActive } from '@/src/lib/server/availability';
import { loadDb } from '@/src/lib/server/store';

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const db = loadDb();
  const slug = String(rawSlug ?? '').trim().toLowerCase();
  const business = db.businesses.find((b) => b.slug === slug && b.status !== 'deleted');
  if (!business) {
    return NextResponse.json({ error: 'Estabelecimento não encontrado.' }, { status: 404 });
  }

  const access = isBusinessPubliclyActive(db, business.id);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason || 'Agendamentos indisponíveis.', slots: [] },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const serviceId = String(searchParams.get('serviceId') ?? '');
  const professionalId = String(searchParams.get('professionalId') ?? '');
  const dateStr = String(searchParams.get('date') ?? '');

  const result = getAvailableSlots({
    state: db,
    businessId: business.id,
    serviceId,
    professionalId,
    dateStr,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error, slots: [] }, { status: 400 });
  }
  return NextResponse.json({ slots: result.slots, timezone: business.timezone });
}
