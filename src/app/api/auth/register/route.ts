import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { isValidEmail } from '@/src/lib/server/auth';
import { hashPassword, signSessionToken } from '@/src/lib/server/security';
import { addAuditLog, ensureUniqueSlug, loadDb, saveDb } from '@/src/lib/server/store';
import { DEFAULT_TIMEZONE } from '@/src/lib/server/timezone';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const businessName = String(body.businessName ?? '').trim();
  const segment = String(body.segment ?? 'Barbearia').trim();

  if (name.length < 2) {
    return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'A senha deve ter pelo menos 6 caracteres.' },
      { status: 400 },
    );
  }

  const db = loadDb();
  if (db.profiles.some((p) => p.email === email)) {
    return NextResponse.json(
      { error: 'Já existe uma conta cadastrada com este e-mail.' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const businessId = crypto.randomUUID();
  const finalBizName = businessName || `Agenda de ${name.split(' ')[0]}`;
  const slug = ensureUniqueSlug(finalBizName);

  db.profiles.push({
    id: userId,
    name,
    email,
    password_hash: hashPassword(password),
    role: 'owner',
    email_verified: true,
    created_at: now,
    updated_at: now,
  });

  db.businesses.push({
    id: businessId,
    name: finalBizName,
    slug,
    segment: segment || 'Serviços Autônomos',
    phone: '',
    address: '',
    logo_url: '',
    description: '',
    timezone: DEFAULT_TIMEZONE,
    status: 'onboarding',
    min_advance_minutes: 60,
    max_future_days: 30,
    created_at: now,
    updated_at: now,
  });

  db.business_members.push({
    id: crypto.randomUUID(),
    business_id: businessId,
    user_id: userId,
    role: 'owner',
    created_at: now,
    updated_at: now,
  });

  db.professionals.push({
    id: crypto.randomUUID(),
    business_id: businessId,
    name,
    photo_url: '',
    description: 'Profissional responsável',
    active: true,
    created_at: now,
    updated_at: now,
  });

  for (let day = 0; day <= 6; day += 1) {
    db.working_hours.push({
      id: crypto.randomUUID(),
      business_id: businessId,
      professional_id: null,
      day_of_week: day,
      start_time: '09:00',
      end_time: day === 6 ? '13:00' : '18:00',
      is_closed: day === 0,
    });
  }

  db.subscriptions.push({
    id: crypto.randomUUID(),
    business_id: businessId,
    plan_name: 'Plano Profissional AgendaFlat',
    price_cents: 1990,
    status: 'pending_payment',
    provider: 'mercadopago',
    external_id: '',
    current_period_end: null,
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
  });

  addAuditLog(db, {
    business_id: businessId,
    actor_id: userId,
    actor_email: email,
    action: 'business.registered',
    target_type: 'business',
    target_id: businessId,
    details: `Cadastro inicial de "${finalBizName}" (${slug}).`,
  });

  saveDb(db);

  const token = signSessionToken({
    userId,
    email,
    role: 'owner',
    businessId,
  });

  return NextResponse.json(
    {
      token,
      user: { id: userId, name, email, role: 'owner' },
      business: db.businesses.find((b) => b.id === businessId),
    },
    { status: 201 },
  );
}
