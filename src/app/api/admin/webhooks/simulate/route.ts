import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { processMercadoPagoWebhook, requireSuperadminAuth } from '@/src/lib/server/auth';

export async function POST(req: Request) {
  const auth = requireSuperadminAuth(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const businessId = String(body.business_id ?? '');
  const subscriptionId = String(body.subscription_id ?? '');
  const eventId = String(body.event_id ?? `evt_sim_${crypto.randomBytes(4).toString('hex')}`);
  const status = (body.status ?? 'approved') as 'approved' | 'rejected' | 'cancelled';

  const result = processMercadoPagoWebhook({
    eventId,
    eventType: 'subscription_preapproval.updated',
    businessId,
    subscriptionId,
    paymentStatus: status,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }
  return NextResponse.json(result);
}
