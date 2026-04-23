import { net } from 'electron';
import { getBillingApiKey } from '../billing-store';

const BASE_URL = 'https://api.billingo.hu/v3';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// ── Types ──

export interface DocumentBlock {
  id: number;
  name: string;
  prefix: string;
  type: string;
}

export interface BankAccount {
  id: number;
  name: string;
  account_number: string;
  currency: string;
}

export interface BillingoPartnerAddress {
  country_code: string;
  post_code: string;
  city: string;
  address: string;
}

export interface BillingoPartnerData {
  name: string;
  address: BillingoPartnerAddress;
  taxcode?: string;
  emails?: string[];
}

export interface BillingoInvoiceItem {
  name: string;
  unit_price: number;
  unit_price_type: 'net' | 'gross';
  quantity: number;
  unit: string;
  vat: string;
  entitlement?: string;
}

export interface BillingoInvoiceRequest {
  vendor_id: string;
  partner_id: number;
  block_id: number;
  fulfillment_date: string;
  due_date: string;
  payment_method: string;
  electronic?: boolean;
  language?: string;
  currency?: string;
  items: BillingoInvoiceItem[];
  /** Számla megjegyzés / záradék (pl. AAM záradék) */
  comment?: string;
}

export interface BillingoInvoiceResult {
  id: number;
  invoice_number: string;
  payment_status: string;
}

// ── In-memory cache ──

let cachedBlocks: DocumentBlock[] | null = null;
let cachedBankAccounts: BankAccount[] | null = null;

export function clearBillingoCache(): void {
  cachedBlocks = null;
  cachedBankAccounts = null;
}

// ── Error classes ──

class BillingoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'BillingoApiError';
  }
}

// ── HTTP client ──

function getApiKey(): string {
  const key = getBillingApiKey();
  if (!key) throw new BillingoApiError(401, 'Nincs mentett Billingo API kulcs');
  return key;
}

async function billingoFetch(
  method: string,
  path: string,
  body?: unknown,
  retryCount = 0,
): Promise<Response> {
  const apiKey = getApiKey();
  const url = `${BASE_URL}${path}`;

  const opts: RequestInit = {
    method,
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await net.fetch(url, opts);
  } catch (err: any) {
    console.error('[Billingo] Network error:', err.message);
    throw new BillingoApiError(0, 'Nincs internetkapcsolat');
  }

  // Rate limit → retry
  if (response.status === 429 && retryCount < MAX_RETRIES) {
    console.warn(`[Billingo] Rate limited, retry ${retryCount + 1}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    return billingoFetch(method, path, body, retryCount + 1);
  }

  if (response.status === 401 || response.status === 403) {
    console.error('[Billingo] Auth error:', response.status);
    throw new BillingoApiError(response.status, 'Érvénytelen API kulcs');
  }

  if (response.status === 422) {
    let detail = 'Validációs hiba';
    try {
      const err = await response.json() as any;
      console.error('[Billingo] Raw 422 response:', JSON.stringify(err, null, 2));
      detail = JSON.stringify(err, null, 2);
    } catch { /* ignore */ }
    console.error('[Billingo] Validation error:', detail);
    throw new BillingoApiError(422, detail);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json() as any;
      detail = err.message || err.error || detail;
    } catch { /* ignore */ }
    console.error('[Billingo] API error:', detail);
    throw new BillingoApiError(response.status, detail);
  }

  return response;
}

// ── Document blocks (cached) ──

export async function getDocumentBlocks(): Promise<DocumentBlock[]> {
  if (cachedBlocks) return cachedBlocks;
  const res = await billingoFetch('GET', '/document-blocks');
  const data = await res.json() as any;
  cachedBlocks = (data.data ?? data) as DocumentBlock[];
  return cachedBlocks;
}

// ── Bank accounts (cached) ──

export async function getBankAccounts(): Promise<BankAccount[]> {
  if (cachedBankAccounts) return cachedBankAccounts;
  const res = await billingoFetch('GET', '/bank-accounts');
  const data = await res.json() as any;
  cachedBankAccounts = (data.data ?? data) as BankAccount[];
  return cachedBankAccounts;
}

// ── Partner management ──

export async function ensurePartner(clientData: BillingoPartnerData): Promise<number> {
  // Search for existing partner by name
  const searchRes = await billingoFetch('GET', `/partners?query=${encodeURIComponent(clientData.name)}`);
  const searchData = await searchRes.json() as any;
  const partners = searchData.data ?? searchData;

  if (Array.isArray(partners) && partners.length > 0) {
    // Find exact name match (case-insensitive)
    const exact = partners.find(
      (p: any) => p.name?.toLowerCase() === clientData.name.toLowerCase(),
    );
    if (exact) {
      console.log(`[Billingo] Found existing partner: ${exact.id} – ${exact.name}`);
      return exact.id;
    }
  }

  // Create new partner
  const createBody: Record<string, unknown> = {
    name: clientData.name,
    address: {
      country_code: clientData.address.country_code || 'HU',
      post_code: clientData.address.post_code || '',
      city: clientData.address.city || '',
      address: clientData.address.address || '',
    },
    type: 'company',
  };
  if (clientData.taxcode) {
    createBody.taxcode = clientData.taxcode;
  }
  if (clientData.emails?.length) {
    createBody.emails = clientData.emails;
  }

  const createRes = await billingoFetch('POST', '/partners', createBody);
  const created = await createRes.json() as any;
  console.log(`[Billingo] Created partner: ${created.id} – ${created.name}`);
  return created.id as number;
}

// ── Invoice creation ──

export async function createInvoice(request: BillingoInvoiceRequest): Promise<BillingoInvoiceResult> {
  const body: Record<string, unknown> = {
    vendor_id: request.vendor_id,
    partner_id: request.partner_id,
    block_id: request.block_id,
    type: 'invoice',
    electronic: request.electronic !== false,
    fulfillment_date: request.fulfillment_date,
    due_date: request.due_date,
    payment_method: request.payment_method,
    language: request.language || 'hu',
    currency: request.currency || 'HUF',
    items: request.items.map(item => ({
      name: item.name,
      unit_price: item.unit_price,
      unit_price_type: item.unit_price_type || 'net',
      quantity: item.quantity,
      unit: item.unit,
      vat: item.vat,
      entitlement: item.entitlement,
    })),
  };
  if (request.comment) {
    body.comment = request.comment;
  }

  const res = await billingoFetch('POST', '/documents', body);
  const doc = await res.json() as any;
  console.log(`[Billingo] Invoice created: ${doc.id} – ${doc.invoice_number}`);
  return {
    id: doc.id as number,
    invoice_number: doc.invoice_number as string,
    payment_status: doc.payment_status as string,
  };
}

// ── PDF download ──

const PDF_MAX_RETRIES = 5;
const PDF_RETRY_DELAY_MS = 2000;

export async function getInvoicePdf(invoiceId: number): Promise<Buffer> {
  const apiKey = getApiKey();
  const url = `${BASE_URL}/documents/${invoiceId}/download`;

  for (let attempt = 0; attempt <= PDF_MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await net.fetch(url, {
        headers: { 'X-API-KEY': apiKey },
      });
    } catch (err: any) {
      console.error('[Billingo] PDF download network error:', err.message);
      throw new BillingoApiError(0, 'Nincs internetkapcsolat');
    }

    // 202 = PDF not generated yet, retry after delay
    if (response.status === 202) {
      if (attempt < PDF_MAX_RETRIES) {
        console.log(`[Billingo] PDF not ready yet (202), retry ${attempt + 1}/${PDF_MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, PDF_RETRY_DELAY_MS));
        continue;
      }
      throw new BillingoApiError(202, 'A PDF generálás időtúllépése – próbáld újra később');
    }

    if (!response.ok) {
      throw new BillingoApiError(response.status, `PDF letöltés sikertelen: ${response.status}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Sanity check: a valid PDF starts with %PDF
    if (buffer.length < 100 || buffer.subarray(0, 4).toString() !== '%PDF') {
      if (attempt < PDF_MAX_RETRIES) {
        console.warn(`[Billingo] Response is not a valid PDF (${buffer.length} bytes), retrying...`);
        await new Promise(r => setTimeout(r, PDF_RETRY_DELAY_MS));
        continue;
      }
      throw new BillingoApiError(0, 'A letöltött fájl nem érvényes PDF');
    }

    return buffer;
  }

  throw new BillingoApiError(0, 'PDF letöltés sikertelen a maximális próbálkozás után');
}

// ── Invoice cancellation ──

export interface CancelResult {
  stornoInvoiceNumber?: string;
  stornoInvoiceId?: string;
  stornoGrossTotal?: number;
  pdfBase64?: string;
}

export async function cancelInvoice(invoiceId: number): Promise<CancelResult> {
  // Send empty body – Billingo v3 cancel accepts optional DocumentCancellation
  const res = await billingoFetch('POST', `/documents/${invoiceId}/cancel`, {});
  const doc = await res.json() as any;

  // Validate: the response should be the newly created cancellation document
  if (!doc.id || !doc.invoice_number) {
    console.error('[Billingo] Unexpected cancel response:', JSON.stringify(doc, null, 2));
    throw new BillingoApiError(0, 'Váratlan válasz a sztornó művelet során');
  }

  console.log(`[Billingo] Invoice ${invoiceId} cancelled → storno: ${doc.id} (${doc.invoice_number}), gross: ${doc.gross_total}`);

  const result: CancelResult = {
    stornoInvoiceNumber: doc.invoice_number,
    stornoInvoiceId: String(doc.id),
    stornoGrossTotal: typeof doc.gross_total === 'number' ? doc.gross_total : undefined,
  };

  // Download storno PDF
  try {
    const pdfBuf = await getInvoicePdf(doc.id);
    result.pdfBase64 = pdfBuf.toString('base64');
  } catch (err) {
    console.warn('[Billingo] Could not download storno PDF:', err);
  }

  return result;
}

// ── Invoice status ──

export async function getInvoiceStatus(invoiceId: number): Promise<string> {
  const res = await billingoFetch('GET', `/documents/${invoiceId}`);
  const doc = await res.json() as any;
  return doc.payment_status as string; // "paid" | "outstanding" | "overdue"
}

// ── Mark invoice as paid ──

export async function markInvoicePaid(invoiceId: number, paymentMethod?: string): Promise<void> {
  // First get the document to know its gross total and payment method
  const docRes = await billingoFetch('GET', `/documents/${invoiceId}`);
  const doc = await docRes.json() as any;

  if (doc.payment_status === 'paid') {
    console.log(`[Billingo] Invoice ${invoiceId} already paid, skipping`);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const payment = [{
    date: today,
    price: doc.gross_total as number,
    payment_method: paymentMethod || doc.payment_method || 'wire_transfer',
  }];

  await billingoFetch('PUT', `/documents/${invoiceId}/payments`, payment);
  console.log(`[Billingo] Invoice ${invoiceId} marked as paid`);
}

// ── Send invoice by email ──

export async function sendInvoice(invoiceId: number, emails: string[]): Promise<void> {
  if (!emails.length) return;
  await billingoFetch('POST', `/documents/${invoiceId}/send`, { emails });
  console.log(`[Billingo] Invoice ${invoiceId} sent to: ${emails.join(', ')}`);
}
