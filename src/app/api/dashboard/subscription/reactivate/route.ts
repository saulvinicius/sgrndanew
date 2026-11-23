import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { addAuditLog, loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const biz = db.businesses.find((b) => b.id === businessId);
  const sub = db.subscriptions.find((s) => s.business_id === businessId);
  if (!biz || !sub) {
    return NextResponse.json({ error: 'Assinatura não localizada.' }, { status: 404 });
  }
  const now = new Date().toISOString();
  sub.status = 'authorized';
  sub.cancel_at_period_end = false;
  if (!sub.current_period_end || new Date(sub.current_period_end).getTime() < Date.now()) {
    sub.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  sub.updated_at = now;
  biz.status = 'active';
  biz.updated_at = now;

  addAuditLog(db, {
    business_id: businessId,
    actor_id: auth.session.userId,
    actor_email: auth.session.email,
    action: 'subscription.reactivated',
    target_type: 'subscription',
    target_id: sub.id,
    details: 'Assinatura recorrente reativada.',
  });
  saveDb(db);
  return NextResponse.json({ subscription: sub, business: biz });
}
