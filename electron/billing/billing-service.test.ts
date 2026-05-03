import { describe, expect, it } from 'vitest';
import { resolveVatCode } from './billing-service';

describe('resolveVatCode', () => {
  it('uses domestic VAT rate for Hungarian standard-tax clients', () => {
    expect(resolveVatCode('HU', null, 'standard', 27)).toEqual({ vatRate: 27 });
  });

  it('uses AAM code for Hungarian exempt sellers', () => {
    expect(resolveVatCode('HU', null, 'exempt', 27)).toEqual({ vatRate: 0, vatCode: 'AAM' });
  });

  it('uses reverse charge for EU B2B clients with an EU VAT number', () => {
    expect(resolveVatCode('DE', 'DE123456789', 'standard', 27)).toEqual({ vatRate: 0, vatCode: 'EU' });
  });

  it('keeps domestic VAT for EU B2C clients without an EU VAT number', () => {
    expect(resolveVatCode('DE', '', 'standard', 27)).toEqual({ vatRate: 27 });
  });

  it('uses 0% EUK VAT for third-country clients such as the USA', () => {
    expect(resolveVatCode('US', null, 'standard', 27)).toEqual({ vatRate: 0, vatCode: 'EUK' });
  });
});
