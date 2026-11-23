import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const biz = db.businesses.find((b) => b.id === businessId);
  const sub = db.subscriptions.find((s) => s.business_id === businessId);
  if (!biz || !sub) {
    return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 404 });
  }

  const servicesCount = db.services.filter((s) => s.business_id === businessId && s.active).length;
  if (servicesCount === 0) {
    return NextResponse.json(
      { error: 'Cadastre ao menos 1 serviço antes de ativar a assinatura.' },
      { status: 400 },
    );
  }

  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (mpToken) {
    try {
      const origin = new URL(req.url).origin;
      const appUrl = process.env.APP_URL || origin;
      const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: `AgendaFlat — ${biz.name}`,
          external_reference: `${biz.id}:${sub.id}`,
          payer_email: auth.session.email,
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
        return NextResponse.json({
          mode: 'mercadopago_live',
          externalId: mpData.id,
          initPoint: mpData.init_point,
          subscription: sub,
        });
      }
      return NextResponse.json(
        { error: mpData.message || 'Falha ao criar assinatura no Mercado Pago.' },
        { status: 502 },
      );
    } catch {
      return NextResponse.json(
        { error: 'Erro ao conectar ao gateway Mercado Pago.' },
        { status: 502 },
      );
    }
  }

  const externalId = sub.external_id || `mp_pre_${crypto.randomBytes(6).toString('hex')}`;
  sub.external_id = externalId;
  sub.updated_at = new Date().toISOString();
  saveDb(db);

  return NextResponse.json({
    mode: 'sandbox_preview',
    externalId,
    subscription: sub,
    businessId: biz.id,
    amountCents: 1990,
  });
}
