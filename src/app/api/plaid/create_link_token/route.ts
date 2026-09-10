import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { auth } from '@clerk/nextjs/server';
import { plaidClient, describePlaidError } from '@/lib/plaid';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const createTokenResponse = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Multi-Hustle FinOS',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json(createTokenResponse.data);
  } catch (error) {
    console.error('Error generating Plaid Link Token:', describePlaidError(error));
    return NextResponse.json({ error: 'Failed to generate link token' }, { status: 500 });
  }
}
