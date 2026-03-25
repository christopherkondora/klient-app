import { app, BrowserWindow, ipcMain, protocol, Tray, Menu, nativeImage, session } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { initDatabase } from './database';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Klient',
    icon: path.join(__dirname, '../assets/icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Klient');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Megnyitás', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Kilépés', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

app.whenReady().then(async () => {
  await initDatabase();
  registerIpcHandlers();

  // Allow microphone / speech recognition permissions
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture', 'speech'].includes(permission);
    callback(allowed);
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ['media', 'audioCapture', 'speech'].includes(permission);
  });

  createWindow();
  createTray();

  // Auto-updater (only in production)
  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Forward update events to renderer
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info);
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info);
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window control IPC handlers
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized());

// --- Speech Recognition via Deepgram + AI via Supabase Edge Functions ---
import WebSocket from 'ws';
import fs from 'fs';
import { getSupabase } from './supabase';

// ── Deepgram real-time streaming (for dictation) ──
// Note: streaming stays client-side for low latency; uses Edge Function to fetch the API key
let dgSocket: WebSocket | null = null;
let cachedDgKey: string | null = null;

async function getDgKey(): Promise<string | null> {
  if (cachedDgKey) return cachedDgKey;
  try {
    const sb = getSupabase();
    const { data, error } = await sb.functions.invoke('transcribe', {
      body: JSON.stringify({ getKey: true }),
      headers: { 'x-audio-content-type': 'none' },
    });
    // The key fetching isn't supported yet — we'll handle streaming differently later
    return null;
  } catch {
    return null;
  }
}

ipcMain.handle('speech:startStream', async () => {
  // For now, real-time dictation streaming still needs the Deepgram key.
  // It's fetched from the Edge Function or falls back to env
  const apiKey = process.env.DEEPGRAM_API_KEY || cachedDgKey;
  if (!apiKey) return { ok: false, error: 'No Deepgram API key' };
  if (dgSocket && dgSocket.readyState === WebSocket.OPEN) return { ok: true };

  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const url = 'wss://api.deepgram.com/v1/listen?language=hu&model=nova-3&punctuate=true&interim_results=true&encoding=linear16&sample_rate=16000&channels=1';
    const ws = new WebSocket(url, { headers: { Authorization: `Token ${apiKey}` } });

    ws.on('open', () => {
      dgSocket = ws;
      resolve({ ok: true });
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'Results' && msg.channel?.alternatives?.[0]) {
          const alt = msg.channel.alternatives[0];
          mainWindow?.webContents.send('speech:transcript', {
            text: alt.transcript || '',
            isFinal: msg.is_final ?? false,
          });
        }
      } catch { /* ignore malformed */ }
    });

    ws.on('error', (err) => {
      console.error('[Deepgram] WebSocket error:', err.message);
      dgSocket = null;
      resolve({ ok: false, error: err.message });
    });

    ws.on('close', () => { dgSocket = null; });

    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.terminate();
        dgSocket = null;
        resolve({ ok: false, error: 'Connection timeout' });
      }
    }, 10000);
  });
});

ipcMain.on('speech:sendAudio', (_event, audioBase64: string) => {
  if (dgSocket && dgSocket.readyState === WebSocket.OPEN) {
    dgSocket.send(Buffer.from(audioBase64, 'base64'));
  }
});

ipcMain.handle('speech:stopStream', () => {
  if (dgSocket && dgSocket.readyState === WebSocket.OPEN) {
    dgSocket.send(JSON.stringify({ type: 'CloseStream' }));
    dgSocket.close();
  }
  dgSocket = null;
  return { ok: true };
});

// ── Transcribe a full recording file via Edge Function ──
ipcMain.handle('recordings:transcribe', async (_event, filePath: string) => {
  try {
    const audio = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1) || 'webm';
    const mimeMap: Record<string, string> = { webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
    const contentType = mimeMap[ext] || 'audio/webm';

    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { text: '' };

    // Call Edge Function with raw audio (can't use sb.functions.invoke for binary body)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://arbhhltbjovuxwvfcnni.supabase.co';
    const response = await fetch(
      `${supabaseUrl}/functions/v1/transcribe`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-audio-content-type': contentType,
        },
        body: audio,
      }
    );

    const json = await response.json() as { text?: string };
    return { text: json.text || '' };
  } catch (err) {
    console.error('[Transcribe] Error:', err);
    return { text: '' };
  }
});

// ── Summarize via Edge Function ──
ipcMain.handle('recordings:summarize', async (_event, transcription: string) => {
  if (!transcription) return { summary: '' };
  try {
    const sb = getSupabase();
    const { data, error } = await sb.functions.invoke('summarize', {
      body: { transcription },
    });
    if (error) {
      console.error('[Summarize] Edge Function error:', error);
      return { summary: '' };
    }
    return { summary: data?.summary || '' };
  } catch (err) {
    console.error('[Summarize] Error:', err);
    return { summary: '' };
  }
});

// ── AI Invoice PDF extraction via Edge Function ──
ipcMain.handle('invoices:extract', async (_event, filePath: string) => {
  if (!filePath) return { data: null, error: 'No file' };
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    const sb = getSupabase();
    const { data, error } = await sb.functions.invoke('invoice-extract', {
      body: { fileBase64: base64File },
    });
    if (error) {
      console.error('[InvoiceExtract] Edge Function error:', error);
      return { data: null, error: 'AI extraction failed' };
    }
    return { data: data?.data || null };
  } catch (err) {
    console.error('[InvoiceExtract] Error:', err);
    return { data: null, error: 'Invoice extraction failed' };
  }
});
