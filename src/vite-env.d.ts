/// <reference types="vite/client" />

interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;

  // User / Auth
  getUser: () => Promise<UserSettings | null>;
  registerUser: (data: { name: string; email: string; password: string; invoice_platform?: string; onboarding_complete?: boolean }) => Promise<UserSettings>;
  loginUser: (data: { email: string; password: string }) => Promise<UserSettings>;
  logoutUser: () => Promise<{ success: boolean }>;
  resetPassword: (email: string) => Promise<{ success: boolean }>;
  checkEmailConfirmed: (data: { email: string; password: string }) => Promise<{ confirmed: boolean; user?: UserSettings }>;
  googleAuth: () => Promise<UserSettings>;
  updateUser: (id: string, data: Partial<UserSettings>) => Promise<UserSettings>;

  // Subscription
  getSubscription: () => Promise<Subscription | null>;
  openCheckout: (data: { plan: 'monthly' | 'yearly' | 'lifetime' }) => Promise<{ success: boolean; url: string }>;

  // Update
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;

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
  transcribeRecording: (filePath: string) => Promise<{ text: string }>;
  summarizeRecording: (transcription: string) => Promise<{ summary: string }>;

  // Shortcuts
  getShortcuts: () => Promise<Shortcut[]>;
  createShortcut: (data: Partial<Shortcut>) => Promise<Shortcut>;
  updateShortcut: (id: string, data: Partial<Shortcut>) => Promise<Shortcut>;
  deleteShortcut: (id: string) => Promise<{ success: boolean }>;

  // Invoices
  getInvoices: (projectId?: string) => Promise<Invoice[]>;
  getClientInvoices: (clientId: string) => Promise<Invoice[]>;
  createInvoice: (data: Partial<Invoice>) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<Invoice>;
  deleteInvoice: (id: string) => Promise<{ success: boolean }>;
  getFinanceStats: () => Promise<FinanceStats>;
  getNextInvoiceNumber: () => Promise<string>;
  getMonthlyRevenue: () => Promise<MonthlyRevenueRow[]>;
  getEnhancedFinanceStats: () => Promise<EnhancedFinanceStats>;
  extractInvoice: (filePath: string) => Promise<{ data: ExtractedInvoice | null; error?: string }>;

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
  filesRenameFolder: (oldPath: string, newPath: string) => Promise<{ success: boolean; renamed: boolean }>;
  filesCopyFiles: (sourcePaths: string[], targetRelPath: string) => Promise<{ success: boolean; copied: string[] }>;
  filesSelectFiles: () => Promise<string[]>;
  filesSelectFolder: () => Promise<string[]>;
  getFilePathForDrop: (file: File) => string;

  // Speech recognition (Deepgram streaming)
  startDeepgramStream: () => Promise<{ ok: boolean; error?: string }>;
  sendAudioChunk: (audioBase64: string) => void;
  stopDeepgramStream: () => Promise<{ ok: boolean }>;
  onTranscript: (callback: (data: { text: string; isFinal: boolean }) => void) => () => void;
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  path: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  client_id: string | null;
  client_name?: string;
  client_color?: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  deadline: string;
  estimated_hours: number;
  allocated_hours: number;
  is_hours_distributed: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string | null;
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
  is_notification: number;
  notification_email: string | null;
  notification_sent: number;
  color: string;
  pinned: number;
  reminder_date: string | null;
  reminder_time: string | null;
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
  issue_date: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  type: 'invoice' | 'manual';
  notes: string | null;
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

interface Expense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  amount_huf: number | null;
  category: string;
  type: 'subscription' | 'investment';
  frequency: 'monthly' | 'yearly' | 'one-time';
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

interface EnhancedFinanceStats {
  paidLastMonth: number;
  yearlyRevenue: number;
  yearlyMonthly: { month: string; total: number }[];
  topClients: { id: string; name: string; color: string; total: number; invoice_count: number }[];
  avgPaymentDays: number;
  monthlyExpenses: number;
  yearlyExpenses: number;
  revenueGoal: number;
  expensesByCategory: { category: string; total: number }[];
  monthlyExpensesTrend: { month: string; total: number }[];
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

interface UserSettings {
  id: string;
  name: string;
  email: string;
  invoice_platform: string;
  onboarding_complete: number;
  pomodoro_project_tracking: number;
  revenue_goal_yearly: number;
  created_at: string;
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

interface Window {
  electronAPI: ElectronAPI;
}
