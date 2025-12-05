import { prisma } from "../lib/prisma";
import { z } from "zod";

export enum AdminSettingKey {
  RIDE_COMMISSION_PERCENT_BD = "RIDE_COMMISSION_PERCENT_BD",
  RIDE_COMMISSION_PERCENT_US = "RIDE_COMMISSION_PERCENT_US",
  FOOD_COMMISSION_PERCENT_BD = "FOOD_COMMISSION_PERCENT_BD",
  FOOD_COMMISSION_PERCENT_US = "FOOD_COMMISSION_PERCENT_US",
  SHOP_COMMISSION_PERCENT_BD = "SHOP_COMMISSION_PERCENT_BD",
  SHOP_COMMISSION_PERCENT_US = "SHOP_COMMISSION_PERCENT_US",
  MAX_DAILY_PAYOUT_LIMIT_BD = "MAX_DAILY_PAYOUT_LIMIT_BD",
  MAX_DAILY_PAYOUT_LIMIT_US = "MAX_DAILY_PAYOUT_LIMIT_US",
  MIN_PAYOUT_AMOUNT_BD = "MIN_PAYOUT_AMOUNT_BD",
  MIN_PAYOUT_AMOUNT_US = "MIN_PAYOUT_AMOUNT_US",
  SUPPORT_EMAIL_BD = "SUPPORT_EMAIL_BD",
  SUPPORT_EMAIL_US = "SUPPORT_EMAIL_US",
  SUPPORT_PHONE_BD = "SUPPORT_PHONE_BD",
  SUPPORT_PHONE_US = "SUPPORT_PHONE_US",
  EMERGENCY_CONTACT_BD = "EMERGENCY_CONTACT_BD",
  EMERGENCY_CONTACT_US = "EMERGENCY_CONTACT_US",
  LOGIN_RATE_LIMIT_WINDOW_MS = "LOGIN_RATE_LIMIT_WINDOW_MS",
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS = "LOGIN_RATE_LIMIT_MAX_ATTEMPTS",
  ACCOUNT_LOCK_THRESHOLD = "ACCOUNT_LOCK_THRESHOLD",
  ACCOUNT_LOCK_DURATION_MINUTES = "ACCOUNT_LOCK_DURATION_MINUTES",
  SESSION_TIMEOUT_MINUTES = "SESSION_TIMEOUT_MINUTES",
  MFA_REQUIRED_FOR_SENSITIVE_OPS = "MFA_REQUIRED_FOR_SENSITIVE_OPS",
  DRIVER_MIN_ACCEPTANCE_RATE = "DRIVER_MIN_ACCEPTANCE_RATE",
  DRIVER_MIN_RATING = "DRIVER_MIN_RATING",
  SURGE_PRICING_MAX_MULTIPLIER = "SURGE_PRICING_MAX_MULTIPLIER",
  PLATFORM_MAINTENANCE_MODE = "PLATFORM_MAINTENANCE_MODE",
}

export type AdminSettingScope = "GLOBAL" | "BD_ONLY" | "US_ONLY";
export type AdminSettingCategory = "PLATFORM_ECONOMICS" | "SECURITY_ABUSE" | "CONTACTS_SUPPORT" | "OPERATIONAL";

export interface SettingDefinition {
  key: AdminSettingKey;
  description: string;
  isSensitive: boolean;
  countryScope: AdminSettingScope;
  category: AdminSettingCategory;
  defaultValue: any;
  validationSchema: z.ZodSchema;
  displayLabel: string;
  unit?: string;
}

const percentSchema = z.number().min(0).max(50);
const currencyAmountSchema = z.number().min(0).max(1000000);
const emailSchema = z.string().email();
const phoneSchema = z.string().min(5).max(20);
const positiveIntSchema = z.number().int().min(1);
const booleanSchema = z.boolean();
const ratingSchema = z.number().min(1).max(5);
const multiplierSchema = z.number().min(1).max(10);

export const SETTING_DEFINITIONS: Record<AdminSettingKey, SettingDefinition> = {
  [AdminSettingKey.RIDE_COMMISSION_PERCENT_BD]: {
    key: AdminSettingKey.RIDE_COMMISSION_PERCENT_BD,
    description: "Platform commission rate for ride services in Bangladesh",
    isSensitive: true,
    countryScope: "BD_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 10,
    validationSchema: percentSchema,
    displayLabel: "Ride Commission (BD)",
    unit: "%",
  },
  [AdminSettingKey.RIDE_COMMISSION_PERCENT_US]: {
    key: AdminSettingKey.RIDE_COMMISSION_PERCENT_US,
    description: "Platform commission rate for ride services in USA",
    isSensitive: true,
    countryScope: "US_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 10,
    validationSchema: percentSchema,
    displayLabel: "Ride Commission (US)",
    unit: "%",
  },
  [AdminSettingKey.FOOD_COMMISSION_PERCENT_BD]: {
    key: AdminSettingKey.FOOD_COMMISSION_PERCENT_BD,
    description: "Platform commission rate for food delivery in Bangladesh",
    isSensitive: true,
    countryScope: "BD_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 12,
    validationSchema: percentSchema,
    displayLabel: "Food Commission (BD)",
    unit: "%",
  },
  [AdminSettingKey.FOOD_COMMISSION_PERCENT_US]: {
    key: AdminSettingKey.FOOD_COMMISSION_PERCENT_US,
    description: "Platform commission rate for food delivery in USA",
    isSensitive: true,
    countryScope: "US_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 15,
    validationSchema: percentSchema,
    displayLabel: "Food Commission (US)",
    unit: "%",
  },
  [AdminSettingKey.SHOP_COMMISSION_PERCENT_BD]: {
    key: AdminSettingKey.SHOP_COMMISSION_PERCENT_BD,
    description: "Platform commission rate for shop delivery in Bangladesh",
    isSensitive: true,
    countryScope: "BD_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 10,
    validationSchema: percentSchema,
    displayLabel: "Shop Commission (BD)",
    unit: "%",
  },
  [AdminSettingKey.SHOP_COMMISSION_PERCENT_US]: {
    key: AdminSettingKey.SHOP_COMMISSION_PERCENT_US,
    description: "Platform commission rate for shop delivery in USA",
    isSensitive: true,
    countryScope: "US_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 10,
    validationSchema: percentSchema,
    displayLabel: "Shop Commission (US)",
    unit: "%",
  },
  [AdminSettingKey.MAX_DAILY_PAYOUT_LIMIT_BD]: {
    key: AdminSettingKey.MAX_DAILY_PAYOUT_LIMIT_BD,
    description: "Maximum daily payout limit per partner in Bangladesh (BDT)",
    isSensitive: true,
    countryScope: "BD_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 500000,
    validationSchema: currencyAmountSchema,
    displayLabel: "Max Daily Payout (BD)",
    unit: "BDT",
  },
  [AdminSettingKey.MAX_DAILY_PAYOUT_LIMIT_US]: {
    key: AdminSettingKey.MAX_DAILY_PAYOUT_LIMIT_US,
    description: "Maximum daily payout limit per partner in USA (USD)",
    isSensitive: true,
    countryScope: "US_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 10000,
    validationSchema: currencyAmountSchema,
    displayLabel: "Max Daily Payout (US)",
    unit: "USD",
  },
  [AdminSettingKey.MIN_PAYOUT_AMOUNT_BD]: {
    key: AdminSettingKey.MIN_PAYOUT_AMOUNT_BD,
    description: "Minimum payout threshold in Bangladesh (BDT)",
    isSensitive: false,
    countryScope: "BD_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 500,
    validationSchema: z.number().min(0).max(100000),
    displayLabel: "Min Payout Amount (BD)",
    unit: "BDT",
  },
  [AdminSettingKey.MIN_PAYOUT_AMOUNT_US]: {
    key: AdminSettingKey.MIN_PAYOUT_AMOUNT_US,
    description: "Minimum payout threshold in USA (USD)",
    isSensitive: false,
    countryScope: "US_ONLY",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 25,
    validationSchema: z.number().min(0).max(10000),
    displayLabel: "Min Payout Amount (US)",
    unit: "USD",
  },
  [AdminSettingKey.SUPPORT_EMAIL_BD]: {
    key: AdminSettingKey.SUPPORT_EMAIL_BD,
    description: "Customer support email for Bangladesh",
    isSensitive: false,
    countryScope: "BD_ONLY",
    category: "CONTACTS_SUPPORT",
    defaultValue: "support-bd@safego.app",
    validationSchema: emailSchema,
    displayLabel: "Support Email (BD)",
  },
  [AdminSettingKey.SUPPORT_EMAIL_US]: {
    key: AdminSettingKey.SUPPORT_EMAIL_US,
    description: "Customer support email for USA",
    isSensitive: false,
    countryScope: "US_ONLY",
    category: "CONTACTS_SUPPORT",
    defaultValue: "support-us@safego.app",
    validationSchema: emailSchema,
    displayLabel: "Support Email (US)",
  },
  [AdminSettingKey.SUPPORT_PHONE_BD]: {
    key: AdminSettingKey.SUPPORT_PHONE_BD,
    description: "Customer support phone number for Bangladesh",
    isSensitive: false,
    countryScope: "BD_ONLY",
    category: "CONTACTS_SUPPORT",
    defaultValue: "+880-1700-000000",
    validationSchema: phoneSchema,
    displayLabel: "Support Phone (BD)",
  },
  [AdminSettingKey.SUPPORT_PHONE_US]: {
    key: AdminSettingKey.SUPPORT_PHONE_US,
    description: "Customer support phone number for USA",
    isSensitive: false,
    countryScope: "US_ONLY",
    category: "CONTACTS_SUPPORT",
    defaultValue: "+1-800-SAFEGO",
    validationSchema: phoneSchema,
    displayLabel: "Support Phone (US)",
  },
  [AdminSettingKey.EMERGENCY_CONTACT_BD]: {
    key: AdminSettingKey.EMERGENCY_CONTACT_BD,
    description: "Emergency contact number for Bangladesh (SOS)",
    isSensitive: false,
    countryScope: "BD_ONLY",
    category: "CONTACTS_SUPPORT",
    defaultValue: "+880-999",
    validationSchema: phoneSchema,
    displayLabel: "Emergency Contact (BD)",
  },
  [AdminSettingKey.EMERGENCY_CONTACT_US]: {
    key: AdminSettingKey.EMERGENCY_CONTACT_US,
    description: "Emergency contact number for USA (SOS)",
    isSensitive: false,
    countryScope: "US_ONLY",
    category: "CONTACTS_SUPPORT",
    defaultValue: "+1-911",
    validationSchema: phoneSchema,
    displayLabel: "Emergency Contact (US)",
  },
  [AdminSettingKey.LOGIN_RATE_LIMIT_WINDOW_MS]: {
    key: AdminSettingKey.LOGIN_RATE_LIMIT_WINDOW_MS,
    description: "Time window for login rate limiting (milliseconds)",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "SECURITY_ABUSE",
    defaultValue: 900000,
    validationSchema: z.number().int().min(60000).max(3600000),
    displayLabel: "Rate Limit Window",
    unit: "ms",
  },
  [AdminSettingKey.LOGIN_RATE_LIMIT_MAX_ATTEMPTS]: {
    key: AdminSettingKey.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    description: "Maximum login attempts within rate limit window",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "SECURITY_ABUSE",
    defaultValue: 5,
    validationSchema: z.number().int().min(3).max(20),
    displayLabel: "Max Login Attempts",
  },
  [AdminSettingKey.ACCOUNT_LOCK_THRESHOLD]: {
    key: AdminSettingKey.ACCOUNT_LOCK_THRESHOLD,
    description: "Failed login attempts before account lockout",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "SECURITY_ABUSE",
    defaultValue: 5,
    validationSchema: z.number().int().min(3).max(10),
    displayLabel: "Account Lock Threshold",
  },
  [AdminSettingKey.ACCOUNT_LOCK_DURATION_MINUTES]: {
    key: AdminSettingKey.ACCOUNT_LOCK_DURATION_MINUTES,
    description: "Duration of account lockout (minutes)",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "SECURITY_ABUSE",
    defaultValue: 30,
    validationSchema: z.number().int().min(5).max(1440),
    displayLabel: "Lock Duration",
    unit: "min",
  },
  [AdminSettingKey.SESSION_TIMEOUT_MINUTES]: {
    key: AdminSettingKey.SESSION_TIMEOUT_MINUTES,
    description: "Admin session timeout duration (minutes)",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "SECURITY_ABUSE",
    defaultValue: 480,
    validationSchema: z.number().int().min(15).max(1440),
    displayLabel: "Session Timeout",
    unit: "min",
  },
  [AdminSettingKey.MFA_REQUIRED_FOR_SENSITIVE_OPS]: {
    key: AdminSettingKey.MFA_REQUIRED_FOR_SENSITIVE_OPS,
    description: "Require MFA for sensitive operations (payouts, settings changes)",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "SECURITY_ABUSE",
    defaultValue: true,
    validationSchema: booleanSchema,
    displayLabel: "MFA Required",
  },
  [AdminSettingKey.DRIVER_MIN_ACCEPTANCE_RATE]: {
    key: AdminSettingKey.DRIVER_MIN_ACCEPTANCE_RATE,
    description: "Minimum driver acceptance rate to remain active (%)",
    isSensitive: false,
    countryScope: "GLOBAL",
    category: "OPERATIONAL",
    defaultValue: 70,
    validationSchema: z.number().min(0).max(100),
    displayLabel: "Min Acceptance Rate",
    unit: "%",
  },
  [AdminSettingKey.DRIVER_MIN_RATING]: {
    key: AdminSettingKey.DRIVER_MIN_RATING,
    description: "Minimum driver rating to remain active",
    isSensitive: false,
    countryScope: "GLOBAL",
    category: "OPERATIONAL",
    defaultValue: 4.0,
    validationSchema: ratingSchema,
    displayLabel: "Min Driver Rating",
  },
  [AdminSettingKey.SURGE_PRICING_MAX_MULTIPLIER]: {
    key: AdminSettingKey.SURGE_PRICING_MAX_MULTIPLIER,
    description: "Maximum surge pricing multiplier allowed",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "PLATFORM_ECONOMICS",
    defaultValue: 3.0,
    validationSchema: multiplierSchema,
    displayLabel: "Max Surge Multiplier",
    unit: "x",
  },
  [AdminSettingKey.PLATFORM_MAINTENANCE_MODE]: {
    key: AdminSettingKey.PLATFORM_MAINTENANCE_MODE,
    description: "Enable maintenance mode to block all user operations",
    isSensitive: true,
    countryScope: "GLOBAL",
    category: "OPERATIONAL",
    defaultValue: false,
    validationSchema: booleanSchema,
    displayLabel: "Maintenance Mode",
  },
};

export function isValidSettingKey(key: string): key is AdminSettingKey {
  return Object.values(AdminSettingKey).includes(key as AdminSettingKey);
}

export function getSettingDefinition(key: AdminSettingKey): SettingDefinition {
  return SETTING_DEFINITIONS[key];
}

export function validateSettingValue(key: AdminSettingKey, value: any): { valid: boolean; error?: string } {
  const definition = SETTING_DEFINITIONS[key];
  if (!definition) {
    return { valid: false, error: `Unknown setting key: ${key}` };
  }

  const result = definition.validationSchema.safeParse(value);
  if (!result.success) {
    return { valid: false, error: result.error.errors.map(e => e.message).join(", ") };
  }

  return { valid: true };
}

export async function getAllSettings(filters?: {
  category?: AdminSettingCategory;
  countryScope?: AdminSettingScope;
}): Promise<Array<{
  key: string;
  value: any;
  description: string;
  isSensitive: boolean;
  countryScope: string;
  category: string;
  updatedAt: Date;
  updatedByAdminId: string | null;
  definition: SettingDefinition;
}>> {
  const dbSettings = await prisma.adminSetting.findMany({
    where: {
      ...(filters?.category && { category: filters.category }),
      ...(filters?.countryScope && { countryScope: filters.countryScope }),
    },
    orderBy: [
      { category: "asc" },
      { key: "asc" },
    ],
  });

  const settingsMap = new Map(dbSettings.map(s => [s.key, s]));

  const allSettings = Object.values(SETTING_DEFINITIONS)
    .filter(def => {
      if (filters?.category && def.category !== filters.category) return false;
      if (filters?.countryScope && def.countryScope !== filters.countryScope) return false;
      return true;
    })
    .map(def => {
      const dbSetting = settingsMap.get(def.key);
      return {
        key: def.key,
        value: dbSetting?.value ?? def.defaultValue,
        description: def.description,
        isSensitive: def.isSensitive,
        countryScope: def.countryScope,
        category: def.category,
        updatedAt: dbSetting?.updatedAt ?? new Date(),
        updatedByAdminId: dbSetting?.updatedByAdminId ?? null,
        definition: def,
      };
    });

  return allSettings;
}

export async function getSetting(key: AdminSettingKey): Promise<any> {
  const definition = SETTING_DEFINITIONS[key];
  if (!definition) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  const dbSetting = await prisma.adminSetting.findUnique({
    where: { key },
  });

  return dbSetting?.value ?? definition.defaultValue;
}

export async function updateSetting(
  key: AdminSettingKey,
  value: any,
  adminId: string,
  adminEmail: string,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const definition = SETTING_DEFINITIONS[key];
    if (!definition) {
      return { success: false, error: `Unknown setting key: ${key}` };
    }

    if (!adminId || !adminEmail) {
      return { success: false, error: "Admin ID and email are required for audit trail" };
    }

    const validation = validateSettingValue(key, value);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const existingSetting = await prisma.adminSetting.findUnique({
      where: { key },
    });

    const oldValue = existingSetting?.value ?? definition.defaultValue;

    await prisma.$transaction(async (tx) => {
      const setting = await tx.adminSetting.upsert({
        where: { key },
        create: {
          key,
          value,
          description: definition.description,
          isSensitive: definition.isSensitive,
          countryScope: definition.countryScope,
          category: definition.category,
          updatedByAdminId: adminId,
        },
        update: {
          value,
          updatedByAdminId: adminId,
        },
      });

      await tx.adminSettingChange.create({
        data: {
          settingId: setting.id,
          settingKey: key,
          oldValue,
          newValue: value,
          changedById: adminId,
          changedByEmail: adminEmail,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          reason: reason || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorEmail: adminEmail,
          actorRole: "ADMIN",
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          actionType: "UPDATE_GLOBAL_SETTING",
          entityType: "AdminSetting",
          entityId: setting.id,
          description: `Updated global setting ${key} from ${JSON.stringify(oldValue)} to ${JSON.stringify(value)}`,
          metadata: {
            key,
            oldValue,
            newValue: value,
            reason: reason || null,
            isSensitive: definition.isSensitive,
          },
          success: true,
        },
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[GlobalSettings] Failed to update setting ${key}:`, error);
    return { success: false, error: error.message || "Database error while updating setting" };
  }
}

export async function getSettingHistory(
  key: AdminSettingKey,
  limit: number = 20
): Promise<Array<{
  id: string;
  oldValue: any;
  newValue: any;
  changedById: string;
  changedByEmail: string;
  reason: string | null;
  createdAt: Date;
}>> {
  const changes = await prisma.adminSettingChange.findMany({
    where: { settingKey: key },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return changes;
}

export async function initializeDefaultSettings(): Promise<void> {
  const existingSettings = await prisma.adminSetting.findMany();
  const existingKeys = new Set(existingSettings.map(s => s.key));

  const missingSettings = Object.values(SETTING_DEFINITIONS).filter(
    def => !existingKeys.has(def.key)
  );

  if (missingSettings.length > 0) {
    await prisma.adminSetting.createMany({
      data: missingSettings.map(def => ({
        key: def.key,
        value: def.defaultValue,
        description: def.description,
        isSensitive: def.isSensitive,
        countryScope: def.countryScope,
        category: def.category,
      })),
      skipDuplicates: true,
    });
    console.log(`[GlobalSettings] Initialized ${missingSettings.length} default settings`);
  }
}

export const GlobalAdminSettingsService = {
  getAllSettings,
  getSetting,
  updateSetting,
  getSettingHistory,
  initializeDefaultSettings,
  isValidSettingKey,
  validateSettingValue,
  getSettingDefinition,
  SETTING_DEFINITIONS,
  AdminSettingKey,
};
