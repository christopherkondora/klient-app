import { describe, it, expect, vi } from 'vitest';
import { handleBillingPortalRequest, type BillingPortalDeps } from './handler.ts';
import { signBillingPortalToken } from '../_shared/hmac-token.ts';

const SECRET = 'test-secret-32-bytes-long-padding!';
const USER_ID = 'user-uuid-1234';
const CUSTOMER_ID = 'cus_stripe123';
const PORTAL_URL = 'https://billing.stripe.com/session/test_abc';

function futureTs() {
  return Math.floor(Date.now() / 1000) + 3600;
}

function pastTs() {
  return Math.floor(Date.now() / 1000) - 1;
}

function makeDeps(overrides: Partial<BillingPortalDeps> = {}): BillingPortalDeps {
  return {
    billingPortalTokenSecret: SECRET,
    validateBearerJwt: vi.fn().mockResolvedValue(USER_ID),
    getStripeCustomerId: vi.fn().mockResolvedValue(CUSTOMER_ID),
    createStripePortalSession: vi.fn().mockResolvedValue(PORTAL_URL),
    ...overrides,
  };
}

describe('handleBillingPortalRequest — Bearer JWT path', () => {
  it('valid Supabase session → calls Stripe Portal API → returns { url }', async () => {
    const deps = makeDeps();
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { authorization: 'Bearer valid_jwt_token' },
    });

    const res = await handleBillingPortalRequest(req, deps);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe(PORTAL_URL);
    expect(deps.validateBearerJwt).toHaveBeenCalledWith('Bearer valid_jwt_token');
    expect(deps.getStripeCustomerId).toHaveBeenCalledWith(USER_ID);
    expect(deps.createStripePortalSession).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it('invalid Bearer JWT (validateBearerJwt returns null) → 401', async () => {
    const deps = makeDeps({ validateBearerJwt: vi.fn().mockResolvedValue(null) });
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { authorization: 'Bearer bad_jwt' },
    });

    const res = await handleBillingPortalRequest(req, deps);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeTruthy();
    expect(deps.createStripePortalSession).not.toHaveBeenCalled();
  });

  it('user has no Stripe customer profile → 404', async () => {
    const deps = makeDeps({ getStripeCustomerId: vi.fn().mockResolvedValue(null) });
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { authorization: 'Bearer valid_jwt' },
    });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBe(404);
    expect(deps.createStripePortalSession).not.toHaveBeenCalled();
  });

  it('Stripe portal session creation fails → 500', async () => {
    const deps = makeDeps({ createStripePortalSession: vi.fn().mockResolvedValue(null) });
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { authorization: 'Bearer valid_jwt' },
    });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBe(500);
  });
});

describe('handleBillingPortalRequest — HMAC token path', () => {
  it('valid, non-expired token → calls Stripe Portal API → returns { url }', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    const deps = makeDeps();
    const req = new Request(`https://example.com/?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });

    const res = await handleBillingPortalRequest(req, deps);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe(PORTAL_URL);
    // Bearer-only deps must not have been used
    expect(deps.validateBearerJwt).not.toHaveBeenCalled();
    expect(deps.getStripeCustomerId).not.toHaveBeenCalled();
    expect(deps.createStripePortalSession).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it('expired token → 401 with a human-readable error', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, pastTs(), SECRET);
    const deps = makeDeps();
    const req = new Request(`https://example.com/?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });

    const res = await handleBillingPortalRequest(req, deps);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/lejárt|érvénytelen/);
    expect(deps.createStripePortalSession).not.toHaveBeenCalled();
  });

  it('tampered token → 401', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    const deps = makeDeps();
    const req = new Request(`https://example.com/?token=${encodeURIComponent(tampered)}`, {
      method: 'POST',
    });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBe(401);
    expect(deps.createStripePortalSession).not.toHaveBeenCalled();
  });

  it('token path with no signing secret configured → 500', async () => {
    const token = await signBillingPortalToken(USER_ID, CUSTOMER_ID, futureTs(), SECRET);
    const deps = makeDeps({ billingPortalTokenSecret: '' });
    const req = new Request(`https://example.com/?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBe(500);
  });
});

describe('handleBillingPortalRequest — boundary cases', () => {
  it('no token query param and no Authorization header → 400', async () => {
    const deps = makeDeps();
    const req = new Request('https://example.com/', { method: 'POST' });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBe(400);
    expect(deps.createStripePortalSession).not.toHaveBeenCalled();
  });

  it('OPTIONS preflight → 200/204 with CORS headers', async () => {
    const deps = makeDeps();
    const req = new Request('https://example.com/', { method: 'OPTIONS' });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('non-POST method → 405', async () => {
    const deps = makeDeps();
    const req = new Request('https://example.com/', { method: 'GET' });

    const res = await handleBillingPortalRequest(req, deps);
    expect(res.status).toBe(405);
  });
});
