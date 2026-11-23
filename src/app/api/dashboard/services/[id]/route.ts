import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const businessId = auth.session.businessId!;
  const service = db.services.find((s) => s.id === id && s.business_id === businessId);
  if (!service) {
    return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.name !== undefined) service.name = String(body.name).trim();
  if (body.description !== undefined) service.description = String(body.description).trim();
  if (body.price_cents !== undefined)
    service.price_cents = Math.max(0, Math.round(Number(body.price_cents)));
  if (body.duration_minutes !== undefined) {
    service.duration_minutes = Math.max(
      5,
      Math.min(480, Math.round(Number(body.duration_minutes))),
    );
  }
  if (body.buffer_minutes !== undefined) {
    service.buffer_minutes = Math.max(0, Math.round(Number(body.buffer_minutes)));
  }
  if (body.active !== undefined) service.active = Boolean(body.active);
  service.updated_at = new Date().toISOString();

  if (Array.isArray(body.professional_ids)) {
    const targetIds = new Set(body.professional_ids.map(String));
    db.professional_services = db.professional_services.filter(
      (ps) => !(ps.business_id === businessId && ps.service_id === service.id),
    );
    for (const pro of db.professionals.filter(
      (p) => p.business_id === businessId && targetIds.has(p.id),
    )) {
      db.professional_services.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: pro.id,
        service_id: service.id,
        created_at: new Date().toISOString(),
      });
    }
  }

  saveDb(db);
  return NextResponse.json({ service });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const businessId = auth.session.businessId!;
  const idx = db.services.findIndex((s) => s.id === id && s.business_id === businessId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  }
  db.services.splice(idx, 1);
  db.professional_services = db.professional_services.filter(
    (ps) => !(ps.business_id === businessId && ps.service_id === id),
  );
  saveDb(db);
  return NextResponse.json({ ok: true });
}
