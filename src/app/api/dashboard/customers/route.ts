import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const customers = db.customers
    .filter((c) => c.business_id === businessId)
    .map((c) => ({
      ...c,
      appointments_count: db.appointments.filter(
        (a) => a.business_id === businessId && a.customer_id === c.id,
      ).length,
    }));
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '').trim();
  const notes = String(body.notes ?? '').trim();
  if (name.length < 2 || phone.length < 8) {
    return NextResponse.json({ error: 'Nome e telefone são obrigatórios.' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const customer = {
    id: crypto.randomUUID(),
    business_id: businessId,
    name,
    phone,
    email,
    notes,
    consent_at: body.consent ? now : null,
    created_at: now,
    updated_at: now,
  };
  db.customers.push(customer);
  saveDb(db);
  return NextResponse.json({ customer }, { status: 201 });
}
