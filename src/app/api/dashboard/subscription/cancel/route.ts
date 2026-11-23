import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { addAuditLog, loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const sub = db.subscriptions.find((s) => s.business_id === businessId);
  if (!sub) {
    return NextResponse.json({ error: 'Assinatura não localizada.' }, { status: 404 });
  }
  sub.status = 'cancelled';
  sub.cancel_at_period_end = true;
  sub.updated_at = new Date().toISOString();

  addAuditLog(db, {
    business_id: businessId,
    actor_id: auth.session.userId,
    actor_email: auth.session.email,
    action: 'subscription.cancel_requested',
    target_type: 'subscription',
    target_id: sub.id,
    details: 'Cancelamento agendado para o fim do período já pago; dados preservados.',
  });
  saveDb(db);
  return NextResponse.json({ subscription: sub });
}
