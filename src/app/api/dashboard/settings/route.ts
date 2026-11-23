import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { sanitizeImageUrl } from '@/src/lib/server/security';
import { ensureUniqueSlug, loadDb, saveDb } from '@/src/lib/server/store';
import { isValidTimeZone } from '@/src/lib/server/timezone';

export async function PUT(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const biz = db.businesses.find((b) => b.id === businessId)!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.name !== undefined) biz.name = String(body.name).trim();
  if (body.slug !== undefined) biz.slug = ensureUniqueSlug(String(body.slug), businessId);
  if (body.segment !== undefined) biz.segment = String(body.segment).trim();
  if (body.phone !== undefined) biz.phone = String(body.phone).trim();
  if (body.address !== undefined) biz.address = String(body.address).trim();
  if (body.description !== undefined) biz.description = String(body.description).trim();
  if (body.logo_url !== undefined) biz.logo_url = sanitizeImageUrl(String(body.logo_url));
  if (body.timezone !== undefined && isValidTimeZone(String(body.timezone))) {
    biz.timezone = String(body.timezone);
  }
  biz.updated_at = new Date().toISOString();
  saveDb(db);
  return NextResponse.json({ business: biz });
}
