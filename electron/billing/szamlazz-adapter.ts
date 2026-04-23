import { net } from 'electron';
import { getBillingApiKey } from '../billing-store';

const ENDPOINT = 'https://www.szamlazz.hu/szamla/';

// ── Types ──

export interface SzamlazzBuyerData {
  name: string;
  zip: string;
  city: string;
  address: string;
  email?: string;
  taxNumber?: string;
  clientId?: string;
}

export interface SzamlazzInvoiceItem {
  name: string;
  quantity: number;
  unit: string;
  netUnitPrice: number;
  /** Százalékban (pl. 27) vagy szöveges kód (pl. "AAM", "TAM", "EU"). */
  vatRate: number | string;
}

export interface SzamlazzInvoiceRequest {
  externalId: string;
  fulfillmentDate: string;    // YYYY-MM-DD
  dueDate: string;            // YYYY-MM-DD
  paymentMethod: 'bank_transfer' | 'cash' | 'bankcard';
  currency?: string;
  language?: string;
  buyer: SzamlazzBuyerData;
  items: SzamlazzInvoiceItem[];
  sellerBankName?: string;
  sellerBankAccount?: string;
  /** Számla megjegyzése (pl. AAM záradék). */
  comment?: string;
}

export interface SzamlazzInvoiceResult {
  invoiceNumber: string;
  netTotal: number;
  grossTotal: number;
  pdfBase64?: string;
}

export interface SzamlazzQueryResult {
  invoiceNumber: string;
  status: string;
}

// ── Error class ──

class SzamlazzApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'SzamlazzApiError';
  }
}

// ── Payment method mapping ──

export function mapPaymentMethod(method: 'bank_transfer' | 'cash' | 'bankcard'): string {
  switch (method) {
    case 'bank_transfer': return 'Átutalás';
    case 'cash': return 'Készpénz';
    case 'bankcard': return 'Bankkártya';
  }
}

// ── XML helpers ──

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number | boolean): string {
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function roundTo(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function getApiKey(): string {
  const key = getBillingApiKey();
  if (!key) throw new SzamlazzApiError(0, 'Nincs mentett Számlázz.hu Agent kulcs');
  return key;
}

// ── XML builder ──

export function buildInvoiceXml(request: SzamlazzInvoiceRequest, agentKey: string): string {
  const fizmod = mapPaymentMethod(request.paymentMethod);
  const currency = request.currency || 'HUF';
  const language = request.language || 'hu';

  let itemsXml = '';
  for (const item of request.items) {
    const netTotal = roundTo(item.netUnitPrice * item.quantity);
    const rateNumeric = typeof item.vatRate === 'number' ? item.vatRate : 0;
    const vatAmount = roundTo(netTotal * (rateNumeric / 100));
    const grossTotal = roundTo(netTotal + vatAmount);

    itemsXml += `
    <tetel>
      ${tag('megnevezes', item.name)}
      ${tag('mennyiseg', item.quantity)}
      ${tag('mennyisegiEgyseg', item.unit)}
      ${tag('nettoEgysegar', roundTo(item.netUnitPrice))}
      ${tag('afakulcs', item.vatRate)}
      ${tag('nettoErtek', netTotal)}
      ${tag('afaErtek', vatAmount)}
      ${tag('bruttoErtek', grossTotal)}
    </tetel>`;
  }

  const buyerBlock = [
    tag('nev', request.buyer.name),
    tag('irsz', request.buyer.zip),
    tag('telepules', request.buyer.city),
    tag('cim', request.buyer.address),
  ];
  if (request.buyer.email) buyerBlock.push(tag('email', request.buyer.email));
  if (request.buyer.taxNumber) buyerBlock.push(tag('adoszam', request.buyer.taxNumber));
  if (request.buyer.clientId) buyerBlock.push(tag('azonosito', request.buyer.clientId));

  const sellerBlock: string[] = [];
  if (request.sellerBankName) sellerBlock.push(tag('bank', request.sellerBankName));
  if (request.sellerBankAccount) sellerBlock.push(tag('bankszamlaszam', request.sellerBankAccount));

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    ${tag('szamlaagentkulcs', agentKey)}
    ${tag('eszamla', true)}
    ${tag('szamlaLetoltes', true)}
    ${tag('valaszVerzio', 2)}
    ${tag('szamlaKulsoAzon', request.externalId)}
  </beallitasok>
  <fejlec>
    ${tag('keltDatum', new Date().toISOString().slice(0, 10))}
    ${tag('teljesitesDatum', request.fulfillmentDate)}
    ${tag('fizetesiHataridoDatum', request.dueDate)}
    ${tag('fizmod', fizmod)}
    ${tag('penznem', currency)}
    ${tag('szamlaNyelve', language)}${request.comment ? `
    ${tag('megjegyzes', request.comment)}` : ''}
  </fejlec>
  <elado>
    ${sellerBlock.join('\n    ')}
  </elado>
  <vevo>
    ${buyerBlock.join('\n    ')}
  </vevo>
  <tetelek>${itemsXml}
  </tetelek>
</xmlszamla>`;
}

// ── Send XML to Számlázz.hu ──

async function postXml(xmlContent: string, actionName: string): Promise<Response> {
  // Build multipart/form-data manually
  const boundary = `----SzamlazzBoundary${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="action-${actionName}"; filename="${actionName}.xml"\r\n` +
    `Content-Type: application/xml\r\n\r\n` +
    `${xmlContent}\r\n` +
    `--${boundary}--\r\n`;

  let response: Response;
  try {
    response = await net.fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
  } catch (err: any) {
    console.error('[Szamlazz] Network error:', err.message);
    throw new SzamlazzApiError(0, 'Nincs internetkapcsolat');
  }

  return response;
}

function parseErrorFromHeaders(response: Response): void {
  const errorCode = response.headers.get('szlahu_error_code');
  const errorMsg = response.headers.get('szlahu_error');
  if (errorCode) {
    const code = parseInt(errorCode, 10);
    console.error(`[Szamlazz] API error ${code}: ${errorMsg}`);
    if (code === 56) {
      throw new SzamlazzApiError(code, 'Érvénytelen API kulcs');
    }
    if (code >= 259 && code <= 264) {
      throw new SzamlazzApiError(code, 'Tétel számítási hiba');
    }
    throw new SzamlazzApiError(code, errorMsg || `Számlázz.hu hiba (${code})`);
  }
}

// Simple XML tag value extractor (no dependency needed for this simple use case)
function extractXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// ── Invoice creation ──

export async function createInvoice(request: SzamlazzInvoiceRequest): Promise<SzamlazzInvoiceResult> {
  const agentKey = getApiKey();
  const xml = buildInvoiceXml(request, agentKey);
  const response = await postXml(xml, 'xmlagentxmlfile');

  parseErrorFromHeaders(response);

  // Extract invoice number from headers
  const invoiceNumber = response.headers.get('szlahu_szamlaszam');
  const grossStr = response.headers.get('szlahu_bruttovegosszeg');
  const netStr = response.headers.get('szlahu_nettovegosszeg');

  // Read body once
  const bodyBuf = await response.arrayBuffer();
  const bodyBytes = Buffer.from(bodyBuf);

  if (!invoiceNumber) {
    // Try parsing XML body for error
    const bodyText = bodyBytes.toString('utf-8');
    console.error('[Szamlazz] No invoice number in response. Body:', bodyText.substring(0, 500));
    const xmlError = extractXmlValue(bodyText, 'hibakod');
    const xmlMsg = extractXmlValue(bodyText, 'hibauzenet');
    if (xmlError) {
      throw new SzamlazzApiError(parseInt(xmlError, 10), xmlMsg || 'Ismeretlen hiba');
    }
    throw new SzamlazzApiError(0, 'Nem érkezett számlaszám a válaszban');
  }

  // Extract PDF from response body
  let pdfBase64: string | undefined;
  if (bodyBytes.length > 0) {
    // Check if body starts with %PDF (raw PDF bytes)
    if (bodyBytes.subarray(0, 4).toString() === '%PDF') {
      pdfBase64 = bodyBytes.toString('base64');
    } else {
      // valaszVerzio=2: body is XML with <pdf>base64data</pdf>
      const bodyText = bodyBytes.toString('utf-8');
      const pdfMatch = bodyText.match(/<pdf>([^<]+)<\/pdf>/);
      if (pdfMatch) {
        pdfBase64 = pdfMatch[1];
      } else {
        console.warn('[Szamlazz] Response body is neither raw PDF nor XML with <pdf> tag. Length:', bodyBytes.length, 'First 100 chars:', bodyText.substring(0, 100));
      }
    }
  }

  const result: SzamlazzInvoiceResult = {
    invoiceNumber,
    netTotal: netStr ? parseFloat(netStr) : 0,
    grossTotal: grossStr ? parseFloat(grossStr) : 0,
    pdfBase64,
  };

  console.log(`[Szamlazz] Invoice created: ${result.invoiceNumber}, gross: ${result.grossTotal}`);
  return result;
}

// ── Invoice query by external ID ──

export async function getInvoiceByExternalId(externalId: string): Promise<SzamlazzQueryResult | null> {
  const agentKey = getApiKey();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlaxml xmlns="http://www.szamlazz.hu/xmlszamlaxml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  ${tag('szamlaagentkulcs', agentKey)}
  ${tag('szamlaKulsoAzon', externalId)}
  ${tag('valaszVerzio', 2)}
</xmlszamlaxml>`;

  const response = await postXml(xml, 'xmlagentxmlfile');

  const errorCode = response.headers.get('szlahu_error_code');
  if (errorCode) {
    const code = parseInt(errorCode, 10);
    // Error 68 = invoice not found — this is expected
    if (code === 68 || code === 3) {
      return null;
    }
    parseErrorFromHeaders(response);
  }

  const invoiceNumber = response.headers.get('szlahu_szamlaszam');
  if (!invoiceNumber) {
    // Parse XML body
    const bodyText = await response.text();
    const parsedNum = extractXmlValue(bodyText, 'szamlaszam');
    if (!parsedNum) return null;
    return {
      invoiceNumber: parsedNum,
      status: extractXmlValue(bodyText, 'allapot') || 'unknown',
    };
  }

  return {
    invoiceNumber,
    status: 'exists',
  };
}

// ── Invoice cancellation (sztornó) ──

export interface CancelResult {
  stornoInvoiceNumber?: string;
  pdfBase64?: string;
}

export async function cancelInvoice(invoiceNumber: string): Promise<CancelResult> {
  const agentKey = getApiKey();
  const today = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    ${tag('szamlaagentkulcs', agentKey)}
    ${tag('eszamla', true)}
    ${tag('szamlaLetoltes', true)}
    ${tag('valaszVerzio', 2)}
  </beallitasok>
  <fejlec>
    ${tag('szamlaszam', invoiceNumber)}
    ${tag('keltDatum', today)}
    ${tag('teljesitesDatum', today)}
  </fejlec>
</xmlszamlast>`;

  const response = await postXml(xml, 'szamla_agent_st');
  parseErrorFromHeaders(response);

  const stornoNum = response.headers.get('szlahu_szamlaszam');
  console.log(`[Szamlazz] Invoice cancelled: ${invoiceNumber}, storno: ${stornoNum || 'N/A'}`);

  const result: CancelResult = {
    stornoInvoiceNumber: stornoNum || undefined,
  };

  // Extract PDF from response body
  const bodyBuf = await response.arrayBuffer();
  const bodyBytes = Buffer.from(bodyBuf);
  if (bodyBytes.length > 0) {
    if (bodyBytes.subarray(0, 4).toString() === '%PDF') {
      result.pdfBase64 = bodyBytes.toString('base64');
    } else {
      const bodyText = bodyBytes.toString('utf-8');
      const pdfMatch = bodyText.match(/<pdf>([^<]+)<\/pdf>/);
      if (pdfMatch) {
        result.pdfBase64 = pdfMatch[1];
      }
    }
  }

  return result;
}

// ── Mark invoice as paid (kifizetés jóváírása) ──

export async function markInvoicePaid(invoiceNumber: string, amount: number, paymentMethod?: string): Promise<void> {
  const agentKey = getApiKey();
  const today = new Date().toISOString().slice(0, 10);
  const jogcim = paymentMethod || 'Átutalás';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlakifiz xmlns="http://www.szamlazz.hu/xmlszamlakifiz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlakifiz https://www.szamlazz.hu/szamla/docs/xsds/agentkifiz/xmlszamlakifiz.xsd">
  <beallitasok>
    ${tag('szamlaagentkulcs', agentKey)}
    ${tag('szamlaszam', invoiceNumber)}
    ${tag('additiv', false)}
    ${tag('valaszVerzio', 2)}
  </beallitasok>
  <kifizetes>
    ${tag('datum', today)}
    ${tag('jogcim', jogcim)}
    ${tag('osszeg', amount)}
  </kifizetes>
</xmlszamlakifiz>`;

  const response = await postXml(xml, 'szamla_agent_kifiz');
  parseErrorFromHeaders(response);
  console.log(`[Szamlazz] Invoice ${invoiceNumber} marked as paid (${amount})`);
}
