import { NextResponse } from 'next/server';
import { loadDb } from '@/src/lib/server/store';

export async function GET() {
  const db = loadDb();
  return NextResponse.json({
    status: 'ok',
    service: 'agendaflat',
    framework: 'nextjs-app-router',
    businesses: db.businesses.length,
    timestamp: new Date().toISOString(),
  });
}
