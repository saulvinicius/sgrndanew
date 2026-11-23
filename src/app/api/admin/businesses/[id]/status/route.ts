import { NextResponse } from 'next/server';
import { requireSuperadminAuth } from '@/src/lib/server/auth';
import { addAuditLog, loadDb, saveDb } from '@/src/lib/server/store';
import type { BusinessStatus } from '@/src/lib/server/types';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireSuperadminAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const biz = db.businesses.find((b) => b.id === id);
  if (!biz) {
    return NextResponse.json({ error: 'Estabelecimento não encontrado.' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(body.status ?? '') as BusinessStatus;
  if (!['active', 'suspended', 'onboarding'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
  }
  biz.status = status;
  biz.updated_at = new Date().toISOString();

  addAuditLog(db, {
    business_id: biz.id,
    actor_id: auth.session.userId,
    actor_email: auth.session.email,
    action: `superadmin.business_${status}`,
    target_type: 'business',
    target_id: biz.id,
    details: `Estado alterado manualmente para "${status}" pelo Superadmin.`,
  });
  saveDb(db);
  return NextResponse.json({ business: biz });
}
