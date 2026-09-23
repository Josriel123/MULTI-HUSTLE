import { NextResponse } from 'next/server';
import { agreementStatus, parseAgreementInput } from '@/lib/agreement';
import { LEGAL } from '@/lib/legal';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';

/**
 * POST /api/account/agreement  { agreementVersion, agree: true, adult: true }
 *
 * Records the clickwrap: which version of the Terms and Privacy Policy the
 * user agreed to, when, and when they confirmed they are 18 or older. The
 * server stamps the time; the body only says which version was on screen, and
 * a stale version is refused so nobody agrees to text they did not see.
 */
export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  const parsed = parseAgreementInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  try {
    const now = new Date();
    const user = await prisma.user.update({
      where: { id: userId },
      data: { agreementVersion: LEGAL.agreementVersion, agreementAcceptedAt: now, adultConfirmedAt: now },
      select: { agreementVersion: true, agreementAcceptedAt: true, adultConfirmedAt: true },
    });
    return NextResponse.json({ agreement: agreementStatus(user) });
  } catch (error) {
    console.error('Failed to record agreement:', error);
    return NextResponse.json({ error: 'Failed to record your agreement' }, { status: 500 });
  }
}
