import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { parseW2Input } from '@/lib/formInput';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';
import { serializeW2 } from './serialize';

/**
 * W-2s for a tax year. A person with two jobs has two; on a joint return the
 * spouse's are entered too, marked `ownedByTaxpayer: false`. The adapter
 * decides which boxes count where (src/lib/tax/adapters/prismaRows.ts).
 *
 * GET  /api/w2?taxYear=YYYY   { taxYear, forms }
 * POST /api/w2                one form; `taxYear` in the body or query
 */

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

  try {
    const forms = await prisma.w2Form.findMany({
      where: { userId, taxYear: resolved.taxYear },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ taxYear: resolved.taxYear, forms: forms.map(serializeW2), warnings: resolved.warnings });
  } catch (error) {
    console.error('Failed to read W-2s:', error);
    return NextResponse.json({ error: 'Failed to read W-2s' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  const resolved = resolveTaxYearFromRequest(request.nextUrl.searchParams.get('taxYear'), body?.taxYear);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const parsed = parseW2Input(body ?? {}, resolved.taxYear);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const form = await prisma.w2Form.create({ data: { userId, taxYear: resolved.taxYear, ...parsed.values } });
    return NextResponse.json(serializeW2(form), { status: 201 });
  } catch (error) {
    console.error('Failed to save W-2:', error);
    return NextResponse.json({ error: 'Failed to save W-2' }, { status: 500 });
  }
}
