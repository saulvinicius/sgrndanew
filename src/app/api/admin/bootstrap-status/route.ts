import { NextResponse } from 'next/server';
import { loadDb } from '@/src/lib/server/store';

export async function GET() {
  const db = loadDb();
  const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE?.trim());
  const claimed = db.platform_admins.length > 0;
  return NextResponse.json({
    requiresClaim: !envPasscodeSet && !claimed,
    envPasscodeSet,
  });
}
