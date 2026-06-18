import { describe, it, expect } from 'vitest';
import { signBillingPortalToken, verifyBillingPortalToken } from './hmac-token';

const SECRET = 'test-secret-32-bytes-long-padding!';
const USER_ID = 'user-uuid-1234';
const CUSTOMER_ID = 'cus_stripe123';

function futureTs(offsetSeconds = 3600) {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

function pastTs() {
  return Math.floor(Date.now() / 1000) - 1;
}

describe('signBillingPortalToken', () => {
  it('returns a non-empty string with a dot separator', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(token.includes('.')).toBe(true);
  });
});

describe('verifyBillingPortalToken', () => {
  it('round-trip: verify returns original payload for a valid token', async () => {
    const expiresAt = futureTs();
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, expiresAt, SECRET);
    const result = await verifyBillingPortalToken(token, SECRET);

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(USER_ID);
    expect(result!.stripeCustomerId).toBe(CUSTOMER_ID);
    expect(result!.expiresAt).toBe(expiresAt);
  });

  it('returns null for a token with a tampered signature', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    const result = await verifyBillingPortalToken(tampered, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a token with a tampered payload', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    const [, sig] = token.split('.');
    const fakePayload = btoa(JSON.stringify({ userId: 'hacker', stripeCustomerId: 'cus_evil', expiresAt: futureTs() }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const tampered = `${fakePayload}.${sig}`;
    const result = await verifyBillingPortalToken(tampered, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, pastTs(), SECRET);
    const result = await verifyBillingPortalToken(token, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a malformed (non-base64url) token', async () => {
    const result = await verifyBillingPortalToken('not-a-valid-token!!!', SECRET);
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifyBillingPortalToken('', SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a token with no dot separator', async () => {
    const result = await verifyBillingPortalToken('justapayload', SECRET);
    expect(result).toBeNull();
  });

  it('returns null when verified with a different secret', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    const result = await verifyBillingPortalToken(token, 'wrong-secret');
    expect(result).toBeNull();
  });
});
