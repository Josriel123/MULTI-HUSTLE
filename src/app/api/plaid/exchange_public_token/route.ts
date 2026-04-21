import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
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

    const { public_token } = await req.json();

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Save accessToken to the database mapped to this userId
    // Upsert to handle multiple handshakes gracefully in development
    await prisma.plaidConnection.create({
      data: {
        userId,
        accessToken,
        itemId
      }
    });

    return NextResponse.json({ success: true, message: 'Bank linked successfully!' });
  } catch (error: any) {
    console.error('Error exchanging public token:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
