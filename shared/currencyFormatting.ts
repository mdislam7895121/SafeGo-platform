/**
 * Phase 4: Currency Formatting Service
 * 
 * Supports:
 * - BDT (৳) with Bangladeshi grouping: 1,25,000.50 (lakhs/crores system)
 * - USD ($) with standard grouping: 125,000.50
 * 
 * Usage:
 *   formatCurrency(125000.50, 'BDT') // "৳1,25,000.50"
 *   formatCurrency(125000.50, 'USD') // "$125,000.50"
 */

export type SupportedCurrency = 'BDT' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  decimals: number;
  groupingSeparator: string;
  decimalSeparator: string;
  groupingPattern: 'standard' | 'indian'; // indian = 1,00,000 system
}

const currencyConfigs: Record<SupportedCurrency, CurrencyConfig> = {
  BDT: {
    code: 'BDT',
    symbol: '৳',
    symbolPosition: 'prefix',
    decimals: 2,
    groupingSeparator: ',',
    decimalSeparator: '.',
    groupingPattern: 'indian', // Bangladesh uses Indian number system
  },
  USD: {
    code: 'USD',
    symbol: '$',
    symbolPosition: 'prefix',
    decimals: 2,
    groupingSeparator: ',',
    decimalSeparator: '.',
    groupingPattern: 'standard',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    symbolPosition: 'prefix',
    decimals: 2,
    groupingSeparator: '.',
    decimalSeparator: ',',
    groupingPattern: 'standard',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    symbolPosition: 'prefix',
    decimals: 2,
    groupingSeparator: ',',
    decimalSeparator: '.',
    groupingPattern: 'standard',
  },
};

/**
 * Format a number using Indian/Bangladeshi grouping system
 * Pattern: 1,00,00,000 (groups of 2 after first group of 3 from right)
 */
function formatWithIndianGrouping(num: number, decimals: number): string {
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart] = absNum.toFixed(decimals).split('.');
  
  // Apply Indian grouping to integer part
  const numStr = integerPart;
  const len = numStr.length;
  
  if (len <= 3) {
    // No grouping needed for numbers under 1000
    const result = decimalPart ? `${numStr}.${decimalPart}` : numStr;
    return isNegative ? `-${result}` : result;
  }
  
  // Take last 3 digits
  let result = numStr.slice(-3);
  let remaining = numStr.slice(0, -3);
  
  // Group remaining digits in pairs
  while (remaining.length > 0) {
    const group = remaining.slice(-2);
    result = `${group},${result}`;
    remaining = remaining.slice(0, -2);
  }
  
  // Remove leading comma if exists
  if (result.startsWith(',')) {
    result = result.slice(1);
  }
  
  // Add decimal part
  if (decimalPart) {
    result = `${result}.${decimalPart}`;
  }
  
  return isNegative ? `-${result}` : result;
}

/**
 * Format a number using standard Western grouping
 * Pattern: 1,000,000 (groups of 3)
 */
function formatWithStandardGrouping(num: number, decimals: number, config: CurrencyConfig): string {
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart] = absNum.toFixed(decimals).split('.');
  
  // Apply standard grouping to integer part
  const numStr = integerPart;
  let result = '';
  let count = 0;
  
  for (let i = numStr.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      result = config.groupingSeparator + result;
    }
    result = numStr[i] + result;
    count++;
  }
  
  // Add decimal part
  if (decimalPart) {
    result = `${result}${config.decimalSeparator}${decimalPart}`;
  }
  
  return isNegative ? `-${result}` : result;
}

/**
 * Main currency formatting function
 * 
 * @param amount - The numeric amount to format
 * @param currency - The currency code ('BDT', 'USD', 'EUR', 'GBP')
 * @param options - Optional formatting options
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(125000.50, 'BDT')  // "৳1,25,000.50"
 * formatCurrency(125000.50, 'USD')  // "$125,000.50"
 * formatCurrency(-5000, 'BDT')      // "-৳5,000.00"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: SupportedCurrency = 'USD',
  options?: {
    showSymbol?: boolean;
    showDecimals?: boolean;
    decimals?: number;
  }
): string {
  // Handle null/undefined
  if (amount === null || amount === undefined) {
    return formatCurrency(0, currency, options);
  }
  
  // Parse string amounts
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN
  if (isNaN(numAmount)) {
    return formatCurrency(0, currency, options);
  }
  
  const config = currencyConfigs[currency] || currencyConfigs.USD;
  const showSymbol = options?.showSymbol !== false;
  const decimals = options?.decimals ?? (options?.showDecimals === false ? 0 : config.decimals);
  
  // Format the number based on grouping pattern
  let formattedNumber: string;
  if (config.groupingPattern === 'indian') {
    formattedNumber = formatWithIndianGrouping(numAmount, decimals);
  } else {
    formattedNumber = formatWithStandardGrouping(numAmount, decimals, config);
  }
  
  // Add currency symbol
  if (showSymbol) {
    if (config.symbolPosition === 'prefix') {
      return `${config.symbol}${formattedNumber}`;
    } else {
      return `${formattedNumber}${config.symbol}`;
    }
  }
  
  return formattedNumber;
}

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return currencyConfigs[currency]?.symbol || '$';
}

/**
 * Get currency config for a currency code
 */
export function getCurrencyConfig(currency: SupportedCurrency): CurrencyConfig {
  return currencyConfigs[currency] || currencyConfigs.USD;
}

/**
 * Format currency based on country code
 * Maps country codes to their default currencies
 */
export function formatCurrencyByCountry(
  amount: number | string | null | undefined,
  countryCode: string,
  options?: {
    showSymbol?: boolean;
    showDecimals?: boolean;
    decimals?: number;
  }
): string {
  const currencyMap: Record<string, SupportedCurrency> = {
    'BD': 'BDT',
    'US': 'USD',
    'UK': 'GBP',
    'GB': 'GBP',
    'EU': 'EUR',
    'DE': 'EUR',
    'FR': 'EUR',
    'IT': 'EUR',
    'ES': 'EUR',
  };
  
  const currency = currencyMap[countryCode.toUpperCase()] || 'USD';
  return formatCurrency(amount, currency, options);
}

/**
 * Parse a formatted currency string back to a number
 * Handles both BDT and USD formats
 */
export function parseCurrency(formattedAmount: string): number {
  if (!formattedAmount) return 0;
  
  // Remove currency symbols
  let cleaned = formattedAmount.replace(/[৳$€£]/g, '').trim();
  
  // Remove grouping separators (commas)
  cleaned = cleaned.replace(/,/g, '');
  
  // Parse the number
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a large number with abbreviation (K, L, Cr for BDT; K, M, B for USD)
 */
export function formatCompactCurrency(
  amount: number | string | null | undefined,
  currency: SupportedCurrency = 'USD'
): string {
  if (amount === null || amount === undefined) {
    return formatCurrency(0, currency);
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    return formatCurrency(0, currency);
  }
  
  const absAmount = Math.abs(numAmount);
  const config = currencyConfigs[currency] || currencyConfigs.USD;
  const isNegative = numAmount < 0;
  
  let formatted: string;
  
  if (currency === 'BDT') {
    // Indian/Bangladeshi system: L (Lakh) = 1,00,000; Cr (Crore) = 1,00,00,000
    if (absAmount >= 10000000) { // 1 Crore
      formatted = `${(absAmount / 10000000).toFixed(2)}Cr`;
    } else if (absAmount >= 100000) { // 1 Lakh
      formatted = `${(absAmount / 100000).toFixed(2)}L`;
    } else if (absAmount >= 1000) {
      formatted = `${(absAmount / 1000).toFixed(1)}K`;
    } else {
      formatted = absAmount.toFixed(2);
    }
  } else {
    // Western system: K, M, B
    if (absAmount >= 1000000000) {
      formatted = `${(absAmount / 1000000000).toFixed(2)}B`;
    } else if (absAmount >= 1000000) {
      formatted = `${(absAmount / 1000000).toFixed(2)}M`;
    } else if (absAmount >= 1000) {
      formatted = `${(absAmount / 1000).toFixed(1)}K`;
    } else {
      formatted = absAmount.toFixed(2);
    }
  }
  
  // Remove trailing zeros after decimal
  formatted = formatted.replace(/\.?0+([KLMBCr]?)$/, '$1');
  
  const result = isNegative ? `-${formatted}` : formatted;
  return `${config.symbol}${result}`;
}
