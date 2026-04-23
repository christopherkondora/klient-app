import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'ads-config.json');
}

interface RawConfig {
  developerToken?: string;    // base64-encoded encrypted
  clientId?: string;          // OAuth client ID (not secret — safe to store plain)
  clientSecret?: string;      // base64-encoded encrypted
  mccId?: string;             // MCC customer ID
}

interface RawAccountTokens {
  [accountId: string]: string; // base64-encoded encrypted refresh tokens
}

function getTokensPath(): string {
  return path.join(app.getPath('userData'), 'ads-tokens.json');
}

function loadRaw(): RawConfig {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch { /* corrupt file – treat as empty */ }
  return {};
}

function saveRaw(config: RawConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function loadTokens(): RawAccountTokens {
  try {
    const p = getTokensPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch { /* corrupt file – treat as empty */ }
  return {};
}

function saveTokens(tokens: RawAccountTokens): void {
  fs.writeFileSync(getTokensPath(), JSON.stringify(tokens, null, 2), 'utf-8');
}

function encrypt(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64');
  }
  // Fallback: base64 only (not secure, but app still works)
  return Buffer.from(value).toString('base64');
}

function decrypt(encoded: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    }
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/** Save Google Ads API credentials (developer token, OAuth client ID/secret, MCC ID) */
export function saveGoogleCredentials(config: {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  mccId?: string;
}): void {
  const raw: RawConfig = {
    developerToken: encrypt(config.developerToken),
    clientId: config.clientId, // not encrypted — needed for auth URL construction
    clientSecret: encrypt(config.clientSecret),
    mccId: config.mccId || undefined,
  };
  saveRaw(raw);
}

/** Get Google Ads credentials (decrypted) */
export function getGoogleCredentials(): {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  mccId: string;
  hasCredentials: boolean;
} {
  const raw = loadRaw();
  const developerToken = raw.developerToken ? decrypt(raw.developerToken) : '';
  const clientSecret = raw.clientSecret ? decrypt(raw.clientSecret) : '';
  return {
    developerToken,
    clientId: raw.clientId || '',
    clientSecret,
    mccId: raw.mccId || '',
    hasCredentials: !!(developerToken && raw.clientId && clientSecret),
  };
}

/** Save a refresh token for a specific ads account */
export function saveAccountRefreshToken(accountId: string, refreshToken: string): void {
  const tokens = loadTokens();
  tokens[accountId] = encrypt(refreshToken);
  saveTokens(tokens);
}

/** Get a refresh token for a specific ads account */
export function getAccountRefreshToken(accountId: string): string | null {
  const tokens = loadTokens();
  if (!tokens[accountId]) return null;
  const decrypted = decrypt(tokens[accountId]);
  return decrypted || null;
}

/** Remove refresh token for a specific account */
export function removeAccountRefreshToken(accountId: string): void {
  const tokens = loadTokens();
  delete tokens[accountId];
  saveTokens(tokens);
}

/** Clear all Google Ads credentials and tokens */
export function clearGoogleCredentials(): void {
  const configPath = getConfigPath();
  const tokensPath = getTokensPath();
  if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  if (fs.existsSync(tokensPath)) fs.unlinkSync(tokensPath);
}
