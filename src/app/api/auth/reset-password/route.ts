import { NextResponse } from 'next/server';
import { hashPassword } from '@/src/lib/server/security';
import { loadDb, saveDb } from '@/src/lib/server/store';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.token ?? '').trim();
  const newPassword = String(body.password ?? '');
  if (!token || newPassword.length < 6) {
    return NextResponse.json(
      { error: 'Token inválido ou nova senha menor que 6 caracteres.' },
      { status: 400 },
    );
  }
  const db = loadDb();
  const record = db.password_resets.find(
    (r) => r.token === token && !r.used && new Date(r.expires_at).getTime() > Date.now(),
  );
  if (!record) {
    return NextResponse.json(
      { error: 'Token de recuperação inválido ou expirado.' },
      { status: 400 },
    );
  }
  const user = db.profiles.find((p) => p.id === record.user_id);
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }
  user.password_hash = hashPassword(newPassword);
  user.updated_at = new Date().toISOString();
  record.used = true;
  saveDb(db);
  return NextResponse.json({ message: 'Senha atualizada com sucesso. Você já pode entrar.' });
}
