import { db } from "../db";
import {
  CountryCode,
  ServiceType,
  ActorType,
  PaymentMethodType,
  PaymentProvider,
  PayoutRailType,
  PayoutProvider,
  PayoutSchedule,
  KycLevel,
} from "../../shared/types";

/**
 * Seed initial payment and payout configuration for Bangladesh and United States markets
 * This provides the foundation for country-aware payment/payout functionality
 */
export async function seedPaymentConfiguration() {
  console.log("🌱 Seeding payment & payout configuration...");

  try {
    // ===== BANGLADESH (BD) - Customer Payment Methods =====
    
    // BD - FOOD Service Payment Methods
    const bdFoodPayments = [
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.BKASH,
        isEnabled: true,
        priority: 1,
        minAmount: 50,
        maxAmount: 50000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.NAGAD,
        isEnabled: true,
        priority: 2,
        minAmount: 50,
        maxAmount: 50000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.ROCKET,
        isEnabled: true,
        priority: 3,
        minAmount: 50,
        maxAmount: 50000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.CARD,
        provider: PaymentProvider.VISA,
        isEnabled: true,
        priority: 4,
        minAmount: 100,
        maxAmount: 100000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.CARD,
        provider: PaymentProvider.MASTERCARD,
        isEnabled: true,
        priority: 5,
        minAmount: 100,
        maxAmount: 100000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.CASH,
        provider: PaymentProvider.CASH_ON_DELIVERY,
        isEnabled: true,
        priority: 6,
        minAmount: 50,
        maxAmount: 10000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // BD - RIDE Service Payment Methods
    const bdRidePayments = [
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.RIDE,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.BKASH,
        isEnabled: true,
        priority: 1,
        minAmount: 30,
        maxAmount: 5000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.RIDE,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.NAGAD,
        isEnabled: true,
        priority: 2,
        minAmount: 30,
        maxAmount: 5000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.RIDE,
        methodType: PaymentMethodType.CASH,
        provider: PaymentProvider.CASH_ON_DELIVERY,
        isEnabled: true,
        priority: 3,
        minAmount: 30,
        maxAmount: 2000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // BD - PARCEL Service Payment Methods
    const bdParcelPayments = [
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.PARCEL,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.BKASH,
        isEnabled: true,
        priority: 1,
        minAmount: 50,
        maxAmount: 20000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.PARCEL,
        methodType: PaymentMethodType.MOBILE_WALLET,
        provider: PaymentProvider.NAGAD,
        isEnabled: true,
        priority: 2,
        minAmount: 50,
        maxAmount: 20000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.PARCEL,
        methodType: PaymentMethodType.CARD,
        provider: PaymentProvider.VISA,
        isEnabled: true,
        priority: 3,
        minAmount: 100,
        maxAmount: 50000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        serviceType: ServiceType.PARCEL,
        methodType: PaymentMethodType.CASH,
        provider: PaymentProvider.CASH_ON_DELIVERY,
        isEnabled: true,
        priority: 4,
        minAmount: 50,
        maxAmount: 5000,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // ===== UNITED STATES (US) - Customer Payment Methods =====
    
    // US - FOOD Service Payment Methods
    const usFoodPayments = [
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.CARD,
        provider: PaymentProvider.STRIPE_CARD,
        isEnabled: true,
        priority: 1,
        minAmount: 5,
        maxAmount: 1000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.DIGITAL_WALLET,
        provider: PaymentProvider.STRIPE_APPLE_PAY,
        isEnabled: true,
        priority: 2,
        minAmount: 5,
        maxAmount: 1000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.DIGITAL_WALLET,
        provider: PaymentProvider.STRIPE_GOOGLE_PAY,
        isEnabled: true,
        priority: 3,
        minAmount: 5,
        maxAmount: 1000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.DIGITAL_WALLET,
        provider: PaymentProvider.PAYPAL,
        isEnabled: true,
        priority: 4,
        minAmount: 5,
        maxAmount: 2000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.FOOD,
        methodType: PaymentMethodType.CASH,
        provider: PaymentProvider.CASH_ON_DELIVERY,
        isEnabled: false, // Optional in US
        priority: 5,
        minAmount: 5,
        maxAmount: 100,
        supportsRecurring: false,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // US - RIDE Service Payment Methods
    const usRidePayments = [
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.RIDE,
        methodType: PaymentMethodType.CARD,
        provider: PaymentProvider.STRIPE_CARD,
        isEnabled: true,
        priority: 1,
        minAmount: 3,
        maxAmount: 500,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.RIDE,
        methodType: PaymentMethodType.DIGITAL_WALLET,
        provider: PaymentProvider.STRIPE_APPLE_PAY,
        isEnabled: true,
        priority: 2,
        minAmount: 3,
        maxAmount: 500,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.RIDE,
        methodType: PaymentMethodType.DIGITAL_WALLET,
        provider: PaymentProvider.STRIPE_GOOGLE_PAY,
        isEnabled: true,
        priority: 3,
        minAmount: 3,
        maxAmount: 500,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // US - PARCEL Service Payment Methods
    const usParcelPayments = [
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.PARCEL,
        methodType: PaymentMethodType.CARD,
        provider: PaymentProvider.STRIPE_CARD,
        isEnabled: true,
        priority: 1,
        minAmount: 5,
        maxAmount: 1500,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.NONE,
      },
      {
        countryCode: CountryCode.US,
        serviceType: ServiceType.PARCEL,
        methodType: PaymentMethodType.DIGITAL_WALLET,
        provider: PaymentProvider.PAYPAL,
        isEnabled: true,
        priority: 2,
        minAmount: 5,
        maxAmount: 2000,
        supportsRecurring: true,
        requiresKycLevel: KycLevel.BASIC,
      },
    ];

    // Combine all customer payment configs
    const allCustomerPayments = [
      ...bdFoodPayments,
      ...bdRidePayments,
      ...bdParcelPayments,
      ...usFoodPayments,
      ...usRidePayments,
      ...usParcelPayments,
    ];

    // Insert customer payment configurations
    for (const config of allCustomerPayments) {
      await db.countryPaymentConfig.upsert({
        where: {
          countryCode_serviceType_methodType_provider: {
            countryCode: config.countryCode,
            serviceType: config.serviceType,
            methodType: config.methodType,
            provider: config.provider,
          },
        },
        update: config,
        create: config,
      });
    }

    console.log(`✅ Seeded ${allCustomerPayments.length} customer payment configurations`);

    // ===== BANGLADESH (BD) - Payout Rails =====
    
    // BD - RESTAURANT Payout Rails
    const bdRestaurantPayouts = [
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.RESTAURANT,
        payoutRailType: PayoutRailType.BANK_ACCOUNT,
        provider: PayoutProvider.BANK_TRANSFER_BD_LOCAL,
        isEnabled: true,
        minPayoutAmount: 500,
        payoutSchedule: PayoutSchedule.WEEKLY,
        requiresKycLevel: KycLevel.FULL,
      },
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.RESTAURANT,
        payoutRailType: PayoutRailType.MOBILE_WALLET,
        provider: PayoutProvider.BKASH_AGENT,
        isEnabled: true,
        minPayoutAmount: 500,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.RESTAURANT,
        payoutRailType: PayoutRailType.MOBILE_WALLET,
        provider: PayoutProvider.NAGAD_AGENT,
        isEnabled: true,
        minPayoutAmount: 500,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.BASIC,
      },
    ];

    // BD - DRIVER Payout Rails
    const bdDriverPayouts = [
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.MOBILE_WALLET,
        provider: PayoutProvider.BKASH_AGENT,
        isEnabled: true,
        minPayoutAmount: 100,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.MOBILE_WALLET,
        provider: PayoutProvider.NAGAD_AGENT,
        isEnabled: true,
        minPayoutAmount: 100,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.MOBILE_WALLET,
        provider: PayoutProvider.ROCKET_AGENT,
        isEnabled: true,
        minPayoutAmount: 100,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.BASIC,
      },
      {
        countryCode: CountryCode.BD,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.CASH_SETTLEMENT,
        provider: PayoutProvider.MANUAL_OFFLINE,
        isEnabled: true,
        minPayoutAmount: 50,
        payoutSchedule: PayoutSchedule.ON_DEMAND,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // ===== UNITED STATES (US) - Payout Rails =====
    
    // US - RESTAURANT Payout Rails
    const usRestaurantPayouts = [
      {
        countryCode: CountryCode.US,
        actorType: ActorType.RESTAURANT,
        payoutRailType: PayoutRailType.BANK_ACCOUNT,
        provider: PayoutProvider.BANK_TRANSFER_US_ACH,
        isEnabled: true,
        minPayoutAmount: 10,
        payoutSchedule: PayoutSchedule.WEEKLY,
        requiresKycLevel: KycLevel.FULL,
      },
      {
        countryCode: CountryCode.US,
        actorType: ActorType.RESTAURANT,
        payoutRailType: PayoutRailType.CARD_PAYOUT,
        provider: PayoutProvider.STRIPE_CONNECT,
        isEnabled: true,
        minPayoutAmount: 10,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.FULL,
      },
    ];

    // US - DRIVER Payout Rails
    const usDriverPayouts = [
      {
        countryCode: CountryCode.US,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.CARD_PAYOUT,
        provider: PayoutProvider.STRIPE_CONNECT,
        isEnabled: true,
        minPayoutAmount: 10,
        payoutSchedule: PayoutSchedule.DAILY,
        requiresKycLevel: KycLevel.FULL,
      },
      {
        countryCode: CountryCode.US,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.BANK_ACCOUNT,
        provider: PayoutProvider.BANK_TRANSFER_US_ACH,
        isEnabled: true,
        minPayoutAmount: 10,
        payoutSchedule: PayoutSchedule.WEEKLY,
        requiresKycLevel: KycLevel.FULL,
      },
      {
        countryCode: CountryCode.US,
        actorType: ActorType.DRIVER,
        payoutRailType: PayoutRailType.CASH_SETTLEMENT,
        provider: PayoutProvider.MANUAL_OFFLINE,
        isEnabled: false, // Rarely used in US
        minPayoutAmount: 5,
        payoutSchedule: PayoutSchedule.ON_DEMAND,
        requiresKycLevel: KycLevel.NONE,
      },
    ];

    // Combine all payout configs
    const allPayoutConfigs = [
      ...bdRestaurantPayouts,
      ...bdDriverPayouts,
      ...usRestaurantPayouts,
      ...usDriverPayouts,
    ];

    // Insert payout configurations
    for (const config of allPayoutConfigs) {
      await db.countryPayoutConfig.upsert({
        where: {
          countryCode_actorType_payoutRailType_provider: {
            countryCode: config.countryCode,
            actorType: config.actorType,
            payoutRailType: config.payoutRailType,
            provider: config.provider,
          },
        },
        update: config,
        create: config,
      });
    }

    console.log(`✅ Seeded ${allPayoutConfigs.length} payout rail configurations`);
    console.log("🎉 Payment & Payout configuration seeding complete!");

    return {
      customerPayments: allCustomerPayments.length,
      payoutRails: allPayoutConfigs.length,
    };
  } catch (error) {
    console.error("❌ Error seeding payment configuration:", error);
    throw error;
  }
}

// Run seeding if invoked directly
// Note: This file exports the function for use in server startup or manual execution
// To manually seed: node --loader tsx server/utils/seedPaymentConfig.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPaymentConfiguration()
    .then((result) => {
      console.log("✅ Seed complete:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed failed:", error);
      process.exit(1);
    });
}
