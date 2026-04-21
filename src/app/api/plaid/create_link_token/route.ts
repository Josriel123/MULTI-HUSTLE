import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { auth } from '@clerk/nextjs/server';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Always use sandbox for development
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const createTokenResponse = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'Multi-Hustle FinOS',
      products: ['auth', 'transactions'] as any,
      country_codes: ['US'] as any,
      language: 'en',
    });

    return NextResponse.json(createTokenResponse.data);
  } catch (error: any) {
    console.error('Error generating Plaid Link Token:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to generate link token' }, { status: 500 });
  }
}
