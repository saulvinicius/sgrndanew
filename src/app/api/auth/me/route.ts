import { NextResponse } from 'next/server';
import { getBearerToken } from '@/src/lib/server/auth';
import { verifySessionToken } from '@/src/lib/server/security';
import { loadDb } from '@/src/lib/server/store';

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }
  const db = loadDb();
  if (session.role === 'superadmin') {
    return NextResponse.json({
      user: {
        id: session.userId,
        name: 'Administrador AgendaFlat',
        email: session.email,
        role: 'superadmin',
      },
      business: null,
    });
  }
  const user = db.profiles.find((p) => p.id === session.userId);
  const business = session.businessId
    ? db.businesses.find((b) => b.id === session.businessId) ?? null
    : null;
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    business,
  });
}
