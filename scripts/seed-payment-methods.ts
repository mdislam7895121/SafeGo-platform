import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PAYMENT_METHODS_SEED = [
  // United States - Stripe-based payments
  {
    countryCode: "US",
    methodType: "stripe_card",
    provider: "stripe",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Credit/Debit Card",
    description: "Pay securely with Visa, Mastercard, or AmEx",
    iconName: "credit-card",
    sortOrder: 1,
    supportsSaving: true,
    isDefaultForCountry: true,
    priority: 100,
  },
  {
    countryCode: "US",
    methodType: "apple_pay",
    provider: "stripe",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Apple Pay",
    description: "Quick payment with Apple Pay",
    iconName: "smartphone",
    sortOrder: 2,
    supportsSaving: false,
    isDefaultForCountry: false,
    priority: 90,
  },
  {
    countryCode: "US",
    methodType: "google_pay",
    provider: "stripe",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Google Pay",
    description: "Quick payment with Google Pay",
    iconName: "smartphone",
    sortOrder: 3,
    supportsSaving: false,
    isDefaultForCountry: false,
    priority: 85,
  },
  {
    countryCode: "US",
    methodType: "cash",
    provider: "cash",
    serviceType: "RIDE",
    isEnabled: true,
    displayName: "Cash",
    description: "Pay your driver in cash",
    iconName: "banknote",
    sortOrder: 10,
    supportsSaving: false,
    isDefaultForCountry: false,
    priority: 10,
  },
  
  // Bangladesh - Mobile Wallets & SSLCommerz
  {
    countryCode: "BD",
    methodType: "bkash",
    provider: "bkash",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "bKash",
    description: "Pay with bKash mobile wallet",
    iconName: "smartphone",
    sortOrder: 1,
    supportsSaving: true,
    isDefaultForCountry: true,
    priority: 100,
    maxAmount: 25000,
  },
  {
    countryCode: "BD",
    methodType: "nagad",
    provider: "nagad",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Nagad",
    description: "Pay with Nagad mobile wallet",
    iconName: "smartphone",
    sortOrder: 2,
    supportsSaving: true,
    isDefaultForCountry: false,
    priority: 95,
    maxAmount: 25000,
  },
  {
    countryCode: "BD",
    methodType: "rocket",
    provider: "rocket",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Rocket",
    description: "Pay with Dutch-Bangla Rocket",
    iconName: "smartphone",
    sortOrder: 3,
    supportsSaving: true,
    isDefaultForCountry: false,
    priority: 80,
    maxAmount: 25000,
  },
  {
    countryCode: "BD",
    methodType: "upay",
    provider: "upay",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Upay",
    description: "Pay with Upay mobile wallet",
    iconName: "smartphone",
    sortOrder: 4,
    supportsSaving: true,
    isDefaultForCountry: false,
    priority: 70,
    maxAmount: 25000,
  },
  {
    countryCode: "BD",
    methodType: "sslcommerz",
    provider: "sslcommerz",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Card/Bank (SSLCommerz)",
    description: "Pay with cards or bank transfer via SSLCommerz",
    iconName: "credit-card",
    sortOrder: 5,
    supportsSaving: true,
    isDefaultForCountry: false,
    priority: 60,
  },
  {
    countryCode: "BD",
    methodType: "cash",
    provider: "cash",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "Cash",
    description: "Pay in cash on delivery",
    iconName: "banknote",
    sortOrder: 10,
    supportsSaving: false,
    isDefaultForCountry: false,
    priority: 50,
  },
];

async function seedPaymentMethods() {
  console.log("Seeding payment methods catalog...");

  for (const method of PAYMENT_METHODS_SEED) {
    const existing = await prisma.countryPaymentConfig.findFirst({
      where: {
        countryCode: method.countryCode,
        methodType: method.methodType,
        serviceType: method.serviceType,
      },
    });

    if (existing) {
      console.log(`  Updating: ${method.countryCode} - ${method.methodType} (${method.serviceType})`);
      await prisma.countryPaymentConfig.update({
        where: { id: existing.id },
        data: method,
      });
    } else {
      console.log(`  Creating: ${method.countryCode} - ${method.methodType} (${method.serviceType})`);
      await prisma.countryPaymentConfig.create({
        data: method,
      });
    }
  }

  console.log(`Seeded ${PAYMENT_METHODS_SEED.length} payment method configurations.`);
}

seedPaymentMethods()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
