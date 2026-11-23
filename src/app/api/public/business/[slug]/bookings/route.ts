import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { isValidEmail } from '@/src/lib/server/auth';
import { validateBookingInterval } from '@/src/lib/server/availability';
import { generateSecureToken, withLock } from '@/src/lib/server/security';
import { loadDb, saveDb } from '@/src/lib/server/store';
import { utcIsoToLocalParts } from '@/src/lib/server/timezone';

export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const slug = String(rawSlug ?? '').trim().toLowerCase();
  const preDb = loadDb();
  const biz = preDb.businesses.find((b) => b.slug === slug && b.status !== 'deleted');
  if (!biz) {
    return NextResponse.json({ error: 'Estabelecimento não encontrado.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const serviceId = String(body.service_id ?? '');
  const professionalId = String(body.professional_id ?? '');
  const dateStr = String(body.date ?? '');
  const startTimeStr = String(body.start_time ?? '');
  const customerName = String(body.customer_name ?? '').trim();
  const customerPhone = String(body.customer_phone ?? '').trim();
  const customerEmail = String(body.customer_email ?? '').trim();
  const notes = String(body.notes ?? '').trim();
  const consent = Boolean(body.consent);

  if (customerName.length < 2) {
    return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
  }
  if (customerPhone.replace(/\D/g, '').length < 10) {
    return NextResponse.json(
      { error: 'Informe um telefone/WhatsApp válido com DDD.' },
      { status: 400 },
    );
  }
  if (customerEmail && !isValidEmail(customerEmail)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: 'Confirme o consentimento para registrar seu agendamento.' },
      { status: 400 },
    );
  }

  const result = await withLock(`booking:${biz.id}:${professionalId}`, async () => {
    const db = loadDb();
    const validation = validateBookingInterval({
      state: db,
      businessId: biz.id,
      serviceId,
      professionalId,
      dateStr,
      startTimeStr,
      isAdminOrigin: false,
    });

    if (!validation.ok) {
      return { error: validation.error, status: 409 as const };
    }

    const service = db.services.find((s) => s.id === serviceId && s.business_id === biz.id)!;
    const pro = db.professionals.find((p) => p.id === professionalId && p.business_id === biz.id)!;
    const now = new Date().toISOString();

    let customer = db.customers.find(
      (c) =>
        c.business_id === biz.id &&
        c.phone.replace(/\D/g, '') === customerPhone.replace(/\D/g, ''),
    );
    if (!customer) {
      customer = {
        id: crypto.randomUUID(),
        business_id: biz.id,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        notes: '',
        consent_at: now,
        created_at: now,
        updated_at: now,
      };
      db.customers.push(customer);
    } else {
      customer.name = customerName;
      if (customerEmail) customer.email = customerEmail;
      customer.consent_at = now;
      customer.updated_at = now;
    }

    const cancelToken = generateSecureToken(24);
    const appointment = {
      id: crypto.randomUUID(),
      business_id: biz.id,
      customer_id: customer.id,
      professional_id: pro.id,
      service_id: service.id,
      service_name_snapshot: service.name,
      price_cents_snapshot: service.price_cents,
      duration_minutes_snapshot: service.duration_minutes,
      buffer_minutes_snapshot: service.buffer_minutes,
      start_at: validation.start_at,
      end_at: validation.end_at,
      status: 'confirmed' as const,
      origin: 'public' as const,
      cancel_token: cancelToken,
      notes,
      history: [{ at: now, action: 'created', actor: 'public' }],
      created_at: now,
      updated_at: now,
    };
    db.appointments.push(appointment);
    saveDb(db);

    return {
      status: 201 as const,
      booking: {
        id: appointment.id,
        business_name: biz.name,
        business_slug: biz.slug,
        business_address: biz.address,
        business_phone: biz.phone,
        timezone: biz.timezone,
        service_name: appointment.service_name_snapshot,
        price_cents: appointment.price_cents_snapshot,
        duration_minutes: appointment.duration_minutes_snapshot,
        professional_name: pro.name,
        customer_name: customer.name,
        start_at: appointment.start_at,
        end_at: appointment.end_at,
        local: utcIsoToLocalParts(appointment.start_at, biz.timezone),
        cancel_token: cancelToken,
        status: appointment.status,
      },
    };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}
