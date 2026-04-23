import { describe, it, expect } from 'vitest';
import { microsToAmount, calculateROAS, calculateCTR } from './ads-api';

describe('microsToAmount', () => {
  it('converts 1_000_000 micros to 1', () => {
    expect(microsToAmount(1_000_000)).toBe(1);
  });

  it('converts 0 micros to 0', () => {
    expect(microsToAmount(0)).toBe(0);
  });

  it('converts 5_500_000 micros to 5.5', () => {
    expect(microsToAmount(5_500_000)).toBe(5.5);
  });

  it('converts large values correctly', () => {
    expect(microsToAmount(123_456_789_000)).toBe(123456.789);
  });

  it('handles negative micros', () => {
    expect(microsToAmount(-2_000_000)).toBe(-2);
  });
});

describe('calculateROAS', () => {
  it('returns correct ROAS for normal values', () => {
    // conversionsValue = 300, costMicros = 100_000_000 (100 Ft)
    expect(calculateROAS(300, 100_000_000)).toBe(3);
  });

  it('returns 0 when costMicros is 0', () => {
    expect(calculateROAS(500, 0)).toBe(0);
  });

  it('handles fractional ROAS', () => {
    // conversionsValue = 150, costMicros = 200_000_000 (200 Ft)
    expect(calculateROAS(150, 200_000_000)).toBe(0.75);
  });

  it('returns 0 when both values are 0', () => {
    expect(calculateROAS(0, 0)).toBe(0);
  });

  it('handles very small cost', () => {
    // conversionsValue = 1000, costMicros = 1_000_000 (1 Ft)
    expect(calculateROAS(1000, 1_000_000)).toBe(1000);
  });
});

describe('calculateCTR', () => {
  it('returns correct CTR percentage', () => {
    // 50 clicks / 1000 impressions = 5%
    expect(calculateCTR(50, 1000)).toBe(5);
  });

  it('returns 0 when impressions is 0', () => {
    expect(calculateCTR(10, 0)).toBe(0);
  });

  it('returns 0 when both are 0', () => {
    expect(calculateCTR(0, 0)).toBe(0);
  });

  it('returns 100 when clicks equals impressions', () => {
    expect(calculateCTR(100, 100)).toBe(100);
  });

  it('handles very low CTR', () => {
    const ctr = calculateCTR(1, 100_000);
    expect(ctr).toBeCloseTo(0.001, 5);
  });

  it('handles high click values', () => {
    const ctr = calculateCTR(8_500, 100_000);
    expect(ctr).toBe(8.5);
  });
});
