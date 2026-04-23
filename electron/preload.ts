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
  changePassword: (data: { currentPassword: string; newPassword: string }) => ipcRenderer.invoke('db:user:changePassword', data),
  checkEmailConfirmed: (data: { email: string; password: string }) => ipcRenderer.invoke('db:user:checkEmailConfirmed', data),
  googleAuth: () => ipcRenderer.invoke('db:user:googleAuth'),
  updateUser: (id: string, data: unknown) => ipcRenderer.invoke('db:user:update', id, data),

  // Subscription
  getSubscription: () => ipcRenderer.invoke('db:subscription:get'),
  openCheckout: (data: { plan: string; module?: string }) => ipcRenderer.invoke('db:subscription:checkout', data),
  cancelSubscription: (module?: string) => ipcRenderer.invoke('db:subscription:cancel', module),
  reactivateSubscription: (module?: string) => ipcRenderer.invoke('db:subscription:reactivate', module),

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

  // Database operations - Contracts
  getContractTemplates: () => ipcRenderer.invoke('db:contracts:getTemplates'),
  getContracts: (clientId?: string) => ipcRenderer.invoke('db:contracts:getAll', clientId),
  generateContract: (data: unknown) => ipcRenderer.invoke('db:contracts:generate', data),
  deleteContract: (id: string) => ipcRenderer.invoke('db:contracts:delete', id),

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
  extractExpense: (filePath: string) => ipcRenderer.invoke('expenses:extract', filePath),

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
  filesSaveToClientInvoices: (clientName: string, fileName: string, base64Data: string) => ipcRenderer.invoke('files:saveToClientInvoices', clientName, fileName, base64Data),
  filesRenameFolder: (oldPath: string, newPath: string) => ipcRenderer.invoke('files:renameFolder', oldPath, newPath),
  filesCopyFiles: (sourcePaths: string[], targetRelPath: string) => ipcRenderer.invoke('files:copyFiles', sourcePaths, targetRelPath),
  filesSelectFiles: () => ipcRenderer.invoke('files:selectFiles'),
  filesSelectFolder: () => ipcRenderer.invoke('files:selectFolder'),
  getFilePathForDrop: (file: File) => webUtils.getPathForFile(file),
  filesGetAbsolutePath: (relativePath: string) => ipcRenderer.invoke('files:getAbsolutePath', relativePath),
  filesMoveFiles: (sourcePaths: string[], targetRelPath: string) => ipcRenderer.invoke('files:moveFiles', sourcePaths, targetRelPath),
  filesStartDrag: (relativePaths: string[]) => ipcRenderer.send('files:startDrag', relativePaths),
  filesDuplicate: (relativePath: string) => ipcRenderer.invoke('files:duplicate', relativePath),
  filesCopyToClipboard: (relativePaths: string[]) => ipcRenderer.invoke('files:copyToClipboard', relativePaths),

  // Team members
  getTeamMembers: () => ipcRenderer.invoke('db:team:getAll'),
  getTeamMember: (id: string) => ipcRenderer.invoke('db:team:get', id),
  createTeamMember: (data: unknown) => ipcRenderer.invoke('db:team:create', data),
  updateTeamMember: (id: string, data: unknown) => ipcRenderer.invoke('db:team:update', id, data),
  deleteTeamMember: (id: string) => ipcRenderer.invoke('db:team:delete', id),

  // Project assignments
  getProjectAssignments: (projectId: string) => ipcRenderer.invoke('db:team:getProjectAssignments', projectId),
  getMemberAssignments: (teamMemberId: string) => ipcRenderer.invoke('db:team:getMemberAssignments', teamMemberId),
  assignToProject: (projectId: string, teamMemberId: string, data?: { fee?: number | null; fee_currency?: string; fee_huf?: number | null; notes?: string | null }) => ipcRenderer.invoke('db:team:assignToProject', projectId, teamMemberId, data),
  updateAssignment: (assignmentId: string, data: unknown) => ipcRenderer.invoke('db:team:updateAssignment', assignmentId, data),
  unassignFromProject: (projectId: string, teamMemberId: string) => ipcRenderer.invoke('db:team:unassignFromProject', projectId, teamMemberId),

  // Speech recognition (Deepgram streaming)
  startDeepgramStream: () => ipcRenderer.invoke('speech:startStream'),
  sendAudioChunk: (audioBase64: string) => ipcRenderer.send('speech:sendAudio', audioBase64),
  stopDeepgramStream: () => ipcRenderer.invoke('speech:stopStream'),
  onTranscript: (callback: (data: { text: string; isFinal: boolean }) => void) => {
    const handler = (_event: any, data: { text: string; isFinal: boolean }) => callback(data);
    ipcRenderer.on('speech:transcript', handler);
    return () => { ipcRenderer.removeListener('speech:transcript', handler); };
  },

  // Tax
  getTaxBusinessTypes: () => ipcRenderer.invoke('db:tax:getBusinessTypes'),
  getTaxRules: (businessType: string, year: number) => ipcRenderer.invoke('db:tax:getRules', businessType, year),
  checkTaxEligibility: (businessType: string, revenue: number, employeeCount?: number, year?: number) => ipcRenderer.invoke('db:tax:checkEligibility', businessType, revenue, employeeCount, year),
  calculateTax: (input: { businessType: string; year: number; revenue: number; expenses?: number; employeeCount?: number }) => ipcRenderer.invoke('db:tax:calculate', input),
  getAvailableTaxTypes: (revenue: number, employeeCount?: number, year?: number) => ipcRenderer.invoke('db:tax:getAvailableTypes', revenue, employeeCount, year),
  getUserTaxSettings: (year?: number) => ipcRenderer.invoke('db:tax:getUserSettings', year),
  setUserTaxSettings: (businessType: string, year?: number) => ipcRenderer.invoke('db:tax:setUserSettings', businessType, year),
  getTaxCalculationHistory: (limit?: number) => ipcRenderer.invoke('db:tax:getCalculationHistory', limit),

  // Tax module (new)
  getTaxParameters: (year: number) => ipcRenderer.invoke('db:tax:getParameters', year),
  getTaxProfile: (userId?: string) => ipcRenderer.invoke('db:tax:getProfile', userId),
  saveTaxProfile: (profile: any) => ipcRenderer.invoke('db:tax:saveProfile', profile),
  searchHipaRates: (query: string) => ipcRenderer.invoke('db:tax:searchHipa', query),
  getHipaRate: (megye: string, telepules: string) => ipcRenderer.invoke('db:tax:getHipaRate', megye, telepules),
  getFullTaxEstimate: (userId: string | undefined, adoev: number, evesBevétel: number) => ipcRenderer.invoke('db:tax:fullEstimate', userId, adoev, evesBevétel),
  getTaxDeadlines: (userId: string | undefined, adoev: number) => ipcRenderer.invoke('db:tax:getDeadlines', userId, adoev),
  getTaxWarnings: (userId: string | undefined, bevétel: number, adoev: number) => ipcRenderer.invoke('db:tax:getWarnings', userId, bevétel, adoev),
  compareTaxForms: (bevétel: number, koltsegek: number, adoev: number, hipaKulcs: number, kivet?: number) => ipcRenderer.invoke('db:tax:compareForms', bevétel, koltsegek, adoev, hipaKulcs, kivet),

  // Billing / Invoicing config
  setBillingConfig: (data: { platform: string; apiKey?: string; url?: string }) => ipcRenderer.invoke('billing:set-config', data),
  getBillingConfig: () => ipcRenderer.invoke('billing:get-config'),
  testBillingConnection: (data: { platform: string }) => ipcRenderer.invoke('billing:test-connection', data),
  clearBillingConfig: () => ipcRenderer.invoke('billing:clear-config'),

  // Billingo adapter
  billingoGetBlocks: () => ipcRenderer.invoke('billing:billingo:get-blocks'),
  billingoGetBanks: () => ipcRenderer.invoke('billing:billingo:get-banks'),
  billingoEnsurePartner: (clientData: unknown) => ipcRenderer.invoke('billing:billingo:ensure-partner', clientData),
  billingoCreateInvoice: (request: unknown) => ipcRenderer.invoke('billing:billingo:create-invoice', request),
  billingoGetPdf: (invoiceId: number) => ipcRenderer.invoke('billing:billingo:get-pdf', invoiceId),
  billingoCancelInvoice: (invoiceId: number) => ipcRenderer.invoke('billing:billingo:cancel', invoiceId),
  billingoGetStatus: (invoiceId: number) => ipcRenderer.invoke('billing:billingo:get-status', invoiceId),

  // Számlázz.hu adapter
  szamlazzCreateInvoice: (request: unknown) => ipcRenderer.invoke('billing:szamlazz:create-invoice', request),
  szamlazzGetByExternalId: (externalId: string) => ipcRenderer.invoke('billing:szamlazz:get-by-external-id', externalId),
  szamlazzCancelInvoice: (invoiceNumber: string) => ipcRenderer.invoke('billing:szamlazz:cancel', invoiceNumber),

  // Unified billing service
  getActiveProvider: () => ipcRenderer.invoke('billing:get-active-provider'),
  billingCreateInvoice: (request: unknown) => ipcRenderer.invoke('billing:create-invoice', request),

  // Billing sync
  billingSyncInvoices: () => ipcRenderer.invoke('billing:sync-invoices'),
  billingMarkInvoicePaid: (providerInvoiceId: string, provider: string, amount?: number) => ipcRenderer.invoke('billing:mark-invoice-paid', providerInvoiceId, provider, amount),
  billingGetLastSyncTime: () => ipcRenderer.invoke('billing:get-last-sync-time'),
  onBillingSyncUpdated: (callback: (result: unknown) => void) => {
    const handler = (_event: unknown, result: unknown) => callback(result);
    ipcRenderer.on('billing:sync-updated', handler);
    return () => { ipcRenderer.removeListener('billing:sync-updated', handler); };
  },

  // Google Ads
  adsSaveCredentials: (config: { developerToken: string; clientId: string; clientSecret: string; mccId?: string }) => ipcRenderer.invoke('ads:save-credentials', config),
  adsGetCredentials: () => ipcRenderer.invoke('ads:get-credentials'),
  adsClearCredentials: () => ipcRenderer.invoke('ads:clear-credentials'),
  adsStartOAuth: () => ipcRenderer.invoke('ads:start-oauth'),
  adsConnectAccount: (account: { customerId: string; name: string; currency: string; timezone: string; isMcc: boolean; refreshToken: string }) => ipcRenderer.invoke('ads:connect-account', account),
  adsDisconnectAccount: (accountId: string) => ipcRenderer.invoke('ads:disconnect-account', accountId),
  adsGetAccounts: () => ipcRenderer.invoke('ads:get-accounts'),
  adsLinkAccount: (accountId: string, clientId: string | null) => ipcRenderer.invoke('ads:link-account', accountId, clientId),
  adsGetClientAdsSummary: (clientId: string) => ipcRenderer.invoke('ads:get-client-ads-summary', clientId),
  adsGetTotalSpendSummary: () => ipcRenderer.invoke('ads:get-total-spend-summary'),
  adsGetSpendByClient: () => ipcRenderer.invoke('ads:get-spend-by-client'),
  adsListAccounts: () => ipcRenderer.invoke('ads:list-accounts'),

  // Google Ads Sync
  adsSyncAccount: (accountId: string, syncType?: string) => ipcRenderer.invoke('ads:sync-account', accountId, syncType),
  adsSyncAll: (syncType?: string) => ipcRenderer.invoke('ads:sync-all', syncType),
  adsGetSyncLog: (accountId: string, limit?: number) => ipcRenderer.invoke('ads:get-sync-log', accountId, limit),
  adsGetLastSync: (accountId: string) => ipcRenderer.invoke('ads:get-last-sync', accountId),

  // Google Ads Data Queries
  adsGetCampaigns: (accountId: string) => ipcRenderer.invoke('ads:get-campaigns', accountId),
  adsGetAdGroups: (accountId: string, campaignId?: string) => ipcRenderer.invoke('ads:get-ad-groups', accountId, campaignId),
  adsGetKeywords: (accountId: string, adGroupId?: string) => ipcRenderer.invoke('ads:get-keywords', accountId, adGroupId),
  adsGetDailyMetrics: (accountId: string, entityType: string, entityId: string | null, startDate: string, endDate: string) => ipcRenderer.invoke('ads:get-daily-metrics', accountId, entityType, entityId, startDate, endDate),
  adsGetKpiSummary: (accountId: string, startDate: string, endDate: string) => ipcRenderer.invoke('ads:get-kpi-summary', accountId, startDate, endDate),
  adsGetCampaignMetrics: (accountId: string, startDate: string, endDate: string) => ipcRenderer.invoke('ads:get-campaign-metrics', accountId, startDate, endDate),

  // Google Ads AI
  adsRunAnalysis: (accountId: string, analysisType: string, customPrompt?: string) => ipcRenderer.invoke('ads:run-analysis', accountId, analysisType, customPrompt),
  adsGetAnalyses: (accountId: string, limit?: number) => ipcRenderer.invoke('ads:get-analyses', accountId, limit),
  adsGetAnalysis: (id: string) => ipcRenderer.invoke('ads:get-analysis', id),

  // Google Ads Knowledge Base
  adsKbGetAll: () => ipcRenderer.invoke('ads:kb-getAll'),
  adsKbCreate: (title: string, content: string, category?: string) => ipcRenderer.invoke('ads:kb-create', title, content, category),
  adsKbUpdate: (id: string, title: string, content: string, category?: string) => ipcRenderer.invoke('ads:kb-update', id, title, content, category),
  adsKbDelete: (id: string) => ipcRenderer.invoke('ads:kb-delete', id),

  // Google Ads Alerts
  adsGetAlerts: (accountId: string) => ipcRenderer.invoke('ads:get-alerts', accountId),
  adsGetAllAlerts: () => ipcRenderer.invoke('ads:get-all-alerts'),
  adsDismissAlert: (alertId: string) => ipcRenderer.invoke('ads:dismiss-alert', alertId),
  adsGetAlertCount: () => ipcRenderer.invoke('ads:get-alert-count'),
  onAdsAlertsUpdated: (callback: (data: { accountId: string; alertCount: number }) => void) => {
    const handler = (_event: unknown, data: { accountId: string; alertCount: number }) => callback(data);
    ipcRenderer.on('ads:alerts-updated', handler);
    return () => { ipcRenderer.removeListener('ads:alerts-updated', handler); };
  },

  // Google Ads Campaign Detail Data
  adsGetAdGroupAds: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-ad-group-ads', accountId, campaignId),
  adsGetNegativeKeywords: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-negative-keywords', accountId, campaignId),
  adsGetSearchTerms: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-search-terms', accountId, campaignId),
  adsGetAssetGroups: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-asset-groups', accountId, campaignId),
  adsGetAssetGroupAssets: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-asset-group-assets', accountId, campaignId),
  adsGetShoppingPerformance: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-shopping-performance', accountId, campaignId),
  adsGetPlacements: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-placements', accountId, campaignId),
  adsGetKeywordsWithMetrics: (accountId: string, campaignId: string) => ipcRenderer.invoke('ads:get-keywords-with-metrics', accountId, campaignId),
});
