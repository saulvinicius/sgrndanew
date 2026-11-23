import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';
import { utcIsoToLocalParts } from '@/src/lib/server/timezone';

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const biz = db.businesses.find((b) => b.id === businessId)!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const professionalId = body.professional_id ? String(body.professional_id) : null;
  const startAt = String(body.start_at ?? '');
  const endAt = String(body.end_at ?? '');
  const reason = String(body.reason ?? 'Bloqueio de agenda').trim();

  if (
    professionalId &&
    !db.professionals.some((p) => p.id === professionalId && p.business_id === businessId)
  ) {
    return NextResponse.json({ error: 'Profissional inválido.' }, { status: 400 });
  }
  if (
    Number.isNaN(Date.parse(startAt)) ||
    Number.isNaN(Date.parse(endAt)) ||
    new Date(endAt) <= new Date(startAt)
  ) {
    return NextResponse.json({ error: 'Intervalo de bloqueio inválido.' }, { status: 400 });
  }

  const block = {
    id: crypto.randomUUID(),
    business_id: businessId,
    professional_id: professionalId,
    start_at: new Date(startAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    reason,
    created_at: new Date().toISOString(),
  };
  db.blocked_times.push(block);
  saveDb(db);

  return NextResponse.json(
    {
      block: {
        ...block,
        localStart: utcIsoToLocalParts(block.start_at, biz.timezone),
        localEnd: utcIsoToLocalParts(block.end_at, biz.timezone),
      },
    },
    { status: 201 },
  );
}
