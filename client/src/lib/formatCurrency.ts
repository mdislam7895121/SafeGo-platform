const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export interface FormatCurrencyOptions {
  useBanglaDigits?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "USD",
  options: FormatCurrencyOptions = {}
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (numAmount === null || numAmount === undefined || isNaN(numAmount)) {
    return currency === "BDT" ? "৳0.00" : "$0.00";
  }

  const {
    useBanglaDigits = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const normalizedCurrency = currency.toUpperCase();
  
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numAmount);

    if (useBanglaDigits && normalizedCurrency === "BDT") {
      return toBanglaDigits(formatted);
    }

    return formatted;
  } catch {
    if (normalizedCurrency === "BDT") {
      const symbol = "৳";
      const formattedNum = numAmount.toLocaleString("en-US", {
        minimumFractionDigits,
        maximumFractionDigits,
      });
      const result = `${symbol}${formattedNum}`;
      return useBanglaDigits ? toBanglaDigits(result) : result;
    }
    
    return `$${numAmount.toFixed(maximumFractionDigits)}`;
  }
}

export function formatCurrencyBD(
  amount: number | string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  return formatCurrency(amount, "BDT", options);
}

export function formatCurrencyBangla(
  amount: number | string | null | undefined
): string {
  return formatCurrency(amount, "BDT", { useBanglaDigits: true });
}

export function toBanglaDigits(str: string): string {
  return str.replace(/\d/g, (digit) => BANGLA_DIGITS[parseInt(digit, 10)] || digit);
}

export function getCurrencySymbol(currency: string): string {
  const normalizedCurrency = currency.toUpperCase();
  switch (normalizedCurrency) {
    case "BDT":
      return "৳";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return normalizedCurrency;
  }
}

export function getCurrencyByCountry(countryCode: string): string {
  const normalizedCode = countryCode.toUpperCase();
  switch (normalizedCode) {
    case "BD":
    case "BGD":
      return "BDT";
    case "US":
    case "USA":
      return "USD";
    default:
      return "USD";
  }
}
