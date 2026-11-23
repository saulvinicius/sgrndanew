import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { signSessionToken, verifyPassword } from '@/src/lib/server/security';
import { loadDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
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
      return NextResponse.json({
        token,
        user: {
          id: 'env-superadmin',
          name: 'Superadmin AgendaFlat',
          email: email || 'superadmin@agendaflat.com.br',
          role: 'superadmin',
        },
      });
    }
    return NextResponse.json(
      { error: 'Código de acesso administrativo incorreto.' },
      { status: 401 },
    );
  }

  const db = loadDb();
  const adminProfile = db.profiles.find((p) => p.email === email && p.role === 'superadmin');
  if (
    !adminProfile ||
    !db.platform_admins.some((a) => a.user_id === adminProfile.id) ||
    !verifyPassword(password, adminProfile.password_hash)
  ) {
    return NextResponse.json({ error: 'Credenciais de Superadmin inválidas.' }, { status: 401 });
  }

  const token = signSessionToken({
    userId: adminProfile.id,
    email: adminProfile.email,
    role: 'superadmin',
    businessId: null,
  });
  return NextResponse.json({
    token,
    user: {
      id: adminProfile.id,
      name: adminProfile.name,
      email: adminProfile.email,
      role: 'superadmin',
    },
  });
}
