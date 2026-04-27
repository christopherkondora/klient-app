import { app, BrowserWindow, ipcMain, protocol, Tray, Menu, nativeImage, session, desktopCapturer } from 'electron';
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
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
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
  // Database will be initialized after user login
  registerIpcHandlers();

  // Allow microphone / speech recognition permissions
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture', 'speech'].includes(permission);
    callback(allowed);
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ['media', 'audioCapture', 'speech'].includes(permission);
  });

  // Allow `getDisplayMedia()` calls from the renderer to silently resolve with
  // the system audio loopback (Windows). This is used by the recording feature
  // to capture the other side of Google Meet / Teams calls alongside the mic.
  // No picker is shown; we always return the primary screen + loopback audio.
  try {
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          if (sources.length === 0) {
            callback({});
            return;
          }
          callback({ video: sources[0], audio: 'loopback' });
        })
        .catch(() => callback({}));
    });
  } catch (err) {
    console.warn('[main] Failed to install display media handler:', err);
  }

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
let dgSocket: WebSocket | null = null;
let cachedDgKey: string | null = null;

async function getDgKey(): Promise<{ key: string | null; error?: string }> {
  if (cachedDgKey) return { key: cachedDgKey };
  try {
    const sb = getSupabase();

    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) {
      return { key: null, error: `Session hiba: ${sessionError?.message || 'Nincs aktív munkamenet'}` };
    }

    const { data, error } = await sb.functions.invoke('get-deepgram-key');
    if (error) {
      let detail = error.message || String(error);
      try {
        if (error.context && typeof error.context.text === 'function') {
          const body = await error.context.text();
          detail += ` | ${error.context.status} | ${body}`;
        }
      } catch { /* ignore */ }
      return { key: null, error: `Edge Function hiba: ${detail}` };
    }
    if (!data?.key) {
      return { key: null, error: `Nem érkezett kulcs a válaszban` };
    }
    cachedDgKey = data.key;
    return { key: cachedDgKey };
  } catch (err) {
    return { key: null, error: `Váratlan hiba: ${err}` };
  }
}

ipcMain.handle('speech:startStream', async () => {
  const { key: apiKey, error: keyError } = await getDgKey();
  if (!apiKey) return { ok: false, error: keyError || 'No Deepgram API key' };
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

// ── Transcribe a full recording file via Deepgram directly ──
ipcMain.handle('recordings:transcribe', async (_event, filePath: string) => {
  try {
    const { key: apiKey, error: keyError } = await getDgKey();
    if (!apiKey) return { text: '', error: keyError || 'Nem sikerült a Deepgram API kulcsot lekérni' };

    const audio = fs.readFileSync(filePath);
    console.log(`[Transcribe] File: ${filePath}, size: ${(audio.length / 1024 / 1024).toFixed(1)} MB`);
    const ext = path.extname(filePath).slice(1) || 'webm';
    const mimeMap: Record<string, string> = { webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
    const contentType = mimeMap[ext] || 'audio/webm';

    const response = await fetch(
      'https://api.deepgram.com/v1/listen?language=hu&model=nova-3&punctuate=true&smart_format=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': contentType,
        },
        body: audio,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Transcribe] Deepgram HTTP ${response.status}:`, errText);
      return { text: '', error: `Deepgram hiba: ${response.status}` };
    }

    const json = await response.json() as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
    const transcript = json.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    console.log(`[Transcribe] Success, transcript length: ${transcript.length} chars`);
    return { text: transcript };
  } catch (err) {
    console.error('[Transcribe] Error:', err);
    return { text: '', error: String(err) };
  }
});

// ── Summarize via Edge Function ──
ipcMain.handle('recordings:summarize', async (_event, transcription: string) => {
  if (!transcription) return { summary: '', error: 'Nincs szöveg az összefoglaláshoz' };
  try {
    const sb = getSupabase();
    const { data, error } = await sb.functions.invoke('summarize', {
      body: { transcription },
    });
    if (error) {
      console.error('[Summarize] Edge Function error:', error);
      return { summary: '', error: String(error) };
    }
    return { summary: data?.summary || '' };
  } catch (err) {
    console.error('[Summarize] Error:', err);
    return { summary: '', error: String(err) };
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

// ── AI Expense extraction (PDF) via Edge Function ──
ipcMain.handle('expenses:extract', async (_event, filePath: string) => {
  if (!filePath) return { data: null, error: 'No file' };
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');
    console.log(`[ExpenseExtract] Processing PDF: ${filePath}, size: ${fileBuffer.length} bytes`);

    const sb = getSupabase();
    const { data, error } = await sb.functions.invoke('expense-extract', {
      body: { fileBase64: base64File },
    });
    if (error) {
      console.error('[ExpenseExtract] Edge Function error:', error);
      let detail = String(error);
      try {
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json();
          detail = body?.error || detail;
        }
      } catch { /* ignore */ }
      return { data: null, error: detail };
    }
    console.log('[ExpenseExtract] Raw response data:', JSON.stringify(data));
    // Edge Function returns { data: { name, amount, ... } } — unwrap the inner data
    const extracted = data?.data ?? null;
    console.log('[ExpenseExtract] Extracted:', JSON.stringify(extracted));
    if (!extracted || typeof extracted !== 'object') {
      return { data: null, error: 'No data extracted' };
    }
    return { data: extracted };
  } catch (err) {
    console.error('[ExpenseExtract] Error:', err);
    return { data: null, error: 'Expense extraction failed' };
  }
});
