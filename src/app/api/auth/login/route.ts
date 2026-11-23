import { NextResponse } from 'next/server';
import { signSessionToken, verifyPassword } from '@/src/lib/server/security';
import { loadDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 });
  }

  const db = loadDb();
  const user = db.profiles.find((p) => p.email === email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
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

  return NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    business,
  });
}
