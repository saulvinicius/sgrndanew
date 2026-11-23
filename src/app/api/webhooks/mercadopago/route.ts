import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { processMercadoPagoWebhook } from '@/src/lib/server/auth';

export async function POST(req: Request) {
  const rawBody = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const signature = String(req.headers.get('x-signature') ?? '');
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return NextResponse.json(
        { error: 'Assinatura do webhook Mercado Pago inválida.' },
        { status: 401 },
      );
    }
  }

  const eventId = String(body.event_id ?? body.id ?? '').trim();
  const eventType = String(body.type ?? 'subscription_preapproval').trim();
  const businessId = String(body.business_id ?? '').trim();
  const subscriptionId = String(body.subscription_id ?? '').trim();
  const paymentStatus = (body.status ?? 'approved') as 'approved' | 'rejected' | 'cancelled';

  if (!eventId || !businessId || !subscriptionId) {
    return NextResponse.json({ error: 'Payload de webhook incompleto.' }, { status: 400 });
  }

  const result = processMercadoPagoWebhook({
    eventId,
    eventType,
    businessId,
    subscriptionId,
    paymentStatus,
    providerPaymentId: body.provider_payment_id ? String(body.provider_payment_id) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }
  return NextResponse.json(result);
}
