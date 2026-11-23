import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const services = db.services.filter((s) => s.business_id === businessId);
  const links = db.professional_services.filter((ps) => ps.business_id === businessId);
  const professionals = db.professionals.filter((p) => p.business_id === businessId);
  return NextResponse.json({ services, links, professionals });
}

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const priceCents = Math.max(0, Math.round(Number(body.price_cents ?? 0)));
  const durationMinutes = Math.round(Number(body.duration_minutes ?? 30));
  const bufferMinutes = Math.max(0, Math.round(Number(body.buffer_minutes ?? 0)));
  const professionalIds: string[] = Array.isArray(body.professional_ids)
    ? body.professional_ids.map(String)
    : [];

  if (name.length < 2 || durationMinutes < 5 || durationMinutes > 480) {
    return NextResponse.json({ error: 'Nome ou duração do serviço inválidos.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const service = {
    id: crypto.randomUUID(),
    business_id: businessId,
    name,
    description,
    price_cents: priceCents,
    duration_minutes: durationMinutes,
    buffer_minutes: bufferMinutes,
    active: true,
    created_at: now,
    updated_at: now,
  };
  db.services.push(service);

  const validProIds = db.professionals
    .filter(
      (p) =>
        p.business_id === businessId &&
        (professionalIds.length === 0 || professionalIds.includes(p.id)),
    )
    .map((p) => p.id);

  for (const proId of validProIds) {
    db.professional_services.push({
      id: crypto.randomUUID(),
      business_id: businessId,
      professional_id: proId,
      service_id: service.id,
      created_at: now,
    });
  }

  saveDb(db);
  return NextResponse.json({ service }, { status: 201 });
}
