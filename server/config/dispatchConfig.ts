/**
 * SafeGo Real-Time Dispatch Configuration
 * Phase 1A: Country-specific dispatch settings
 */

import { DeliveryServiceType } from '@prisma/client';

export interface DispatchConfig {
  maxRadiusKm: number;
  maxCandidates: number;
  offerTimeoutSeconds: number;
  sessionTimeoutMinutes: number;
  maxSearchRounds: number;
  radiusIncrementKm: number;
}

export interface CountryDispatchConfig {
  ride: DispatchConfig;
  food: DispatchConfig;
  parcel: DispatchConfig;
}

const DEFAULT_DISPATCH_CONFIG: CountryDispatchConfig = {
  ride: {
    maxRadiusKm: 8,
    maxCandidates: 10,
    offerTimeoutSeconds: 25,
    sessionTimeoutMinutes: 5,
    maxSearchRounds: 3,
    radiusIncrementKm: 3,
  },
  food: {
    maxRadiusKm: 5,
    maxCandidates: 8,
    offerTimeoutSeconds: 30,
    sessionTimeoutMinutes: 10,
    maxSearchRounds: 3,
    radiusIncrementKm: 2,
  },
  parcel: {
    maxRadiusKm: 10,
    maxCandidates: 5,
    offerTimeoutSeconds: 45,
    sessionTimeoutMinutes: 15,
    maxSearchRounds: 2,
    radiusIncrementKm: 5,
  },
};

const COUNTRY_DISPATCH_CONFIGS: Record<string, Partial<CountryDispatchConfig>> = {
  US: {
    ride: {
      maxRadiusKm: 10,
      maxCandidates: 15,
      offerTimeoutSeconds: 20,
      sessionTimeoutMinutes: 5,
      maxSearchRounds: 4,
      radiusIncrementKm: 4,
    },
    food: {
      maxRadiusKm: 6,
      maxCandidates: 10,
      offerTimeoutSeconds: 25,
      sessionTimeoutMinutes: 8,
      maxSearchRounds: 3,
      radiusIncrementKm: 2,
    },
  },
  BD: {
    ride: {
      maxRadiusKm: 5,
      maxCandidates: 20,
      offerTimeoutSeconds: 30,
      sessionTimeoutMinutes: 7,
      maxSearchRounds: 5,
      radiusIncrementKm: 2,
    },
    food: {
      maxRadiusKm: 3,
      maxCandidates: 15,
      offerTimeoutSeconds: 35,
      sessionTimeoutMinutes: 12,
      maxSearchRounds: 4,
      radiusIncrementKm: 1.5,
    },
  },
};

export function getDispatchConfig(
  countryCode: string | null | undefined,
  serviceType: DeliveryServiceType | string
): DispatchConfig {
  const country = countryCode?.toUpperCase() || 'US';
  const service = serviceType.toLowerCase() as keyof CountryDispatchConfig;
  
  const countryConfig = COUNTRY_DISPATCH_CONFIGS[country];
  
  if (countryConfig && countryConfig[service]) {
    return countryConfig[service] as DispatchConfig;
  }
  
  return DEFAULT_DISPATCH_CONFIG[service] || DEFAULT_DISPATCH_CONFIG.ride;
}

export function getOfferTimeoutMs(countryCode: string | null | undefined, serviceType: string): number {
  const config = getDispatchConfig(countryCode, serviceType as DeliveryServiceType);
  return config.offerTimeoutSeconds * 1000;
}

export function getMaxRadiusKm(countryCode: string | null | undefined, serviceType: string): number {
  const config = getDispatchConfig(countryCode, serviceType as DeliveryServiceType);
  return config.maxRadiusKm;
}

export function getMaxCandidates(countryCode: string | null | undefined, serviceType: string): number {
  const config = getDispatchConfig(countryCode, serviceType as DeliveryServiceType);
  return config.maxCandidates;
}
