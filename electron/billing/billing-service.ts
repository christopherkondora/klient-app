import { getBillingConfig } from '../billing-store';
import * as billingoAdapter from './billingo-adapter';
import * as szamlazzAdapter from './szamlazz-adapter';
import type { DomesticVatRate, HungarianVatCode } from '../../shared/invoice-scenario';

// ── Unified types ──

export interface InvoiceRequest {
  externalId: string;
  clientName: string;
  clientAddress: {
    postCode: string;
    city: string;
    address: string;
  };
  clientEmail?: string;
  clientTaxNumber?: string;
  clientId: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    netUnitPrice: number;
    vatRate: DomesticVatRate;
    /** Speciális áfa kód, pl. 'AAM' (alanyi adómentes), 'TAM' (tárgyi adómentes). Ha meg van adva, a vatRate 0 kell legyen. */
    vatCode?: HungarianVatCode;
  }>;
  fulfillmentDate: string;
  dueDate: string;
  paymentMethod: 'bank_transfer' | 'cash' | 'bankcard';
  currency: string;
  /** ISO 3166-1 alpha-2 country code of the buyer (e.g. 'HU', 'DE'). Defaults to 'HU'. */
  clientCountryCode?: string;
  /** EU VAT registration number of the buyer (e.g. 'DE123456789'). Required for EU B2B reverse-charge. */
  clientEuVatNumber?: string;
  /** Invoice language code (e.g. 'hu', 'en', 'de'). Defaults to 'hu'. */
  language?: string;
  /** Exchange rate from invoice currency to HUF. Required by Billingo for non-HUF invoices. */
  conversionRate?: number;
  sellerBankName?: string;
  sellerBankAccount?: string;
  /** Számla megjegyzés / záradék (pl. AAM esetén kötelező hivatkozás). */
  comment?: string;
}

export interface InvoiceResult {
  provider: 'billingo' | 'szamlazz';
  invoiceNumber: string;
  providerInvoiceId: string;
  grossTotal: number;
  netTotal: number;
  pdfBase64?: string;
}

// ── Active provider check ──

export function getActiveProvider(): 'billingo' | 'szamlazz' | null {
  const cfg = getBillingConfig();
  if ((cfg.platform === 'billingo' || cfg.platform === 'szamlazz') && cfg.hasApiKey) {
    return cfg.platform;
  }
  return null;
}

// ── Mark invoice as paid on provider ──

export async function markInvoicePaid(providerInvoiceId: string, provider: string, amount?: number): Promise<void> {
  if (provider === 'billingo') {
    await billingoAdapter.markInvoicePaid(Number(providerInvoiceId));
  } else if (provider === 'szamlazz') {
    if (!amount) throw new Error('Számlázz.hu kifizetés jóváírásához szükséges az összeg');
    await szamlazzAdapter.markInvoicePaid(providerInvoiceId, amount);
  }
}

// ── Cancel (storno) invoice on provider ──

export interface StornoCancelResult {
  stornoInvoiceNumber?: string;
  stornoInvoiceId?: string;
  grossTotal?: number;
  pdfBase64?: string;
  provider: string;
}

export async function cancelInvoice(providerInvoiceId: string, provider: string): Promise<StornoCancelResult> {
  if (provider === 'billingo') {
    const r = await billingoAdapter.cancelInvoice(Number(providerInvoiceId));
    return {
      stornoInvoiceNumber: r.stornoInvoiceNumber,
      stornoInvoiceId: r.stornoInvoiceId,
      grossTotal: r.stornoGrossTotal,
      pdfBase64: r.pdfBase64,
      provider,
    };
  } else if (provider === 'szamlazz') {
    const r = await szamlazzAdapter.cancelInvoice(providerInvoiceId);
    return { ...r, provider };
  }
  return { provider };
}

// ── Unified invoice creation ──

export async function createInvoice(request: InvoiceRequest): Promise<InvoiceResult> {
  const provider = getActiveProvider();
  if (!provider) throw new Error('Nincs beállítva számlázó integráció');

  if (provider === 'billingo') {
    return createBillingoInvoice(request);
  }
  return createSzamlazzInvoice(request);
}

// ── Address parsing helper ──

function parseAddress(raw: { postCode: string; city: string; address: string }): { post_code: string; city: string; address: string } {
  let postCode = raw.postCode.trim();
  let city = raw.city.trim();
  let address = raw.address.trim();

  // If structured fields are empty, try to parse from address string
  // Hungarian format: "1234 Városnév, Utcanév 1." or "1234 Városnév Utcanév 1."
  if ((!postCode || !city) && address) {
    const match = address.match(/^(\d{4})\s+([^,]+?)(?:,\s*(.+))?$/);
    if (match) {
      if (!postCode) postCode = match[1];
      if (!city) {
        // If there's a comma, the city is before it; otherwise guess first word after zip
        if (match[3]) {
          city = match[2].trim();
          address = match[3].trim();
        } else {
          // "8630 Balatonboglár Wesselényi u. 9." — first word is city
          const parts = match[2].trim().split(/\s+/);
          city = parts[0];
          address = parts.slice(1).join(' ') || match[2].trim();
        }
      }
    }
  }

  return { post_code: postCode || '-', city: city || '-', address: address || '-' };
}

// ── Billingo payment method mapping ──

function mapBillingoPaymentMethod(method: string): string {
  switch (method) {
    case 'bank_transfer': return 'wire_transfer';
    case 'cash': return 'cash';
    case 'bankcard': return 'bankcard';
    default: return 'wire_transfer';
  }
}

// ── Billingo implementation ──

async function createBillingoInvoice(request: InvoiceRequest): Promise<InvoiceResult> {
  const addr = parseAddress(request.clientAddress);
  const countryCode = (request.clientCountryCode || 'HU').toUpperCase();
  const language = request.language || (countryCode === 'HU' ? 'hu' : 'en');

  // 1. Ensure partner exists
  const partnerId = await billingoAdapter.ensurePartner({
    name: request.clientName,
    address: {
      country_code: countryCode,
      post_code: addr.post_code,
      city: addr.city,
      address: addr.address,
    },
    taxcode: request.clientEuVatNumber || request.clientTaxNumber,
    emails: request.clientEmail ? [request.clientEmail] : undefined,
  });

  // 2. Get first document block
  const blocks = await billingoAdapter.getDocumentBlocks();
  if (!blocks.length) throw new Error('Nincs elérhető számlatömb a Billingo fiókban');
  const blockId = blocks[0].id;

  // 3. Create invoice
  const result = await billingoAdapter.createInvoice({
    vendor_id: request.externalId,
    partner_id: partnerId,
    block_id: blockId,
    fulfillment_date: request.fulfillmentDate,
    due_date: request.dueDate,
    payment_method: mapBillingoPaymentMethod(request.paymentMethod),
    electronic: true,
    language,
    currency: request.currency || 'HUF',
    conversion_rate: request.conversionRate,
    items: request.items.map(item => ({
      name: item.name,
      unit_price: item.netUnitPrice,
      unit_price_type: 'net' as const,
      quantity: item.quantity,
      unit: item.unit,
      vat: item.vatCode ? item.vatCode : `${item.vatRate}%`,
    })),
    comment: request.comment,
  });

  // 4. Download PDF
  let pdfBase64: string | undefined;
  try {
    const pdfBuf = await billingoAdapter.getInvoicePdf(result.id);
    pdfBase64 = pdfBuf.toString('base64');
  } catch (err) {
    console.warn('[BillingService] Could not download Billingo PDF:', err);
  }

  // 5. Send invoice to client email
  if (request.clientEmail) {
    try {
      await billingoAdapter.sendInvoice(result.id, [request.clientEmail]);
    } catch (err) {
      console.warn('[BillingService] Could not send Billingo invoice email:', err);
    }
  }

  // 6. Calculate totals
  let netTotal = 0;
  let grossTotal = 0;
  for (const item of request.items) {
    const net = item.netUnitPrice * item.quantity;
    netTotal += net;
    grossTotal += net * (1 + item.vatRate / 100);
  }
  // Round only for HUF (no fractional forints); keep 2 decimals for other currencies
  const isHuf = (request.currency || 'HUF').toUpperCase() === 'HUF';
  const roundAmount = (n: number) => isHuf ? Math.round(n) : Math.round(n * 100) / 100;

  return {
    provider: 'billingo',
    invoiceNumber: result.invoice_number,
    providerInvoiceId: String(result.id),
    grossTotal: roundAmount(grossTotal),
    netTotal: roundAmount(netTotal),
    pdfBase64,
  };
}

// ── Számlázz.hu implementation ──

async function createSzamlazzInvoice(request: InvoiceRequest): Promise<InvoiceResult> {
  const addr = parseAddress(request.clientAddress);
  const language = request.language || ((request.clientCountryCode || 'HU').toUpperCase() === 'HU' ? 'hu' : 'en');
  const result = await szamlazzAdapter.createInvoice({
    externalId: request.externalId,
    fulfillmentDate: request.fulfillmentDate,
    dueDate: request.dueDate,
    paymentMethod: request.paymentMethod,
    currency: request.currency || 'HUF',
    language,
    buyer: {
      name: request.clientName,
      countryCode: request.clientCountryCode,
      zip: addr.post_code,
      city: addr.city,
      address: addr.address,
      email: request.clientEmail,
      taxNumber: request.clientEuVatNumber || request.clientTaxNumber,
      clientId: request.clientId,
    },
    items: request.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      netUnitPrice: item.netUnitPrice,
      vatRate: item.vatCode ? item.vatCode : item.vatRate,
    })),
    sellerBankName: request.sellerBankName,
    sellerBankAccount: request.sellerBankAccount,
    comment: request.comment,
  });

  return {
    provider: 'szamlazz',
    invoiceNumber: result.invoiceNumber,
    providerInvoiceId: result.invoiceNumber,
    grossTotal: result.grossTotal,
    netTotal: result.netTotal,
    pdfBase64: result.pdfBase64,
  };
}
