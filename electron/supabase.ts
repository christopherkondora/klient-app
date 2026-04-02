import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let supabase: SupabaseClient | null = null;

// Hardcoded fallbacks for production builds (anon key is safe to embed — it's a public key)
const SUPABASE_URL_DEFAULT = 'https://arbhhltbjovuxwvfcnni.supabase.co';
const SUPABASE_ANON_KEY_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyYmhobHRiam92dXh3dmZjbm5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDY3MTksImV4cCI6MjA4OTYyMjcxOX0.DQlIdlYCQazFGOLTB3AYws74akm9Higmr407cRnMCdc';

// File-based storage adapter for Electron main process (no localStorage available)
function createFileStorage() {
  const storageDir = path.join(app.getPath('userData'), 'supabase');
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

  const filePath = path.join(storageDir, 'auth-storage.json');
  let cache: Record<string, string> = {};

  // Load from disk on init
  try {
    if (fs.existsSync(filePath)) {
      cache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* start fresh */ }

  const persist = () => {
    try { fs.writeFileSync(filePath, JSON.stringify(cache)); } catch { /* ignore */ }
  };

  return {
    getItem: (key: string) => cache[key] ?? null,
    setItem: (key: string, value: string) => { cache[key] = value; persist(); },
    removeItem: (key: string) => { delete cache[key]; persist(); },
  };
}

export function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_DEFAULT;

  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file.\n' +
      'Create a .env file in the project root with:\n' +
      'SUPABASE_URL=https://your-project.supabase.co\n' +
      'SUPABASE_ANON_KEY=your-anon-key'
    );
  }

  // Clear stale auth storage if anon key changed (sessions become invalid)
  clearStaleAuthStorage(anonKey);

  supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      flowType: 'pkce',
      storage: createFileStorage(),
    },
  });

  return supabase;
}

/**
 * Clear auth storage if the anon key has changed.
 * When the key changes, old sessions are invalid and cause auth errors.
 */
function clearStaleAuthStorage(currentKey: string) {
  const storageDir = path.join(app.getPath('userData'), 'supabase');
  const authFile = path.join(storageDir, 'auth-storage.json');
  const keyFile = path.join(storageDir, 'anon-key.txt');

  try {
    // Check if key has changed
    let needsClear = false;
    if (fs.existsSync(keyFile)) {
      const savedKey = fs.readFileSync(keyFile, 'utf-8').trim();
      if (savedKey !== currentKey) {
        console.log('[Supabase] Anon key changed - clearing stale auth sessions');
        needsClear = true;
      }
    } else if (fs.existsSync(authFile)) {
      // First time checking, but auth file exists - might be stale
      console.log('[Supabase] No key record found - clearing potentially stale auth');
      needsClear = true;
    }

    if (needsClear) {
      // Clear auth storage
      if (fs.existsSync(authFile)) {
        fs.unlinkSync(authFile);
      }
      // Save current key
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      fs.writeFileSync(keyFile, currentKey);
    }
  } catch (err) {
    console.error('[Supabase] Error checking/clearing stale auth:', err);
  }
}
