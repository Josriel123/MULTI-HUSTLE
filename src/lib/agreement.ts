import { LEGAL } from './legal';

/**
 * Whether a user still has to agree before using the app: they never have,
 * they agreed to an older version of the Terms and Privacy Policy, or they have
 * not confirmed they are 18 or older. Pure, so the gate's rule is testable.
 */
export function agreementStatus(user: { agreementVersion: string | null; agreementAcceptedAt: Date | null; adultConfirmedAt: Date | null } | null) {
  const acceptedVersion = user?.agreementVersion ?? null;
  return {
    currentVersion: LEGAL.agreementVersion,
    acceptedVersion,
    acceptedAt: user?.agreementAcceptedAt?.toISOString() ?? null,
    adultConfirmedAt: user?.adultConfirmedAt?.toISOString() ?? null,
    needsAgreement: acceptedVersion !== LEGAL.agreementVersion || !user?.agreementAcceptedAt || !user?.adultConfirmedAt,
  };
}

export type AgreementStatus = ReturnType<typeof agreementStatus>;

export type ParsedAgreement = { ok: true } | { ok: false; status: number; error: string };

/**
 * An acceptance is valid only if the person ticked both boxes themselves, for
 * the version on screen. A body with anything but literal `true` is refused:
 * no default, no truthy strings, no silent upgrade to a newer version.
 */
export function parseAgreementInput(body: unknown): ParsedAgreement {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.agreementVersion !== LEGAL.agreementVersion) {
    return { ok: false, status: 409, error: 'The Terms or Privacy Policy changed while this page was open. Reload the page and read the current version.' };
  }
  if (b.agree !== true) return { ok: false, status: 400, error: 'Agree to the Terms of Service and Privacy Policy to continue.' };
  if (b.adult !== true) return { ok: false, status: 400, error: `You must be ${LEGAL.minimumAge} or older to use ${LEGAL.appName}.` };
  return { ok: true };
}
