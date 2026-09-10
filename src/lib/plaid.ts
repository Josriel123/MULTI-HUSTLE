import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

/**
 * Single shared Plaid client.
 *
 * Previously each of the three Plaid routes built its own client and hardcoded
 * `PlaidEnvironments.sandbox`, so PLAID_ENV was read from .env but never used.
 * This honours it — while still defaulting to sandbox, since this project is
 * scoped to sandbox only (see PLAN.md).
 */

const env = (process.env.PLAID_ENV ?? 'sandbox') as keyof typeof PlaidEnvironments;

if (!(env in PlaidEnvironments)) {
  throw new Error(
    `PLAID_ENV="${env}" is not a valid Plaid environment. ` +
      `Expected one of: ${Object.keys(PlaidEnvironments).join(', ')}`
  );
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
export const plaidEnv = env;

/**
 * Plaid errors carry the useful detail on `error.response.data`; `error.message`
 * is usually just "Request failed with status code 400". Use this for logs.
 * Never return the result to the client — it can contain request identifiers.
 */
export function describePlaidError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const res = (error as { response?: { data?: unknown } }).response;
    if (res?.data) return JSON.stringify(res.data);
  }
  return error instanceof Error ? error.message : String(error);
}
