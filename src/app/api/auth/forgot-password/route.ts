import { NextResponse } from 'next/server';
import { isValidEmail } from '@/src/lib/server/auth';
import { generateSecureToken } from '@/src/lib/server/security';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
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
    if (process.env.NODE_ENV !== 'production') {
      previewResetToken = resetToken;
    }
  }

  return NextResponse.json({
    message: 'Se este e-mail estiver cadastrado, enviamos as instruções para redefinir sua senha.',
    previewResetToken,
  });
}
