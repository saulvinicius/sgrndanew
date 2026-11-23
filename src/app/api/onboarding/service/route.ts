import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const priceCents = Math.round(Number(body.price_cents ?? 0));
  const durationMinutes = Math.round(Number(body.duration_minutes ?? 30));
  const bufferMinutes = Math.max(0, Math.round(Number(body.buffer_minutes ?? 0)));

  if (name.length < 2 || priceCents < 0 || durationMinutes < 5 || durationMinutes > 480) {
    return NextResponse.json({ error: 'Dados do serviço inválidos.' }, { status: 400 });
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

  const pros = db.professionals.filter((p) => p.business_id === businessId);
  for (const pro of pros) {
    db.professional_services.push({
      id: crypto.randomUUID(),
      business_id: businessId,
      professional_id: pro.id,
      service_id: service.id,
      created_at: now,
    });
  }

  saveDb(db);
  return NextResponse.json({ service }, { status: 201 });
}
