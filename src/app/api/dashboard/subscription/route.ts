import { NextResponse } from 'next/server';
import { requireOwnerAuth } from '@/src/lib/server/auth';
import { loadDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const auth = requireOwnerAuth(req);
  if (!auth.ok) return auth.response;

  const db = loadDb();
  const businessId = auth.session.businessId!;
  const business = db.businesses.find((b) => b.id === businessId)!;
  const subscription = db.subscriptions.find((s) => s.business_id === businessId) ?? null;
  const payments = db.payments
    .filter((p) => p.business_id === businessId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ business, subscription, payments });
}
