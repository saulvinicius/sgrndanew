import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function PUT(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const hours = Array.isArray(body.hours) ? body.hours : [];
  if (hours.length !== 7) {
    return NextResponse.json({ error: 'Informe os 7 dias da semana.' }, { status: 400 });
  }

  db.working_hours = db.working_hours.filter(
    (w) => !(w.business_id === businessId && w.professional_id === null),
  );
  for (const rawItem of hours) {
    const item = rawItem as Record<string, unknown>;
    const day = Number(item.day_of_week);
    const start = String(item.start_time ?? '09:00');
    const end = String(item.end_time ?? '18:00');
    const isClosed = Boolean(item.is_closed);
    if (day < 0 || day > 6 || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return NextResponse.json({ error: 'Horário inválido em um dos dias.' }, { status: 400 });
    }
    db.working_hours.push({
      id: crypto.randomUUID(),
      business_id: businessId,
      professional_id: null,
      day_of_week: day,
      start_time: start,
      end_time: end,
      is_closed: isClosed,
    });
  }
  saveDb(db);
  return NextResponse.json({
    workingHours: db.working_hours.filter(
      (w) => w.business_id === businessId && w.professional_id === null,
    ),
  });
}
