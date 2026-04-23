/**
 * Native Google Sign-In for Klient Desktop
 *
 * Uses PKCE + loopback redirect (Desktop app OAuth flow).
 * The id_token is passed to Supabase signInWithIdToken — no Supabase
 * redirect proxy, so the Google consent screen shows "Klient" + klient.work.
 *
 * Setup:
 *   1. Google Cloud Console → Credentials → OAuth 2.0 Client ID (Desktop app type)
 *   2. Supabase Dashboard → Authentication → Google provider → paste Client ID + Secret
 *   3. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET below (or in env)
 */

import { BrowserWindow } from 'electron';
import http from 'http';
import crypto from 'crypto';
import { net } from 'electron';

// ── Credentials ─────────────────────────────────────────────────────────────
// Desktop app OAuth credentials (not truly secret — Google allows embedding them)
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '1053047814117-h48plrm8fvler7j5d43evf1l56v3ip1r.apps.googleusercontent.com';

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ||
  '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';

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ── Token types ───────────────────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ── Result page HTML ──────────────────────────────────────────────────────────

function resultPage(success: boolean): string {
  const title = success ? 'Sikeres bejelentkezés' : 'Hiba történt';
  const msg = success
    ? 'Sikeresen bejelentkeztél a Google fiókoddal. Ez az ablak automatikusan bezárul.'
    : 'A bejelentkezés nem sikerült. Zárd be ezt az ablakot és próbáld újra.';
  return `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#01161E;color:#598392;display:flex;align-items:center;
       justify-content:center;min-height:100vh;margin:0}
  .card{background:#0C2230;border:1px solid rgba(18,69,89,.3);border-radius:16px;
        padding:48px 56px;max-width:400px;text-align:center}
  h1{font-size:18px;font-weight:600;color:#EFF6E0;margin:0 0 10px}
  p{font-size:13px;line-height:1.7;margin:0 0 24px}
  .brand{font-size:11px;font-weight:700;color:#124559;letter-spacing:3px}
</style></head><body>
<div class="card">
  <h1>${title}</h1>
  <p>${msg}</p>
  <div class="brand">KLIENT</div>
</div>
</body></html>`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    code_verifier: codeVerifier,
  });

  const response = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

// ── Main flow ─────────────────────────────────────────────────────────────────

export interface GoogleSignInResult {
  idToken: string;
  accessToken: string;
}

/**
 * Opens a BrowserWindow with Google's login page (PKCE flow).
 * Returns the id_token to pass to Supabase signInWithIdToken.
 */
export function startGoogleSignIn(): Promise<GoogleSignInResult> {
  if (!GOOGLE_CLIENT_SECRET) {
    return Promise.reject(new Error(
      'Google Client Secret nincs beállítva. Töltsd ki a GOOGLE_CLIENT_SECRET értéket a google-signin.ts fájlban.'
    ));
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  return new Promise((resolve, reject) => {
    const server = http.createServer();
    let settled = false;

    // 5 perces timeout
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        server.close();
        reject(new Error('Google bejelentkezés időtúllépés (5 perc). Próbáld újra.'));
      }
    }, 5 * 60 * 1000);

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        clearTimeout(timeout);
        server.close();
        reject(new Error('Nem sikerült lokális szervert indítani'));
        return;
      }

      const port = addr.port;
      const redirectUri = `http://127.0.0.1:${port}`;

      // Build Google auth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('prompt', 'select_account');

      // Open in embedded BrowserWindow (user stays in-app)
      const win = new BrowserWindow({
        width: 500,
        height: 660,
        autoHideMenuBar: true,
        title: 'Bejelentkezés Google fiókkal',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'google-signin', // separate session, no cookie leakage
        },
      });

      win.loadURL(authUrl.toString());

      // Close window → abort
      win.on('closed', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          server.close();
          reject(new Error('Google bejelentkezés megszakítva'));
        }
      });

      // Handle loopback callback
      server.on('request', async (req, res) => {
        if (settled) { res.writeHead(200); res.end(); return; }

        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          settled = true;
          clearTimeout(timeout);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(resultPage(false));
          server.close();
          if (!win.isDestroyed()) win.close();
          reject(new Error(`Google OAuth hiba: ${error}`));
          return;
        }

        if (code) {
          // CSRF check
          if (returnedState !== state) {
            settled = true;
            clearTimeout(timeout);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(resultPage(false));
            server.close();
            if (!win.isDestroyed()) win.close();
            reject(new Error('State mismatch — esetleges CSRF kísérlet'));
            return;
          }

          try {
            const tokens = await exchangeCode(code, redirectUri, codeVerifier);

            if (!tokens.id_token) {
              throw new Error('Nem érkezett id_token a Google-tól');
            }

            settled = true;
            clearTimeout(timeout);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(resultPage(true));
            server.close();

            // Small delay so user sees the success page, then close
            setTimeout(() => { if (!win.isDestroyed()) win.close(); }, 1500);

            resolve({ idToken: tokens.id_token, accessToken: tokens.access_token });
          } catch (err) {
            settled = true;
            clearTimeout(timeout);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(resultPage(false));
            server.close();
            if (!win.isDestroyed()) win.close();
            reject(err);
          }
        }
      });

      server.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          if (!win.isDestroyed()) win.close();
          reject(err);
        }
      });
    });
  });
}
