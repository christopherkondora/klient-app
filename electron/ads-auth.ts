import { shell } from 'electron';
import http from 'http';
import crypto from 'crypto';
import { getGoogleCredentials, saveAccountRefreshToken } from './ads-store';

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/** Generate a styled OAuth result HTML page */
function getOAuthResultPage(success: boolean): string {
  const title = success ? 'Sikeres hitelesítés' : 'Hiba történt';
  const message = success
    ? 'A Google fiókod sikeresen össze lett kapcsolva a Klient alkalmazással. Ez az ablak bezárható.'
    : 'A hitelesítés nem sikerült. Zárd be ezt az ablakot és próbáld újra az alkalmazásban.';
  const icon = success
    ? `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#598392" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Klient</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #01161E;
      color: #598392;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #0C2230;
      border: 1px solid rgba(18, 69, 89, 0.3);
      border-radius: 16px;
      padding: 48px 56px;
      max-width: 420px;
      text-align: center;
    }
    .icon-wrap {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: ${success ? 'rgba(18, 69, 89, 0.25)' : 'rgba(248, 113, 113, 0.1)'};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      color: #EFF6E0;
      margin-bottom: 10px;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 13px;
      line-height: 1.7;
      color: #598392;
      margin-bottom: 32px;
    }
    .brand {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #124559;
      letter-spacing: 3px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="brand">KLIENT</div>
  </div>
</body>
</html>`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Start OAuth2 PKCE flow:
 * 1. Start local HTTP server on random port
 * 2. Open Google auth URL in system browser
 * 3. Wait for redirect with authorization code
 * 4. Exchange code for tokens
 * 5. Return access_token + refresh_token
 */
export async function startOAuthFlow(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const creds = getGoogleCredentials();
  if (!creds.hasCredentials) {
    throw new Error('Google Ads credentials not configured. Set them in Settings first.');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return new Promise((resolve, reject) => {
    const server = http.createServer();
    let resolved = false;

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        reject(new Error('OAuth flow timed out (5 minutes). Please try again.'));
      }
    }, 5 * 60 * 1000);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        clearTimeout(timeout);
        server.close();
        reject(new Error('Failed to start local server'));
        return;
      }

      const port = address.port;
      const redirectUri = `http://127.0.0.1:${port}`;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', creds.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      shell.openExternal(authUrl.toString());

      server.on('request', async (req, res) => {
        if (resolved) {
          res.writeHead(200);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          resolved = true;
          clearTimeout(timeout);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getOAuthResultPage(false));
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          try {
            const tokens = await exchangeCodeForTokens(code, redirectUri, codeVerifier, creds.clientId, creds.clientSecret);
            resolved = true;
            clearTimeout(timeout);

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getOAuthResultPage(true));
            server.close();

            resolve({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || '',
            });
          } catch (err) {
            resolved = true;
            clearTimeout(timeout);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getOAuthResultPage(false));
            server.close();
            reject(err);
          }
        }
      });
    });

    server.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

/** Exchange authorization code for tokens */
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/** Refresh an access token using a refresh token */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const creds = getGoogleCredentials();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json() as TokenResponse;
  return data.access_token;
}

/**
 * List all Google Ads accounts accessible with the given access token.
 * Uses the Google Ads REST API (CustomerService.ListAccessibleCustomers).
 */
export async function listAccessibleAccounts(accessToken: string): Promise<string[]> {
  const creds = getGoogleCredentials();

  const response = await fetch(
    'https://googleads.googleapis.com/v23/customers:listAccessibleCustomers',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': creds.developerToken,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list accounts (${response.status}): ${text}`);
  }

  const data = await response.json() as { resourceNames: string[] };
  // resourceNames are like "customers/1234567890"
  return (data.resourceNames || []).map((r: string) => r.replace('customers/', ''));
}

/**
 * Get account display name and details for a customer ID.
 * When accessing client accounts under an MCC, loginCustomerId must be provided.
 */
export async function getAccountInfo(accessToken: string, customerId: string, loginCustomerId?: string): Promise<{
  customerId: string;
  name: string;
  currency: string;
  timezone: string;
  isMcc: boolean;
}> {
  const creds = getGoogleCredentials();
  const cleanId = customerId.replace(/-/g, '');

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': creds.developerToken,
  };

  // Only set login-customer-id when explicitly provided (e.g. for MCC child accounts)
  const loginId = loginCustomerId?.replace(/-/g, '');
  if (loginId && loginId !== cleanId) {
    headers['login-customer-id'] = loginId;
  }

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${cleanId}`,
    { headers },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get account info (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    id: string;
    descriptiveName: string;
    currencyCode: string;
    timeZone: string;
    manager: boolean;
  };

  return {
    customerId: data.id || cleanId,
    name: data.descriptiveName || `Account ${cleanId}`,
    currency: data.currencyCode || 'HUF',
    timezone: data.timeZone || 'Europe/Budapest',
    isMcc: !!data.manager,
  };
}

/**
 * List all client accounts under an MCC (manager) account.
 * Uses the GoogleAds REST API with a GAQL query on customer_client.
 */
export async function listMccClientAccounts(accessToken: string, mccCustomerId: string): Promise<Array<{
  customerId: string;
  name: string;
  currency: string;
  timezone: string;
  isMcc: boolean;
}>> {
  const creds = getGoogleCredentials();
  const cleanMccId = mccCustomerId.replace(/-/g, '');

  const query = `SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.status = 'ENABLED' AND customer_client.id != ${cleanMccId}`;

  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${cleanMccId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': creds.developerToken,
        'login-customer-id': cleanMccId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to list MCC client accounts (${response.status}): ${text}`);
    return [];
  }

  const data = await response.json() as Array<{ results?: Array<{ customerClient: { id: string; descriptiveName: string; currencyCode: string; timeZone: string; manager: boolean } }> }>;

  const accounts: Array<{ customerId: string; name: string; currency: string; timezone: string; isMcc: boolean }> = [];

  for (const batch of data) {
    if (batch.results) {
      for (const row of batch.results) {
        const cc = row.customerClient;
        accounts.push({
          customerId: String(cc.id),
          name: cc.descriptiveName || `Account ${cc.id}`,
          currency: cc.currencyCode || 'HUF',
          timezone: cc.timeZone || 'Europe/Budapest',
          isMcc: !!cc.manager,
        });
      }
    }
  }

  return accounts;
}
