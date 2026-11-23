import { NextResponse } from 'next/server';
import { isBusinessPubliclyActive } from '@/src/lib/server/availability';
import { loadDb } from '@/src/lib/server/store';

export async function GET() {
  const db = loadDb();
  const items = db.businesses
    .filter((b) => b.status === 'active' && isBusinessPubliclyActive(db, b.id).allowed)
    .slice(0, 6)
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      segment: b.segment,
      address: b.address,
      logo_url: b.logo_url,
      servicesCount: db.services.filter((s) => s.business_id === b.id && s.active).length,
    }));
  return NextResponse.json({ businesses: items });
}
