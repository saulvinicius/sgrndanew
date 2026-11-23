import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const businessId = auth.session.businessId!;
  db.business_date_exceptions = db.business_date_exceptions.filter(
    (e) => !(e.id === id && e.business_id === businessId),
  );
  saveDb(db);
  return NextResponse.json({ ok: true });
}
