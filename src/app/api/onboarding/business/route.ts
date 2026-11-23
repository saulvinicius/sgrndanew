import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { ensureUniqueSlug, loadDb, saveDb } from '@/src/lib/server/store';
import { isValidTimeZone } from '@/src/lib/server/timezone';

export async function PUT(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const business = db.businesses.find((b) => b.id === businessId);
  if (!business) {
    return NextResponse.json({ error: 'Estabelecimento não encontrado.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? business.name).trim();
  const segment = String(body.segment ?? business.segment).trim();
  const phone = String(body.phone ?? business.phone).trim();
  const address = String(body.address ?? business.address).trim();
  const description = String(body.description ?? business.description).trim();
  const timezone = String(body.timezone ?? business.timezone).trim();
  const desiredSlug = String(body.slug ?? name).trim();

  if (name.length < 2) {
    return NextResponse.json({ error: 'Nome do estabelecimento é obrigatório.' }, { status: 400 });
  }
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: 'Fuso horário inválido.' }, { status: 400 });
  }

  business.name = name;
  business.slug = ensureUniqueSlug(desiredSlug || name, businessId);
  business.segment = segment || business.segment;
  business.phone = phone;
  business.address = address;
  business.description = description;
  business.timezone = timezone;
  business.updated_at = new Date().toISOString();

  saveDb(db);
  return NextResponse.json({ business });
}
