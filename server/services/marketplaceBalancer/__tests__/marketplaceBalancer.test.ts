/**
 * SafeGo AI Marketplace Balancer - Comprehensive Test Suite
 * 
 * Test coverage for:
 * - Safety guards validation
 * - Demand/supply forecasting
 * - Surge controller logic
 * - Commission controller logic
 * - Incentive controller logic
 * - Dispatch optimizer scoring
 * - Heatmap generation
 * - State management
 * - Orchestrator control loop
 */

import {
  SafetyGuardsConfig,
  DEFAULT_SAFETY_GUARDS,
  DemandMetrics,
  SupplyMetrics,
  ZoneMetrics,
  DemandForecast,
  SupplyForecast,
  SupplyGap,
  WeatherCondition,
  DriverScoreInput,
  GeoZone,
} from '@shared/marketplace';

import { SafetyGuardValidator } from '../safetyGuards';
import { MarketplaceStateStore } from '../stateStore';
import { predictDemand, predictSupply, calculateSupplyGap, generateForecastWindow } from '../predictiveModels';
import { SurgeController } from '../actuators/surgeController';
import { CommissionController } from '../actuators/commissionController';
import { IncentiveController } from '../actuators/incentiveController';
import { DispatchOptimizer } from '../actuators/dispatchOptimizer';
import { HeatmapGenerator } from '../heatmapGenerator';

// ========================================
// MOCK DATA HELPERS
// ========================================

const mockZone: GeoZone = {
  id: 'test_zone',
  name: 'Test Zone',
  center: { lat: 40.7128, lng: -74.0060 },
  radiusMiles: 2.0,
};

const mockDemandMetrics: DemandMetrics = {
  zoneId: 'test_zone',
  rideRequestsPerMinute: 5,
  requestsLastHour: 300,
  requestsLast15Min: 75,
  requestsLast5Min: 25,
  cancellationRate: 0.08,
  requestConversionRate: 0.92,
  avgWaitTimeSeconds: 180,
  pendingRequests: 10,
  matchRate: 0.90,
};

const mockSupplyMetrics: SupplyMetrics = {
  zoneId: 'test_zone',
  activeDrivers: 20,
  idleDrivers: 8,
  onTripDrivers: 12,
  avgDistanceToZone: 1.5,
  avgAcceptanceRate: 0.85,
  avgCompletionRate: 0.95,
  avgRating: 4.8,
  driversGoingOfflineSoon: 2,
  driversInboundToZone: 3,
};

const mockZoneMetrics: ZoneMetrics = {
  zoneId: 'test_zone',
  zoneName: 'Test Zone',
  status: 'balanced',
  demand: mockDemandMetrics,
  supply: mockSupplyMetrics,
  supplyDemandRatio: 1.6,
  balanceScore: 0.8,
  lastUpdated: new Date(),
};

const mockWeather: WeatherCondition = {
  type: 'clear',
  temperatureFahrenheit: 65,
  severity: 'none',
  impactMultiplier: 1.0,
};

const mockDriverInput: DriverScoreInput = {
  driverId: 'driver_1',
  currentLocation: { lat: 40.7128, lng: -74.0060 },
  etaMinutes: 4,
  rating: 4.9,
  acceptanceRate: 0.92,
  cancellationRate: 0.02,
  completedTripsToday: 8,
  hoursOnlineToday: 5,
  isInDemandZone: true,
  vehicleType: 'sedan',
  isPremiumDriver: false,
};

// ========================================
// SAFETY GUARDS TESTS
// ========================================

describe('SafetyGuardValidator', () => {
  let validator: SafetyGuardValidator;

  beforeEach(() => {
    validator = new SafetyGuardValidator();
  });

  describe('Surge Validation', () => {
    test('should allow valid surge within limits', () => {
      const decision = {
        zoneId: 'test_zone',
        currentMultiplier: 1.0,
        recommendedMultiplier: 1.5,
        reason: 'Test',
        factors: [],
        confidenceScore: 0.9,
      };

      const result = validator.validateSurge(decision);
      expect(result.valid).toBe(true);
      expect(result.corrected.recommendedMultiplier).toBe(1.5);
    });

    test('should cap surge at maximum 1.90x', () => {
      const decision = {
        zoneId: 'test_zone',
        currentMultiplier: 1.0,
        recommendedMultiplier: 2.5,
        reason: 'Test',
        factors: [],
        confidenceScore: 0.9,
      };

      const result = validator.validateSurge(decision);
      expect(result.valid).toBe(false);
      expect(result.corrected.recommendedMultiplier).toBe(1.90);
      expect(result.violation?.guardType).toBe('surge_cap');
    });

    test('should ensure surge is below Uber surge', () => {
      const decision = {
        zoneId: 'test_zone',
        currentMultiplier: 1.0,
        recommendedMultiplier: 1.8,
        reason: 'Test',
        factors: [],
        confidenceScore: 0.9,
      };

      const result = validator.validateSurge(decision, 1.85);
      expect(result.corrected.recommendedMultiplier).toBeLessThan(1.85);
    });

    test('should enforce minimum surge of 1.0x', () => {
      const decision = {
        zoneId: 'test_zone',
        currentMultiplier: 1.0,
        recommendedMultiplier: 0.8,
        reason: 'Test',
        factors: [],
        confidenceScore: 0.9,
      };

      const result = validator.validateSurge(decision);
      expect(result.corrected.recommendedMultiplier).toBe(1.0);
    });
  });

  describe('Commission Validation', () => {
    test('should allow valid commission within limits', () => {
      const decision = {
        zoneId: 'test_zone',
        currentRate: 15,
        recommendedRate: 16,
        reason: 'Test',
        demandLevel: 'high' as const,
        confidenceScore: 0.9,
      };

      const result = validator.validateCommission(decision);
      expect(result.valid).toBe(true);
      expect(result.corrected.recommendedRate).toBe(16);
    });

    test('should cap commission at maximum 18%', () => {
      const decision = {
        zoneId: 'test_zone',
        currentRate: 15,
        recommendedRate: 22,
        reason: 'Test',
        demandLevel: 'extreme' as const,
        confidenceScore: 0.9,
      };

      const result = validator.validateCommission(decision);
      expect(result.valid).toBe(false);
      expect(result.corrected.recommendedRate).toBe(18);
      expect(result.violation?.guardType).toBe('commission_cap');
    });

    test('should enforce minimum commission of 10%', () => {
      const decision = {
        zoneId: 'test_zone',
        currentRate: 15,
        recommendedRate: 5,
        reason: 'Test',
        demandLevel: 'low' as const,
        confidenceScore: 0.9,
      };

      const result = validator.validateCommission(decision);
      expect(result.corrected.recommendedRate).toBe(10);
    });
  });

  describe('Driver Payout Validation', () => {
    test('should pass when payout meets minimum', () => {
      const result = validator.validateDriverPayout(20, 15, 2);
      expect(result.valid).toBe(true);
    });

    test('should adjust when payout is below minimum', () => {
      const result = validator.validateDriverPayout(5, 15, 0);
      expect(result.valid).toBe(false);
      expect(result.adjustedIncentives).toBeGreaterThan(0);
    });
  });

  describe('Price Fairness Validation', () => {
    test('should allow reasonable price increases', () => {
      const result = validator.validatePriceFairness(10, 15);
      expect(result.valid).toBe(true);
    });

    test('should cap extreme price increases', () => {
      const result = validator.validatePriceFairness(10, 30);
      expect(result.valid).toBe(false);
      expect(result.correctedFare).toBe(20); // 100% max increase
    });
  });
});

// ========================================
// STATE STORE TESTS
// ========================================

describe('MarketplaceStateStore', () => {
  let store: MarketplaceStateStore;

  beforeEach(() => {
    store = new MarketplaceStateStore();
  });

  test('should initialize zone correctly', () => {
    store.initializeZone(mockZone);
    const zone = store.getZone('test_zone');
    expect(zone).toBeDefined();
    expect(zone?.zone.id).toBe('test_zone');
  });

  test('should update zone metrics', () => {
    store.initializeZone(mockZone);
    store.updateZoneMetrics('test_zone', mockDemandMetrics, mockSupplyMetrics);
    
    const zone = store.getZone('test_zone');
    expect(zone?.metrics.demand.rideRequestsPerMinute).toBe(5);
    expect(zone?.metrics.supply.activeDrivers).toBe(20);
  });

  test('should track surge decisions', () => {
    store.initializeZone(mockZone);
    
    const decision = {
      zoneId: 'test_zone',
      currentMultiplier: 1.0,
      recommendedMultiplier: 1.3,
      reason: 'Test',
      factors: [],
      confidenceScore: 0.9,
    };
    
    store.applySurgeDecision(decision);
    expect(store.getActiveSurge('test_zone')).toBe(1.3);
  });

  test('should track commission decisions', () => {
    store.initializeZone(mockZone);
    
    const decision = {
      zoneId: 'test_zone',
      currentRate: 15,
      recommendedRate: 16,
      reason: 'Test',
      demandLevel: 'high' as const,
      confidenceScore: 0.9,
    };
    
    store.applyCommissionDecision(decision);
    expect(store.getActiveCommission('test_zone')).toBe(16);
  });

  test('should track cycle counts', () => {
    expect(store.getCycleCount()).toBe(0);
    store.startCycle();
    store.endCycle(100);
    expect(store.getCycleCount()).toBe(1);
  });

  test('should handle circuit breaker', () => {
    for (let i = 0; i < 5; i++) {
      store.startCycle();
      store.endCycle(100, 'Error');
    }
    expect(store.isCircuitBreakerOpen()).toBe(true);
  });
});

// ========================================
// PREDICTIVE MODELS TESTS
// ========================================

describe('Predictive Models', () => {
  let store: MarketplaceStateStore;

  beforeEach(() => {
    store = new MarketplaceStateStore();
    store.initializeZone(mockZone);
    
    // Add historical data
    for (let i = 0; i < 10; i++) {
      store.updateZoneMetrics('test_zone', mockDemandMetrics, mockSupplyMetrics);
    }
  });

  test('should predict demand for 10 minutes', () => {
    const forecast = predictDemand('test_zone', '10m', mockWeather, []);
    expect(forecast.zoneId).toBe('test_zone');
    expect(forecast.window).toBe('10m');
    expect(forecast.predictedRequestsPerMinute).toBeGreaterThanOrEqual(0);
    expect(forecast.confidenceScore).toBeGreaterThan(0);
    expect(forecast.confidenceScore).toBeLessThanOrEqual(1);
  });

  test('should predict demand for 30 minutes', () => {
    const forecast = predictDemand('test_zone', '30m', mockWeather, []);
    expect(forecast.window).toBe('30m');
    // 30m forecast should have lower confidence than 10m
    expect(forecast.confidenceScore).toBeLessThanOrEqual(0.95);
  });

  test('should predict supply', () => {
    const forecast = predictSupply('test_zone', '10m');
    expect(forecast.zoneId).toBe('test_zone');
    expect(forecast.predictedActiveDrivers).toBeGreaterThanOrEqual(0);
    expect(forecast.shortageRisk).toBeGreaterThanOrEqual(0);
    expect(forecast.shortageRisk).toBeLessThanOrEqual(1);
  });

  test('should calculate supply gap', () => {
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'high',
      predictedRequestsPerMinute: 8,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'low',
      predictedActiveDrivers: 10,
      shortageRisk: 0.5,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const gap = calculateSupplyGap('test_zone', demandForecast, supplyForecast);
    expect(gap.zoneId).toBe('test_zone');
    expect(gap.requiredDrivers).toBeGreaterThan(0);
  });

  test('should generate forecast window', () => {
    const window = generateForecastWindow([mockZoneMetrics], '10m', mockWeather, []);
    expect(window.window).toBe('10m');
    expect(window.demandForecasts.length).toBe(1);
    expect(window.supplyForecasts.length).toBe(1);
    expect(window.supplyGaps.length).toBe(1);
  });
});

// ========================================
// SURGE CONTROLLER TESTS
// ========================================

describe('SurgeController', () => {
  let controller: SurgeController;

  beforeEach(() => {
    controller = new SurgeController();
  });

  test('should calculate surge for balanced zone', () => {
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'normal',
      predictedRequestsPerMinute: 3,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'adequate',
      predictedActiveDrivers: 20,
      shortageRisk: 0.1,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const supplyGap: SupplyGap = {
      zoneId: 'test_zone',
      currentDrivers: 20,
      requiredDrivers: 10,
      gap: 0,
      gapPercent: 0,
      severity: 'none',
    };

    const decision = controller.calculateSurgeDecision(
      mockZoneMetrics,
      demandForecast,
      supplyForecast,
      supplyGap
    );

    expect(decision.recommendedMultiplier).toBeCloseTo(1.0, 1);
  });

  test('should increase surge for supply shortage', () => {
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'high',
      predictedRequestsPerMinute: 8,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'low',
      predictedActiveDrivers: 5,
      shortageRisk: 0.8,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const supplyGap: SupplyGap = {
      zoneId: 'test_zone',
      currentDrivers: 5,
      requiredDrivers: 20,
      gap: 15,
      gapPercent: 75,
      severity: 'severe',
    };

    const shortageMetrics = {
      ...mockZoneMetrics,
      supplyDemandRatio: 0.25,
      status: 'critical' as const,
    };

    const decision = controller.calculateSurgeDecision(
      shortageMetrics,
      demandForecast,
      supplyForecast,
      supplyGap
    );

    expect(decision.recommendedMultiplier).toBeGreaterThan(1.0);
    expect(decision.recommendedMultiplier).toBeLessThanOrEqual(1.90);
  });
});

// ========================================
// COMMISSION CONTROLLER TESTS
// ========================================

describe('CommissionController', () => {
  let controller: CommissionController;

  beforeEach(() => {
    controller = new CommissionController();
  });

  test('should set lower commission for low demand', () => {
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'low',
      predictedRequestsPerMinute: 1,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'surplus',
      predictedActiveDrivers: 30,
      shortageRisk: 0,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const decision = controller.calculateCommissionDecision(
      mockZoneMetrics,
      demandForecast,
      supplyForecast
    );

    expect(decision.recommendedRate).toBeLessThanOrEqual(12);
    expect(decision.recommendedRate).toBeGreaterThanOrEqual(10);
  });

  test('should set higher commission for extreme demand', () => {
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'extreme',
      predictedRequestsPerMinute: 10,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'adequate',
      predictedActiveDrivers: 25,
      shortageRisk: 0.2,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const decision = controller.calculateCommissionDecision(
      mockZoneMetrics,
      demandForecast,
      supplyForecast
    );

    expect(decision.recommendedRate).toBeGreaterThanOrEqual(16);
    expect(decision.recommendedRate).toBeLessThanOrEqual(18);
  });
});

// ========================================
// INCENTIVE CONTROLLER TESTS
// ========================================

describe('IncentiveController', () => {
  let controller: IncentiveController;

  beforeEach(() => {
    controller = new IncentiveController();
  });

  test('should activate boost zone for supply shortage', () => {
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'high',
      predictedRequestsPerMinute: 8,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'low',
      predictedActiveDrivers: 5,
      shortageRisk: 0.7,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const supplyGap: SupplyGap = {
      zoneId: 'test_zone',
      currentDrivers: 5,
      requiredDrivers: 20,
      gap: 15,
      gapPercent: 75,
      severity: 'severe',
    };

    const decisions = controller.calculateIncentiveDecisions(
      mockZoneMetrics,
      demandForecast,
      supplyForecast,
      supplyGap,
      mockWeather
    );

    const boostDecision = decisions.find(d => d.incentiveType === 'boost_zone');
    expect(boostDecision).toBeDefined();
    expect(boostDecision?.activate).toBe(true);
  });

  test('should activate weather bonus in bad weather', () => {
    const badWeather: WeatherCondition = {
      type: 'heavy_rain',
      temperatureFahrenheit: 45,
      severity: 'moderate',
      impactMultiplier: 1.5,
    };

    const supplyGap: SupplyGap = {
      zoneId: 'test_zone',
      currentDrivers: 10,
      requiredDrivers: 15,
      gap: 5,
      gapPercent: 33,
      severity: 'minor',
    };

    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'normal',
      predictedRequestsPerMinute: 4,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'adequate',
      predictedActiveDrivers: 10,
      shortageRisk: 0.3,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const decisions = controller.calculateIncentiveDecisions(
      mockZoneMetrics,
      demandForecast,
      supplyForecast,
      supplyGap,
      badWeather
    );

    const weatherDecision = decisions.find(d => d.incentiveType === 'weather_bonus');
    expect(weatherDecision).toBeDefined();
    expect(weatherDecision?.activate).toBe(true);
  });
});

// ========================================
// DISPATCH OPTIMIZER TESTS
// ========================================

describe('DispatchOptimizer', () => {
  let optimizer: DispatchOptimizer;

  beforeEach(() => {
    optimizer = new DispatchOptimizer();
  });

  test('should score driver correctly', () => {
    const result = optimizer.scoreDriver(mockDriverInput);
    expect(result.driverId).toBe('driver_1');
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.recommendation).toBeDefined();
  });

  test('should rank drivers by score', () => {
    const drivers: DriverScoreInput[] = [
      { ...mockDriverInput, driverId: 'driver_1', etaMinutes: 10 },
      { ...mockDriverInput, driverId: 'driver_2', etaMinutes: 3 },
      { ...mockDriverInput, driverId: 'driver_3', etaMinutes: 6 },
    ];

    const ranked = optimizer.rankDrivers(drivers);
    expect(ranked[0].driverId).toBe('driver_2'); // Fastest ETA
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  test('should select best driver for dispatch', () => {
    const drivers: DriverScoreInput[] = [
      { ...mockDriverInput, driverId: 'driver_1', etaMinutes: 10, rating: 4.5 },
      { ...mockDriverInput, driverId: 'driver_2', etaMinutes: 3, rating: 4.9 },
      { ...mockDriverInput, driverId: 'driver_3', etaMinutes: 5, rating: 4.8 },
    ];

    const decision = optimizer.selectBestDriver('req_1', 'test_zone', drivers);
    expect(decision).not.toBeNull();
    expect(decision?.selectedDriverId).toBe('driver_2');
    expect(decision?.alternativeDrivers.length).toBe(2);
  });

  test('should avoid fatigued drivers', () => {
    const fatiguedDriver: DriverScoreInput = {
      ...mockDriverInput,
      hoursOnlineToday: 12,
      completedTripsToday: 25,
    };

    const result = optimizer.scoreDriver(fatiguedDriver);
    expect(result.fatigueScore).toBeLessThan(50);
  });

  test('should flag high cancellation risk', () => {
    const riskyDriver: DriverScoreInput = {
      ...mockDriverInput,
      cancellationRate: 0.20,
      etaMinutes: 18,
    };

    const avoidResult = optimizer.shouldAvoidDispatch(
      riskyDriver,
      { lat: 40.7, lng: -74.0 }
    );

    expect(avoidResult.avoid).toBe(true);
  });
});

// ========================================
// HEATMAP GENERATOR TESTS
// ========================================

describe('HeatmapGenerator', () => {
  let generator: HeatmapGenerator;
  let store: MarketplaceStateStore;

  beforeEach(() => {
    generator = new HeatmapGenerator();
    store = new MarketplaceStateStore();
    store.initializeZone(mockZone);
    store.updateZoneMetrics('test_zone', mockDemandMetrics, mockSupplyMetrics);
  });

  test('should generate demand heatmap', () => {
    const heatmap = generator.generateDemandHeatmap([mockZoneMetrics]);
    expect(heatmap.type).toBe('demand');
    expect(heatmap.cells.length).toBe(1);
    expect(heatmap.cells[0].zoneId).toBe('test_zone');
    expect(heatmap.cells[0].intensity).toBeDefined();
  });

  test('should generate supply heatmap', () => {
    const heatmap = generator.generateSupplyHeatmap([mockZoneMetrics]);
    expect(heatmap.type).toBe('supply');
    expect(heatmap.cells.length).toBe(1);
  });

  test('should generate surge heatmap', () => {
    const heatmap = generator.generateSurgeHeatmap([mockZoneMetrics]);
    expect(heatmap.type).toBe('surge');
    expect(heatmap.cells[0].value).toBeGreaterThanOrEqual(1);
  });

  test('should calculate heatmap summary', () => {
    const heatmap = generator.generateDemandHeatmap([mockZoneMetrics]);
    const summary = generator.getHeatmapSummary(heatmap);
    expect(summary.totalCells).toBe(1);
    expect(summary.byIntensity).toBeDefined();
  });

  test('should generate all heatmaps', () => {
    const forecast30m = generateForecastWindow([mockZoneMetrics], '30m', mockWeather, []);
    const forecast60m = generateForecastWindow([mockZoneMetrics], '60m', mockWeather, []);

    const heatmaps = generator.generateAllHeatmaps([mockZoneMetrics], forecast30m, forecast60m);
    expect(heatmaps.demandLive).toBeDefined();
    expect(heatmaps.supplyLive).toBeDefined();
    expect(heatmaps.demand30m).toBeDefined();
    expect(heatmaps.demand60m).toBeDefined();
    expect(heatmaps.surgeZones).toBeDefined();
    expect(heatmaps.incentiveZones).toBeDefined();
  });
});

// ========================================
// INTEGRATION TESTS
// ========================================

describe('Marketplace Balancer Integration', () => {
  test('should validate batch decisions with safety guards', () => {
    const validator = new SafetyGuardValidator();

    const surgeDecisions = [
      { zoneId: 'zone1', currentMultiplier: 1, recommendedMultiplier: 1.5, reason: 'Test', factors: [], confidenceScore: 0.8 },
      { zoneId: 'zone2', currentMultiplier: 1, recommendedMultiplier: 2.5, reason: 'Test', factors: [], confidenceScore: 0.8 },
    ];

    const commissionDecisions = [
      { zoneId: 'zone1', currentRate: 15, recommendedRate: 16, reason: 'Test', demandLevel: 'high' as const, confidenceScore: 0.8 },
      { zoneId: 'zone2', currentRate: 15, recommendedRate: 25, reason: 'Test', demandLevel: 'extreme' as const, confidenceScore: 0.8 },
    ];

    const result = validator.validateAllDecisions(surgeDecisions, commissionDecisions, []);

    expect(result.correctedSurge[0].recommendedMultiplier).toBe(1.5);
    expect(result.correctedSurge[1].recommendedMultiplier).toBe(1.90);
    expect(result.correctedCommission[1].recommendedRate).toBe(18);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('should handle complete decision flow', () => {
    const store = new MarketplaceStateStore();
    const surgeController = new SurgeController();
    const commissionController = new CommissionController();
    const validator = new SafetyGuardValidator();

    // Initialize zone
    store.initializeZone(mockZone);
    store.updateZoneMetrics('test_zone', mockDemandMetrics, mockSupplyMetrics);

    // Generate forecasts
    const demandForecast = predictDemand('test_zone', '10m', mockWeather, []);
    const supplyForecast = predictSupply('test_zone', '10m');
    const supplyGap = calculateSupplyGap('test_zone', demandForecast, supplyForecast);

    // Get zone state
    const zoneState = store.getZone('test_zone');
    expect(zoneState).toBeDefined();

    // Calculate decisions
    const surgeDecision = surgeController.calculateSurgeDecision(
      zoneState!.metrics,
      demandForecast,
      supplyForecast,
      supplyGap
    );

    // Validate
    const validatedSurge = validator.validateSurge(surgeDecision);
    expect(validatedSurge.corrected.recommendedMultiplier).toBeGreaterThanOrEqual(1);
    expect(validatedSurge.corrected.recommendedMultiplier).toBeLessThanOrEqual(1.90);
  });
});

// ========================================
// EDGE CASE TESTS
// ========================================

describe('Edge Cases', () => {
  test('should handle empty zone list', () => {
    const generator = new HeatmapGenerator();
    const heatmap = generator.generateDemandHeatmap([]);
    expect(heatmap.cells.length).toBe(0);
    expect(heatmap.minValue).toBe(0);
    expect(heatmap.maxValue).toBe(0);
  });

  test('should handle zero demand', () => {
    const zeroDemand: DemandMetrics = {
      ...mockDemandMetrics,
      rideRequestsPerMinute: 0,
      pendingRequests: 0,
    };

    const zoneWithZeroDemand: ZoneMetrics = {
      ...mockZoneMetrics,
      demand: zeroDemand,
    };

    const controller = new SurgeController();
    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'low',
      predictedRequestsPerMinute: 0,
      confidenceScore: 0.5,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'surplus',
      predictedActiveDrivers: 20,
      shortageRisk: 0,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const supplyGap: SupplyGap = {
      zoneId: 'test_zone',
      currentDrivers: 20,
      requiredDrivers: 0,
      gap: 0,
      gapPercent: 0,
      severity: 'none',
    };

    const decision = controller.calculateSurgeDecision(
      zoneWithZeroDemand,
      demandForecast,
      supplyForecast,
      supplyGap
    );

    expect(decision.recommendedMultiplier).toBe(1.0);
  });

  test('should handle no available drivers for dispatch', () => {
    const optimizer = new DispatchOptimizer();
    const decision = optimizer.selectBestDriver('req_1', 'test_zone', []);
    expect(decision).toBeNull();
  });

  test('should handle extreme cold weather', () => {
    const extremeCold: WeatherCondition = {
      type: 'extreme_cold',
      temperatureFahrenheit: 15,
      severity: 'severe',
      impactMultiplier: 1.8,
    };

    const controller = new IncentiveController();
    const supplyGap: SupplyGap = {
      zoneId: 'test_zone',
      currentDrivers: 10,
      requiredDrivers: 15,
      gap: 5,
      gapPercent: 33,
      severity: 'minor',
    };

    const demandForecast: DemandForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'normal',
      predictedRequestsPerMinute: 4,
      confidenceScore: 0.8,
      factors: [],
      timestamp: new Date(),
    };

    const supplyForecast: SupplyForecast = {
      zoneId: 'test_zone',
      window: '10m',
      predictedLevel: 'adequate',
      predictedActiveDrivers: 10,
      shortageRisk: 0.3,
      confidenceScore: 0.8,
      timestamp: new Date(),
    };

    const decisions = controller.calculateIncentiveDecisions(
      mockZoneMetrics,
      demandForecast,
      supplyForecast,
      supplyGap,
      extremeCold
    );

    const weatherBonus = decisions.find(d => d.incentiveType === 'weather_bonus');
    expect(weatherBonus).toBeDefined();
    expect(weatherBonus?.activate).toBe(true);
  });
});
