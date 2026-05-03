import { describe, expect, it } from 'vitest';
import { buildInvoiceXml } from './szamlazz-adapter';

describe('buildInvoiceXml', () => {
  it('serializes third-country EUK VAT code with zero VAT and buyer country', () => {
    const xml = buildInvoiceXml({
      externalId: 'test-us-invoice',
      fulfillmentDate: '2026-04-28',
      dueDate: '2026-05-06',
      paymentMethod: 'bank_transfer',
      currency: 'USD',
      language: 'en',
      buyer: {
        name: 'US Client LLC',
        countryCode: 'US',
        zip: '10001',
        city: 'New York',
        address: '1 Main Street',
        email: 'billing@example.com',
      },
      items: [{
        name: 'Consulting',
        quantity: 1,
        unit: 'db',
        netUnitPrice: 10000,
        vatRate: 'EUK',
      }],
      comment: 'Export of services - outside the scope of EU VAT.',
    }, 'agent-key');

    expect(xml).toContain('<orszag>US</orszag>');
    expect(xml).toContain('<afakulcs>EUK</afakulcs>');
    expect(xml).toContain('<nettoErtek>10000</nettoErtek>');
    expect(xml).toContain('<afaErtek>0</afaErtek>');
    expect(xml).toContain('<bruttoErtek>10000</bruttoErtek>');
  });
});