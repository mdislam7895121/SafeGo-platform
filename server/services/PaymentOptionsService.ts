import { prisma } from "../lib/prisma";

interface PaymentMethodOption {
  methodCode: string;
  displayName: string;
  description: string;
  provider: string;
  iconName: string;
  supportsSaving: boolean;
  isDefaultCandidate: boolean;
  priority: number;
  sortOrder: number;
}

interface CustomerSavedMethod {
  id: string;
  methodCode: string;
  provider: string;
  label: string;
  maskedDetails: string;
  isDefault: boolean;
  isActive: boolean;
  providerType: string;
  walletBrand: string | null;
}

interface PaymentOptionsResult {
  countryCode: string;
  currencyCode: string;
  serviceType: string;
  availableMethods: PaymentMethodOption[];
  savedMethods: CustomerSavedMethod[];
  selectedDefaultMethodCode: string;
}

const COUNTRY_CURRENCIES: Record<string, string> = {
  US: "USD",
  BD: "BDT",
};

const DEFAULT_METHOD_ICONS: Record<string, string> = {
  stripe_card: "credit-card",
  apple_pay: "smartphone",
  google_pay: "smartphone",
  bkash: "smartphone",
  nagad: "smartphone",
  rocket: "smartphone",
  upay: "smartphone",
  sslcommerz: "credit-card",
  sslcommerz_online: "credit-card",
  cash: "banknote",
};

const DEFAULT_METHOD_NAMES: Record<string, string> = {
  stripe_card: "Debit/Credit Card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  upay: "Upay",
  sslcommerz: "Card/Bank (SSLCommerz)",
  sslcommerz_online: "Online Payment (Cards & Wallets)",
  cash: "Cash",
};

const DEFAULT_METHOD_DESCRIPTIONS: Record<string, string> = {
  stripe_card: "Pay securely with Visa, Mastercard, or AmEx",
  apple_pay: "Quick payment with Apple Pay",
  google_pay: "Quick payment with Google Pay",
  bkash: "Pay with bKash mobile wallet",
  nagad: "Pay with Nagad mobile wallet",
  rocket: "Pay with Rocket mobile wallet",
  upay: "Pay with Upay mobile wallet",
  sslcommerz: "Pay with cards or bank transfer",
  sslcommerz_online: "Pay securely with cards, mobile wallets, and bank accounts via SSLCOMMERZ",
  cash: "Pay your driver or restaurant in cash",
};

function isBdOnlinePaymentsEnabled(): boolean {
  const featureEnabled = process.env.FEATURE_BD_ONLINE_PAYMENTS_ENABLED === "true";
  const hasCredentials = !!process.env.SSLCOMMERZ_STORE_ID_BD || !!process.env.SSLCOMMERZ_SANDBOX_STORE_ID_BD;
  return featureEnabled && hasCredentials;
}

export class PaymentOptionsService {
  static async getAvailableMethodsForCustomer(
    customerId: string,
    serviceType: string = "GLOBAL"
  ): Promise<PaymentOptionsResult> {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      include: {
        user: { select: { countryCode: true } },
        paymentMethods: {
          where: { status: "active" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const countryCode = customer.user.countryCode || "US";
    const currencyCode = COUNTRY_CURRENCIES[countryCode] || "USD";

    const configs = await prisma.countryPaymentConfig.findMany({
      where: {
        countryCode,
        isEnabled: true,
        OR: [
          { serviceType: serviceType.toUpperCase() },
          { serviceType: "GLOBAL" },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { priority: "desc" }],
    });

    const bdOnlineEnabled = isBdOnlinePaymentsEnabled();
    
    const filteredConfigs = configs.filter((config) => {
      if (countryCode === "BD" && config.provider === "sslcommerz" && !bdOnlineEnabled) {
        return false;
      }
      return true;
    });

    const availableMethods: PaymentMethodOption[] = filteredConfigs.map((config) => ({
      methodCode: config.methodType,
      displayName: config.displayName || DEFAULT_METHOD_NAMES[config.methodType] || config.methodType,
      description: config.description || DEFAULT_METHOD_DESCRIPTIONS[config.methodType] || "",
      provider: config.provider,
      iconName: config.iconName || DEFAULT_METHOD_ICONS[config.methodType] || "credit-card",
      supportsSaving: config.supportsSaving,
      isDefaultCandidate: config.isDefaultForCountry,
      priority: config.priority,
      sortOrder: config.sortOrder,
    }));

    const hasCash = availableMethods.some((m) => m.methodCode === "cash");
    if (!hasCash) {
      availableMethods.push({
        methodCode: "cash",
        displayName: "Cash",
        description: "Pay your driver or restaurant in cash",
        provider: "cash",
        iconName: "banknote",
        supportsSaving: false,
        isDefaultCandidate: false,
        priority: 0,
        sortOrder: 999,
      });
    }

    const savedMethods: CustomerSavedMethod[] = customer.paymentMethods.map((pm) => ({
      id: pm.id,
      methodCode: pm.providerType === "mobile_wallet" ? (pm.walletBrand || "mobile_wallet") : "stripe_card",
      provider: pm.provider,
      label: pm.billingName || `${pm.brand || "Card"} ending in ${pm.last4}`,
      maskedDetails: pm.providerType === "mobile_wallet" 
        ? (pm.walletPhoneMasked || "••••") 
        : `•••• ${pm.last4}`,
      isDefault: pm.isDefault,
      isActive: pm.status === "active",
      providerType: pm.providerType || "card",
      walletBrand: pm.walletBrand,
    }));

    let selectedDefaultMethodCode = "cash";
    const defaultSaved = savedMethods.find((m) => m.isDefault);
    if (defaultSaved) {
      selectedDefaultMethodCode = defaultSaved.methodCode;
    } else {
      const defaultConfig = availableMethods.find((m) => m.isDefaultCandidate);
      if (defaultConfig) {
        selectedDefaultMethodCode = defaultConfig.methodCode;
      }
    }

    return {
      countryCode,
      currencyCode,
      serviceType,
      availableMethods,
      savedMethods,
      selectedDefaultMethodCode,
    };
  }

  static async getAvailableMethodsByCountry(
    countryCode: string,
    serviceType: string = "GLOBAL"
  ): Promise<PaymentMethodOption[]> {
    const configs = await prisma.countryPaymentConfig.findMany({
      where: {
        countryCode,
        isEnabled: true,
        OR: [
          { serviceType: serviceType.toUpperCase() },
          { serviceType: "GLOBAL" },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { priority: "desc" }],
    });

    const bdOnlineEnabled = isBdOnlinePaymentsEnabled();
    
    const filteredConfigs = configs.filter((config) => {
      if (countryCode === "BD" && config.provider === "sslcommerz" && !bdOnlineEnabled) {
        return false;
      }
      return true;
    });

    const methods: PaymentMethodOption[] = filteredConfigs.map((config) => ({
      methodCode: config.methodType,
      displayName: config.displayName || DEFAULT_METHOD_NAMES[config.methodType] || config.methodType,
      description: config.description || DEFAULT_METHOD_DESCRIPTIONS[config.methodType] || "",
      provider: config.provider,
      iconName: config.iconName || DEFAULT_METHOD_ICONS[config.methodType] || "credit-card",
      supportsSaving: config.supportsSaving,
      isDefaultCandidate: config.isDefaultForCountry,
      priority: config.priority,
      sortOrder: config.sortOrder,
    }));

    const hasCash = methods.some((m) => m.methodCode === "cash");
    if (!hasCash) {
      methods.push({
        methodCode: "cash",
        displayName: "Cash",
        description: "Pay your driver or restaurant in cash",
        provider: "cash",
        iconName: "banknote",
        supportsSaving: false,
        isDefaultCandidate: false,
        priority: 0,
        sortOrder: 999,
      });
    }

    return methods;
  }

  static async validateMethodForCountry(
    methodCode: string,
    countryCode: string,
    serviceType: string = "GLOBAL"
  ): Promise<boolean> {
    if (methodCode === "cash") return true;

    const config = await prisma.countryPaymentConfig.findFirst({
      where: {
        countryCode,
        methodType: methodCode,
        isEnabled: true,
        OR: [
          { serviceType: serviceType.toUpperCase() },
          { serviceType: "GLOBAL" },
        ],
      },
    });

    return !!config;
  }
}

export default PaymentOptionsService;
