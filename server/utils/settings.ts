import { prisma } from "../lib/prisma";
import { z } from "zod";

// Type definitions for each settings section
export interface GeneralSettings {
  supportEmail: string;
  supportPhone: string;
  defaultCountry: "BD" | "US";
}

export interface KYCSettings {
  driver: {
    BD: {
      requireProfilePhoto: boolean;
      requireNid: boolean;
      requirePostalCode: boolean;
      requireVehicleDocuments: boolean;
    };
    US: {
      requireProfilePhoto: boolean;
      requireDmvLicenseDocs: boolean;
      requireTlcLicenseDocsForNY: boolean;
      requireSsn: boolean;
    };
  };
  customer: {
    BD: {
      requireNid: boolean;
    };
    US: {
      requireSsn: boolean;
    };
  };
  restaurant: {
    BD: {
      requireBusinessLicense: boolean;
    };
    US: {
      requireBusinessLicense: boolean;
    };
  };
  documentExpiry: {
    warningDays: number;
    hardBlockOnExpiry: boolean;
  };
}

export interface CommissionSettings {
  driver: {
    ride: {
      defaultCommissionPercent: number;
    };
    parcel: {
      defaultCommissionPercent: number;
    };
  };
  restaurant: {
    food: {
      defaultCommissionPercent: number;
    };
  };
  countryOverrides: {
    BD: {
      driverRideCommissionPercent: number | null;
      restaurantFoodCommissionPercent: number | null;
      driverParcelCommissionPercent: number | null;
    };
    US: {
      driverRideCommissionPercent: number | null;
      restaurantFoodCommissionPercent: number | null;
      driverParcelCommissionPercent: number | null;
    };
  };
}

export type SettlementCycle = "DAILY" | "WEEKLY" | "MONTHLY";

export interface SettlementSettings {
  driver: {
    cycle: SettlementCycle;
    minPayoutAmount: number;
  };
  restaurant: {
    cycle: SettlementCycle;
    minPayoutAmount: number;
  };
}

export interface NotificationSettings {
  documentExpiry: {
    enabled: boolean;
    warningDays: number;
  };
  lowWalletBalance: {
    enabled: boolean;
    threshold: number;
  };
  fraudAlerts: {
    enabled: boolean;
  };
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  forceMfaForSuperAdmin: boolean;
}

export interface SupportSettings {
  enabled: boolean;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  rateLimitMessagesPerHour: number;
  workingHours: {
    enabled: boolean;
    timezone: string;
    schedule: {
      monday: { start: string; end: string; enabled: boolean };
      tuesday: { start: string; end: string; enabled: boolean };
      wednesday: { start: string; end: string; enabled: boolean };
      thursday: { start: string; end: string; enabled: boolean };
      friday: { start: string; end: string; enabled: boolean };
      saturday: { start: string; end: string; enabled: boolean };
      sunday: { start: string; end: string; enabled: boolean };
    };
  };
  autoCloseInactiveDays: number;
  requireAdminApprovalForFileUploads: boolean;
}

export interface AllSettings {
  general: GeneralSettings;
  kyc: KYCSettings;
  commission: CommissionSettings;
  settlement: SettlementSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  support: SupportSettings;
}

// Zod validation schemas for each section
const generalSettingsSchema = z.object({
  supportEmail: z.string().email("Invalid email format"),
  supportPhone: z.string(),
  defaultCountry: z.enum(["BD", "US"], { errorMap: () => ({ message: "Must be 'BD' or 'US'" }) }),
});

const kycSettingsSchema = z.object({
  driver: z.object({
    BD: z.object({
      requireProfilePhoto: z.boolean(),
      requireNid: z.boolean(),
      requirePostalCode: z.boolean(),
      requireVehicleDocuments: z.boolean(),
    }),
    US: z.object({
      requireProfilePhoto: z.boolean(),
      requireDmvLicenseDocs: z.boolean(),
      requireTlcLicenseDocsForNY: z.boolean(),
      requireSsn: z.boolean(),
    }),
  }),
  customer: z.object({
    BD: z.object({
      requireNid: z.boolean(),
    }),
    US: z.object({
      requireSsn: z.boolean(),
    }),
  }),
  restaurant: z.object({
    BD: z.object({
      requireBusinessLicense: z.boolean(),
    }),
    US: z.object({
      requireBusinessLicense: z.boolean(),
    }),
  }),
  documentExpiry: z.object({
    warningDays: z.number().int().min(1).max(365, "Warning days must be between 1 and 365"),
    hardBlockOnExpiry: z.boolean(),
  }),
});

const commissionSettingsSchema = z.object({
  driver: z.object({
    ride: z.object({
      defaultCommissionPercent: z.number().min(0).max(100, "Commission must be between 0 and 100"),
    }),
    parcel: z.object({
      defaultCommissionPercent: z.number().min(0).max(100, "Commission must be between 0 and 100"),
    }),
  }),
  restaurant: z.object({
    food: z.object({
      defaultCommissionPercent: z.number().min(0).max(100, "Commission must be between 0 and 100"),
    }),
  }),
  countryOverrides: z.object({
    BD: z.object({
      driverRideCommissionPercent: z.number().min(0).max(100).nullable(),
      restaurantFoodCommissionPercent: z.number().min(0).max(100).nullable(),
      driverParcelCommissionPercent: z.number().min(0).max(100).nullable(),
    }),
    US: z.object({
      driverRideCommissionPercent: z.number().min(0).max(100).nullable(),
      restaurantFoodCommissionPercent: z.number().min(0).max(100).nullable(),
      driverParcelCommissionPercent: z.number().min(0).max(100).nullable(),
    }),
  }),
});

const settlementSettingsSchema = z.object({
  driver: z.object({
    cycle: z.enum(["DAILY", "WEEKLY", "MONTHLY"], { errorMap: () => ({ message: "Must be DAILY, WEEKLY, or MONTHLY" }) }),
    minPayoutAmount: z.number().min(0, "Minimum payout must be non-negative"),
  }),
  restaurant: z.object({
    cycle: z.enum(["DAILY", "WEEKLY", "MONTHLY"], { errorMap: () => ({ message: "Must be DAILY, WEEKLY, or MONTHLY" }) }),
    minPayoutAmount: z.number().min(0, "Minimum payout must be non-negative"),
  }),
});

const notificationSettingsSchema = z.object({
  documentExpiry: z.object({
    enabled: z.boolean(),
    warningDays: z.number().int().min(1).max(365, "Warning days must be between 1 and 365"),
  }),
  lowWalletBalance: z.object({
    enabled: z.boolean(),
    threshold: z.number().min(0, "Threshold must be non-negative"),
  }),
  fraudAlerts: z.object({
    enabled: z.boolean(),
  }),
});

const securitySettingsSchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(5).max(1440, "Session timeout must be between 5 and 1440 minutes"),
  forceMfaForSuperAdmin: z.boolean(),
});

const dayScheduleSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)"),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)"),
  enabled: z.boolean(),
});

const supportSettingsSchema = z.object({
  enabled: z.boolean(),
  maxFileSizeMB: z.number().min(1).max(50, "Max file size must be between 1 and 50 MB"),
  allowedFileTypes: z.array(z.string()).min(1, "At least one file type must be allowed"),
  rateLimitMessagesPerHour: z.number().int().min(1).max(1000, "Rate limit must be between 1 and 1000 messages per hour"),
  workingHours: z.object({
    enabled: z.boolean(),
    timezone: z.string(),
    schedule: z.object({
      monday: dayScheduleSchema,
      tuesday: dayScheduleSchema,
      wednesday: dayScheduleSchema,
      thursday: dayScheduleSchema,
      friday: dayScheduleSchema,
      saturday: dayScheduleSchema,
      sunday: dayScheduleSchema,
    }),
  }),
  autoCloseInactiveDays: z.number().int().min(0).max(365, "Auto-close days must be between 0 and 365"),
  requireAdminApprovalForFileUploads: z.boolean(),
});

// Map section keys to their validation schemas
const sectionSchemas: Record<keyof AllSettings, z.ZodSchema> = {
  general: generalSettingsSchema,
  kyc: kycSettingsSchema,
  commission: commissionSettingsSchema,
  settlement: settlementSettingsSchema,
  notifications: notificationSettingsSchema,
  security: securitySettingsSchema,
  support: supportSettingsSchema,
};

// Validation function for settings payload
export function validateSettingsPayload<K extends keyof AllSettings>(
  sectionKey: K,
  payload: any
): { valid: boolean; data?: AllSettings[K]; errors?: string[] } {
  try {
    const schema = sectionSchemas[sectionKey];
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      const errors = result.error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      return { valid: false, errors };
    }
    
    return { valid: true, data: result.data as AllSettings[K] };
  } catch (error: any) {
    return { valid: false, errors: [`Validation error: ${error.message}`] };
  }
}

// Default settings that match existing hard-coded behavior
const DEFAULT_SETTINGS: AllSettings = {
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
        defaultCommissionPercent: 10,
      },
      parcel: {
        defaultCommissionPercent: 10,
      },
    },
    restaurant: {
      food: {
        defaultCommissionPercent: 15,
      },
    },
    countryOverrides: {
      BD: {
        driverRideCommissionPercent: 10,
        restaurantFoodCommissionPercent: 12,
        driverParcelCommissionPercent: 10,
      },
      US: {
        driverRideCommissionPercent: 10,
        restaurantFoodCommissionPercent: 15,
        driverParcelCommissionPercent: 10,
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
  support: {
    enabled: true,
    maxFileSizeMB: 10,
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    rateLimitMessagesPerHour: 100,
    workingHours: {
      enabled: false,
      timezone: "UTC",
      schedule: {
        monday: { start: "09:00", end: "17:00", enabled: true },
        tuesday: { start: "09:00", end: "17:00", enabled: true },
        wednesday: { start: "09:00", end: "17:00", enabled: true },
        thursday: { start: "09:00", end: "17:00", enabled: true },
        friday: { start: "09:00", end: "17:00", enabled: true },
        saturday: { start: "10:00", end: "14:00", enabled: false },
        sunday: { start: "10:00", end: "14:00", enabled: false },
      },
    },
    autoCloseInactiveDays: 30,
    requireAdminApprovalForFileUploads: false,
  },
};

// In-memory cache with TTL
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60000; // 1 minute cache
const cache = new Map<string, CacheEntry<any>>();

function getCacheKey(sectionKey?: string): string {
  return sectionKey || "all_settings";
}

function isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

function setCache<T>(key: string, value: T): void {
  cache.set(key, { value, timestamp: Date.now() });
}

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (isCacheValid(entry) && entry) {
    return entry.value as T;
  }
  cache.delete(key);
  return null;
}

export function invalidateCache(sectionKey?: string): void {
  if (sectionKey) {
    cache.delete(getCacheKey(sectionKey));
  }
  cache.delete(getCacheKey());
}

// Helper to safely parse JSON with fallback
function safeJsonParse<T>(json: any, fallback: T): T {
  try {
    if (typeof json === "string") {
      return JSON.parse(json);
    }
    if (typeof json === "object" && json !== null) {
      return json as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// Get all settings with defaults merged
export async function getSettings(): Promise<AllSettings> {
  const cacheKey = getCacheKey();
  const cached = getCache<AllSettings>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const dbSettings = await prisma.platformSettings.findMany();
    
    const result: AllSettings = { ...DEFAULT_SETTINGS };
    
    for (const setting of dbSettings) {
      const sectionKey = setting.key as keyof AllSettings;
      if (sectionKey in result) {
        result[sectionKey] = safeJsonParse(
          setting.valueJson,
          DEFAULT_SETTINGS[sectionKey]
        ) as any;
      }
    }
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error fetching settings from database:", error);
    return DEFAULT_SETTINGS;
  }
}

// Get specific section with defaults
export async function getSection<K extends keyof AllSettings>(
  sectionKey: K
): Promise<AllSettings[K]> {
  const cacheKey = getCacheKey(sectionKey);
  const cached = getCache<AllSettings[K]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const dbSetting = await prisma.platformSettings.findUnique({
      where: { key: sectionKey },
    });
    
    const result = dbSetting
      ? safeJsonParse(dbSetting.valueJson, DEFAULT_SETTINGS[sectionKey])
      : DEFAULT_SETTINGS[sectionKey];
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`Error fetching ${sectionKey} settings:`, error);
    return DEFAULT_SETTINGS[sectionKey];
  }
}

// Update specific section
export async function updateSection<K extends keyof AllSettings>(
  sectionKey: K,
  payload: AllSettings[K],
  updatedByAdminId?: string
): Promise<AllSettings[K]> {
  try {
    // Upsert the setting
    const updated = await prisma.platformSettings.upsert({
      where: { key: sectionKey },
      update: {
        valueJson: payload as any,
        updatedByAdminId: updatedByAdminId || null,
      },
      create: {
        key: sectionKey,
        valueJson: payload as any,
        updatedByAdminId: updatedByAdminId || null,
      },
    });
    
    // Invalidate cache
    invalidateCache(sectionKey);
    invalidateCache();
    
    return safeJsonParse(updated.valueJson, DEFAULT_SETTINGS[sectionKey]);
  } catch (error) {
    console.error(`Error updating ${sectionKey} settings:`, error);
    throw new Error(`Failed to update ${sectionKey} settings`);
  }
}

// Get default settings (useful for reset functionality)
export function getDefaultSettings(): AllSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

// Get default for specific section
export function getDefaultSection<K extends keyof AllSettings>(
  sectionKey: K
): AllSettings[K] {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS[sectionKey]));
}

// Validation helpers
export function isValidSettingKey(key: string): key is keyof AllSettings {
  return ["general", "kyc", "commission", "settlement", "notifications", "security", "support"].includes(key);
}

export const SettingsService = {
  getSettings,
  getSection,
  updateSection,
  getDefaultSettings,
  getDefaultSection,
  invalidateCache,
  isValidSettingKey,
};
