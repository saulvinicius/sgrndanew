import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function PUT(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const biz = db.businesses.find((b) => b.id === businessId)!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.min_advance_minutes !== undefined) {
    biz.min_advance_minutes = Math.max(0, Math.min(4320, Number(body.min_advance_minutes)));
  }
  if (body.max_future_days !== undefined) {
    biz.max_future_days = Math.max(1, Math.min(365, Number(body.max_future_days)));
  }
  biz.updated_at = new Date().toISOString();
  saveDb(db);
  return NextResponse.json({ business: biz });
}
