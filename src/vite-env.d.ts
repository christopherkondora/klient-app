/// <reference types="vite/client" />

import type { Client as _SharedClient } from '../shared/types/client';

declare global {

type Client = _SharedClient;

interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;

  // User / Auth
  getUser: () => Promise<UserSettings | null>;
  registerUser: (data: { name: string; email: string; password: string; invoice_platform?: string; onboarding_complete?: boolean }) => Promise<AuthRegisterResult>;
  loginUser: (data: { email: string; password: string }) => Promise<UserSettings>;
  logoutUser: () => Promise<{ success: boolean }>;
  resetPassword: (email: string) => Promise<{ success: boolean }>;
  resendConfirmation: (email: string) => Promise<{ success: boolean }>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean }>;
  checkEmailConfirmed: (data: { email: string; password: string }) => Promise<{ confirmed: boolean; user?: UserSettings }>;
  googleAuth: () => Promise<UserSettings>;
  updateUser: (id: string, data: Partial<UserSettings>) => Promise<UserSettings>;

  // Subscription
  getSubscription: () => Promise<Subscription | null>;
  openCheckout: (data: { plan: 'monthly' | 'yearly' | 'lifetime' }) => Promise<{ success: boolean; url: string }>;
  cancelSubscription: () => Promise<{ success: boolean }>;
  reactivateSubscription: () => Promise<{ success: boolean }>;

  // Update
  getUpdateStatus: () => Promise<{ status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error'; info?: unknown; message?: string }>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (callback: (status: { status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error'; info?: unknown; message?: string }) => void) => () => void;
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  onUpdateError: (callback: (message: unknown) => void) => () => void;

  // Clients
  getClients: () => Promise<Client[]>;
  getClient: (id: string) => Promise<Client>;
  createClient: (data: Partial<Client>) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<Client>;
  deleteClient: (id: string) => Promise<{ success: boolean }>;

  // Projects
  getProjects: (clientId?: string) => Promise<Project[]>;
  getProject: (id: string) => Promise<Project>;
  createProject: (data: Partial<Project>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<{ success: boolean }>;
  closeProject: (id: string) => Promise<{ success: boolean }>;
  markProjectPaid: (id: string, invoiceData: Partial<Invoice>) => Promise<{ success: boolean }>;

  getCompletedHours: () => Promise<{ project_id: string; completed_hours: number }[]>;

  // Calendar
  getCalendarEvents: (startDate: string, endDate: string) => Promise<CalendarEvent[]>;
  createCalendarEvent: (data: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  updateCalendarEvent: (id: string, data: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  deleteCalendarEvent: (id: string) => Promise<{ success: boolean }>;

  // Notes
  getNotes: (projectId?: string) => Promise<Note[]>;
  createNote: (data: Partial<Note>) => Promise<Note>;
  updateNote: (id: string, data: Partial<Note>) => Promise<Note>;
  deleteNote: (id: string) => Promise<{ success: boolean }>;
  getReminders: () => Promise<Note[]>;

  // Recordings
  getRecordings: (clientId?: string) => Promise<Recording[]>;
  createRecording: (data: Partial<Recording>) => Promise<Recording>;
  updateRecording: (id: string, data: Partial<Recording>) => Promise<Recording>;
  deleteRecording: (id: string) => Promise<{ success: boolean }>;
  transcribeRecording: (filePath: string) => Promise<{ text: string; error?: string }>;
  summarizeRecording: (transcription: string) => Promise<{ summary: string; error?: string }>;

  // Shortcuts
  getShortcuts: () => Promise<Shortcut[]>;
  createShortcut: (data: Partial<Shortcut>) => Promise<Shortcut>;
  updateShortcut: (id: string, data: Partial<Shortcut>) => Promise<Shortcut>;
  deleteShortcut: (id: string) => Promise<{ success: boolean }>;

  // Contracts
  getContractTemplates: () => Promise<ContractTemplate[]>;
  getContracts: (clientId?: string) => Promise<Contract[]>;
  generateContract: (data: { templateId: string; clientId: string; projectId?: string; fields: Record<string, string>; contractDate: string }) => Promise<Contract>;
  deleteContract: (id: string) => Promise<{ success: boolean }>;

  // Invoices
  getInvoices: (projectId?: string) => Promise<Invoice[]>;
  getClientInvoices: (clientId: string) => Promise<Invoice[]>;
  createInvoice: (data: Partial<Invoice>) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<Invoice>;
  deleteInvoice: (id: string) => Promise<{ success: boolean; error?: string }>;
  getFinanceStats: () => Promise<FinanceStats>;
  getNextInvoiceNumber: () => Promise<string>;
  getMonthlyRevenue: () => Promise<MonthlyRevenueRow[]>;
  getEnhancedFinanceStats: () => Promise<EnhancedFinanceStats>;
  extractInvoice: (filePath: string) => Promise<{ data: ExtractedInvoice | null; error?: string }>;
  extractExpense: (filePath: string) => Promise<{ data: ExtractedExpense | null; error?: string }>;

  // Expenses
  getExpenses: () => Promise<Expense[]>;
  createExpense: (data: Partial<Expense>) => Promise<Expense>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<{ success: boolean }>;

  // Dashboard
  getDashboardStats: () => Promise<DashboardStats>;
  getTodayNotes: () => Promise<Note[]>;
  getUpcomingDeadlines: () => Promise<Project[]>;

  // File operations
  saveFile: (data: { buffer: number[]; fileName: string; type: string }) => Promise<string>;
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
  getExchangeRate: (from: string, to: string) => Promise<number>;
  openFile: (filePath: string) => Promise<void>;
  exportFile: (data: { sourcePath: string; defaultName: string }) => Promise<string | null>;

  // Files module
  filesGetRoot: () => Promise<string>;
  filesList: (relativePath: string) => Promise<FileEntry[]>;
  filesCreateFolder: (relativePath: string) => Promise<{ success: boolean }>;
  filesRename: (oldPath: string, newPath: string) => Promise<{ success: boolean }>;
  filesDelete: (relativePath: string) => Promise<{ success: boolean }>;
  filesOpenInExplorer: (relativePath: string) => Promise<void>;
  filesOpenFile: (relativePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  filesReadFile: (relativePath: string) => Promise<string | null>;
  filesEnsureClientFolder: (clientName: string) => Promise<string>;
  filesEnsureProjectFolder: (clientName: string, projectName: string) => Promise<string>;
  filesSaveToClientInvoices: (clientName: string, fileName: string, base64Data: string) => Promise<{ relativePath: string; absolutePath: string }>;
  filesRenameFolder: (oldPath: string, newPath: string) => Promise<{ success: boolean; renamed: boolean }>;
  filesCopyFiles: (sourcePaths: string[], targetRelPath: string) => Promise<{ success: boolean; copied: string[] }>;
  filesSelectFiles: () => Promise<string[]>;
  filesSelectFolder: () => Promise<string[]>;
  getFilePathForDrop: (file: File) => string;
  filesGetAbsolutePath: (relativePath: string) => Promise<string>;
  filesMoveFiles: (sourcePaths: string[], targetRelPath: string) => Promise<{ success: boolean; moved: string[] }>;
  filesStartDrag: (relativePaths: string[]) => void;
  filesDuplicate: (relativePath: string) => Promise<{ success: boolean; newName?: string }>;
  filesCopyToClipboard: (relativePaths: string[]) => Promise<{ success: boolean }>;

  // Team members
  getTeamMembers: () => Promise<TeamMember[]>;
  getTeamMember: (id: string) => Promise<TeamMember>;
  createTeamMember: (data: Partial<TeamMember>) => Promise<TeamMember>;
  updateTeamMember: (id: string, data: Partial<TeamMember>) => Promise<TeamMember>;
  deleteTeamMember: (id: string) => Promise<{ success: boolean }>;

  // Project assignments
  getProjectAssignments: (projectId: string) => Promise<ProjectAssignment[]>;
  getMemberAssignments: (teamMemberId: string) => Promise<MemberAssignment[]>;
  assignToProject: (projectId: string, teamMemberId: string, data?: { fee?: number | null; fee_currency?: string; fee_huf?: number | null; notes?: string | null }) => Promise<ProjectAssignment>;
  updateAssignment: (assignmentId: string, data: Partial<ProjectAssignment>) => Promise<ProjectAssignment>;
  unassignFromProject: (projectId: string, teamMemberId: string) => Promise<{ success: boolean }>;

  // Speech recognition (Deepgram streaming)
  startDeepgramStream: () => Promise<{ ok: boolean; error?: string }>;
  sendAudioChunk: (audioBase64: string) => void;
  stopDeepgramStream: () => Promise<{ ok: boolean }>;
  onTranscript: (callback: (data: { text: string; isFinal: boolean }) => void) => () => void;

  // Tax
  getTaxBusinessTypes: () => Promise<TaxBusinessTypeRow[]>;
  getTaxRules: (businessType: string, year: number) => Promise<TaxRuleRow[]>;
  checkTaxEligibility: (businessType: string, revenue: number, employeeCount?: number, year?: number) => Promise<{ eligible: boolean; reasons: string[] }>;
  calculateTax: (input: TaxCalcInput) => Promise<TaxCalcResult>;
  getAvailableTaxTypes: (revenue: number, employeeCount?: number, year?: number) => Promise<string[]>;
  getUserTaxSettings: (year?: number) => Promise<UserTaxSettingsRow | null>;
  setUserTaxSettings: (businessType: string, year?: number) => Promise<{ success: boolean }>;
  getTaxCalculationHistory: (limit?: number) => Promise<TaxCalculationRow[]>;

  // Tax module (new)
  getTaxParameters: (year: number) => Promise<TaxParametersRow | null>;
  getTaxProfile: (userId?: string) => Promise<BusinessProfileRow | null>;
  saveTaxProfile: (profile: BusinessProfileRow) => Promise<{ success: boolean }>;
  searchHipaRates: (query: string) => Promise<HipaRateRow[]>;
  getHipaRate: (megye: string, telepules: string) => Promise<HipaRateRow | null>;
  getFullTaxEstimate: (userId: string | undefined, adoev: number, evesBevétel: number) => Promise<TaxEstimateRow | null>;
  getTaxDeadlines: (userId: string | undefined, adoev: number) => Promise<TaxDeadlineRow[]>;
  getTaxWarnings: (userId: string | undefined, bevétel: number, adoev: number) => Promise<TaxWarningRow[]>;
  compareTaxForms: (bevétel: number, koltsegek: number, adoev: number, hipaKulcs: number, kivet?: number) => Promise<TaxFormComparisonRow[]>;
  getKivaPeriods: (userId: string | undefined, year: number) => Promise<KivaPeriodRow[]>;
  saveKivaPeriod: (userId: string | undefined, input: KivaPeriodSaveInput) => Promise<KivaPeriodRow | null>;
  getKivaAdjustments: (userId: string | undefined, year: number) => Promise<KivaAdjustmentRow[]>;
  createKivaAdjustment: (userId: string | undefined, item: KivaAdjustmentInput) => Promise<KivaAdjustmentRow | null>;
  updateKivaAdjustment: (userId: string | undefined, id: string, patch: Partial<KivaAdjustmentInput>) => Promise<KivaAdjustmentRow | null>;
  deleteKivaAdjustment: (userId: string | undefined, id: string) => Promise<{ success: boolean }>;
  getKivaEstimate: (userId: string | undefined, year: number) => Promise<KivaEstimateRow | null>;

  // Billing / Invoicing config
  setBillingConfig: (data: { platform: string; apiKey?: string; url?: string }) => Promise<{ success: boolean }>;
  getBillingConfig: () => Promise<{ platform: string; hasApiKey: boolean; url?: string }>;
  testBillingConnection: (data: { platform: string }) => Promise<{ success: boolean; error?: string }>;
  clearBillingConfig: () => Promise<{ success: boolean }>;

  // Billingo adapter
  billingoGetBlocks: () => Promise<{ success: boolean; data?: BillingoDocumentBlock[]; error?: string }>;
  billingoGetBanks: () => Promise<{ success: boolean; data?: BillingoBankAccount[]; error?: string }>;
  billingoEnsurePartner: (clientData: BillingoPartnerInput) => Promise<{ success: boolean; partnerId?: number; error?: string }>;
  billingoCreateInvoice: (request: BillingoInvoiceInput) => Promise<{ success: boolean; data?: BillingoInvoiceResult; error?: string }>;
  billingoGetPdf: (invoiceId: number) => Promise<{ success: boolean; data?: string; error?: string }>;
  ensureInvoicePdf: (data: EnsureInvoicePdfInput) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  billingoCancelInvoice: (invoiceId: number) => Promise<{ success: boolean; error?: string }>;
  billingoGetStatus: (invoiceId: number) => Promise<{ success: boolean; status?: string; error?: string }>;

  // Számlázz.hu adapter
  szamlazzCreateInvoice: (request: SzamlazzInvoiceInput) => Promise<{ success: boolean; data?: SzamlazzInvoiceResult; error?: string }>;
  szamlazzGetByExternalId: (externalId: string) => Promise<{ success: boolean; data?: SzamlazzQueryResult | null; error?: string }>;
  szamlazzCancelInvoice: (invoiceNumber: string) => Promise<{ success: boolean; error?: string }>;

  // Unified billing service
  getActiveProvider: () => Promise<{ provider: 'billingo' | 'szamlazz' | null }>;
  billingCreateInvoice: (request: UnifiedInvoiceRequest) => Promise<{ success: boolean; data?: UnifiedInvoiceResult; error?: string }>;

  // Billing sync
  billingSyncInvoices: () => Promise<{ success: boolean; data?: { synced: number; errors: number; total: number }; error?: string }>;
  billingMarkInvoicePaid: (providerInvoiceId: string, provider: string, amount?: number) => Promise<{ success: boolean; error?: string }>;
  billingGetLastSyncTime: () => Promise<{ time: string | null }>;
  onBillingSyncUpdated: (callback: (result: { synced: number; errors: number; total: number }) => void) => () => void;
}


interface UnifiedInvoiceRequest {
  externalId: string;
  clientName: string;
  clientAddress: { postCode: string; city: string; address: string };
  clientEmail?: string;
  clientTaxNumber?: string;
  clientId: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    netUnitPrice: number;
    vatRate: 27 | 18 | 5 | 0;
    /** Speciális áfa kód (pl. 'AAM' alanyi adómentes). Ha meg van adva, a vatRate 0. */
    vatCode?: 'AM' | 'AAM' | 'TAM' | 'EU' | 'EUK' | 'ATHK' | 'MAA' | 'FAD' | 'AKK' | 'K_AFA';
  }>;
  fulfillmentDate: string;
  dueDate: string;
  paymentMethod: 'bank_transfer' | 'cash' | 'bankcard';
  currency: string;
  /** ISO 3166-1 alpha-2 country code of the buyer (e.g. 'HU', 'DE'). Defaults to 'HU'. */
  clientCountryCode?: string;
  /** EU VAT registration number of the buyer (for B2B reverse charge). */
  clientEuVatNumber?: string;
  /** Invoice language code ('hu', 'en', 'de'). Defaults to 'hu'. */
  language?: string;
  /** Exchange rate from invoice currency to HUF (Billingo requires for non-HUF). Auto-fetched by backend if omitted. */
  conversionRate?: number;
  sellerBankName?: string;
  sellerBankAccount?: string;
  /** Számla megjegyzés / záradék (AAM esetén kötelező hivatkozás). */
  comment?: string;
}

interface UnifiedInvoiceResult {
  provider: 'billingo' | 'szamlazz';
  invoiceNumber: string;
  providerInvoiceId: string;
  grossTotal: number;
  netTotal: number;
  pdfBase64?: string;
}

interface SzamlazzBuyerData {
  name: string;
  countryCode?: string;
  zip: string;
  city: string;
  address: string;
  email?: string;
  taxNumber?: string;
  clientId?: string;
}

interface SzamlazzInvoiceItemInput {
  name: string;
  quantity: number;
  unit: string;
  netUnitPrice: number;
  vatRate: number | string;
}

interface SzamlazzInvoiceInput {
  externalId: string;
  fulfillmentDate: string;
  dueDate: string;
  paymentMethod: 'bank_transfer' | 'cash' | 'bankcard';
  currency?: string;
  language?: string;
  buyer: SzamlazzBuyerData;
  items: SzamlazzInvoiceItemInput[];
  sellerBankName?: string;
  sellerBankAccount?: string;
  comment?: string;
}

interface SzamlazzInvoiceResult {
  invoiceNumber: string;
  netTotal: number;
  grossTotal: number;
  pdfBase64?: string;
}

interface SzamlazzQueryResult {
  invoiceNumber: string;
  status: string;
}

interface BillingoDocumentBlock {
  id: number;
  name: string;
  prefix: string;
  type: string;
}

interface BillingoBankAccount {
  id: number;
  name: string;
  account_number: string;
  currency: string;
}

interface BillingoPartnerInput {
  name: string;
  address: { country_code: string; post_code: string; city: string; address: string };
  taxcode?: string;
  emails?: string[];
}

interface BillingoInvoiceItem {
  name: string;
  unit_price: number;
  unit_price_type: 'net' | 'gross';
  quantity: number;
  unit: string;
  vat: string;
}

interface BillingoInvoiceInput {
  vendor_id: string;
  partner_id: number;
  block_id: number;
  fulfillment_date: string;
  due_date: string;
  payment_method: 'bank_transfer' | 'cash' | 'bankcard' | 'paypal';
  language?: string;
  currency?: string;
  items: BillingoInvoiceItem[];
}

interface BillingoInvoiceResult {
  id: number;
  invoice_number: string;
  payment_status: string;
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  path: string;
}

interface Project {
  id: string;
  client_id: string | null;
  client_name?: string;
  client_color?: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  deadline: string | null;
  estimated_hours: number;
  allocated_hours: number;
  is_hours_distributed: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string | null;
  /** Megállapodott projektár (eredeti pénznemben) */
  project_price: number | null;
  /** Pénznem (HUF, EUR, USD, GBP, CHF...) */
  project_price_currency: string | null;
  /** HUF-ban számolt érték (statisztikákhoz) */
  project_price_huf: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface CalendarEvent {
  id: string;
  project_id: string | null;
  project_name?: string;
  client_id?: string;
  client_name?: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  actual_minutes: number | null;
  type: 'work' | 'meeting' | 'deadline' | 'reminder' | 'other';
  color: string;
  created_at: string;
}

interface Note {
  id: string;
  project_id: string | null;
  client_id: string | null;
  project_name?: string;
  client_name?: string;
  title: string;
  content: string;
  date: string;
  color: string;
  pinned: number;
  is_notification?: number;
  reminder_date?: string | null;
  created_at: string;
  updated_at: string;
}

interface Recording {
  id: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  file_path: string;
  duration_seconds: number;
  transcription: string | null;
  ai_summary: string | null;
  created_at: string;
}

interface Shortcut {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

interface Contract {
  id: string;
  project_id: string | null;
  client_id: string;
  client_name?: string;
  project_name?: string;
  name: string;
  file_path: string;
  signed_date: string | null;
  created_at: string;
}

interface ContractTemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  suffix?: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  fields: ContractTemplateField[];
}

interface Invoice {
  id: string;
  project_id: string | null;
  client_id: string;
  project_name?: string;
  client_name?: string;
  client_color?: string;
  file_path: string | null;
  invoice_number: string;
  amount: number;
  currency: string;
  amount_huf: number | null;
  /** ÁFA kulcs százalékban (pl. 27, 18, 5, 0) */
  vat_rate: number | null;
  /** Nettó összeg eredeti devizában */
  net_amount: number | null;
  /** ÁFA összeg eredeti devizában */
  vat_amount: number | null;
  /** Nettó HUF-ban */
  net_amount_huf: number | null;
  /** ÁFA HUF-ban */
  vat_amount_huf: number | null;
  issue_date: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  type: 'invoice' | 'manual';
  notes: string | null;
  provider: 'billingo' | 'szamlazz' | null;
  provider_invoice_id: string | null;
  provider_synced_at: string | null;
  /** Beérkezés (kifizetés) napja — pénzforgalmi elszámoláshoz (Sztv. §60) */
  paid_date: string | null;
  /** Beérkezés napi árfolyam (currency → HUF) */
  paid_exchange_rate: number | null;
  /** Ténylegesen befolyt összeg HUF-ban (paid_date-i árfolyamon) */
  paid_amount_huf: number | null;
  /** Kiállítás napi árfolyam (tájékoztató — amount_huf ezzel számolt) */
  issue_exchange_rate: number | null;
  created_at: string;
}

interface FinanceStats {
  paidThisMonth: number;
  pendingTotal: number;
  expectedRevenue: number;
  avgHourlyRate: number;
  expectedBreakdown: { projectName: string; clientName: string; hours: number; value: number; isInvoiced: boolean; isCompleted: boolean }[];
}

interface MonthlyRevenueRow {
  month: string;
  client_id: string;
  client_name: string;
  client_color: string;
  total: number;
}

interface ExtractedInvoice {
  invoice_number: string | null;
  client_name: string | null;
  amount: number | null;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  is_incoming: boolean;
}

interface ExtractedExpense {
  name: string | null;
  amount: number | null;
  currency: string;
  category: string | null;
  type: 'subscription' | 'investment' | null;
  frequency: 'monthly' | 'yearly' | 'one-time' | null;
  date: string | null;
  vendor: string | null;
  notes: string | null;
  subscription_hint: string | null;
  extra_amount: number | null;
  extra_description: string | null;
}

interface Expense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  amount_huf: number | null;
  /** ÁFA kulcs százalékban */
  vat_rate: number | null;
  net_amount: number | null;
  vat_amount: number | null;
  net_amount_huf: number | null;
  vat_amount_huf: number | null;
  /** Visszaigényelhető-e az áfa (áfakörös usernél alapértelmezésben true) */
  vat_deductible: number;
  category: string;
  type: 'subscription' | 'investment';
  frequency: 'monthly' | 'yearly' | 'one-time';
  start_date: string;
  end_date: string | null;
  notes: string | null;
  extra_amount: number | null;
  extra_description: string | null;
  created_at: string;
}

interface EnhancedFinanceStats {
  paidLastMonth: number;
  yearlyRevenue: number;
  /** Nettó éves árbevétel (áfa nélkül) */
  yearlyNetRevenue: number;
  /** Beszéphető (kötelezettség) áfa YTD */
  vatPayable: number;
  /** Levonható áfa YTD (beszerzések után) */
  vatDeductible: number;
  /** Befizetendő áfa YTD (payable − deductible) */
  vatBalance: number;
  yearlyMonthly: { month: string; total: number }[];
  topClients: { id: string; name: string; color: string; total: number; invoice_count: number }[];
  avgPaymentDays: number;
  monthlyExpenses: number;
  yearlyExpenses: number;
  monthlyPayroll: number;
  openContractorFees: number;
  revenueGoal: number;
  profitGoal: number;
  vatStatus: 'exempt' | 'standard';
  expensesByCategory: { category: string; total: number }[];
  monthlyExpensesTrend: { month: string; total: number }[];
  teamCostItems: {
    id: string;
    assigned_at: string;
    fee: number;
    fee_currency: string;
    fee_huf: number | null;
    member_name: string;
    member_role: string | null;
    employment_type: string;
    project_name: string;
  }[];
  employeeSalaryItems: {
    id: string;
    name: string;
    role: string | null;
    monthly_salary: number;
    salary_currency: string | null;
    salary_huf: number | null;
  }[];
}

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  activeProjects: number;
  completedProjects: number;
  totalRevenue: number;
  pendingRevenue: number;
  thisMonthRevenue: number;
  thisWeekRevenue: number;
  thisYearRevenue: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  hourly_rate: number | null;
  employment_type: 'employee' | 'contractor' | 'freelancer';
  status: 'active' | 'vacation' | 'inactive' | null;
  monthly_salary: number | null;
  salary_currency: string | null;
  salary_huf: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectAssignment {
  id: string;
  project_id: string;
  team_member_id: string;
  assigned_at: string;
  notes: string | null;
  fee: number | null;
  fee_currency: string | null;
  fee_huf: number | null;
  member_name?: string;
  member_email?: string;
  member_role?: string;
  member_employment_type?: 'employee' | 'contractor' | 'freelancer';
  member_hourly_rate?: number | null;
}

interface MemberAssignment {
  id: string;
  project_id: string;
  team_member_id: string;
  assigned_at: string;
  notes: string | null;
  project_name?: string;
  project_status?: string;
}

interface UserSettings {
  id: string;
  name: string;
  email: string;
  invoice_platform: string;
  onboarding_complete: number;
  pomodoro_project_tracking: number;
  revenue_goal_yearly: number;
  profit_goal_yearly: number;
  company_name: string;
  tax_number: string;
  address: string;
  bank_account: string;
  team_mode: number;
  /** 'exempt' = alanyi mentes (AAM), 'standard' = áfakörös */
  vat_status: 'exempt' | 'standard';
  /** Alapértelmezett áfa kulcs számla készítéskor, százalékban (pl. 27) */
  vat_rate_default: number;
  /** Közösségi adószám (opcionális) */
  vat_number: string;
  /** 1 = vállalkozó (alapértelmezett), 0 = magánszemélyként használja az appot */
  is_business: number;
  created_at: string;
}

interface AuthRegisterResult {
  requiresEmailConfirmation: boolean;
  email?: string;
  message?: string;
  user?: UserSettings;
}

interface EnsureInvoicePdfInput {
  invoiceId?: string;
  filePath?: string | null;
  provider?: string | null;
  providerInvoiceId?: string | null;
  clientName?: string | null;
  invoiceNumber?: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  status: 'trial' | 'active' | 'cancelled' | 'expired' | 'past_due';
  plan: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TaxBusinessTypeRow {
  id: string;
  code: string;
  name_hu: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

interface TaxRuleRow {
  id: string;
  business_type: string;
  year: number;
  rate_percent: number;
  rate_label: string;
  notes: string | null;
}

interface TaxCalcInput {
  businessType: string;
  year: number;
  revenue: number;
  expenses?: number;
  employeeCount?: number;
}

interface TaxCalcResult {
  businessType: string;
  year: number;
  taxAmount: number;
  effectiveRate: number;
  eligible: boolean;
  warnings: string[];
  breakdown: {
    revenue: number;
    deductibleExpenses: number;
    taxableBase: number;
    appliedRate: number;
    appliedRateLabel: string;
  };
}

interface UserTaxSettingsRow {
  id: string;
  user_id: string;
  business_type: string;
  year: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface TaxCalculationRow {
  id: string;
  user_id: string;
  business_type: string;
  year: number;
  revenue: number;
  expenses: number;
  tax_amount: number;
  calculation_json: string;
  created_at: string;
}

type KivaCompleteness = 'missing' | 'partial' | 'complete';
type KivaPersonalPaymentsMode = 'auto' | 'manual' | 'auto_plus_manual';
type KivaAdjustmentType = 'AAN' | 'AACS';

interface KivaPeriodRow {
  id: string;
  user_id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  auto_personal_payments_huf: number;
  manual_personal_payments_huf: number | null;
  personal_payments_mode: KivaPersonalPaymentsMode;
  calculated_base_huf: number;
  calculated_tax_huf: number;
  completeness: KivaCompleteness;
  notes: string | null;
}

interface KivaPeriodSaveInput {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  manualPersonalPaymentsHuf?: number | null;
  personalPaymentsMode: KivaPersonalPaymentsMode;
  notes?: string | null;
}

interface KivaAdjustmentRow {
  id: string;
  user_id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4 | null;
  type: KivaAdjustmentType;
  category: string;
  amount_huf: number;
  note: string | null;
}

interface KivaAdjustmentInput {
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  type: KivaAdjustmentType;
  category: string;
  amountHuf: number;
  note?: string | null;
}

interface KivaPeriodResultRow {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  personalPaymentsHuf: number;
  aanTotalHuf: number;
  aacsTotalHuf: number;
  baseBeforeMinimumHuf: number;
  baseHuf: number;
  taxHuf: number;
  completeness: KivaCompleteness;
}

interface KivaEstimateRow {
  year: number;
  periods: KivaPeriodResultRow[];
  annualPersonalPaymentsHuf: number;
  annualAanTotalHuf: number;
  annualAacsTotalHuf: number;
  annualBaseBeforeMinimumHuf: number;
  annualBaseHuf: number;
  annualTaxHuf: number;
  quarterlyAdvanceTaxHuf: number;
  settlementDifferenceHuf: number;
  completeness: KivaCompleteness;
  warnings: TaxWarningRow[];
}

// Tax module types
interface TaxParametersRow {
  year: number;
  minimalberHavi: number;
  garantaltBerminimumHavi: number;
  szjaKulcs: number;
  tbKulcs: number;
  szochoKulcs: number;
  taoKulcs: number;
  kivaKulcs: number;
  aamLimit: number;
  atalanyAltalanos: number;
  atalanySpecialis: number;
  atalanyKisker: number;
  atalanyLimitSzorzo: number;
  atalanyAdomentesSzorzo: number;
  szochoPlafonSzorzo: number;
  hipaMaxKulcs: number;
  afaStandard: number;
  afaReduced: number;
  afaSuperReduced: number;
}

interface BusinessProfileRow {
  userId: string;
  vallalkozasTipus: 'EV' | 'Kft' | 'Bt' | 'Kkt';
  adozasForma: 'atalany' | 'vszja' | 'TAO' | 'KIVA';
  foglalkozas: 'fofoglalkozasu' | 'mellekfoglalkozasu';
  koltseghanyad: number;
  szakkepzettseg: boolean;
  aamValasztott: boolean;
  afaBevallas: 'havi' | 'negyedeves' | 'eves';
  hipaKulcs: number;
  hipaTelepules: string;
  hipaEgyszeru: boolean;
  adoev: number;
  beallitva: boolean;
}

interface HipaRateRow {
  megye: string;
  telepules: string;
  kulcs: number;
}

interface TaxEstimateRow {
  adoev: number;
  profil: BusinessProfileRow;
  evesBevétel: number;
  szja: number;
  tb: number;
  szocho: number;
  hipa: number;
  egyebAdo: number;
  osszesen: number;
  negyedevek: Array<{
    quarter: 1 | 2 | 3 | 4;
    bevétel: number;
    szja: number;
    tb: number;
    szocho: number;
    hipa: number;
    osszesen: number;
  }>;
  reszletek: Record<string, unknown>;
  hipaReszletek: Record<string, unknown> | null;
}

interface TaxWarningRow {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

interface TaxDeadlineRow {
  date: string;
  type: string;
  description: string;
  color: string;
}

interface TaxFormComparisonRow {
  forma: string;
  label: string;
  osszesen: number;
  reszletek: Record<string, unknown>;
  status?: 'ready' | 'needs_data';
  note?: string;
}

interface Window {
  electronAPI: ElectronAPI;
}

}
