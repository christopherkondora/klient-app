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

// --- Speech Recognition via Deepgram + OpenAI ---
import dotenv from 'dotenv';
import https from 'https';
import WebSocket from 'ws';

dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Deepgram real-time streaming (for dictation) ──
let dgSocket: WebSocket | null = null;

ipcMain.handle('speech:startStream', () => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
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

// ── Deepgram REST: transcribe a full recording file ──
import fs from 'fs';

ipcMain.handle('recordings:transcribe', async (_event, filePath: string) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return { text: '' };

  let audio: Buffer;
  try {
    audio = fs.readFileSync(filePath);
  } catch {
    console.error('[Transcribe] Could not read file:', filePath);
    return { text: '' };
  }

  const ext = path.extname(filePath).slice(1) || 'webm';
  const mimeMap: Record<string, string> = { webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
  const contentType = mimeMap[ext] || 'audio/webm';

  return new Promise<{ text: string }>((resolve) => {
    const req = https.request({
      hostname: 'api.deepgram.com',
      path: '/v1/listen?language=hu&model=nova-3&punctuate=true&smart_format=true',
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': contentType,
        'Content-Length': audio.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const transcript = json.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
          resolve({ text: transcript });
        } catch {
          console.error('[Transcribe] Deepgram parse error:', data);
          resolve({ text: '' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Transcribe] Deepgram error:', err.message);
      resolve({ text: '' });
    });

    req.setTimeout(120000, () => {
      req.destroy();
      resolve({ text: '' });
    });

    req.write(audio);
    req.end();
  });
});

// --- Summarize a transcription with GPT-4o-mini ---
ipcMain.handle('recordings:summarize', async (_event, transcription: string) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !transcription) return { summary: '' };

  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Projekt menedzser asszisztens vagy. Foglald össze tömören a konzultáció/beszélgetés lényegét magyarul. Emeld ki a fő témákat, döntéseket, feladatokat és határidőket. Használj rövid bekezdéseket.'
      },
      {
        role: 'user',
        content: `Foglald össze az alábbi konzultáció átiratát:\n\n${transcription}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  return new Promise<{ summary: string }>((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const summary = json.choices?.[0]?.message?.content || '';
          resolve({ summary });
        } catch {
          console.error('[Summarize] API parse error:', data);
          resolve({ summary: '' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Summarize] API error:', err.message);
      resolve({ summary: '' });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ summary: '' });
    });

    req.write(payload);
    req.end();
  });
});

// AI Invoice PDF extraction
ipcMain.handle('invoices:extract', async (_event, filePath: string) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !filePath) return { data: null, error: 'No API key or file' };

  const fileBuffer = fs.readFileSync(filePath);
  const base64File = fileBuffer.toString('base64');

  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Számla adatkinyerő asszisztens vagy. Egy PDF számla képéből kinyered a következő adatokat JSON formátumban:
- invoice_number: számlaszám (string vagy null ha nem olvasható)
- client_name: ügyfél/vevő neve (string vagy null)
- amount: összeg számként (number vagy null) - mindig a bruttó végösszeg
- currency: pénznem (string, alapértelmezett "HUF")
- issue_date: kiállítás dátuma YYYY-MM-DD formátumban (string vagy null)
- due_date: fizetési határidő YYYY-MM-DD formátumban (string vagy null)
- is_incoming: boolean - true ha EZ egy bejövő számla (mi vagyunk a vevő), false ha kimenő (mi vagyunk az eladó). Az eladó/szállító vs vevő/megrendelő alapján döntsd el.

FONTOS: Ha valamit nem tudsz biztosan kiolvasni, az értéke legyen null. NE találj ki adatot.
Csak a JSON objektumot add vissza, semmi mást.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: {
              filename: 'invoice.pdf',
              file_data: `data:application/pdf;base64,${base64File}`
            }
          },
          {
            type: 'text',
            text: 'Kinyerd az adatokat ebből a számlából.'
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 500,
  });

  return new Promise<{ data: Record<string, unknown> | null; error?: string }>((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content || '';
          // Parse JSON from content (might be wrapped in ```json ... ```)
          const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const extracted = JSON.parse(cleaned);
          resolve({ data: extracted });
        } catch (err) {
          console.error('[InvoiceExtract] Parse error:', data);
          resolve({ data: null, error: 'Failed to parse AI response' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[InvoiceExtract] API error:', err.message);
      resolve({ data: null, error: err.message });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ data: null, error: 'Request timeout' });
    });

    req.write(payload);
    req.end();
  });
});
