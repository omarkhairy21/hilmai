/**
 * Currency Conversion Utilities for HilmAI Agent V2
 *
 * Provides functions for:
 * - Fetching real-time exchange rates
 * - Converting amounts between currencies
 * - Normalizing currency codes and names
 * - Caching exchange rates for performance
 *
 * Uses exchangerate-api.io free tier (1,500 requests/month)
 * Falls back to static rates if API unavailable
 */

import { supabaseService } from './supabase';

/**
 * Common currency code normalizations
 * Maps variations and common names to ISO 4217 codes
 */
const CURRENCY_NORMALIZATIONS: Record<string, string> = {
  // Lowercase variations
  aed: 'AED',
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  jpy: 'JPY',
  cny: 'CNY',
  inr: 'INR',
  sar: 'SAR',
  kwd: 'KWT',
  bhd: 'BHD',
  omr: 'OMR',
  qar: 'QAR',
  vnd: 'VND',
  thb: 'THB',
  egp: 'EGP',
  jod: 'JOD',
  lbp: 'LBP',
  mad: 'MAD',
  tnd: 'TND',
  dzd: 'DZD',
  lyd: 'LYD',
  iqd: 'IQD',
  syp: 'SYP',
  pkr: 'PKR',
  bdt: 'BDT',
  php: 'PHP',
  idr: 'IDR',
  myr: 'MYR',
  rub: 'RUB',
  
  // Common names to codes
  dirhams: 'AED',
  dirham: 'AED',
  dollars: 'USD',
  dollar: 'USD',
  euros: 'EUR',
  euro: 'EUR',
  pounds: 'GBP',
  pound: 'GBP',
  yen: 'JPY',
  yuan: 'CNY',
  rupees: 'INR',
  rupee: 'INR',
  riyals: 'SAR',
  riyal: 'SAR',
  dong: 'VND',
  baht: 'THB',
  pesos: 'PHP',
  peso: 'PHP',
  dinar: 'JOD',
  dinars: 'JOD',
  ruble: 'RUB',
  rubles: 'RUB',
};

/**
 * Valid ISO 4217 currency codes
 * Common currencies used in the system
 */
const VALID_CURRENCIES = new Set([
  // Major global currencies
  'AED', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD',
  'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON',
  'TRY', 'MXN', 'BRL', 'ZAR', 'KRW', 'SGD', 'HKD', 'NZD',
  
  // MENA region currencies
  'SAR', 'KWT', 'BHD', 'OMR', 'QAR', 'EGP', 'JOD', 'LBP',
  'MAD', 'TND', 'DZD', 'LYD', 'IQD', 'SYP',
  
  // Southeast Asia
  'VND', 'THB', 'PHP', 'IDR', 'MYR',
  
  // South Asia
  'PKR', 'BDT',
  
  // Other
  'RUB',
]);

/**
 * Fallback exchange rates (relative to USD)
 * Used when API is unavailable
 * Updated: November 2024
 */
const FALLBACK_RATES: Record<string, number> = {
  // Major global currencies
  USD: 1.0,
  EUR: 0.93,     // Euro
  GBP: 0.79,     // British Pound
  JPY: 149.5,    // Japanese Yen
  CNY: 7.24,     // Chinese Yuan
  CAD: 1.39,     // Canadian Dollar
  AUD: 1.54,     // Australian Dollar
  CHF: 0.88,     // Swiss Franc
  SEK: 10.85,    // Swedish Krona
  NOK: 11.05,    // Norwegian Krone
  DKK: 6.93,     // Danish Krone
  PLN: 4.05,     // Polish Zloty
  CZK: 23.5,     // Czech Koruna
  HUF: 365,      // Hungarian Forint
  RON: 4.62,     // Romanian Leu
  TRY: 34.2,     // Turkish Lira
  RUB: 95.5,     // Russian Ruble
  
  // MENA region currencies
  AED: 3.6725,   // UAE Dirham
  SAR: 3.75,     // Saudi Riyal
  KWT: 0.31,     // Kuwaiti Dinar
  BHD: 0.377,    // Bahraini Dinar
  OMR: 0.385,    // Omani Rial
  QAR: 3.64,     // Qatari Riyal
  EGP: 49.2,     // Egyptian Pound
  JOD: 0.71,     // Jordanian Dinar
  LBP: 89500,    // Lebanese Pound
  MAD: 10.1,     // Moroccan Dirham
  TND: 3.15,     // Tunisian Dinar
  DZD: 135,      // Algerian Dinar
  LYD: 4.85,     // Libyan Dinar
  IQD: 1310,     // Iraqi Dinar
  SYP: 13000,    // Syrian Pound
  
  // Asia-Pacific
  VND: 24500,    // Vietnamese Dong
  THB: 35.5,     // Thai Baht
  PHP: 56.5,     // Philippine Peso
  IDR: 15750,    // Indonesian Rupiah
  MYR: 4.48,     // Malaysian Ringgit
  SGD: 1.35,     // Singapore Dollar
  HKD: 7.82,     // Hong Kong Dollar
  KRW: 1320,     // South Korean Won
  INR: 83.2,     // Indian Rupee
  PKR: 278,      // Pakistani Rupee
  BDT: 110,      // Bangladeshi Taka
  
  // Americas
  MXN: 17.2,     // Mexican Peso
  BRL: 4.98,     // Brazilian Real
  
  // Africa
  ZAR: 18.5,     // South African Rand
  
  // Oceania
  NZD: 1.68,     // New Zealand Dollar
};

/**
 * In-memory cache for exchange rates
 * TTL: 24 hours
 */
interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
  baseCurrency: string;
}

let rateCache: ExchangeRateCache | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Normalize currency code to ISO 4217 standard
 * 
 * @param currency - Currency code or name (case-insensitive)
 * @returns Normalized ISO 4217 currency code or null if invalid
 * 
 * @example
 * normalizeCurrency('vnd') // 'VND'
 * normalizeCurrency('dirhams') // 'AED'
 * normalizeCurrency('AED') // 'AED'
 */
export function normalizeCurrency(currency: string): string | null {
  const normalized = currency.trim().toLowerCase();
  
  // Check direct normalization map
  if (CURRENCY_NORMALIZATIONS[normalized]) {
    return CURRENCY_NORMALIZATIONS[normalized];
  }
  
  // Check if already uppercase valid code
  const uppercase = currency.trim().toUpperCase();
  if (VALID_CURRENCIES.has(uppercase)) {
    return uppercase;
  }
  
  return null;
}

/**
 * Validate if a currency code is supported
 * 
 * @param currency - Currency code to validate
 * @returns True if currency is supported
 */
export function isValidCurrency(currency: string): boolean {
  const normalized = normalizeCurrency(currency);
  return normalized !== null && VALID_CURRENCIES.has(normalized);
}

/**
 * Fetch exchange rates from API or fallback
 * 
 * Uses exchangerate-api.io free tier (no API key required for basic usage)
 * Falls back to static rates if API fails
 * 
 * @param baseCurrency - Base currency for rates (default: 'USD')
 * @returns Exchange rates relative to base currency
 */
async function fetchExchangeRates(baseCurrency = 'USD'): Promise<Record<string, number>> {
  // Check cache first
  if (rateCache && 
      rateCache.baseCurrency === baseCurrency && 
      Date.now() - rateCache.timestamp < CACHE_TTL) {
    console.log('[currency] Using cached exchange rates');
    return rateCache.rates;
  }

  try {
    // Try exchangerate-api.io (free tier, no key needed)
    const apiUrl = `https://open.exchangerate-api.com/v6/latest/${baseCurrency}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.rates) {
      console.log('[currency] Fetched exchange rates from API');
      
      // Cache the rates
      rateCache = {
        rates: data.rates,
        timestamp: Date.now(),
        baseCurrency,
      };
      
      return data.rates;
    }
    
    throw new Error('Invalid API response format');
  } catch (error) {
    console.warn('[currency] API fetch failed, using fallback rates:', error);
    
    // Use fallback rates
    return FALLBACK_RATES;
  }
}

/**
 * Get exchange rate between two currencies
 * 
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Exchange rate (multiply amount by this to convert)
 * 
 * @example
 * await getExchangeRate('VND', 'AED') // 0.00015 (1 VND = 0.00015 AED)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // Normalize currencies
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  
  if (!from || !to) {
    throw new Error(`Invalid currency codes: ${fromCurrency} or ${toCurrency}`);
  }
  
  // Same currency = 1:1
  if (from === to) {
    return 1.0;
  }
  
  // Fetch rates (USD-based)
  const rates = await fetchExchangeRates('USD');
  
  // Convert: FROM -> USD -> TO
  // Rate = (1 / FROM_to_USD) * TO_to_USD
  const fromRate = rates[from];
  const toRate = rates[to];
  
  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not available for ${from} or ${to}`);
  }
  
  // Calculate cross rate
  const exchangeRate = toRate / fromRate;
  
  console.log(`[currency] Exchange rate: 1 ${from} = ${exchangeRate.toFixed(6)} ${to}`);
  
  return exchangeRate;
}

/**
 * Convert amount between currencies
 * 
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount and exchange rate used
 * 
 * @example
 * await convertCurrency(125, 'VND', 'AED')
 * // { convertedAmount: 0.02, rate: 0.00015 }
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; rate: number }> {
  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }
  
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = amount * rate;
  
  // Round to 2 decimal places
  const roundedAmount = Math.round(convertedAmount * 100) / 100;
  
  console.log(`[currency] Converted ${amount} ${fromCurrency} to ${roundedAmount} ${toCurrency} (rate: ${rate.toFixed(6)})`);
  
  return {
    convertedAmount: roundedAmount,
    rate,
  };
}

/**
 * Get user's default currency from database
 * 
 * @param userId - User ID (Telegram user ID)
 * @returns User's default currency code or 'AED' if not found
 */
export async function getUserDefaultCurrency(userId: number): Promise<string> {
  try {
    const { data, error } = await supabaseService
      .from('users')
      .select('default_currency')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.warn(`[currency] Failed to fetch user default currency:`, error);
      return 'AED'; // Fallback to AED
    }
    
    return data?.default_currency || 'AED';
  } catch (error) {
    console.error('[currency] Error fetching user default currency:', error);
    return 'AED'; // Fallback to AED
  }
}

/**
 * Update user's default currency in database
 * 
 * @param userId - User ID (Telegram user ID)
 * @param currency - New default currency code
 * @returns True if update successful
 */
export async function updateUserDefaultCurrency(
  userId: number,
  currency: string
): Promise<boolean> {
  const normalized = normalizeCurrency(currency);
  
  if (!normalized) {
    throw new Error(`Invalid currency code: ${currency}`);
  }
  
  try {
    const { error } = await supabaseService
      .from('users')
      .update({ default_currency: normalized })
      .eq('id', userId);
    
    if (error) {
      console.error('[currency] Failed to update user default currency:', error);
      return false;
    }
    
    console.log(`[currency] Updated user ${userId} default currency to ${normalized}`);
    return true;
  } catch (error) {
    console.error('[currency] Error updating user default currency:', error);
    return false;
  }
}

/**
 * Format currency amount for display
 * 
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted string (e.g., "125.00 VND", "3.67 AED")
 */
export function formatCurrency(amount: number, currency: string): string {
  const normalized = normalizeCurrency(currency) || currency.toUpperCase();
  return `${amount.toFixed(2)} ${normalized}`;
}

/**
 * Clear the exchange rate cache
 * Useful for testing or forcing fresh rates
 */
export function clearRateCache(): void {
  rateCache = null;
  console.log('[currency] Exchange rate cache cleared');
}

