import { NextResponse } from 'next/server';
import { addAuditLog, loadDb, saveDb } from '@/src/lib/server/store';
import { utcIsoToLocalParts } from '@/src/lib/server/timezone';

export async function GET(_req: Request, context: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await context.params;
  const db = loadDb();
  const token = String(rawToken ?? '').trim();
  const appt = db.appointments.find((a) => a.cancel_token === token);
  if (!appt) {
    return NextResponse.json(
      { error: 'Link de cancelamento inválido ou não encontrado.' },
      { status: 404 },
    );
  }
  const biz = db.businesses.find((b) => b.id === appt.business_id)!;
  const pro = db.professionals.find((p) => p.id === appt.professional_id);
  const customer = db.customers.find((c) => c.id === appt.customer_id);

  return NextResponse.json({
    booking: {
      id: appt.id,
      status: appt.status,
      business_name: biz.name,
      business_slug: biz.slug,
      business_address: biz.address,
      service_name: appt.service_name_snapshot,
      price_cents: appt.price_cents_snapshot,
      duration_minutes: appt.duration_minutes_snapshot,
      professional_name: pro?.name ?? 'Profissional',
      customer_name: customer?.name ?? 'Cliente',
      start_at: appt.start_at,
      end_at: appt.end_at,
      local: utcIsoToLocalParts(appt.start_at, biz.timezone),
      timezone: biz.timezone,
      history: appt.history,
    },
  });
}

export async function POST(req: Request, context: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = loadDb();
  const token = String(rawToken ?? '').trim();
  const reason = String(body.reason ?? 'Cancelado pelo cliente via link seguro').trim();
  const appt = db.appointments.find((a) => a.cancel_token === token);
  if (!appt) {
    return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
  }
  if (appt.status === 'cancelled') {
    return NextResponse.json({
      ok: true,
      status: appt.status,
      message: 'Este agendamento já estava cancelado.',
    });
  }
  const now = new Date().toISOString();
  appt.status = 'cancelled';
  appt.updated_at = now;
  appt.history.push({
    at: now,
    action: 'cancelled_by_customer',
    actor: 'public_token',
    note: reason,
  });
  addAuditLog(db, {
    business_id: appt.business_id,
    actor_id: appt.customer_id,
    actor_email: 'cliente@publico',
    action: 'appointment.cancelled_by_token',
    target_type: 'appointment',
    target_id: appt.id,
    details: reason,
  });
  saveDb(db);
  return NextResponse.json({
    ok: true,
    status: appt.status,
    message: 'Agendamento cancelado com sucesso.',
  });
}
