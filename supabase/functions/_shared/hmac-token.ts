// Pure Web Crypto HMAC-SHA256 token for Billing Portal redirect links.
// Runs in Deno (Edge Functions) and browser — no external deps.

export interface BillingPortalTokenPayload {
  userId: string;
  stripeCustomerId: string;
  expiresAt: number; // Unix timestamp in seconds
}

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(padded);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

async function hmacVerify(message: string, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(message, secret);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

export async function signBillingPortalToken(
  userId: string,
  stripeCustomerId: string,
  expiresAt: number,
  secret: string,
): Promise<string> {
  const payloadB64 = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ userId, stripeCustomerId, expiresAt })),
  );
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function verifyBillingPortalToken(
  token: string,
  secret: string,
): Promise<BillingPortalTokenPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;

  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  if (!(await hmacVerify(payloadB64, sig, secret))) return null;

  const payloadBytes = b64urlDecode(payloadB64);
  if (!payloadBytes) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).userId !== 'string' ||
    typeof (parsed as Record<string, unknown>).stripeCustomerId !== 'string' ||
    typeof (parsed as Record<string, unknown>).expiresAt !== 'number'
  ) {
    return null;
  }

  const payload = parsed as BillingPortalTokenPayload;
  if (payload.expiresAt < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
