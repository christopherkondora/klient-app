import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'billing-config.json');
}

interface RawConfig {
  platform?: string;
  apiKey?: string;   // base64-encoded encrypted buffer
  url?: string;      // for "egyéb" platform
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

export function setBillingConfig(platform: string, apiKey?: string, url?: string): void {
  const config: RawConfig = { platform };

  if (apiKey && safeStorage.isEncryptionAvailable()) {
    config.apiKey = safeStorage.encryptString(apiKey).toString('base64');
  }

  if (url) {
    config.url = url;
  }

  saveRaw(config);
}

export function getBillingConfig(): { platform: string; hasApiKey: boolean; url?: string } {
  const raw = loadRaw();
  return {
    platform: raw.platform || 'none',
    hasApiKey: !!raw.apiKey,
    url: raw.url,
  };
}

export function getBillingApiKey(): string | null {
  const raw = loadRaw();
  if (!raw.apiKey) return null;
  try {
    return safeStorage.decryptString(Buffer.from(raw.apiKey, 'base64'));
  } catch {
    return null;
  }
}

export function clearBillingConfig(): void {
  const p = getConfigPath();
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}
