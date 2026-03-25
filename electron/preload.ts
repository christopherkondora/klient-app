import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // User / Auth
  getUser: () => ipcRenderer.invoke('db:user:get'),
  registerUser: (data: unknown) => ipcRenderer.invoke('db:user:register', data),
  loginUser: (data: unknown) => ipcRenderer.invoke('db:user:login', data),
  logoutUser: () => ipcRenderer.invoke('db:user:logout'),
  resetPassword: (email: string) => ipcRenderer.invoke('db:user:resetPassword', email),
  checkEmailConfirmed: (data: { email: string; password: string }) => ipcRenderer.invoke('db:user:checkEmailConfirmed', data),
  googleAuth: () => ipcRenderer.invoke('db:user:googleAuth'),
  updateUser: (id: string, data: unknown) => ipcRenderer.invoke('db:user:update', id, data),

  // Subscription
  getSubscription: () => ipcRenderer.invoke('db:subscription:get'),
  openCheckout: (data: { plan: string }) => ipcRenderer.invoke('db:subscription:checkout', data),

  // Update
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    const handler = (_event: unknown, info: unknown) => callback(info);
    ipcRenderer.on('update:available', handler);
    return () => { ipcRenderer.removeListener('update:available', handler); };
  },
  onUpdateDownloaded: (callback: (info: unknown) => void) => {
    const handler = (_event: unknown, info: unknown) => callback(info);
    ipcRenderer.on('update:downloaded', handler);
    return () => { ipcRenderer.removeListener('update:downloaded', handler); };
  },

  // Database operations - Clients
  getClients: () => ipcRenderer.invoke('db:clients:getAll'),
  getClient: (id: string) => ipcRenderer.invoke('db:clients:get', id),
  createClient: (data: unknown) => ipcRenderer.invoke('db:clients:create', data),
  updateClient: (id: string, data: unknown) => ipcRenderer.invoke('db:clients:update', id, data),
  deleteClient: (id: string) => ipcRenderer.invoke('db:clients:delete', id),

  // Database operations - Projects
  getProjects: (clientId?: string) => ipcRenderer.invoke('db:projects:getAll', clientId),
  getProject: (id: string) => ipcRenderer.invoke('db:projects:get', id),
  createProject: (data: unknown) => ipcRenderer.invoke('db:projects:create', data),
  updateProject: (id: string, data: unknown) => ipcRenderer.invoke('db:projects:update', id, data),
  deleteProject: (id: string) => ipcRenderer.invoke('db:projects:delete', id),
  closeProject: (id: string) => ipcRenderer.invoke('db:projects:close', id),
  markProjectPaid: (id: string, invoiceData: unknown) => ipcRenderer.invoke('db:projects:markPaid', id, invoiceData),

  getCompletedHours: () => ipcRenderer.invoke('db:projects:completedHours'),

  // Database operations - Calendar Events
  getCalendarEvents: (startDate: string, endDate: string) => ipcRenderer.invoke('db:calendar:getAll', startDate, endDate),
  createCalendarEvent: (data: unknown) => ipcRenderer.invoke('db:calendar:create', data),
  updateCalendarEvent: (id: string, data: unknown) => ipcRenderer.invoke('db:calendar:update', id, data),
  deleteCalendarEvent: (id: string) => ipcRenderer.invoke('db:calendar:delete', id),

  // Database operations - Notes
  getNotes: (projectId?: string) => ipcRenderer.invoke('db:notes:getAll', projectId),
  createNote: (data: unknown) => ipcRenderer.invoke('db:notes:create', data),
  updateNote: (id: string, data: unknown) => ipcRenderer.invoke('db:notes:update', id, data),
  deleteNote: (id: string) => ipcRenderer.invoke('db:notes:delete', id),
  getReminders: () => ipcRenderer.invoke('db:notes:getReminders'),

  // Database operations - Recordings
  getRecordings: (clientId?: string) => ipcRenderer.invoke('db:recordings:getAll', clientId),
  createRecording: (data: unknown) => ipcRenderer.invoke('db:recordings:create', data),
  updateRecording: (id: string, data: unknown) => ipcRenderer.invoke('db:recordings:update', id, data),
  deleteRecording: (id: string) => ipcRenderer.invoke('db:recordings:delete', id),
  transcribeRecording: (filePath: string) => ipcRenderer.invoke('recordings:transcribe', filePath),
  summarizeRecording: (transcription: string) => ipcRenderer.invoke('recordings:summarize', transcription),

  // Database operations - Shortcuts
  getShortcuts: () => ipcRenderer.invoke('db:shortcuts:getAll'),
  createShortcut: (data: unknown) => ipcRenderer.invoke('db:shortcuts:create', data),
  updateShortcut: (id: string, data: unknown) => ipcRenderer.invoke('db:shortcuts:update', id, data),
  deleteShortcut: (id: string) => ipcRenderer.invoke('db:shortcuts:delete', id),

  // Database operations - Invoices
  getInvoices: (projectId?: string) => ipcRenderer.invoke('db:invoices:getAll', projectId),
  getClientInvoices: (clientId: string) => ipcRenderer.invoke('db:invoices:getByClient', clientId),
  createInvoice: (data: unknown) => ipcRenderer.invoke('db:invoices:create', data),
  updateInvoice: (id: string, data: unknown) => ipcRenderer.invoke('db:invoices:update', id, data),
  deleteInvoice: (id: string) => ipcRenderer.invoke('db:invoices:delete', id),
  getFinanceStats: () => ipcRenderer.invoke('db:finance:stats'),
  getNextInvoiceNumber: () => ipcRenderer.invoke('db:invoices:nextNumber'),
  getMonthlyRevenue: () => ipcRenderer.invoke('db:finance:monthlyRevenue'),
  getEnhancedFinanceStats: () => ipcRenderer.invoke('db:finance:enhanced'),
  extractInvoice: (filePath: string) => ipcRenderer.invoke('invoices:extract', filePath),

  // Expenses
  getExpenses: () => ipcRenderer.invoke('db:expenses:getAll'),
  createExpense: (data: unknown) => ipcRenderer.invoke('db:expenses:create', data),
  updateExpense: (id: string, data: unknown) => ipcRenderer.invoke('db:expenses:update', id, data),
  deleteExpense: (id: string) => ipcRenderer.invoke('db:expenses:delete', id),

  // Database operations - Dashboard stats
  getDashboardStats: () => ipcRenderer.invoke('db:dashboard:stats'),
  getTodayNotes: () => ipcRenderer.invoke('db:dashboard:todayNotes'),
  getUpcomingDeadlines: () => ipcRenderer.invoke('db:dashboard:upcomingDeadlines'),

  // File operations
  saveFile: (data: unknown) => ipcRenderer.invoke('file:save', data),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('file:readAudio', filePath),
  getExchangeRate: (from: string, to: string) => ipcRenderer.invoke('exchange:getRate', from, to),
  openFile: (filePath: string) => ipcRenderer.invoke('file:open', filePath),
  exportFile: (data: { sourcePath: string; defaultName: string }) => ipcRenderer.invoke('file:export', data),

  // Files module
  filesGetRoot: () => ipcRenderer.invoke('files:getRoot'),
  filesList: (relativePath: string) => ipcRenderer.invoke('files:list', relativePath),
  filesCreateFolder: (relativePath: string) => ipcRenderer.invoke('files:createFolder', relativePath),
  filesRename: (oldPath: string, newPath: string) => ipcRenderer.invoke('files:rename', oldPath, newPath),
  filesDelete: (relativePath: string) => ipcRenderer.invoke('files:delete', relativePath),
  filesOpenInExplorer: (relativePath: string) => ipcRenderer.invoke('files:openInExplorer', relativePath),
  filesOpenFile: (relativePath: string) => ipcRenderer.invoke('files:openFile', relativePath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  filesReadFile: (relativePath: string) => ipcRenderer.invoke('files:readFile', relativePath),
  filesEnsureClientFolder: (clientName: string) => ipcRenderer.invoke('files:ensureClientFolder', clientName),
  filesEnsureProjectFolder: (clientName: string, projectName: string) => ipcRenderer.invoke('files:ensureProjectFolder', clientName, projectName),
  filesRenameFolder: (oldPath: string, newPath: string) => ipcRenderer.invoke('files:renameFolder', oldPath, newPath),
  filesCopyFiles: (sourcePaths: string[], targetRelPath: string) => ipcRenderer.invoke('files:copyFiles', sourcePaths, targetRelPath),
  filesSelectFiles: () => ipcRenderer.invoke('files:selectFiles'),
  filesSelectFolder: () => ipcRenderer.invoke('files:selectFolder'),
  getFilePathForDrop: (file: File) => webUtils.getPathForFile(file),

  // Speech recognition (Deepgram streaming)
  startDeepgramStream: () => ipcRenderer.invoke('speech:startStream'),
  sendAudioChunk: (audioBase64: string) => ipcRenderer.send('speech:sendAudio', audioBase64),
  stopDeepgramStream: () => ipcRenderer.invoke('speech:stopStream'),
  onTranscript: (callback: (data: { text: string; isFinal: boolean }) => void) => {
    const handler = (_event: any, data: { text: string; isFinal: boolean }) => callback(data);
    ipcRenderer.on('speech:transcript', handler);
    return () => { ipcRenderer.removeListener('speech:transcript', handler); };
  },
});
