import { describe, expect, it } from 'vitest';
import { resolveInvoiceScenario } from '../../shared/invoice-scenario';

describe('resolveInvoiceScenario', () => {
  // ── Magyar belföldi ──

  it('HU vevő, áfás eladó → standard rate, nincs vatCode, nincs záradék', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'HU',
      buyerEuVatNumber: null,
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('hu-domestic-standard');
    expect(s.vatRate).toBe(27);
    expect(s.vatCode).toBeUndefined();
    expect(s.comment).toBe('');
    expect(s.useEuVatNumberAsTaxCode).toBe(false);
  });

  it('HU vevő, AAM eladó → AAM kód, 0% rate, magyar AAM záradék', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'HU',
      buyerEuVatNumber: null,
      sellerVatStatus: 'exempt',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('hu-domestic-aam');
    expect(s.vatRate).toBe(0);
    expect(s.vatCode).toBe('AAM');
    expect(s.comment).toContain('Áfa tv.');
  });

  // ── EU B2B fordított adózás ──

  it('EU vevő érvényes EU VAT-számmal → EU kód, 0% rate, fordított adózás záradék (default magyar)', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: 'DE123456789',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('eu-b2b');
    expect(s.vatRate).toBe(0);
    expect(s.vatCode).toBe('EU');
    expect(s.comment).toContain('Fordított adózás');
    expect(s.useEuVatNumberAsTaxCode).toBe(true);
  });

  it('EU B2B záradék angol nyelven, ha invoiceLanguage = en', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: 'DE123456789',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
      invoiceLanguage: 'en',
    });
    expect(s.comment).toContain('Reverse charge');
  });

  it('EU B2B záradék magyar nyelven, ha invoiceLanguage = hu', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: 'DE123456789',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
      invoiceLanguage: 'hu',
    });
    expect(s.comment).toContain('Fordított adózás');
  });

  it('EU B2B záradék német nyelven, ha invoiceLanguage = de', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: 'DE123456789',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
      invoiceLanguage: 'de',
    });
    expect(s.comment).toContain('Reverse-Charge');
  });

  // ── EU B2C — a hibás "VAT-exempt" záradék regressziójának fixe ──

  it('EU vevő EU VAT-szám nélkül → HU domestic rate, NINCS auto záradék (B2C-re HU ÁFA jár)', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: '',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('eu-b2c');
    expect(s.vatRate).toBe(27);
    expect(s.vatCode).toBeUndefined();
    expect(s.comment).toBe('');
    expect(s.useEuVatNumberAsTaxCode).toBe(false);
  });

  // ── A korábbi "űrlap hazudik" hibák regressziós tesztjei ──

  it('AAM eladó és EU B2C vevő → AAM-nek kell érvényesülnie (eladó státusz előbb)', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: null,
      sellerVatStatus: 'exempt',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('hu-domestic-aam');
    expect(s.vatCode).toBe('AAM');
    expect(s.vatRate).toBe(0);
  });

  it('AAM eladó és EU B2B vevő → fordított adózás nyer (B2B az EU vatCode-ot generálja)', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: 'DE123456789',
      sellerVatStatus: 'exempt',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('eu-b2b');
    expect(s.vatCode).toBe('EU');
  });

  it('Whitespace-only EU VAT-szám B2B-ként ne számítson', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'DE',
      buyerEuVatNumber: '   ',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('eu-b2c');
  });

  // ── Harmadik ország ──

  it('USA vevő → EUK kód, 0% rate, export záradék (default magyar)', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'US',
      buyerEuVatNumber: null,
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('third-country');
    expect(s.vatRate).toBe(0);
    expect(s.vatCode).toBe('EUK');
    expect(s.comment).toContain('export');
  });

  // ── Edge case-ek ──

  it('Üres / null countryCode → HU domestic alapértelmezésnek vesszük', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: null,
      buyerEuVatNumber: null,
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('hu-domestic-standard');
  });

  it('Kis-/nagybetűs országkód mindig EU-nak számít', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'de',
      buyerEuVatNumber: 'DE123456789',
      sellerVatStatus: 'standard',
      defaultDomesticRate: 27,
    });
    expect(s.kind).toBe('eu-b2b');
  });

  it('Egyéb HU ÁFA kulcsot átengedi (pl. 18% kedvezményes)', () => {
    const s = resolveInvoiceScenario({
      buyerCountryCode: 'HU',
      buyerEuVatNumber: null,
      sellerVatStatus: 'standard',
      defaultDomesticRate: 18,
    });
    expect(s.vatRate).toBe(18);
  });
});
