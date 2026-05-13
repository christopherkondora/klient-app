import { app, BrowserWindow, ipcMain, protocol, Tray, Menu, nativeImage, session, desktopCapturer } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { initDatabase } from './database';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

type UpdateStatus = {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error';
  info?: unknown;
  message?: string;
};

let updateStatus: UpdateStatus = { status: 'idle' };

const isDev = !app.isPackaged;

function sendUpdateStatus(status: UpdateStatus) {
  updateStatus = status;
  mainWindow?.webContents.send('update:status', status);
}

function setupAutoUpdater() {
  ipcMain.handle('update:status', () => updateStatus);
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ status: 'available', info });
    mainWindow?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ status: 'downloaded', info });
    mainWindow?.webContents.send('update:downloaded', info);
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ status: 'idle' });
  });

  autoUpdater.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[main] Auto-update failed:', message);
    sendUpdateStatus({ status: 'error', message });
    mainWindow?.webContents.send('update:error', message);
  });

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[main] Auto-update check failed:', message);
      sendUpdateStatus({ status: 'error', message });
      mainWindow?.webContents.send('update:error', message);
    });
  }
}

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
  setupAutoUpdater();

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

// --- Speech Recognition via ElevenLabs Scribe + AI via Supabase Edge Functions ---
import WebSocket from 'ws';
import fs from 'fs';
import { getSupabase } from './supabase';

// Hungarian-specific keyterms (Klient domain vocabulary).
// Realtime cap: 50 keyterms, ≤20 chars each. Batch cap: 1000 keyterms, ≤50 chars.
const HU_KEYTERMS_REALTIME = [
  'számla', 'Billingo', 'NAV', 'KATA', 'KIVA', 'TAO', 'ÁFA',
  'ügyfél', 'projekt', 'határidő', 'megbízási', 'vállalkozói',
  'számlázz.hu', 'Klient', 'bevétel', 'kiadás',
];
const HU_KEYTERMS_BATCH = HU_KEYTERMS_REALTIME;

// ── ElevenLabs Scribe real-time streaming (for dictation) ──
let sttSocket: WebSocket | null = null;
let cachedElevenLabsKey: string | null = null;

async function getElevenLabsKey(): Promise<{ key: string | null; error?: string }> {
  if (cachedElevenLabsKey) return { key: cachedElevenLabsKey };
  try {
    const sb = getSupabase();

    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) {
      return { key: null, error: `Session hiba: ${sessionError?.message || 'Nincs aktív munkamenet'}` };
    }

    const { data, error } = await sb.functions.invoke('get-elevenlabs-key');
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
    cachedElevenLabsKey = data.key;
    return { key: cachedElevenLabsKey };
  } catch (err) {
    return { key: null, error: `Váratlan hiba: ${err}` };
  }
}

ipcMain.handle('speech:startStream', async () => {
  const { key: apiKey, error: keyError } = await getElevenLabsKey();
  if (!apiKey) return { ok: false, error: keyError || 'Hiányzó ElevenLabs API kulcs' };
  if (sttSocket && sttSocket.readyState === WebSocket.OPEN) return { ok: true };

  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      language_code: 'hun',
      audio_format: 'pcm_16000',
      commit_strategy: 'vad',
    });
    for (const term of HU_KEYTERMS_REALTIME) params.append('keyterms', term);
    const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
    const ws = new WebSocket(url, { headers: { 'xi-api-key': apiKey } });

    ws.on('open', () => {
      sttSocket = ws;
      resolve({ ok: true });
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.message_type === 'partial_transcript') {
          mainWindow?.webContents.send('speech:transcript', {
            text: msg.text || '',
            isFinal: false,
          });
        } else if (msg.message_type === 'committed_transcript' || msg.message_type === 'committed_transcript_with_timestamps') {
          mainWindow?.webContents.send('speech:transcript', {
            text: msg.text || '',
            isFinal: true,
          });
        } else if (typeof msg.message_type === 'string' && msg.message_type.toLowerCase().includes('error')) {
          console.error('[ElevenLabs] STT error event:', msg);
        }
      } catch { /* ignore malformed */ }
    });

    ws.on('error', (err) => {
      console.error('[ElevenLabs] WebSocket error:', err.message);
      sttSocket = null;
      resolve({ ok: false, error: err.message });
    });

    ws.on('close', () => { sttSocket = null; });

    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.terminate();
        sttSocket = null;
        resolve({ ok: false, error: 'Connection timeout' });
      }
    }, 10000);
  });
});

ipcMain.on('speech:sendAudio', (_event, audioBase64: string) => {
  if (sttSocket && sttSocket.readyState === WebSocket.OPEN) {
    sttSocket.send(JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: audioBase64,
      sample_rate: 16000,
    }));
  }
});

ipcMain.handle('speech:stopStream', () => {
  if (sttSocket && sttSocket.readyState === WebSocket.OPEN) {
    try {
      // Force-commit any pending audio before closing so trailing words aren't lost.
      sttSocket.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: '',
        commit: true,
        sample_rate: 16000,
      }));
    } catch { /* ignore */ }
    sttSocket.close();
  }
  sttSocket = null;
  return { ok: true };
});

// ── Transcribe a full recording file via ElevenLabs Scribe v2 (batch) ──
ipcMain.handle('recordings:transcribe', async (_event, filePath: string) => {
  try {
    const { key: apiKey, error: keyError } = await getElevenLabsKey();
    if (!apiKey) return { text: '', error: keyError || 'Nem sikerült az ElevenLabs API kulcsot lekérni' };

    const audio = fs.readFileSync(filePath);
    console.log(`[Transcribe] File: ${filePath}, size: ${(audio.length / 1024 / 1024).toFixed(1)} MB`);
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      mp4: 'audio/mp4',
      flac: 'audio/flac',
    };
    const contentType = mimeMap[ext] || 'audio/webm';

    const form = new FormData();
    form.append('model_id', 'scribe_v2');
    form.append('language_code', 'hun');
    form.append('tag_audio_events', 'false');
    form.append('diarize', 'false');
    form.append('timestamps_granularity', 'none');
    for (const term of HU_KEYTERMS_BATCH) form.append('keyterms', term);
    form.append('file', new Blob([new Uint8Array(audio)], { type: contentType }), `audio.${ext}`);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Transcribe] ElevenLabs HTTP ${response.status}:`, errText);
      return { text: '', error: `ElevenLabs hiba: ${response.status}` };
    }

    const json = await response.json() as { text?: string };
    const transcript = json.text || '';
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
