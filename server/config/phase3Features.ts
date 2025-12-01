import { prisma } from "../lib/prisma";

export interface Phase3FeatureFlags {
  savedPlacesEnabled: boolean;
  ridePreferencesEnabled: boolean;
  kitchenSystemEnabled: boolean;
  parcelSchedulingEnabled: boolean;
  podPhotosRequired: boolean;
  maxSavedPlaces: number;
  parcelScheduleLeadMinutes: number;
  parcelScheduleMinHoursAhead: number;
  parcelScheduleMaxDaysAhead: number;
}

const defaultFlags: Phase3FeatureFlags = {
  savedPlacesEnabled: true,
  ridePreferencesEnabled: true,
  kitchenSystemEnabled: true,
  parcelSchedulingEnabled: true,
  podPhotosRequired: false,
  maxSavedPlaces: 10,
  parcelScheduleLeadMinutes: 30,
  parcelScheduleMinHoursAhead: 2,
  parcelScheduleMaxDaysAhead: 7,
};

const featureCache = new Map<string, { flags: Phase3FeatureFlags; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPhase3Features(countryCode: string): Promise<Phase3FeatureFlags> {
  const cacheKey = countryCode.toUpperCase();
  const cached = featureCache.get(cacheKey);
  
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.flags;
  }
  
  try {
    const config = await prisma.phase3FeatureConfig.findFirst({
      where: {
        OR: [
          { countryCode: cacheKey },
          { countryCode: "*" },
        ],
      },
      orderBy: {
        countryCode: "desc",
      },
    });
    
    if (config) {
      const flags: Phase3FeatureFlags = {
        savedPlacesEnabled: config.savedPlacesEnabled,
        ridePreferencesEnabled: config.ridePreferencesEnabled,
        kitchenSystemEnabled: config.kitchenSystemEnabled,
        parcelSchedulingEnabled: config.parcelSchedulingEnabled,
        podPhotosRequired: config.podPhotosRequired,
        maxSavedPlaces: config.maxSavedPlaces,
        parcelScheduleLeadMinutes: config.parcelScheduleLeadMinutes,
        parcelScheduleMinHoursAhead: config.parcelScheduleMinHoursAhead,
        parcelScheduleMaxDaysAhead: config.parcelScheduleMaxDaysAhead,
      };
      
      featureCache.set(cacheKey, { flags, cachedAt: Date.now() });
      return flags;
    }
  } catch (error) {
    console.error("[Phase3Features] Error loading feature config:", error);
  }
  
  featureCache.set(cacheKey, { flags: defaultFlags, cachedAt: Date.now() });
  return defaultFlags;
}

export function clearFeatureCache(countryCode?: string): void {
  if (countryCode) {
    featureCache.delete(countryCode.toUpperCase());
  } else {
    featureCache.clear();
  }
}

export async function isFeatureEnabled(
  feature: keyof Pick<Phase3FeatureFlags, 
    'savedPlacesEnabled' | 'ridePreferencesEnabled' | 'kitchenSystemEnabled' | 
    'parcelSchedulingEnabled' | 'podPhotosRequired'>,
  countryCode: string = "*"
): Promise<boolean> {
  const flags = await getPhase3Features(countryCode);
  return flags[feature];
}

export async function ensureDefaultConfigs(): Promise<void> {
  try {
    const existingGlobal = await prisma.phase3FeatureConfig.findUnique({
      where: { countryCode: "*" },
    });
    
    if (!existingGlobal) {
      await prisma.phase3FeatureConfig.create({
        data: {
          countryCode: "*",
          savedPlacesEnabled: true,
          ridePreferencesEnabled: true,
          kitchenSystemEnabled: true,
          parcelSchedulingEnabled: true,
          podPhotosRequired: false,
          maxSavedPlaces: 10,
          parcelScheduleLeadMinutes: 30,
          parcelScheduleMinHoursAhead: 2,
          parcelScheduleMaxDaysAhead: 7,
        },
      });
      console.log("[Phase3Features] Created default global feature config");
    }
    
    const bdConfig = await prisma.phase3FeatureConfig.findUnique({
      where: { countryCode: "BD" },
    });
    
    if (!bdConfig) {
      await prisma.phase3FeatureConfig.create({
        data: {
          countryCode: "BD",
          savedPlacesEnabled: true,
          ridePreferencesEnabled: true,
          kitchenSystemEnabled: true,
          parcelSchedulingEnabled: true,
          podPhotosRequired: true,
          maxSavedPlaces: 10,
          parcelScheduleLeadMinutes: 20,
          parcelScheduleMinHoursAhead: 1,
          parcelScheduleMaxDaysAhead: 7,
        },
      });
      console.log("[Phase3Features] Created BD feature config");
    }
    
    const usConfig = await prisma.phase3FeatureConfig.findUnique({
      where: { countryCode: "US" },
    });
    
    if (!usConfig) {
      await prisma.phase3FeatureConfig.create({
        data: {
          countryCode: "US",
          savedPlacesEnabled: true,
          ridePreferencesEnabled: true,
          kitchenSystemEnabled: true,
          parcelSchedulingEnabled: true,
          podPhotosRequired: true,
          maxSavedPlaces: 15,
          parcelScheduleLeadMinutes: 30,
          parcelScheduleMinHoursAhead: 2,
          parcelScheduleMaxDaysAhead: 14,
        },
      });
      console.log("[Phase3Features] Created US feature config");
    }
  } catch (error) {
    console.error("[Phase3Features] Error ensuring default configs:", error);
  }
}
