/**
 * SafeGo Phase 1B: Dispatch Feature Configuration
 * Controls feature enablement per environment and service type
 */

export interface DispatchFeatureConfig {
  etaCalculation: {
    enabled: boolean;
    provider: 'google' | 'haversine' | 'auto';
    throttleIntervalSeconds: number;
    minDistanceChangeMeters: number;
  };
  liveRouteUpdates: {
    enabled: boolean;
    broadcastIntervalSeconds: number;
    maxSamplesPerTrip: number;
  };
  inTripChat: {
    enabled: boolean;
    enabledForRide: boolean;
    enabledForFood: boolean;
    enabledForParcel: boolean;
    maxMessageLength: number;
    retentionDays: number;
  };
  fareRecalculation: {
    enabled: boolean;
    useActualDistance: boolean;
    useActualDuration: boolean;
  };
  demoMode: {
    enabled: boolean;
    mockDriverMovement: boolean;
    mockEtaSeconds: number;
  };
}

const defaultConfig: DispatchFeatureConfig = {
  etaCalculation: {
    enabled: true,
    provider: 'auto',
    throttleIntervalSeconds: 15,
    minDistanceChangeMeters: 50,
  },
  liveRouteUpdates: {
    enabled: true,
    broadcastIntervalSeconds: 5,
    maxSamplesPerTrip: 1000,
  },
  inTripChat: {
    enabled: true,
    enabledForRide: true,
    enabledForFood: true,
    enabledForParcel: true,
    maxMessageLength: 500,
    retentionDays: 30,
  },
  fareRecalculation: {
    enabled: true,
    useActualDistance: true,
    useActualDuration: true,
  },
  demoMode: {
    enabled: process.env.NODE_ENV !== 'production',
    mockDriverMovement: true,
    mockEtaSeconds: 300,
  },
};

const productionConfig: DispatchFeatureConfig = {
  ...defaultConfig,
  demoMode: {
    enabled: false,
    mockDriverMovement: false,
    mockEtaSeconds: 0,
  },
};

export function getDispatchFeatureConfig(): DispatchFeatureConfig {
  if (process.env.NODE_ENV === 'production') {
    return productionConfig;
  }
  return defaultConfig;
}

export function isFeatureEnabled(feature: keyof DispatchFeatureConfig): boolean {
  const config = getDispatchFeatureConfig();
  const featureConfig = config[feature];
  if (typeof featureConfig === 'object' && 'enabled' in featureConfig) {
    return featureConfig.enabled;
  }
  return false;
}

export function isChatEnabledForService(serviceType: 'ride' | 'food' | 'parcel'): boolean {
  const config = getDispatchFeatureConfig();
  if (!config.inTripChat.enabled) return false;
  
  switch (serviceType) {
    case 'ride':
      return config.inTripChat.enabledForRide;
    case 'food':
      return config.inTripChat.enabledForFood;
    case 'parcel':
      return config.inTripChat.enabledForParcel;
    default:
      return false;
  }
}
