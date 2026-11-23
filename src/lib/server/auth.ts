import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifySessionToken } from './security';
import type { SessionPayload } from './security';
import { addAuditLog, loadDb, saveDb } from './store';

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function requireOwnerAuth(
  req: Request,
): { ok: true; session: SessionPayload } | { ok: false; response: NextResponse } {
  const token = getBearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sessão não informada. Faça login para continuar.' },
        { status: 401 },
      ),
    };
  }
  const session = verifySessionToken(token);
  if (!session || !session.businessId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 }),
    };
  }
  const db = loadDb();
  const membership = db.business_members.find(
    (m) => m.business_id === session.businessId && m.user_id === session.userId,
  );
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sem permissão para acessar este estabelecimento.' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}

export function requireSuperadminAuth(
  req: Request,
): { ok: true; session: SessionPayload } | { ok: false; response: NextResponse } {
  const token = getBearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Autenticação administrativa necessária.' },
        { status: 401 },
      ),
    };
  }
  const session = verifySessionToken(token);
  if (!session || session.role !== 'superadmin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Acesso restrito a administradores da plataforma.' },
        { status: 403 },
      ),
    };
  }
  const db = loadDb();
  const isEnvAdmin =
    session.userId === 'env-superadmin' && Boolean(process.env.ADMIN_PASSCODE?.trim());
  const isListedAdmin = db.platform_admins.some((a) => a.user_id === session.userId);
  if (!isEnvAdmin && !isListedAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Administrador não autorizado no servidor.' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function processMercadoPagoWebhook(params: {
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
    return {
      duplicate: true,
      ok: true,
      message: 'Evento já processado anteriormente (idempotente).',
    };
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
      provider_payment_id:
        params.providerPaymentId || `mp_pay_${crypto.randomBytes(5).toString('hex')}`,
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
      provider_payment_id:
        params.providerPaymentId || `mp_pay_${crypto.randomBytes(5).toString('hex')}`,
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
