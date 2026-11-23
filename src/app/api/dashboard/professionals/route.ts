import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { sanitizeImageUrl } from '@/src/lib/server/security';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const professionals = db.professionals.filter((p) => p.business_id === businessId);
  const services = db.services.filter((s) => s.business_id === businessId);
  const links = db.professional_services.filter((ps) => ps.business_id === businessId);
  const hours = db.working_hours.filter(
    (wh) => wh.business_id === businessId && wh.professional_id !== null,
  );
  return NextResponse.json({ professionals, services, links, hours });
}

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const photoUrl = sanitizeImageUrl(String(body.photo_url ?? ''));
  const serviceIds: string[] = Array.isArray(body.service_ids) ? body.service_ids.map(String) : [];

  if (name.length < 2) {
    return NextResponse.json({ error: 'Informe o nome do profissional.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const pro = {
    id: crypto.randomUUID(),
    business_id: businessId,
    name,
    photo_url: photoUrl,
    description,
    active: true,
    created_at: now,
    updated_at: now,
  };
  db.professionals.push(pro);

  for (const svc of db.services.filter(
    (s) => s.business_id === businessId && (serviceIds.length === 0 || serviceIds.includes(s.id)),
  )) {
    db.professional_services.push({
      id: crypto.randomUUID(),
      business_id: businessId,
      professional_id: pro.id,
      service_id: svc.id,
      created_at: now,
    });
  }

  saveDb(db);
  return NextResponse.json({ professional: pro }, { status: 201 });
}
