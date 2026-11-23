import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const businessId = auth.session.businessId!;
  const customer = db.customers.find((c) => c.id === id && c.business_id === businessId);
  if (!customer) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.name !== undefined) customer.name = String(body.name).trim();
  if (body.phone !== undefined) customer.phone = String(body.phone).trim();
  if (body.email !== undefined) customer.email = String(body.email).trim();
  if (body.notes !== undefined) customer.notes = String(body.notes).trim();
  customer.updated_at = new Date().toISOString();
  saveDb(db);
  return NextResponse.json({ customer });
}
