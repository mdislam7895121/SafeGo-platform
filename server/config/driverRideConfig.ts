/**
 * Step 48: SafeGo Ride Driver Web App Configuration
 * Configures driver ride app behavior including demo mode, polling, and negative balance thresholds
 * ADD-ONLY: Does not modify any existing configuration
 */

export interface DriverRideConfig {
  enableRideDemoMode: boolean;
  ridePollingIntervalSeconds: number;
  mobileBreakpointPx: number;
  maxNearbyRequestRadiusKm: number;
  negativeBalanceCashRideBlockThreshold: {
    BD: number;
    US: number;
    [key: string]: number;
  };
  requestTimeoutSeconds: number;
  locationUpdateIntervalSeconds: number;
  maxActiveRequestsToShow: number;
  activeRideWorkflow: {
    liveLocationIntervalMs: number;
    tripSummaryDisplaySeconds: number;
    statusTransitionAnimationMs: number;
    desktopBreakpointPx: number;
    gpsHighAccuracyEnabled: boolean;
    gpsMaxAgeMsForCompletion: number;
    showSwipeToCompleteThreshold: number;
  };
}

export const driverRideConfig: DriverRideConfig = {
  enableRideDemoMode: process.env.DRIVER_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development',
  ridePollingIntervalSeconds: 10,
  mobileBreakpointPx: 768,
  maxNearbyRequestRadiusKm: 5,
  negativeBalanceCashRideBlockThreshold: {
    BD: 2000,
    US: 100,
  },
  requestTimeoutSeconds: 15,
  locationUpdateIntervalSeconds: 30,
  maxActiveRequestsToShow: 5,
  activeRideWorkflow: {
    liveLocationIntervalMs: 10000,
    tripSummaryDisplaySeconds: 30,
    statusTransitionAnimationMs: 200,
    desktopBreakpointPx: 1024,
    gpsHighAccuracyEnabled: true,
    gpsMaxAgeMsForCompletion: 5000,
    showSwipeToCompleteThreshold: 0.85,
  },
};

export function getNegativeBalanceThreshold(countryCode: string): number {
  const threshold = driverRideConfig.negativeBalanceCashRideBlockThreshold[countryCode];
  return threshold ?? driverRideConfig.negativeBalanceCashRideBlockThreshold.US;
}

export function shouldBlockCashRides(negativeBalance: number, countryCode: string): boolean {
  const threshold = getNegativeBalanceThreshold(countryCode);
  return negativeBalance >= threshold;
}

export function getDriverRideConfig(): DriverRideConfig {
  return { ...driverRideConfig };
}

export function isDemoModeEnabled(): boolean {
  return driverRideConfig.enableRideDemoMode;
}
