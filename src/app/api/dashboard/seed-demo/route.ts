import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb, seedDemoIntoBusiness } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  seedDemoIntoBusiness(db, auth.session.businessId!);
  saveDb(db);
  return NextResponse.json({ ok: true });
}
