import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { sanitizeImageUrl } from '@/src/lib/server/security';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const businessId = auth.session.businessId!;
  const pro = db.professionals.find((p) => p.id === id && p.business_id === businessId);
  if (!pro) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.name !== undefined) pro.name = String(body.name).trim();
  if (body.description !== undefined) pro.description = String(body.description).trim();
  if (body.photo_url !== undefined) pro.photo_url = sanitizeImageUrl(String(body.photo_url));
  if (body.active !== undefined) pro.active = Boolean(body.active);
  pro.updated_at = new Date().toISOString();

  if (Array.isArray(body.service_ids)) {
    const targetIds = new Set(body.service_ids.map(String));
    db.professional_services = db.professional_services.filter(
      (ps) => !(ps.business_id === businessId && ps.professional_id === pro.id),
    );
    for (const svc of db.services.filter(
      (s) => s.business_id === businessId && targetIds.has(s.id),
    )) {
      db.professional_services.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: pro.id,
        service_id: svc.id,
        created_at: new Date().toISOString(),
      });
    }
  }

  if (Array.isArray(body.hours) && body.hours.length === 7) {
    db.working_hours = db.working_hours.filter(
      (wh) => !(wh.business_id === businessId && wh.professional_id === pro.id),
    );
    for (const rawH of body.hours) {
      const h = rawH as Record<string, unknown>;
      db.working_hours.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: pro.id,
        day_of_week: Number(h.day_of_week),
        start_time: String(h.start_time || '09:00'),
        end_time: String(h.end_time || '18:00'),
        is_closed: Boolean(h.is_closed),
      });
    }
  }

  saveDb(db);
  return NextResponse.json({ professional: pro });
}
