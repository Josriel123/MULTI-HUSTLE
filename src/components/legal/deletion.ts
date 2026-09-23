/**
 * Where to land after an account is deleted. When Plaid did not confirm that
 * it stopped sharing a bank, the welcome page says so and points to
 * my.plaid.com instead of claiming everything is done (Privacy Policy,
 * "Who we share it with").
 */
export function afterDeletionUrl(result: { bankRevocationErrors: number }, reason: 'deleted' | 'underage' = 'deleted'): string {
  const params = new URLSearchParams({ [reason]: '1' });
  if (result.bankRevocationErrors > 0) params.set('plaid', 'check');
  return `/welcome?${params.toString()}`;
}
