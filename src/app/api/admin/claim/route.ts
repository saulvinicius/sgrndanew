import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { isValidEmail } from '@/src/lib/server/auth';
import { hashPassword, signSessionToken } from '@/src/lib/server/security';
import { addAuditLog, loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const db = loadDb();
  if (process.env.ADMIN_PASSCODE?.trim() || db.platform_admins.length > 0) {
    return NextResponse.json(
      { error: 'Acesso administrativo já foi configurado neste ambiente.' },
      { status: 403 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? 'Administrador').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!isValidEmail(email) || password.length < 8) {
    return NextResponse.json(
      { error: 'Informe um e-mail válido e senha com no mínimo 8 caracteres.' },
      { status: 400 },
    );
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
  return NextResponse.json(
    {
      token,
      user: { id: adminId, name, email, role: 'superadmin' },
    },
    { status: 201 },
  );
}
