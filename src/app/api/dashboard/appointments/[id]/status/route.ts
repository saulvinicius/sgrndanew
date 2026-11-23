import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';
import type { AppointmentStatus } from '@/src/lib/server/types';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const db = loadDb();
  const businessId = auth.session.businessId!;
  const appt = db.appointments.find((a) => a.id === id && a.business_id === businessId);
  if (!appt) {
    return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nextStatus = String(body.status ?? '') as AppointmentStatus;
  const allowed: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  appt.status = nextStatus;
  appt.updated_at = now;
  appt.history.push({
    at: now,
    action: `status:${nextStatus}`,
    actor: auth.session.email,
  });
  saveDb(db);
  return NextResponse.json({ appointment: appt });
}
