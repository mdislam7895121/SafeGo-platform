import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  general: {
    supportEmail: "support@safego.test",
    supportPhone: "",
    defaultCountry: "BD",
  },
  kyc: {
    driver: {
      BD: {
        requireProfilePhoto: true,
        requireNid: true,
        requirePostalCode: true,
        requireVehicleDocuments: true,
      },
      US: {
        requireProfilePhoto: true,
        requireDmvLicenseDocs: true,
        requireTlcLicenseDocsForNY: true,
        requireSsn: true,
      },
    },
    customer: {
      BD: {
        requireNid: true,
      },
      US: {
        requireSsn: false,
      },
    },
    restaurant: {
      BD: {
        requireBusinessLicense: true,
      },
      US: {
        requireBusinessLicense: true,
      },
    },
    documentExpiry: {
      warningDays: 30,
      hardBlockOnExpiry: false,
    },
  },
  commission: {
    driver: {
      ride: {
        defaultCommissionPercent: 20,
      },
      parcel: {
        defaultCommissionPercent: 20,
      },
    },
    restaurant: {
      food: {
        defaultCommissionPercent: 20,
      },
    },
    countryOverrides: {
      BD: {
        driverRideCommissionPercent: null,
        restaurantFoodCommissionPercent: null,
        driverParcelCommissionPercent: null,
      },
      US: {
        driverRideCommissionPercent: null,
        restaurantFoodCommissionPercent: null,
        driverParcelCommissionPercent: null,
      },
    },
  },
  settlement: {
    driver: {
      cycle: "MONTHLY",
      minPayoutAmount: 0,
    },
    restaurant: {
      cycle: "MONTHLY",
      minPayoutAmount: 0,
    },
  },
  notifications: {
    documentExpiry: {
      enabled: true,
      warningDays: 30,
    },
    lowWalletBalance: {
      enabled: false,
      threshold: 100,
    },
    fraudAlerts: {
      enabled: false,
    },
  },
  security: {
    sessionTimeoutMinutes: 480,
    forceMfaForSuperAdmin: false,
  },
};

async function seedSettings() {
  console.log("Seeding platform settings...");

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.platformSettings.findUnique({
      where: { key },
    });

    if (existing) {
      console.log(`  ✓ Settings for '${key}' already exist, skipping`);
    } else {
      await prisma.platformSettings.create({
        data: {
          key,
          valueJson: value,
        },
      });
      console.log(`  ✓ Created settings for '${key}'`);
    }
  }

  console.log("Platform settings seeding complete!");
}

seedSettings()
  .catch((error) => {
    console.error("Error seeding settings:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
