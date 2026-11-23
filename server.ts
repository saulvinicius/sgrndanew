import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  getAvailableSlots,
  isBusinessPubliclyActive,
  validateBookingInterval,
} from './server/availability.ts';
import {
  generateSecureToken,
  hashPassword,
  sanitizeImageUrl,
  signSessionToken,
  slugify,
  verifyPassword,
  verifySessionToken,
  withLock,
} from './server/security.ts';
import type { SessionPayload } from './server/security.ts';
import { addAuditLog, loadDb, saveDb, seedDemoIntoBusiness } from './server/store.ts';
import { DEFAULT_TIMEZONE, isValidTimeZone, utcIsoToLocalParts } from './server/timezone.ts';
import type { AppointmentStatus, BusinessStatus } from './server/types.ts';

dotenv.config();

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

const PORT = Number(process.env.PORT || 3000);

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function requireOwnerAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sessão não informada. Faça login para continuar.' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session || !session.businessId) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }
  const db = loadDb();
  const membership = db.business_members.find(
    (m) => m.business_id === session.businessId && m.user_id === session.userId,
  );
  if (!membership) {
    res.status(403).json({ error: 'Sem permissão para acessar este estabelecimento.' });
    return;
  }
  req.session = session;
  next();
}

function requireSuperadminAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Autenticação administrativa necessária.' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session || session.role !== 'superadmin') {
    res.status(403).json({ error: 'Acesso restrito a administradores da plataforma.' });
    return;
  }
  const db = loadDb();
  const isEnvAdmin = session.userId === 'env-superadmin' && Boolean(process.env.ADMIN_PASSCODE?.trim());
  const isListedAdmin = db.platform_admins.some((a) => a.user_id === session.userId);
  if (!isEnvAdmin && !isListedAdmin) {
    res.status(403).json({ error: 'Administrador não autorizado no servidor.' });
    return;
  }
  req.session = session;
  next();
}

function ensureUniqueSlug(desired: string, excludeBusinessId?: string): string {
  const db = loadDb();
  const base = slugify(desired) || `negocio-${crypto.randomBytes(2).toString('hex')}`;
  let candidate = base;
  let counter = 2;
  while (
    db.businesses.some(
      (b) => b.slug === candidate && b.id !== excludeBusinessId && b.status !== 'deleted',
    )
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function processMercadoPagoWebhook(params: {
  eventId: string;
  eventType: string;
  businessId: string;
  subscriptionId: string;
  paymentStatus: 'approved' | 'rejected' | 'cancelled';
  providerPaymentId?: string;
}): { duplicate: boolean; ok: boolean; message: string } {
  const db = loadDb();
  const existing = db.webhook_events.find((w) => w.event_id === params.eventId);
  if (existing) {
    return { duplicate: true, ok: true, message: 'Evento já processado anteriormente (idempotente).' };
  }

  const sub = db.subscriptions.find(
    (s) => s.id === params.subscriptionId && s.business_id === params.businessId,
  );
  const biz = db.businesses.find((b) => b.id === params.businessId);
  if (!sub || !biz) {
    return { duplicate: false, ok: false, message: 'Assinatura ou estabelecimento não localizado.' };
  }

  const now = new Date().toISOString();
  db.webhook_events.unshift({
    id: crypto.randomUUID(),
    provider: 'mercadopago',
    event_id: params.eventId,
    event_type: params.eventType,
    payload_summary: `${params.eventType} · ${params.paymentStatus} · ${biz.slug}`,
    processed_at: now,
  });

  if (params.paymentStatus === 'approved') {
    const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    sub.status = 'authorized';
    sub.cancel_at_period_end = false;
    sub.current_period_end = nextPeriodEnd;
    sub.updated_at = now;

    if (biz.status === 'onboarding' || biz.status === 'suspended') {
      biz.status = 'active';
      biz.updated_at = now;
    }

    db.payments.unshift({
      id: crypto.randomUUID(),
      business_id: biz.id,
      subscription_id: sub.id,
      amount_cents: sub.price_cents,
      currency: 'BRL',
      status: 'approved',
      provider_payment_id: params.providerPaymentId || `mp_pay_${crypto.randomBytes(5).toString('hex')}`,
      paid_at: now,
      created_at: now,
    });

    addAuditLog(db, {
      business_id: biz.id,
      actor_id: 'mercadopago_webhook',
      actor_email: 'webhooks@mercadopago.com',
      action: 'subscription.activated',
      target_type: 'subscription',
      target_id: sub.id,
      details: `Assinatura R$ 19,90/mês confirmada via webhook (${params.eventId}).`,
    });
  } else if (params.paymentStatus === 'rejected') {
    db.payments.unshift({
      id: crypto.randomUUID(),
      business_id: biz.id,
      subscription_id: sub.id,
      amount_cents: sub.price_cents,
      currency: 'BRL',
      status: 'rejected',
      provider_payment_id: params.providerPaymentId || `mp_pay_${crypto.randomBytes(5).toString('hex')}`,
      paid_at: null,
      created_at: now,
    });
    sub.status = 'paused';
    sub.updated_at = now;
    biz.status = 'suspended';
    biz.updated_at = now;

    addAuditLog(db, {
      business_id: biz.id,
      actor_id: 'mercadopago_webhook',
      actor_email: 'webhooks@mercadopago.com',
      action: 'subscription.payment_rejected',
      target_type: 'subscription',
      target_id: sub.id,
      details: 'Cobrança recusada; agendamento público bloqueado.',
    });
  } else {
    sub.status = 'cancelled';
    sub.cancel_at_period_end = true;
    sub.updated_at = now;
    addAuditLog(db, {
      business_id: biz.id,
      actor_id: 'mercadopago_webhook',
      actor_email: 'webhooks@mercadopago.com',
      action: 'subscription.cancelled',
      target_type: 'subscription',
      target_id: sub.id,
      details: 'Assinatura cancelada via webhook.',
    });
  }

  saveDb(db);
  return { duplicate: false, ok: true, message: 'Webhook processado com sucesso.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    const db = loadDb();
    res.json({
      status: 'ok',
      service: 'agendaflat',
      businesses: db.businesses.length,
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // Auth: Register, Login, Forgot/Reset Password, Me
  // -------------------------------------------------------------------------
  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const businessName = String(req.body?.businessName ?? '').trim();
    const segment = String(req.body?.segment ?? 'Barbearia').trim();

    if (name.length < 2) {
      res.status(400).json({ error: 'Informe seu nome completo.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um e-mail válido.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    const db = loadDb();
    if (db.profiles.some((p) => p.email === email)) {
      res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
      return;
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

    // Default initial professional = owner
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

    // Default working hours Mon-Fri 09-18, Sat 09-13, Sun closed
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

    res.status(201).json({
      token,
      user: { id: userId, name, email, role: 'owner' },
      business: db.businesses.find((b) => b.id === businessId),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      res.status(400).json({ error: 'Informe e-mail e senha.' });
      return;
    }

    const db = loadDb();
    const user = db.profiles.find((p) => p.email === email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const membership = db.business_members.find((m) => m.user_id === user.id);
    const business = membership
      ? db.businesses.find((b) => b.id === membership.business_id && b.status !== 'deleted') ?? null
      : null;

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      businessId: business?.id ?? null,
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business,
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um e-mail válido.' });
      return;
    }
    const db = loadDb();
    const user = db.profiles.find((p) => p.email === email);
    let previewResetToken: string | undefined;

    if (user) {
      const resetToken = generateSecureToken(18);
      db.password_resets.push({
        token: resetToken,
        user_id: user.id,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        used: false,
      });
      saveDb(db);
      // In preview without SMTP configured, return token explicitly so recovery flow is testable end-to-end
      if (process.env.NODE_ENV !== 'production') {
        previewResetToken = resetToken;
      }
    }

    res.json({
      message:
        'Se este e-mail estiver cadastrado, enviamos as instruções para redefinir sua senha.',
      previewResetToken,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const token = String(req.body?.token ?? '').trim();
    const newPassword = String(req.body?.password ?? '');
    if (!token || newPassword.length < 6) {
      res.status(400).json({ error: 'Token inválido ou nova senha menor que 6 caracteres.' });
      return;
    }
    const db = loadDb();
    const record = db.password_resets.find(
      (r) => r.token === token && !r.used && new Date(r.expires_at).getTime() > Date.now(),
    );
    if (!record) {
      res.status(400).json({ error: 'Token de recuperação inválido ou expirado.' });
      return;
    }
    const user = db.profiles.find((p) => p.id === record.user_id);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    user.password_hash = hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    record.used = true;
    saveDb(db);
    res.json({ message: 'Senha atualizada com sucesso. Você já pode entrar.' });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }
    const session = verifySessionToken(token);
    if (!session) {
      res.status(401).json({ error: 'Sessão expirada.' });
      return;
    }
    const db = loadDb();
    if (session.role === 'superadmin') {
      res.json({
        user: { id: session.userId, name: 'Administrador AgendaFlat', email: session.email, role: 'superadmin' },
        business: null,
      });
      return;
    }
    const user = db.profiles.find((p) => p.id === session.userId);
    const business = session.businessId
      ? db.businesses.find((b) => b.id === session.businessId) ?? null
      : null;
    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business,
    });
  });

  // -------------------------------------------------------------------------
  // Superadmin Bootstrap & Auth (SecureCoder First-Run Claim + env override)
  // -------------------------------------------------------------------------
  app.get('/api/admin/bootstrap-status', (_req, res) => {
    const db = loadDb();
    const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const claimed = db.platform_admins.length > 0;
    res.json({
      requiresClaim: !envPasscodeSet && !claimed,
      envPasscodeSet,
    });
  });

  app.post('/api/admin/claim', (req, res) => {
    const db = loadDb();
    if (process.env.ADMIN_PASSCODE?.trim() || db.platform_admins.length > 0) {
      res.status(403).json({ error: 'Acesso administrativo já foi configurado neste ambiente.' });
      return;
    }
    const name = String(req.body?.name ?? 'Administrador').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!isValidEmail(email) || password.length < 8) {
      res.status(400).json({ error: 'Informe um e-mail válido e senha com no mínimo 8 caracteres.' });
      return;
    }

    const now = new Date().toISOString();
    const adminId = crypto.randomUUID();
    db.profiles.push({
      id: adminId,
      name,
      email,
      password_hash: hashPassword(password),
      role: 'superadmin',
      email_verified: true,
      created_at: now,
      updated_at: now,
    });
    db.platform_admins.push({
      user_id: adminId,
      email,
      created_at: now,
    });
    addAuditLog(db, {
      business_id: null,
      actor_id: adminId,
      actor_email: email,
      action: 'superadmin.claimed',
      target_type: 'platform',
      target_id: adminId,
      details: 'Primeiro acesso Superadmin reivindicado e bloqueado.',
    });
    saveDb(db);

    const token = signSessionToken({
      userId: adminId,
      email,
      role: 'superadmin',
      businessId: null,
    });
    res.status(201).json({
      token,
      user: { id: adminId, name, email, role: 'superadmin' },
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();

    if (envPasscode) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPasscode);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        const token = signSessionToken({
          userId: 'env-superadmin',
          email: email || 'superadmin@agendaflat.com.br',
          role: 'superadmin',
          businessId: null,
        });
        res.json({
          token,
          user: {
            id: 'env-superadmin',
            name: 'Superadmin AgendaFlat',
            email: email || 'superadmin@agendaflat.com.br',
            role: 'superadmin',
          },
        });
        return;
      }
      res.status(401).json({ error: 'Código de acesso administrativo incorreto.' });
      return;
    }

    const db = loadDb();
    const adminProfile = db.profiles.find(
      (p) => p.email === email && p.role === 'superadmin',
    );
    if (
      !adminProfile ||
      !db.platform_admins.some((a) => a.user_id === adminProfile.id) ||
      !verifyPassword(password, adminProfile.password_hash)
    ) {
      res.status(401).json({ error: 'Credenciais de Superadmin inválidas.' });
      return;
    }

    const token = signSessionToken({
      userId: adminProfile.id,
      email: adminProfile.email,
      role: 'superadmin',
      businessId: null,
    });
    res.json({
      token,
      user: {
        id: adminProfile.id,
        name: adminProfile.name,
        email: adminProfile.email,
        role: 'superadmin',
      },
    });
  });

  // -------------------------------------------------------------------------
  // Onboarding & Subscription Checkout (Mercado Pago)
  // -------------------------------------------------------------------------
  app.get('/api/onboarding/state', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const business = db.businesses.find((b) => b.id === businessId);
    const services = db.services.filter((s) => s.business_id === businessId);
    const workingHours = db.working_hours.filter(
      (w) => w.business_id === businessId && w.professional_id === null,
    );
    const subscription = db.subscriptions.find((s) => s.business_id === businessId);

    res.json({
      business,
      services,
      workingHours,
      subscription,
      mercadoPagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()),
    });
  });

  app.put('/api/onboarding/business', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const business = db.businesses.find((b) => b.id === businessId);
    if (!business) {
      res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      return;
    }

    const name = String(req.body?.name ?? business.name).trim();
    const segment = String(req.body?.segment ?? business.segment).trim();
    const phone = String(req.body?.phone ?? business.phone).trim();
    const address = String(req.body?.address ?? business.address).trim();
    const description = String(req.body?.description ?? business.description).trim();
    const timezone = String(req.body?.timezone ?? business.timezone).trim();
    const desiredSlug = String(req.body?.slug ?? name).trim();

    if (name.length < 2) {
      res.status(400).json({ error: 'Nome do estabelecimento é obrigatório.' });
      return;
    }
    if (!isValidTimeZone(timezone)) {
      res.status(400).json({ error: 'Fuso horário inválido.' });
      return;
    }

    business.name = name;
    business.slug = ensureUniqueSlug(desiredSlug || name, businessId);
    business.segment = segment || business.segment;
    business.phone = phone;
    business.address = address;
    business.description = description;
    business.timezone = timezone;
    business.updated_at = new Date().toISOString();

    saveDb(db);
    res.json({ business });
  });

  app.post('/api/onboarding/service', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const priceCents = Math.round(Number(req.body?.price_cents ?? 0));
    const durationMinutes = Math.round(Number(req.body?.duration_minutes ?? 30));
    const bufferMinutes = Math.max(0, Math.round(Number(req.body?.buffer_minutes ?? 0)));

    if (name.length < 2 || priceCents < 0 || durationMinutes < 5 || durationMinutes > 480) {
      res.status(400).json({ error: 'Dados do serviço inválidos.' });
      return;
    }

    const now = new Date().toISOString();
    const service = {
      id: crypto.randomUUID(),
      business_id: businessId,
      name,
      description,
      price_cents: priceCents,
      duration_minutes: durationMinutes,
      buffer_minutes: bufferMinutes,
      active: true,
      created_at: now,
      updated_at: now,
    };
    db.services.push(service);

    // Link automatically to professionals in this business
    const pros = db.professionals.filter((p) => p.business_id === businessId);
    for (const pro of pros) {
      db.professional_services.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: pro.id,
        service_id: service.id,
        created_at: now,
      });
    }

    saveDb(db);
    res.status(201).json({ service });
  });

  app.put('/api/onboarding/hours', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const hours = Array.isArray(req.body?.hours) ? req.body.hours : [];
    if (hours.length !== 7) {
      res.status(400).json({ error: 'Informe os 7 dias da semana.' });
      return;
    }

    db.working_hours = db.working_hours.filter(
      (w) => !(w.business_id === businessId && w.professional_id === null),
    );
    for (const item of hours) {
      const day = Number(item.day_of_week);
      const start = String(item.start_time ?? '09:00');
      const end = String(item.end_time ?? '18:00');
      const isClosed = Boolean(item.is_closed);
      if (day < 0 || day > 6 || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        res.status(400).json({ error: 'Horário inválido em um dos dias.' });
        return;
      }
      db.working_hours.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: null,
        day_of_week: day,
        start_time: start,
        end_time: end,
        is_closed: isClosed,
      });
    }
    saveDb(db);
    res.json({
      workingHours: db.working_hours.filter(
        (w) => w.business_id === businessId && w.professional_id === null,
      ),
    });
  });

  app.post('/api/subscriptions/checkout', requireOwnerAuth, async (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const biz = db.businesses.find((b) => b.id === businessId);
    const sub = db.subscriptions.find((s) => s.business_id === businessId);
    if (!biz || !sub) {
      res.status(404).json({ error: 'Assinatura não encontrada.' });
      return;
    }

    const servicesCount = db.services.filter((s) => s.business_id === businessId && s.active).length;
    if (servicesCount === 0) {
      res.status(400).json({ error: 'Cadastre ao menos 1 serviço antes de ativar a assinatura.' });
      return;
    }

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (mpToken) {
      try {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: `AgendaFlat — ${biz.name}`,
            external_reference: `${biz.id}:${sub.id}`,
            payer_email: req.session!.email,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: 19.9,
              currency_id: 'BRL',
            },
            back_url: `${appUrl}/painel/assinatura`,
            status: 'pending',
          }),
        });
        const mpData = (await mpRes.json()) as { id?: string; init_point?: string; message?: string };
        if (mpRes.ok && mpData.id) {
          sub.external_id = mpData.id;
          sub.updated_at = new Date().toISOString();
          saveDb(db);
          res.json({
            mode: 'mercadopago_live',
            externalId: mpData.id,
            initPoint: mpData.init_point,
            subscription: sub,
          });
          return;
        }
        res.status(502).json({ error: mpData.message || 'Falha ao criar assinatura no Mercado Pago.' });
        return;
      } catch {
        res.status(502).json({ error: 'Erro ao conectar ao gateway Mercado Pago.' });
        return;
      }
    }

    // Preview sandbox mode: creates external_id and returns checkout intent for webhook confirmation
    const externalId = sub.external_id || `mp_pre_${crypto.randomBytes(6).toString('hex')}`;
    sub.external_id = externalId;
    sub.updated_at = new Date().toISOString();
    saveDb(db);

    res.json({
      mode: 'sandbox_preview',
      externalId,
      subscription: sub,
      businessId: biz.id,
      amountCents: 1990,
    });
  });

  app.post('/api/webhooks/mercadopago', (req, res) => {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const signature = String(req.headers['x-signature'] ?? '');
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body ?? {}))
        .digest('hex');
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        res.status(401).json({ error: 'Assinatura do webhook Mercado Pago inválida.' });
        return;
      }
    }

    const eventId = String(req.body?.event_id ?? req.body?.id ?? '').trim();
    const eventType = String(req.body?.type ?? 'subscription_preapproval').trim();
    const businessId = String(req.body?.business_id ?? '').trim();
    const subscriptionId = String(req.body?.subscription_id ?? '').trim();
    const paymentStatus = (req.body?.status ?? 'approved') as 'approved' | 'rejected' | 'cancelled';

    if (!eventId || !businessId || !subscriptionId) {
      res.status(400).json({ error: 'Payload de webhook incompleto.' });
      return;
    }

    const result = processMercadoPagoWebhook({
      eventId,
      eventType,
      businessId,
      subscriptionId,
      paymentStatus,
      providerPaymentId: req.body?.provider_payment_id ? String(req.body.provider_payment_id) : undefined,
    });

    if (!result.ok) {
      res.status(404).json({ error: result.message });
      return;
    }
    res.json(result);
  });

  // -------------------------------------------------------------------------
  // Estabelecimento Dashboard (/api/dashboard/*) — Strict tenant isolation
  // -------------------------------------------------------------------------
  app.get('/api/dashboard/overview', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const business = db.businesses.find((b) => b.id === businessId)!;
    const subscription = db.subscriptions.find((s) => s.business_id === businessId) ?? null;
    const services = db.services.filter((s) => s.business_id === businessId);
    const professionals = db.professionals.filter((p) => p.business_id === businessId);
    const customers = db.customers.filter((c) => c.business_id === businessId);
    const appointments = db.appointments
      .filter((a) => a.business_id === businessId)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    const activePublic = isBusinessPubliclyActive(db, businessId);
    res.json({
      business,
      subscription,
      publicBookingActive: activePublic.allowed,
      publicBookingBlockedReason: activePublic.reason ?? null,
      counts: {
        services: services.filter((s) => s.active).length,
        professionals: professionals.filter((p) => p.active).length,
        customers: customers.length,
        appointments: appointments.length,
      },
      appointments: appointments.map((a) => ({
        ...a,
        customer_name: customers.find((c) => c.id === a.customer_id)?.name ?? 'Cliente',
        customer_phone: customers.find((c) => c.id === a.customer_id)?.phone ?? '',
        professional_name: professionals.find((p) => p.id === a.professional_id)?.name ?? 'Profissional',
        local: utcIsoToLocalParts(a.start_at, business.timezone),
      })),
    });
  });

  app.post('/api/dashboard/seed-demo', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    seedDemoIntoBusiness(db, businessId);
    saveDb(db);
    res.json({ ok: true });
  });

  // Appointments
  app.get('/api/dashboard/appointments', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
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

    res.json({ appointments, professionals, services: db.services.filter((s) => s.business_id === businessId) });
  });

  app.post('/api/dashboard/appointments', requireOwnerAuth, async (req: AuthedRequest, res) => {
    const businessId = req.session!.businessId!;
    const serviceId = String(req.body?.service_id ?? '');
    const professionalId = String(req.body?.professional_id ?? '');
    const dateStr = String(req.body?.date ?? '');
    const startTimeStr = String(req.body?.start_time ?? '');
    const customerName = String(req.body?.customer_name ?? '').trim();
    const customerPhone = String(req.body?.customer_phone ?? '').trim();
    const customerEmail = String(req.body?.customer_email ?? '').trim();
    const notes = String(req.body?.notes ?? '').trim();

    if (customerName.length < 2 || customerPhone.length < 8) {
      res.status(400).json({ error: 'Informe nome e telefone do cliente.' });
      return;
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

      // Match or create customer inside same business_id
      let customer = db.customers.find(
        (c) => c.business_id === businessId && c.phone.replace(/\D/g, '') === customerPhone.replace(/\D/g, ''),
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
        history: [{ at: now, action: 'created', actor: req.session!.email }],
        created_at: now,
        updated_at: now,
      };
      db.appointments.push(appointment);
      saveDb(db);
      return { appointment, status: 201 as const };
    });

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ appointment: result.appointment });
  });

  app.patch('/api/dashboard/appointments/:id/status', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const appt = db.appointments.find(
      (a) => a.id === req.params.id && a.business_id === businessId,
    );
    if (!appt) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    const nextStatus = String(req.body?.status ?? '') as AppointmentStatus;
    const allowed: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
    if (!allowed.includes(nextStatus)) {
      res.status(400).json({ error: 'Status inválido.' });
      return;
    }
    const now = new Date().toISOString();
    appt.status = nextStatus;
    appt.updated_at = now;
    appt.history.push({
      at: now,
      action: `status:${nextStatus}`,
      actor: req.session!.email,
    });
    saveDb(db);
    res.json({ appointment: appt });
  });

  // Services CRUD
  app.get('/api/dashboard/services', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const services = db.services.filter((s) => s.business_id === businessId);
    const links = db.professional_services.filter((ps) => ps.business_id === businessId);
    const professionals = db.professionals.filter((p) => p.business_id === businessId);
    res.json({ services, links, professionals });
  });

  app.post('/api/dashboard/services', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const priceCents = Math.max(0, Math.round(Number(req.body?.price_cents ?? 0)));
    const durationMinutes = Math.round(Number(req.body?.duration_minutes ?? 30));
    const bufferMinutes = Math.max(0, Math.round(Number(req.body?.buffer_minutes ?? 0)));
    const professionalIds: string[] = Array.isArray(req.body?.professional_ids)
      ? req.body.professional_ids.map(String)
      : [];

    if (name.length < 2 || durationMinutes < 5 || durationMinutes > 480) {
      res.status(400).json({ error: 'Nome ou duração do serviço inválidos.' });
      return;
    }

    const now = new Date().toISOString();
    const service = {
      id: crypto.randomUUID(),
      business_id: businessId,
      name,
      description,
      price_cents: priceCents,
      duration_minutes: durationMinutes,
      buffer_minutes: bufferMinutes,
      active: true,
      created_at: now,
      updated_at: now,
    };
    db.services.push(service);

    const validProIds = db.professionals
      .filter((p) => p.business_id === businessId && (professionalIds.length === 0 || professionalIds.includes(p.id)))
      .map((p) => p.id);

    for (const proId of validProIds) {
      db.professional_services.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: proId,
        service_id: service.id,
        created_at: now,
      });
    }

    saveDb(db);
    res.status(201).json({ service });
  });

  app.put('/api/dashboard/services/:id', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const service = db.services.find(
      (s) => s.id === req.params.id && s.business_id === businessId,
    );
    if (!service) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }

    if (req.body?.name !== undefined) service.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) service.description = String(req.body.description).trim();
    if (req.body?.price_cents !== undefined) service.price_cents = Math.max(0, Math.round(Number(req.body.price_cents)));
    if (req.body?.duration_minutes !== undefined) {
      service.duration_minutes = Math.max(5, Math.min(480, Math.round(Number(req.body.duration_minutes))));
    }
    if (req.body?.buffer_minutes !== undefined) {
      service.buffer_minutes = Math.max(0, Math.round(Number(req.body.buffer_minutes)));
    }
    if (req.body?.active !== undefined) service.active = Boolean(req.body.active);
    service.updated_at = new Date().toISOString();

    if (Array.isArray(req.body?.professional_ids)) {
      const targetIds = new Set(req.body.professional_ids.map(String));
      db.professional_services = db.professional_services.filter(
        (ps) => !(ps.business_id === businessId && ps.service_id === service.id),
      );
      for (const pro of db.professionals.filter((p) => p.business_id === businessId && targetIds.has(p.id))) {
        db.professional_services.push({
          id: crypto.randomUUID(),
          business_id: businessId,
          professional_id: pro.id,
          service_id: service.id,
          created_at: new Date().toISOString(),
        });
      }
    }

    saveDb(db);
    res.json({ service });
  });

  app.delete('/api/dashboard/services/:id', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const idx = db.services.findIndex((s) => s.id === req.params.id && s.business_id === businessId);
    if (idx === -1) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }
    db.services.splice(idx, 1);
    db.professional_services = db.professional_services.filter(
      (ps) => !(ps.business_id === businessId && ps.service_id === req.params.id),
    );
    saveDb(db);
    res.json({ ok: true });
  });

  // Professionals CRUD & Individual Hours
  app.get('/api/dashboard/professionals', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const professionals = db.professionals.filter((p) => p.business_id === businessId);
    const services = db.services.filter((s) => s.business_id === businessId);
    const links = db.professional_services.filter((ps) => ps.business_id === businessId);
    const hours = db.working_hours.filter(
      (wh) => wh.business_id === businessId && wh.professional_id !== null,
    );
    res.json({ professionals, services, links, hours });
  });

  app.post('/api/dashboard/professionals', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const photoUrl = sanitizeImageUrl(String(req.body?.photo_url ?? ''));
    const serviceIds: string[] = Array.isArray(req.body?.service_ids)
      ? req.body.service_ids.map(String)
      : [];

    if (name.length < 2) {
      res.status(400).json({ error: 'Informe o nome do profissional.' });
      return;
    }

    const now = new Date().toISOString();
    const pro = {
      id: crypto.randomUUID(),
      business_id: businessId,
      name,
      photo_url: photoUrl,
      description,
      active: true,
      created_at: now,
      updated_at: now,
    };
    db.professionals.push(pro);

    for (const svc of db.services.filter(
      (s) => s.business_id === businessId && (serviceIds.length === 0 || serviceIds.includes(s.id)),
    )) {
      db.professional_services.push({
        id: crypto.randomUUID(),
        business_id: businessId,
        professional_id: pro.id,
        service_id: svc.id,
        created_at: now,
      });
    }

    saveDb(db);
    res.status(201).json({ professional: pro });
  });

  app.put('/api/dashboard/professionals/:id', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const pro = db.professionals.find(
      (p) => p.id === req.params.id && p.business_id === businessId,
    );
    if (!pro) {
      res.status(404).json({ error: 'Profissional não encontrado.' });
      return;
    }
    if (req.body?.name !== undefined) pro.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) pro.description = String(req.body.description).trim();
    if (req.body?.photo_url !== undefined) pro.photo_url = sanitizeImageUrl(String(req.body.photo_url));
    if (req.body?.active !== undefined) pro.active = Boolean(req.body.active);
    pro.updated_at = new Date().toISOString();

    if (Array.isArray(req.body?.service_ids)) {
      const targetIds = new Set(req.body.service_ids.map(String));
      db.professional_services = db.professional_services.filter(
        (ps) => !(ps.business_id === businessId && ps.professional_id === pro.id),
      );
      for (const svc of db.services.filter((s) => s.business_id === businessId && targetIds.has(s.id))) {
        db.professional_services.push({
          id: crypto.randomUUID(),
          business_id: businessId,
          professional_id: pro.id,
          service_id: svc.id,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (Array.isArray(req.body?.hours) && req.body.hours.length === 7) {
      db.working_hours = db.working_hours.filter(
        (wh) => !(wh.business_id === businessId && wh.professional_id === pro.id),
      );
      for (const h of req.body.hours) {
        db.working_hours.push({
          id: crypto.randomUUID(),
          business_id: businessId,
          professional_id: pro.id,
          day_of_week: Number(h.day_of_week),
          start_time: String(h.start_time || '09:00'),
          end_time: String(h.end_time || '18:00'),
          is_closed: Boolean(h.is_closed),
        });
      }
    }

    saveDb(db);
    res.json({ professional: pro });
  });

  // Customers CRUD
  app.get('/api/dashboard/customers', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const customers = db.customers
      .filter((c) => c.business_id === businessId)
      .map((c) => {
        const count = db.appointments.filter(
          (a) => a.business_id === businessId && a.customer_id === c.id,
        ).length;
        return { ...c, appointments_count: count };
      });
    res.json({ customers });
  });

  app.post('/api/dashboard/customers', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const name = String(req.body?.name ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const notes = String(req.body?.notes ?? '').trim();
    if (name.length < 2 || phone.length < 8) {
      res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
      return;
    }
    const now = new Date().toISOString();
    const customer = {
      id: crypto.randomUUID(),
      business_id: businessId,
      name,
      phone,
      email,
      notes,
      consent_at: req.body?.consent ? now : null,
      created_at: now,
      updated_at: now,
    };
    db.customers.push(customer);
    saveDb(db);
    res.status(201).json({ customer });
  });

  app.put('/api/dashboard/customers/:id', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const customer = db.customers.find(
      (c) => c.id === req.params.id && c.business_id === businessId,
    );
    if (!customer) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }
    if (req.body?.name !== undefined) customer.name = String(req.body.name).trim();
    if (req.body?.phone !== undefined) customer.phone = String(req.body.phone).trim();
    if (req.body?.email !== undefined) customer.email = String(req.body.email).trim();
    if (req.body?.notes !== undefined) customer.notes = String(req.body.notes).trim();
    customer.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ customer });
  });

  // Schedule: Working Hours, Blocked Times, Exceptions
  app.get('/api/dashboard/schedule', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const business = db.businesses.find((b) => b.id === businessId)!;
    const workingHours = db.working_hours.filter(
      (w) => w.business_id === businessId && w.professional_id === null,
    );
    const blockedTimes = db.blocked_times
      .filter((b) => b.business_id === businessId)
      .map((b) => ({
        ...b,
        localStart: utcIsoToLocalParts(b.start_at, business.timezone),
        localEnd: utcIsoToLocalParts(b.end_at, business.timezone),
        professional_name: b.professional_id
          ? db.professionals.find((p) => p.id === b.professional_id)?.name ?? 'Profissional'
          : 'Todo o estabelecimento',
      }));
    const exceptions = db.business_date_exceptions.filter((e) => e.business_id === businessId);
    const professionals = db.professionals.filter((p) => p.business_id === businessId);

    res.json({ business, workingHours, blockedTimes, exceptions, professionals });
  });

  app.put('/api/dashboard/schedule/rules', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const biz = db.businesses.find((b) => b.id === businessId)!;
    if (req.body?.min_advance_minutes !== undefined) {
      biz.min_advance_minutes = Math.max(0, Math.min(4320, Number(req.body.min_advance_minutes)));
    }
    if (req.body?.max_future_days !== undefined) {
      biz.max_future_days = Math.max(1, Math.min(365, Number(req.body.max_future_days)));
    }
    biz.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ business: biz });
  });

  app.post('/api/dashboard/blocks', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const biz = db.businesses.find((b) => b.id === businessId)!;
    const professionalId = req.body?.professional_id ? String(req.body.professional_id) : null;
    const startAt = String(req.body?.start_at ?? '');
    const endAt = String(req.body?.end_at ?? '');
    const reason = String(req.body?.reason ?? 'Bloqueio de agenda').trim();

    if (professionalId && !db.professionals.some((p) => p.id === professionalId && p.business_id === businessId)) {
      res.status(400).json({ error: 'Profissional inválido.' });
      return;
    }
    if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt)) || new Date(endAt) <= new Date(startAt)) {
      res.status(400).json({ error: 'Intervalo de bloqueio inválido.' });
      return;
    }

    const block = {
      id: crypto.randomUUID(),
      business_id: businessId,
      professional_id: professionalId,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      reason,
      created_at: new Date().toISOString(),
    };
    db.blocked_times.push(block);
    saveDb(db);
    res.status(201).json({
      block: {
        ...block,
        localStart: utcIsoToLocalParts(block.start_at, biz.timezone),
        localEnd: utcIsoToLocalParts(block.end_at, biz.timezone),
      },
    });
  });

  app.delete('/api/dashboard/blocks/:id', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    db.blocked_times = db.blocked_times.filter(
      (b) => !(b.id === req.params.id && b.business_id === businessId),
    );
    saveDb(db);
    res.json({ ok: true });
  });

  app.post('/api/dashboard/exceptions', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const date = String(req.body?.date ?? '');
    const isClosed = Boolean(req.body?.is_closed);
    const startTime = String(req.body?.start_time ?? '09:00');
    const endTime = String(req.body?.end_time ?? '14:00');
    const note = String(req.body?.note ?? '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Data da exceção inválida.' });
      return;
    }
    db.business_date_exceptions = db.business_date_exceptions.filter(
      (e) => !(e.business_id === businessId && e.date === date),
    );
    const ex = {
      id: crypto.randomUUID(),
      business_id: businessId,
      date,
      is_closed: isClosed,
      start_time: startTime,
      end_time: endTime,
      note,
      created_at: new Date().toISOString(),
    };
    db.business_date_exceptions.push(ex);
    saveDb(db);
    res.status(201).json({ exception: ex });
  });

  app.delete('/api/dashboard/exceptions/:id', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    db.business_date_exceptions = db.business_date_exceptions.filter(
      (e) => !(e.id === req.params.id && e.business_id === businessId),
    );
    saveDb(db);
    res.json({ ok: true });
  });

  // Settings
  app.put('/api/dashboard/settings', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const biz = db.businesses.find((b) => b.id === businessId)!;

    if (req.body?.name !== undefined) biz.name = String(req.body.name).trim();
    if (req.body?.slug !== undefined) biz.slug = ensureUniqueSlug(String(req.body.slug), businessId);
    if (req.body?.segment !== undefined) biz.segment = String(req.body.segment).trim();
    if (req.body?.phone !== undefined) biz.phone = String(req.body.phone).trim();
    if (req.body?.address !== undefined) biz.address = String(req.body.address).trim();
    if (req.body?.description !== undefined) biz.description = String(req.body.description).trim();
    if (req.body?.logo_url !== undefined) biz.logo_url = sanitizeImageUrl(String(req.body.logo_url));
    if (req.body?.timezone !== undefined && isValidTimeZone(String(req.body.timezone))) {
      biz.timezone = String(req.body.timezone);
    }
    biz.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ business: biz });
  });

  // Reports
  app.get('/api/dashboard/reports', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const appts = db.appointments.filter((a) => a.business_id === businessId);
    const pros = db.professionals.filter((p) => p.business_id === businessId);

    const totalRevenueCents = appts
      .filter((a) => a.status === 'completed' || a.status === 'confirmed')
      .reduce((sum, a) => sum + a.price_cents_snapshot, 0);
    const completedCount = appts.filter((a) => a.status === 'completed').length;
    const cancelledCount = appts.filter((a) => a.status === 'cancelled').length;
    const noShowCount = appts.filter((a) => a.status === 'no_show').length;

    const byProfessional = pros.map((p) => {
      const pAppts = appts.filter((a) => a.professional_id === p.id && a.status !== 'cancelled');
      return {
        professional_id: p.id,
        name: p.name,
        bookings: pAppts.length,
        revenue_cents: pAppts.reduce((s, a) => s + a.price_cents_snapshot, 0),
      };
    });

    res.json({
      totalBookings: appts.length,
      totalRevenueCents,
      completedCount,
      cancelledCount,
      noShowCount,
      byProfessional,
    });
  });

  // Subscription management & support
  app.get('/api/dashboard/subscription', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const business = db.businesses.find((b) => b.id === businessId)!;
    const subscription = db.subscriptions.find((s) => s.business_id === businessId) ?? null;
    const payments = db.payments
      .filter((p) => p.business_id === businessId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ business, subscription, payments });
  });

  app.post('/api/dashboard/subscription/cancel', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const sub = db.subscriptions.find((s) => s.business_id === businessId);
    if (!sub) {
      res.status(404).json({ error: 'Assinatura não localizada.' });
      return;
    }
    sub.status = 'cancelled';
    sub.cancel_at_period_end = true;
    sub.updated_at = new Date().toISOString();

    addAuditLog(db, {
      business_id: businessId,
      actor_id: req.session!.userId,
      actor_email: req.session!.email,
      action: 'subscription.cancel_requested',
      target_type: 'subscription',
      target_id: sub.id,
      details: 'Cancelamento agendado para o fim do período já pago; dados preservados.',
    });
    saveDb(db);
    res.json({ subscription: sub });
  });

  app.post('/api/dashboard/subscription/reactivate', requireOwnerAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const businessId = req.session!.businessId!;
    const biz = db.businesses.find((b) => b.id === businessId);
    const sub = db.subscriptions.find((s) => s.business_id === businessId);
    if (!biz || !sub) {
      res.status(404).json({ error: 'Assinatura não localizada.' });
      return;
    }
    const now = new Date().toISOString();
    sub.status = 'authorized';
    sub.cancel_at_period_end = false;
    if (!sub.current_period_end || new Date(sub.current_period_end).getTime() < Date.now()) {
      sub.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    sub.updated_at = now;
    biz.status = 'active';
    biz.updated_at = now;

    addAuditLog(db, {
      business_id: businessId,
      actor_id: req.session!.userId,
      actor_email: req.session!.email,
      action: 'subscription.reactivated',
      target_type: 'subscription',
      target_id: sub.id,
      details: 'Assinatura recorrente reativada.',
    });
    saveDb(db);
    res.json({ subscription: sub, business: biz });
  });

  // -------------------------------------------------------------------------
  // Public Booking & Secure Cancellation (/api/public/*)
  // -------------------------------------------------------------------------
  app.get('/api/public/showcase', (_req, res) => {
    const db = loadDb();
    const items = db.businesses
      .filter((b) => b.status === 'active' && isBusinessPubliclyActive(db, b.id).allowed)
      .slice(0, 6)
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        segment: b.segment,
        address: b.address,
        logo_url: b.logo_url,
        servicesCount: db.services.filter((s) => s.business_id === b.id && s.active).length,
      }));
    res.json({ businesses: items });
  });

  app.get('/api/public/business/:slug', (req, res) => {
    const db = loadDb();
    const slug = String(req.params.slug ?? '').trim().toLowerCase();
    const business = db.businesses.find((b) => b.slug === slug && b.status !== 'deleted');
    if (!business) {
      res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      return;
    }

    const access = isBusinessPubliclyActive(db, business.id);
    const services = db.services.filter((s) => s.business_id === business.id && s.active);
    const professionals = db.professionals.filter((p) => p.business_id === business.id && p.active);
    const links = db.professional_services.filter((ps) => ps.business_id === business.id);
    const workingHours = db.working_hours.filter(
      (wh) => wh.business_id === business.id && wh.professional_id === null,
    );

    res.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        segment: business.segment,
        phone: business.phone,
        address: business.address,
        logo_url: business.logo_url,
        description: business.description,
        timezone: business.timezone,
        max_future_days: business.max_future_days,
        min_advance_minutes: business.min_advance_minutes,
      },
      bookingEnabled: access.allowed,
      bookingDisabledReason: access.reason ?? null,
      services,
      professionals,
      links,
      workingHours,
    });
  });

  app.get('/api/public/business/:slug/availability', (req, res) => {
    const db = loadDb();
    const slug = String(req.params.slug ?? '').trim().toLowerCase();
    const business = db.businesses.find((b) => b.slug === slug && b.status !== 'deleted');
    if (!business) {
      res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      return;
    }

    const access = isBusinessPubliclyActive(db, business.id);
    if (!access.allowed) {
      res.status(403).json({ error: access.reason || 'Agendamentos indisponíveis.', slots: [] });
      return;
    }

    const serviceId = String(req.query.serviceId ?? '');
    const professionalId = String(req.query.professionalId ?? '');
    const dateStr = String(req.query.date ?? '');

    const result = getAvailableSlots({
      state: db,
      businessId: business.id,
      serviceId,
      professionalId,
      dateStr,
    });

    if (result.error) {
      res.status(400).json({ error: result.error, slots: [] });
      return;
    }
    res.json({ slots: result.slots, timezone: business.timezone });
  });

  app.post('/api/public/business/:slug/bookings', async (req, res) => {
    const slug = String(req.params.slug ?? '').trim().toLowerCase();
    const preDb = loadDb();
    const biz = preDb.businesses.find((b) => b.slug === slug && b.status !== 'deleted');
    if (!biz) {
      res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      return;
    }

    const serviceId = String(req.body?.service_id ?? '');
    const professionalId = String(req.body?.professional_id ?? '');
    const dateStr = String(req.body?.date ?? '');
    const startTimeStr = String(req.body?.start_time ?? '');
    const customerName = String(req.body?.customer_name ?? '').trim();
    const customerPhone = String(req.body?.customer_phone ?? '').trim();
    const customerEmail = String(req.body?.customer_email ?? '').trim();
    const notes = String(req.body?.notes ?? '').trim();
    const consent = Boolean(req.body?.consent);

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Informe seu nome completo.' });
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ error: 'Informe um telefone/WhatsApp válido com DDD.' });
      return;
    }
    if (customerEmail && !isValidEmail(customerEmail)) {
      res.status(400).json({ error: 'E-mail inválido.' });
      return;
    }
    if (!consent) {
      res.status(400).json({ error: 'Confirme o consentimento para registrar seu agendamento.' });
      return;
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
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ booking: result.booking });
  });

  app.get('/api/public/cancel/:token', (req, res) => {
    const db = loadDb();
    const token = String(req.params.token ?? '').trim();
    const appt = db.appointments.find((a) => a.cancel_token === token);
    if (!appt) {
      res.status(404).json({ error: 'Link de cancelamento inválido ou não encontrado.' });
      return;
    }
    const biz = db.businesses.find((b) => b.id === appt.business_id)!;
    const pro = db.professionals.find((p) => p.id === appt.professional_id);
    const customer = db.customers.find((c) => c.id === appt.customer_id);

    res.json({
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
  });

  app.post('/api/public/cancel/:token', (req, res) => {
    const db = loadDb();
    const token = String(req.params.token ?? '').trim();
    const reason = String(req.body?.reason ?? 'Cancelado pelo cliente via link seguro').trim();
    const appt = db.appointments.find((a) => a.cancel_token === token);
    if (!appt) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    if (appt.status === 'cancelled') {
      res.json({ ok: true, status: appt.status, message: 'Este agendamento já estava cancelado.' });
      return;
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
    res.json({ ok: true, status: appt.status, message: 'Agendamento cancelado com sucesso.' });
  });

  // -------------------------------------------------------------------------
  // Superadmin Console (/api/admin/*) — Server-enforced
  // -------------------------------------------------------------------------
  app.get('/api/admin/overview', requireSuperadminAuth, (_req, res) => {
    const db = loadDb();
    const businesses = db.businesses.filter((b) => b.status !== 'deleted');
    const subscriptions = db.subscriptions;
    const payments = [...db.payments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const activeSubs = subscriptions.filter((s) => s.status === 'authorized');
    const mrrCents = activeSubs.reduce((sum, s) => sum + s.price_cents, 0);
    const totalRevenueCents = payments
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount_cents, 0);

    res.json({
      metrics: {
        totalBusinesses: businesses.length,
        activeBusinesses: businesses.filter((b) => b.status === 'active').length,
        onboardingBusinesses: businesses.filter((b) => b.status === 'onboarding').length,
        suspendedBusinesses: businesses.filter((b) => b.status === 'suspended').length,
        mrrCents,
        totalRevenueCents,
        totalAppointments: db.appointments.length,
      },
      businesses: businesses.map((b) => ({
        ...b,
        subscription: subscriptions.find((s) => s.business_id === b.id) ?? null,
        appointmentsCount: db.appointments.filter((a) => a.business_id === b.id).length,
      })),
      payments: payments.map((p) => ({
        ...p,
        business_name: businesses.find((b) => b.id === p.business_id)?.name ?? 'Estabelecimento',
      })),
      webhookEvents: db.webhook_events.slice(0, 50),
      auditLogs: db.audit_logs.slice(0, 80),
    });
  });

  app.patch('/api/admin/businesses/:id/status', requireSuperadminAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      return;
    }
    const status = String(req.body?.status ?? '') as BusinessStatus;
    if (!['active', 'suspended', 'onboarding'].includes(status)) {
      res.status(400).json({ error: 'Status inválido.' });
      return;
    }
    biz.status = status;
    biz.updated_at = new Date().toISOString();

    addAuditLog(db, {
      business_id: biz.id,
      actor_id: req.session!.userId,
      actor_email: req.session!.email,
      action: `superadmin.business_${status}`,
      target_type: 'business',
      target_id: biz.id,
      details: `Estado alterado manualmente para "${status}" pelo Superadmin.`,
    });
    saveDb(db);
    res.json({ business: biz });
  });

  app.post('/api/admin/webhooks/simulate', requireSuperadminAuth, (req, res) => {
    const businessId = String(req.body?.business_id ?? '');
    const subscriptionId = String(req.body?.subscription_id ?? '');
    const eventId = String(req.body?.event_id ?? `evt_sim_${crypto.randomBytes(4).toString('hex')}`);
    const status = (req.body?.status ?? 'approved') as 'approved' | 'rejected' | 'cancelled';

    const result = processMercadoPagoWebhook({
      eventId,
      eventType: 'subscription_preapproval.updated',
      businessId,
      subscriptionId,
      paymentStatus: status,
    });
    if (!result.ok) {
      res.status(404).json({ error: result.message });
      return;
    }
    res.json(result);
  });

  // -------------------------------------------------------------------------
  // Vite / Static Frontend Serving + SPA Fallback
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Prevent @vite/client from opening failing HMR WebSocket connections in proxied preview
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build não encontrado.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgendaFlat rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar AgendaFlat:', err);
  process.exit(1);
});
