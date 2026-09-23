import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exportUserData } from '@/lib/userData';

/**
 * GET /api/account/export: everything the app stores about the signed-in
 * user, as a JSON file download (the right to access and to take your data
 * elsewhere). Only ever the caller's own rows.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await exportUserData(userId);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="multi-hustle-data-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to export account data:', error);
    return NextResponse.json({ error: 'Failed to prepare your data' }, { status: 500 });
  }
}
