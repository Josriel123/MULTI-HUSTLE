'use client';

import { useSyncExternalStore } from 'react';

/**
 * The device's memory of an "I'm under 18" answer. The account itself is
 * deleted on the server as soon as the answer is given (AgreementGate); this
 * only stops the same device from going straight back to sign up with a
 * different answer, which the FTC's COPPA guidance asks an age screen to
 * prevent. Listed in the Cookie Policy.
 */
export const UNDERAGE_KEY = 'multi-hustle:underage';

export function readUnderage(): boolean {
  try {
    return window.localStorage.getItem(UNDERAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberUnderage() {
  try {
    window.localStorage.setItem(UNDERAGE_KEY, '1');
  } catch {
    // Storage blocked: the account is still deleted; only the device forgets.
  }
}

const noSubscription = () => () => {};

/** False on the server and while hydrating, then the device's answer. */
export function useUnderage(): boolean {
  return useSyncExternalStore(noSubscription, readUnderage, () => false);
}
