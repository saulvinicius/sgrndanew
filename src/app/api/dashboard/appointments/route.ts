import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { validateBookingInterval } from '@/src/lib/server/availability';
import { generateSecureToken, withLock } from '@/src/lib/server/security';
import { loadDb, saveDb } from '@/src/lib/server/store';
import { utcIsoToLocalParts } from '@/src/lib/server/timezone';
import type { AppointmentStatus } from '@/src/lib/server/types';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const business = db.businesses.find((b) => b.id === businessId)!;
  const customers = db.customers.filter((c) => c.business_id === businessId);
  const professionals = db.professionals.filter((p) => p.business_id === businessId);
  const appointments = db.appointments
    .filter((a) => a.business_id === businessId)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .map((a) => ({
      ...a,
      customer_name: customers.find((c) => c.id === a.customer_id)?.name ?? 'Cliente',
      customer_phone: customers.find((c) => c.id === a.customer_id)?.phone ?? '',
      professional_name: professionals.find((p) => p.id === a.professional_id)?.name ?? 'Profissional',
      local: utcIsoToLocalParts(a.start_at, business.timezone),
    }));

  return NextResponse.json({
    appointments,
    professionals,
    services: db.services.filter((s) => s.business_id === businessId),
  });
}

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const businessId = auth.session.businessId!;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const serviceId = String(body.service_id ?? '');
  const professionalId = String(body.professional_id ?? '');
  const dateStr = String(body.date ?? '');
  const startTimeStr = String(body.start_time ?? '');
  const customerName = String(body.customer_name ?? '').trim();
  const customerPhone = String(body.customer_phone ?? '').trim();
  const customerEmail = String(body.customer_email ?? '').trim();
  const notes = String(body.notes ?? '').trim();

  if (customerName.length < 2 || customerPhone.length < 8) {
    return NextResponse.json(
      { error: 'Informe nome e telefone do cliente.' },
      { status: 400 },
    );
  }

  const result = await withLock(`booking:${businessId}:${professionalId}`, async () => {
    const db = loadDb();
    const validation = validateBookingInterval({
      state: db,
      businessId,
      serviceId,
      professionalId,
      dateStr,
      startTimeStr,
      isAdminOrigin: true,
    });
    if (!validation.ok) return { error: validation.error, status: 409 as const };

    const service = db.services.find((s) => s.id === serviceId && s.business_id === businessId)!;
    const now = new Date().toISOString();

    let customer = db.customers.find(
      (c) =>
        c.business_id === businessId &&
        c.phone.replace(/\D/g, '') === customerPhone.replace(/\D/g, ''),
    );
    if (!customer) {
      customer = {
        id: crypto.randomUUID(),
        business_id: businessId,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        notes: '',
        consent_at: now,
        created_at: now,
        updated_at: now,
      };
      db.customers.push(customer);
    }

    const appointment = {
      id: crypto.randomUUID(),
      business_id: businessId,
      customer_id: customer.id,
      professional_id: professionalId,
      service_id: service.id,
      service_name_snapshot: service.name,
      price_cents_snapshot: service.price_cents,
      duration_minutes_snapshot: service.duration_minutes,
      buffer_minutes_snapshot: service.buffer_minutes,
      start_at: validation.start_at,
      end_at: validation.end_at,
      status: 'confirmed' as AppointmentStatus,
      origin: 'admin' as const,
      cancel_token: generateSecureToken(20),
      notes,
      history: [{ at: now, action: 'created', actor: auth.session.email }],
      created_at: now,
      updated_at: now,
    };
    db.appointments.push(appointment);
    saveDb(db);
    return { appointment, status: 201 as const };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ appointment: result.appointment }, { status: 201 });
}
