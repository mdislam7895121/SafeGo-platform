/**
 * SafeGo AI Marketplace Balancer - Shared Types and Interfaces
 * 
 * Core data structures for real-time marketplace optimization including:
 * - Demand/Supply monitoring
 * - Predictive forecasting
 * - Surge/Commission/Incentive adjustments
 * - Smart dispatch optimization
 * - Safety guards
 */

// ========================================
// GEOGRAPHIC TYPES
// ========================================

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface GeoZone {
  id: string;
  name: string;
  center: GeoLocation;
  radiusMiles: number;
  polygon?: GeoLocation[];
}

export interface HeatmapCell {
  zoneId: string;
  center: GeoLocation;
  value: number;
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  timestamp: Date;
}

// ========================================
// DEMAND METRICS
// ========================================

export interface DemandMetrics {
  zoneId: string;
  rideRequestsPerMinute: number;
  requestsLastHour: number;
  requestsLast15Min: number;
  requestsLast5Min: number;
  cancellationRate: number;
  requestConversionRate: number;
  avgWaitTimeSeconds: number;
  pendingRequests: number;
  matchRate: number;
}

export type DemandLevel = 'low' | 'normal' | 'high' | 'extreme';

export interface DemandForecast {
  zoneId: string;
  window: '10m' | '30m' | '60m';
  predictedLevel: DemandLevel;
  predictedRequestsPerMinute: number;
  confidenceScore: number;
  factors: DemandFactor[];
  timestamp: Date;
}

export interface DemandFactor {
  type: 'time_of_day' | 'day_of_week' | 'weather' | 'event' | 'historical' | 'trend';
  impact: number;
  description: string;
}

// ========================================
// SUPPLY METRICS
// ========================================

export interface SupplyMetrics {
  zoneId: string;
  activeDrivers: number;
  idleDrivers: number;
  onTripDrivers: number;
  avgDistanceToZone: number;
  avgAcceptanceRate: number;
  avgCompletionRate: number;
  avgRating: number;
  driversGoingOfflineSoon: number;
  driversInboundToZone: number;
}

export type SupplyLevel = 'surplus' | 'adequate' | 'low' | 'critical';

export interface SupplyForecast {
  zoneId: string;
  window: '10m' | '30m' | '60m';
  predictedLevel: SupplyLevel;
  predictedActiveDrivers: number;
  shortageRisk: number;
  confidenceScore: number;
  timestamp: Date;
}

export interface SupplyGap {
  zoneId: string;
  currentDrivers: number;
  requiredDrivers: number;
  gap: number;
  gapPercent: number;
  severity: 'none' | 'minor' | 'moderate' | 'severe';
}

// ========================================
// ZONE STATUS
// ========================================

export type ZoneStatus = 'balanced' | 'demand_spike' | 'supply_shortage' | 'oversupply' | 'critical';

export interface ZoneMetrics {
  zoneId: string;
  zoneName: string;
  status: ZoneStatus;
  demand: DemandMetrics;
  supply: SupplyMetrics;
  supplyDemandRatio: number;
  balanceScore: number;
  lastUpdated: Date;
}

// ========================================
// MARKETPLACE SNAPSHOT
// ========================================

export interface MarketplaceSnapshot {
  timestamp: Date;
  zones: ZoneMetrics[];
  globalMetrics: GlobalMetrics;
  weather: WeatherCondition;
  activeEvents: EventInfo[];
}

export interface GlobalMetrics {
  totalActiveDrivers: number;
  totalIdleDrivers: number;
  totalPendingRequests: number;
  avgWaitTimeSeconds: number;
  globalMatchRate: number;
  globalCancellationRate: number;
  avgSurgeMultiplier: number;
  avgCommissionRate: number;
}

export interface WeatherCondition {
  type: 'clear' | 'rain' | 'heavy_rain' | 'snow' | 'storm' | 'fog' | 'extreme_cold';
  temperatureFahrenheit: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  impactMultiplier: number;
}

export interface EventInfo {
  id: string;
  name: string;
  type: 'concert' | 'sports' | 'festival' | 'conference' | 'flight_arrival' | 'other';
  location: GeoLocation;
  radiusMiles: number;
  startTime: Date;
  endTime: Date;
  expectedAttendees: number;
  demandImpact: number;
}

// ========================================
// FORECAST WINDOWS
// ========================================

export interface ForecastWindow {
  window: '10m' | '30m' | '60m';
  demandForecasts: DemandForecast[];
  supplyForecasts: SupplyForecast[];
  supplyGaps: SupplyGap[];
  hotZones: string[];
  coldZones: string[];
  timestamp: Date;
}

// ========================================
// SAFETY GUARDS
// ========================================

export interface SafetyGuardsConfig {
  maxSurgeMultiplier: number;
  minSurgeMultiplier: number;
  maxCommissionPercent: number;
  minCommissionPercent: number;
  minDriverPayout: number;
  maxPriceIncreasePercent: number;
  surgeCapBelowUber: number;
  maxIncentiveBudgetPerHour: number;
  forceBalanceThreshold: number;
}

export const DEFAULT_SAFETY_GUARDS: SafetyGuardsConfig = {
  maxSurgeMultiplier: 1.90,
  minSurgeMultiplier: 1.00,
  maxCommissionPercent: 18,
  minCommissionPercent: 10,
  minDriverPayout: 5.00,
  maxPriceIncreasePercent: 100,
  surgeCapBelowUber: 0.10,
  maxIncentiveBudgetPerHour: 10000,
  forceBalanceThreshold: 0.3,
};

export interface SafetyGuardViolation {
  guardType: 'surge_cap' | 'commission_cap' | 'driver_payout' | 'price_fairness' | 'stability';
  originalValue: number;
  correctedValue: number;
  threshold: number;
  reason: string;
  timestamp: Date;
}

// ========================================
// AI DECISIONS
// ========================================

export interface SurgeDecision {
  zoneId: string;
  currentMultiplier: number;
  recommendedMultiplier: number;
  reason: string;
  factors: string[];
  confidenceScore: number;
  appliedAt?: Date;
}

export interface CommissionDecision {
  zoneId: string;
  currentRate: number;
  recommendedRate: number;
  reason: string;
  demandLevel: DemandLevel;
  confidenceScore: number;
  appliedAt?: Date;
}

export interface IncentiveDecision {
  zoneId: string;
  incentiveType: 'boost_zone' | 'weather_bonus' | 'late_night' | 'airport' | 'supply_boost';
  activate: boolean;
  amount: number;
  durationMinutes: number;
  reason: string;
  expectedSupplyIncrease: number;
  appliedAt?: Date;
}

export interface DispatchDecision {
  requestId: string;
  zoneId: string;
  selectedDriverId: string;
  alternativeDrivers: string[];
  dispatchScore: number;
  priorityReason: string;
  factors: DispatchFactor[];
  appliedAt?: Date;
}

export interface DispatchFactor {
  type: 'eta' | 'rating' | 'acceptance_rate' | 'cancellation_rate' | 'fatigue' | 'zone_proximity';
  value: number;
  weight: number;
  score: number;
}

// ========================================
// DRIVER SCORING
// ========================================

export interface DriverScoreInput {
  driverId: string;
  currentLocation: GeoLocation;
  etaMinutes: number;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  completedTripsToday: number;
  hoursOnlineToday: number;
  isInDemandZone: boolean;
  vehicleType: string;
  isPremiumDriver: boolean;
}

export interface DriverScoreResult {
  driverId: string;
  totalScore: number;
  etaScore: number;
  ratingScore: number;
  acceptanceScore: number;
  cancellationScore: number;
  fatigueScore: number;
  zoneScore: number;
  rank: number;
  recommendation: 'dispatch' | 'consider' | 'skip';
}

// ========================================
// BALANCER DECISION PAYLOAD
// ========================================

export interface BalancerDecisionPayload {
  timestamp: Date;
  cycleNumber: number;
  snapshot: MarketplaceSnapshot;
  forecasts: {
    '10m': ForecastWindow;
    '30m': ForecastWindow;
    '60m': ForecastWindow;
  };
  decisions: {
    surgeDecisions: SurgeDecision[];
    commissionDecisions: CommissionDecision[];
    incentiveDecisions: IncentiveDecision[];
    dispatchHints: DispatchDecision[];
  };
  safetyGuardViolations: SafetyGuardViolation[];
  globalBalanceScore: number;
  actionsTaken: string[];
  nextCycleRecommendations: string[];
}

// ========================================
// HEATMAPS
// ========================================

export interface HeatmapData {
  type: 'demand' | 'supply' | 'surge' | 'incentive';
  timestamp: Date;
  cells: HeatmapCell[];
  minValue: number;
  maxValue: number;
  avgValue: number;
}

export interface MarketplaceHeatmaps {
  demandLive: HeatmapData;
  supplyLive: HeatmapData;
  demand30m: HeatmapData;
  demand60m: HeatmapData;
  surgeZones: HeatmapData;
  incentiveZones: HeatmapData;
  timestamp: Date;
}

// ========================================
// ADMIN MONITORING
// ========================================

export interface MarketplaceStatus {
  isRunning: boolean;
  lastCycleTime: Date;
  cycleCount: number;
  avgCycleDurationMs: number;
  errorCount: number;
  lastError?: string;
  safetyGuardTriggeredCount: number;
  activeZones: number;
  balancedZones: number;
  criticalZones: number;
}

export interface MarketplaceMetricsSummary {
  timestamp: Date;
  globalBalanceScore: number;
  avgSurge: number;
  avgCommission: number;
  activeIncentives: number;
  totalDrivers: number;
  totalRequests: number;
  matchRate: number;
  avgWaitTime: number;
  revenueImpact: number;
}

// ========================================
// CONFIGURATION
// ========================================

export interface MarketplaceBalancerConfig {
  enabled: boolean;
  cycleDurationMs: number;
  safetyGuards: SafetyGuardsConfig;
  predictionHorizons: ('10m' | '30m' | '60m')[];
  surgeAdjustmentEnabled: boolean;
  commissionAdjustmentEnabled: boolean;
  incentiveOptimizationEnabled: boolean;
  dispatchOptimizationEnabled: boolean;
  heatmapGenerationEnabled: boolean;
  manualOverrideActive: boolean;
  debugMode: boolean;
}

export const DEFAULT_BALANCER_CONFIG: MarketplaceBalancerConfig = {
  enabled: true,
  cycleDurationMs: 60000,
  safetyGuards: DEFAULT_SAFETY_GUARDS,
  predictionHorizons: ['10m', '30m', '60m'],
  surgeAdjustmentEnabled: true,
  commissionAdjustmentEnabled: true,
  incentiveOptimizationEnabled: true,
  dispatchOptimizationEnabled: true,
  heatmapGenerationEnabled: true,
  manualOverrideActive: false,
  debugMode: false,
};

// ========================================
// TELEMETRY EVENTS
// ========================================

export interface TelemetryEvent {
  eventType: 'ride_request' | 'ride_matched' | 'ride_cancelled' | 'driver_online' | 'driver_offline' | 'surge_applied' | 'incentive_activated';
  timestamp: Date;
  zoneId: string;
  data: Record<string, unknown>;
}

export interface TelemetryBuffer {
  events: TelemetryEvent[];
  windowStart: Date;
  windowEnd: Date;
  eventCounts: Record<string, number>;
}
