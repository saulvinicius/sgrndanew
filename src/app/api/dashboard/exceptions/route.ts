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

  const date = String(body.date ?? '');
  const isClosed = Boolean(body.is_closed);
  const startTime = String(body.start_time ?? '09:00');
  const endTime = String(body.end_time ?? '14:00');
  const note = String(body.note ?? '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Data da exceção inválida.' }, { status: 400 });
  }
  db.business_date_exceptions = db.business_date_exceptions.filter(
    (e) => !(e.business_id === businessId && e.date === date),
  );
  const ex = {
    id: crypto.randomUUID(),
    business_id: businessId,
    date,
    is_closed: isClosed,
    start_time: startTime,
    end_time: endTime,
    note,
    created_at: new Date().toISOString(),
  };
  db.business_date_exceptions.push(ex);
  saveDb(db);
  return NextResponse.json({ exception: ex }, { status: 201 });
}
