import type { Region, Currency, ExchangeRates } from '@/types';

export const REGION_CURRENCY: Record<Region, Currency> = {
  MY: 'MYR',
  ID: 'IDR',
  SG: 'SGD',
  TH: 'THB',
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  MYR: 'RM',
  IDR: 'Rp',
  SGD: 'S$',
  THB: '฿',
  USD: 'US$',
};

export function convertPrice(amount: number, from: Currency, to: Currency, rates: ExchangeRates): number {
  if (from === to) return amount;
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];
  if (fromRate === undefined || fromRate === 0) return amount;
  if (toRate === undefined) return amount;
  // Convert to base first, then to target
  const inBase = amount / fromRate;
  return inBase * toRate;
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOL[currency];
}
