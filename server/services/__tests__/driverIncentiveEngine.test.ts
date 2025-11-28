/// <reference types="jest" />
/**
 * Driver Incentive Engine Tests
 * 
 * Comprehensive test coverage for:
 * - Quest Bonus System
 * - Boost Zone Engine
 * - Airport Pickup Bonuses
 * - Weather Bonus System
 * - Late-Night Incentives
 * - Integration and stacking rules
 */

import {
  calculateDriverIncentives,
  calculateQuestBonus,
  calculateBoostZoneBonus,
  calculateAirportBonus,
  calculateWeatherBonus,
  calculateLateNightBonus,
  createQuestProgress,
  updateQuestProgress,
  shouldResetQuestCycle,
  resetQuestCycle,
  getQuestCycleStart,
  getQuestCycleEnd,
  DEFAULT_QUEST_CONFIG,
  DEFAULT_BOOST_ZONES,
  DEFAULT_AIRPORT_BONUSES,
  DEFAULT_WEATHER_BONUS_CONFIG,
  DEFAULT_LATE_NIGHT_CONFIG,
  QuestConfig,
  BoostZone,
  AirportBonusConfig,
  WeatherBonusConfig,
  LateNightBonusConfig,
  IncentiveContext,
  Location,
  WeatherContext,
} from '../driverIncentiveEngine';

// ========================================
// TEST FIXTURES
// ========================================

const NYC_COORDS: Location = { lat: 40.7128, lng: -74.0060 };
const JFK_COORDS: Location = { lat: 40.6413, lng: -73.7781 };
const LGA_COORDS: Location = { lat: 40.7769, lng: -73.8740 };
const EWR_COORDS: Location = { lat: 40.6895, lng: -74.1745 };
const TIMES_SQUARE_COORDS: Location = { lat: 40.7590, lng: -73.9845 };
const MIDTOWN_COORDS: Location = { lat: 40.7550, lng: -73.9830 };

// Helper to create a date at specific day/hour
function createTestDate(dayOfWeek: number, hour: number, minute: number = 0): Date {
  const date = new Date('2025-06-02T00:00:00'); // Monday June 2, 2025
  const currentDay = date.getDay();
  const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysToAdd);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// Helper to create incentive context
function createContext(overrides: Partial<IncentiveContext> = {}): IncentiveContext {
  return {
    driverId: 'driver-123',
    pickupLocation: NYC_COORDS,
    currentTime: new Date('2025-06-04T14:00:00'), // Wednesday 2 PM
    driverEarningsBase: 25.00,
    ...overrides,
  };
}

// ========================================
// QUEST BONUS SYSTEM TESTS
// ========================================

describe('Quest Bonus System', () => {
  describe('Quest Tier Calculation', () => {
    it('should return no bonus for 0 rides', () => {
      const result = calculateQuestBonus(0);
      
      expect(result.questActive).toBe(true);
      expect(result.questTier).toBeNull();
      expect(result.questBonusEarned).toBe(0);
      expect(result.progressPercent).toBe(0);
      expect(result.nextTierRides).toBe(20);
      expect(result.nextTierBonus).toBe(15);
    });

    it('should calculate Tier 1 bonus at 20 rides ($15)', () => {
      const result = calculateQuestBonus(20);
      
      expect(result.questTier).toBe(1);
      expect(result.questBonusEarned).toBe(15);
      expect(result.nextTierRides).toBe(40);
      expect(result.nextTierBonus).toBe(40);
    });

    it('should calculate Tier 2 bonus at 40 rides ($40)', () => {
      const result = calculateQuestBonus(40);
      
      expect(result.questTier).toBe(2);
      expect(result.questBonusEarned).toBe(40);
      expect(result.nextTierRides).toBe(60);
      expect(result.nextTierBonus).toBe(75);
    });

    it('should calculate Tier 3 bonus at 60 rides ($75)', () => {
      const result = calculateQuestBonus(60);
      
      expect(result.questTier).toBe(3);
      expect(result.questBonusEarned).toBe(75);
      expect(result.nextTierRides).toBeNull();
      expect(result.nextTierBonus).toBeNull();
      expect(result.progressPercent).toBe(100);
    });

    it('should maintain Tier 3 bonus beyond 60 rides', () => {
      const result = calculateQuestBonus(100);
      
      expect(result.questTier).toBe(3);
      expect(result.questBonusEarned).toBe(75);
      expect(result.progressPercent).toBe(100);
    });

    it('should calculate progress percentage correctly', () => {
      const result10 = calculateQuestBonus(10);
      const result30 = calculateQuestBonus(30);
      const result50 = calculateQuestBonus(50);
      
      expect(result10.progressPercent).toBe(50); // 10/20 = 50%
      expect(result30.progressPercent).toBe(50); // 30/60 = 50%
      expect(result50.progressPercent).toBe(83); // 50/60 ≈ 83%
    });

    it('should return inactive quest when disabled', () => {
      const disabledConfig: QuestConfig = {
        ...DEFAULT_QUEST_CONFIG,
        enabled: false,
      };
      const result = calculateQuestBonus(50, disabledConfig);
      
      expect(result.questActive).toBe(false);
      expect(result.questBonusEarned).toBe(0);
    });
  });

  describe('Quest Cycle Management', () => {
    it('should calculate correct cycle start (Monday)', () => {
      const wednesday = new Date('2025-06-04T14:00:00');
      const cycleStart = getQuestCycleStart(wednesday);
      
      expect(cycleStart.getDay()).toBe(1); // Monday
      expect(cycleStart.getHours()).toBe(0);
      expect(cycleStart.getMinutes()).toBe(0);
    });

    it('should calculate correct cycle end (Sunday 23:59:59)', () => {
      const cycleStart = new Date('2025-06-02T00:00:00'); // Monday
      const cycleEnd = getQuestCycleEnd(cycleStart);
      
      expect(cycleEnd.getDay()).toBe(0); // Sunday
      expect(cycleEnd.getHours()).toBe(23);
      expect(cycleEnd.getMinutes()).toBe(59);
    });

    it('should create new quest progress correctly', () => {
      const progress = createQuestProgress('driver-123', new Date('2025-06-04T14:00:00'));
      
      expect(progress.driverId).toBe('driver-123');
      expect(progress.ridesCompletedInCycle).toBe(0);
      expect(progress.currentTier).toBeNull();
      expect(progress.questActive).toBe(true);
    });

    it('should detect when cycle needs reset', () => {
      const progress = createQuestProgress('driver-123', new Date('2025-06-02T00:00:00'));
      const nextWeek = new Date('2025-06-10T00:00:00');
      
      expect(shouldResetQuestCycle(progress, new Date('2025-06-05T00:00:00'))).toBe(false);
      expect(shouldResetQuestCycle(progress, nextWeek)).toBe(true);
    });

    it('should reset quest cycle correctly', () => {
      const oldProgress = createQuestProgress('driver-123', new Date('2025-06-02T00:00:00'));
      oldProgress.ridesCompletedInCycle = 50;
      oldProgress.currentTier = 2;
      
      const newProgress = resetQuestCycle('driver-123', new Date('2025-06-10T00:00:00'));
      
      expect(newProgress.ridesCompletedInCycle).toBe(0);
      expect(newProgress.currentTier).toBeNull();
    });
  });

  describe('Quest Progress Updates', () => {
    it('should increment rides and update tier on completion', () => {
      let progress = createQuestProgress('driver-123');
      
      // Complete 20 rides
      for (let i = 0; i < 19; i++) {
        const { progress: updated } = updateQuestProgress(progress);
        progress = updated;
      }
      
      expect(progress.ridesCompletedInCycle).toBe(19);
      expect(progress.currentTier).toBeNull();
      
      // 20th ride should trigger Tier 1
      const { progress: final, tierCompleted, bonusAwarded } = updateQuestProgress(progress);
      
      expect(final.ridesCompletedInCycle).toBe(20);
      expect(final.currentTier).toBe(1);
      expect(tierCompleted).toBe(1);
      expect(bonusAwarded).toBe(15);
    });

    it('should award incremental bonus when upgrading tiers', () => {
      let progress = createQuestProgress('driver-123');
      progress.ridesCompletedInCycle = 39;
      progress.currentTier = 1;
      progress.questBonusEarned = 15;
      
      const { tierCompleted, bonusAwarded } = updateQuestProgress(progress);
      
      expect(tierCompleted).toBe(2);
      expect(bonusAwarded).toBe(25); // $40 - $15 = $25 increment
    });
  });
});

// ========================================
// BOOST ZONE ENGINE TESTS
// ========================================

describe('Boost Zone Engine', () => {
  const weekdayEvening = createTestDate(3, 18); // Wednesday 6 PM
  const saturdayNight = createTestDate(6, 20); // Saturday 8 PM
  const weekdayMorning = createTestDate(2, 10); // Tuesday 10 AM

  describe('Zone Detection', () => {
    it('should detect pickup in Times Square boost zone', () => {
      const result = calculateBoostZoneBonus(
        TIMES_SQUARE_COORDS,
        saturdayNight,
        25.00
      );
      
      expect(result.boostActive).toBe(true);
      expect(result.boostZoneId).toBe('times_square');
      expect(result.boostPercent).toBe(30);
      expect(result.boostLevel).toBe('very_busy');
    });

    it('should detect pickup in Midtown boost zone', () => {
      const result = calculateBoostZoneBonus(
        MIDTOWN_COORDS,
        weekdayEvening,
        25.00
      );
      
      expect(result.boostActive).toBe(true);
      expect(result.boostZoneId).toBe('manhattan_midtown');
      expect(result.boostPercent).toBe(20);
    });

    it('should return no boost outside all zones', () => {
      const result = calculateBoostZoneBonus(
        NYC_COORDS,
        weekdayEvening,
        25.00
      );
      
      expect(result.boostActive).toBe(false);
      expect(result.boostZoneId).toBeNull();
      expect(result.boostAmount).toBe(0);
    });
  });

  describe('Time Window Validation', () => {
    it('should apply boost during weekday 5-7 PM window', () => {
      const result = calculateBoostZoneBonus(
        MIDTOWN_COORDS,
        createTestDate(3, 17), // Wednesday 5 PM
        25.00
      );
      
      expect(result.boostActive).toBe(true);
    });

    it('should not apply boost outside time window', () => {
      const result = calculateBoostZoneBonus(
        MIDTOWN_COORDS,
        weekdayMorning, // 10 AM - outside window
        25.00
      );
      
      expect(result.boostActive).toBe(false);
    });

    it('should apply weekend boost during 4-11 PM window', () => {
      const result = calculateBoostZoneBonus(
        MIDTOWN_COORDS,
        createTestDate(6, 16), // Saturday 4 PM
        25.00
      );
      
      expect(result.boostActive).toBe(true);
    });
  });

  describe('Boost Amount Calculation', () => {
    it('should calculate correct boost amount (+10%)', () => {
      const normalBoostZone: BoostZone[] = [{
        id: 'test_zone',
        name: 'Test Zone',
        polygon: {
          points: [
            { lat: 40.70, lng: -74.01 },
            { lat: 40.72, lng: -74.01 },
            { lat: 40.72, lng: -73.99 },
            { lat: 40.70, lng: -73.99 },
          ],
        },
        boostLevel: 'normal',
        boostPercent: 10,
        activeWindows: [{ dayOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 }],
        enabled: true,
      }];

      const result = calculateBoostZoneBonus(
        NYC_COORDS,
        new Date(),
        100.00,
        normalBoostZone
      );
      
      expect(result.boostAmount).toBe(10.00);
    });

    it('should calculate correct boost amount (+20%)', () => {
      const result = calculateBoostZoneBonus(
        MIDTOWN_COORDS,
        weekdayEvening,
        50.00
      );
      
      expect(result.boostAmount).toBe(10.00); // 50 * 0.20 = 10
    });

    it('should calculate correct boost amount (+30%)', () => {
      const result = calculateBoostZoneBonus(
        TIMES_SQUARE_COORDS,
        saturdayNight,
        100.00
      );
      
      expect(result.boostAmount).toBe(30.00); // 100 * 0.30 = 30
    });
  });

  describe('Multiple Zone Handling', () => {
    it('should select highest boost when zones overlap', () => {
      // Create overlapping zones with different boost levels
      const overlappingZones: BoostZone[] = [
        {
          id: 'zone_low',
          name: 'Low Boost',
          polygon: {
            points: [
              { lat: 40.70, lng: -74.02 },
              { lat: 40.73, lng: -74.02 },
              { lat: 40.73, lng: -73.98 },
              { lat: 40.70, lng: -73.98 },
            ],
          },
          boostLevel: 'normal',
          boostPercent: 10,
          activeWindows: [{ dayOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 }],
          enabled: true,
        },
        {
          id: 'zone_high',
          name: 'High Boost',
          polygon: {
            points: [
              { lat: 40.71, lng: -74.01 },
              { lat: 40.72, lng: -74.01 },
              { lat: 40.72, lng: -73.99 },
              { lat: 40.71, lng: -73.99 },
            ],
          },
          boostLevel: 'very_busy',
          boostPercent: 30,
          activeWindows: [{ dayOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 }],
          enabled: true,
        },
      ];

      const result = calculateBoostZoneBonus(
        NYC_COORDS, // Inside both zones
        new Date(),
        50.00,
        overlappingZones
      );
      
      expect(result.boostPercent).toBe(30);
      expect(result.boostZoneId).toBe('zone_high');
    });
  });
});

// ========================================
// AIRPORT PICKUP BONUS TESTS
// ========================================

describe('Airport Pickup Bonuses', () => {
  describe('Airport Detection', () => {
    it('should apply JFK bonus ($4) for pickup at JFK', () => {
      const result = calculateAirportBonus(JFK_COORDS);
      
      expect(result.airportBonusApplied).toBe(true);
      expect(result.airportCode).toBe('JFK');
      expect(result.airportBonusAmount).toBe(4.00);
    });

    it('should apply LGA bonus ($3) for pickup at LaGuardia', () => {
      const result = calculateAirportBonus(LGA_COORDS);
      
      expect(result.airportBonusApplied).toBe(true);
      expect(result.airportCode).toBe('LGA');
      expect(result.airportBonusAmount).toBe(3.00);
    });

    it('should apply EWR bonus ($3) for pickup at Newark', () => {
      const result = calculateAirportBonus(EWR_COORDS);
      
      expect(result.airportBonusApplied).toBe(true);
      expect(result.airportCode).toBe('EWR');
      expect(result.airportBonusAmount).toBe(3.00);
    });

    it('should not apply airport bonus for non-airport pickup', () => {
      const result = calculateAirportBonus(NYC_COORDS);
      
      expect(result.airportBonusApplied).toBe(false);
      expect(result.airportCode).toBeNull();
      expect(result.airportBonusAmount).toBe(0);
    });
  });

  describe('Radius Detection', () => {
    it('should apply bonus within airport radius', () => {
      // Just inside JFK radius (2 miles)
      const nearJFK: Location = { lat: 40.6500, lng: -73.7800 };
      const result = calculateAirportBonus(nearJFK);
      
      expect(result.airportBonusApplied).toBe(true);
      expect(result.airportCode).toBe('JFK');
    });

    it('should not apply bonus outside airport radius', () => {
      // Well outside any airport
      const farFromAirport: Location = { lat: 40.75, lng: -73.90 };
      const result = calculateAirportBonus(farFromAirport);
      
      expect(result.airportBonusApplied).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled airport config', () => {
      const disabledConfig: AirportBonusConfig[] = [
        { ...DEFAULT_AIRPORT_BONUSES[0], enabled: false },
        ...DEFAULT_AIRPORT_BONUSES.slice(1),
      ];
      
      const result = calculateAirportBonus(JFK_COORDS, disabledConfig);
      
      expect(result.airportBonusApplied).toBe(false);
    });
  });
});

// ========================================
// WEATHER BONUS TESTS
// ========================================

describe('Weather Bonus System', () => {
  describe('Weather Trigger Detection', () => {
    it('should apply bonus for heavy rain (+$2)', () => {
      const weather: WeatherContext = { type: 'heavy_rain' };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(true);
      expect(result.weatherConditionType).toBe('heavy_rain');
      expect(result.weatherBonusAmount).toBe(2.00);
    });

    it('should apply bonus for snow (+$2)', () => {
      const weather: WeatherContext = { type: 'snow' };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(true);
      expect(result.weatherConditionType).toBe('snow');
      expect(result.weatherBonusAmount).toBe(2.00);
    });

    it('should apply bonus for storm (+$2)', () => {
      const weather: WeatherContext = { type: 'storm' };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(true);
      expect(result.weatherConditionType).toBe('storm');
      expect(result.weatherBonusAmount).toBe(2.00);
    });

    it('should not apply bonus for light rain', () => {
      const weather: WeatherContext = { type: 'rain' };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(false);
      expect(result.weatherBonusAmount).toBe(0);
    });

    it('should not apply bonus for clear weather', () => {
      const weather: WeatherContext = { type: 'clear' };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(false);
    });
  });

  describe('Temperature Trigger', () => {
    it('should apply bonus for extreme cold (<30°F)', () => {
      const weather: WeatherContext = { type: 'clear', temperatureFahrenheit: 25 };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(true);
      expect(result.weatherBonusAmount).toBe(2.00);
    });

    it('should not apply bonus for mild cold (30°F+)', () => {
      const weather: WeatherContext = { type: 'clear', temperatureFahrenheit: 35 };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(false);
    });

    it('should apply bonus for exactly 29°F', () => {
      const weather: WeatherContext = { type: 'clear', temperatureFahrenheit: 29 };
      const result = calculateWeatherBonus(weather);
      
      expect(result.weatherBonusActive).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled weather config', () => {
      const disabledConfig: WeatherBonusConfig = {
        ...DEFAULT_WEATHER_BONUS_CONFIG,
        enabled: false,
      };
      const weather: WeatherContext = { type: 'storm' };
      const result = calculateWeatherBonus(weather, disabledConfig);
      
      expect(result.weatherBonusActive).toBe(false);
    });

    it('should handle missing weather context', () => {
      const result = calculateWeatherBonus(undefined);
      
      expect(result.weatherBonusActive).toBe(false);
    });
  });
});

// ========================================
// LATE-NIGHT BONUS TESTS
// ========================================

describe('Late-Night Incentives', () => {
  describe('Time Window Detection', () => {
    it('should apply bonus at 12:00 AM (+$3)', () => {
      const midnight = createTestDate(3, 0); // Wednesday 12 AM
      const result = calculateLateNightBonus(midnight);
      
      expect(result.lateNightBonusApplied).toBe(true);
      expect(result.lateNightBonusAmount).toBe(3.00);
    });

    it('should apply bonus at 1:30 AM (+$3)', () => {
      const lateNight = createTestDate(4, 1, 30); // Thursday 1:30 AM
      const result = calculateLateNightBonus(lateNight);
      
      expect(result.lateNightBonusApplied).toBe(true);
      expect(result.lateNightBonusAmount).toBe(3.00);
    });

    it('should apply bonus at 2:59 AM (+$3)', () => {
      const almostEnd = createTestDate(5, 2, 59); // Friday 2:59 AM
      const result = calculateLateNightBonus(almostEnd);
      
      expect(result.lateNightBonusApplied).toBe(true);
    });

    it('should not apply bonus at 3:00 AM', () => {
      const outsideWindow = createTestDate(3, 3); // Wednesday 3 AM
      const result = calculateLateNightBonus(outsideWindow);
      
      expect(result.lateNightBonusApplied).toBe(false);
      expect(result.lateNightBonusAmount).toBe(0);
    });

    it('should not apply bonus during daytime', () => {
      const daytime = createTestDate(3, 14); // Wednesday 2 PM
      const result = calculateLateNightBonus(daytime);
      
      expect(result.lateNightBonusApplied).toBe(false);
    });

    it('should not apply bonus at 11 PM', () => {
      const evening = createTestDate(3, 23); // Wednesday 11 PM
      const result = calculateLateNightBonus(evening);
      
      expect(result.lateNightBonusApplied).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled late-night config', () => {
      const disabledConfig: LateNightBonusConfig = {
        ...DEFAULT_LATE_NIGHT_CONFIG,
        enabled: false,
      };
      const midnight = createTestDate(3, 1);
      const result = calculateLateNightBonus(midnight, disabledConfig);
      
      expect(result.lateNightBonusApplied).toBe(false);
    });

    it('should handle custom time windows', () => {
      const customConfig: LateNightBonusConfig = {
        startHour: 22,  // 10 PM
        endHour: 4,     // 4 AM (crosses midnight)
        bonusPerRide: 5.00,
        enabled: true,
      };
      
      const result10pm = calculateLateNightBonus(createTestDate(3, 22), customConfig);
      const result3am = calculateLateNightBonus(createTestDate(4, 3), customConfig);
      const result5am = calculateLateNightBonus(createTestDate(4, 5), customConfig);
      
      expect(result10pm.lateNightBonusApplied).toBe(true);
      expect(result10pm.lateNightBonusAmount).toBe(5.00);
      expect(result3am.lateNightBonusApplied).toBe(true);
      expect(result5am.lateNightBonusApplied).toBe(false);
    });
  });
});

// ========================================
// INTEGRATION TESTS
// ========================================

describe('Incentive Integration', () => {
  describe('Multi-Incentive Stacking', () => {
    it('should stack airport bonus with boost zone', () => {
      // Create a boost zone that covers JFK
      const jfkBoostZone: BoostZone[] = [{
        id: 'jfk_boost',
        name: 'JFK Boost',
        polygon: {
          points: [
            { lat: 40.63, lng: -73.79 },
            { lat: 40.65, lng: -73.79 },
            { lat: 40.65, lng: -73.76 },
            { lat: 40.63, lng: -73.76 },
          ],
        },
        boostLevel: 'busy',
        boostPercent: 20,
        activeWindows: [{ dayOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 }],
        enabled: true,
      }];

      const context = createContext({
        pickupLocation: JFK_COORDS,
        driverEarningsBase: 50.00,
      });

      const result = calculateDriverIncentives(context, { boostZones: jfkBoostZone });
      
      expect(result.flags.airportBonusApplied).toBe(true);
      expect(result.flags.boostActive).toBe(true);
      expect(result.breakdown.airportBonus).toBe(4.00);
      expect(result.breakdown.boostZoneBonus).toBe(10.00); // 50 * 0.20
      expect(result.breakdown.totalIncentivePayout).toBe(14.00);
    });

    it('should stack weather bonus with late-night bonus', () => {
      const weather: WeatherContext = { type: 'storm' };
      const lateNight = createTestDate(3, 1); // 1 AM
      
      const context = createContext({
        currentTime: lateNight,
        weather,
        driverEarningsBase: 30.00,
      });

      const result = calculateDriverIncentives(context);
      
      expect(result.flags.weatherBonusActive).toBe(true);
      expect(result.flags.lateNightBonusApplied).toBe(true);
      expect(result.breakdown.weatherBonus).toBe(2.00);
      expect(result.breakdown.lateNightBonus).toBe(3.00);
      expect(result.breakdown.totalIncentivePayout).toBe(5.00);
    });

    it('should stack all incentives together', () => {
      // Create boost zone covering JFK
      const jfkBoostZone: BoostZone[] = [{
        id: 'jfk_boost',
        name: 'JFK Boost',
        polygon: {
          points: [
            { lat: 40.63, lng: -73.79 },
            { lat: 40.65, lng: -73.79 },
            { lat: 40.65, lng: -73.76 },
            { lat: 40.63, lng: -73.76 },
          ],
        },
        boostLevel: 'very_busy',
        boostPercent: 30,
        activeWindows: [{ dayOfWeek: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 }],
        enabled: true,
      }];

      const weather: WeatherContext = { type: 'snow' };
      const lateNight = createTestDate(6, 1); // Saturday 1 AM
      
      const context = createContext({
        pickupLocation: JFK_COORDS,
        currentTime: lateNight,
        weather,
        driverEarningsBase: 40.00,
      });

      const result = calculateDriverIncentives(context, { boostZones: jfkBoostZone });
      
      // All incentives should apply
      expect(result.flags.boostActive).toBe(true);
      expect(result.flags.airportBonusApplied).toBe(true);
      expect(result.flags.weatherBonusActive).toBe(true);
      expect(result.flags.lateNightBonusApplied).toBe(true);
      
      // Calculate expected total
      const expectedBoost = 40.00 * 0.30; // $12
      const expectedAirport = 4.00;
      const expectedWeather = 2.00;
      const expectedLateNight = 3.00;
      const expectedTotal = expectedBoost + expectedAirport + expectedWeather + expectedLateNight;
      
      expect(result.breakdown.boostZoneBonus).toBe(12.00);
      expect(result.breakdown.airportBonus).toBe(4.00);
      expect(result.breakdown.weatherBonus).toBe(2.00);
      expect(result.breakdown.lateNightBonus).toBe(3.00);
      expect(result.breakdown.totalIncentivePayout).toBe(expectedTotal);
      expect(result.totalDriverPayout).toBe(40.00 + expectedTotal);
    });
  });

  describe('Incentive Isolation from Fare', () => {
    it('should not affect rider fare calculation', () => {
      const context = createContext({
        pickupLocation: JFK_COORDS,
        driverEarningsBase: 50.00,
      });

      const result = calculateDriverIncentives(context);
      
      // Driver earnings base remains unchanged
      // Only incentives are added on top
      expect(result.breakdown.airportBonus).toBe(4.00);
      expect(result.totalDriverPayout).toBe(54.00);
    });

    it('should preserve minimum driver payout with incentives', () => {
      const context = createContext({
        driverEarningsBase: 5.00, // Minimum payout
        pickupLocation: JFK_COORDS,
      });

      const result = calculateDriverIncentives(context);
      
      // Incentives add to base, never reduce it
      expect(result.totalDriverPayout).toBeGreaterThanOrEqual(5.00);
      expect(result.totalDriverPayout).toBe(9.00); // $5 + $4 airport
    });
  });

  describe('Incentive Suppression', () => {
    it('should suppress all incentives when config disabled', () => {
      const context = createContext({
        pickupLocation: JFK_COORDS,
        currentTime: createTestDate(3, 1), // Late night
        weather: { type: 'storm' },
        driverEarningsBase: 50.00,
      });

      const result = calculateDriverIncentives(context, {
        questConfig: { ...DEFAULT_QUEST_CONFIG, enabled: false },
        boostZones: DEFAULT_BOOST_ZONES.map(z => ({ ...z, enabled: false })),
        airportBonuses: DEFAULT_AIRPORT_BONUSES.map(a => ({ ...a, enabled: false })),
        weatherBonusConfig: { ...DEFAULT_WEATHER_BONUS_CONFIG, enabled: false },
        lateNightConfig: { ...DEFAULT_LATE_NIGHT_CONFIG, enabled: false },
      });
      
      expect(result.flags.questActive).toBe(false);
      expect(result.flags.boostActive).toBe(false);
      expect(result.flags.airportBonusApplied).toBe(false);
      expect(result.flags.weatherBonusActive).toBe(false);
      expect(result.flags.lateNightBonusApplied).toBe(false);
      expect(result.breakdown.totalIncentivePayout).toBe(0);
      expect(result.totalDriverPayout).toBe(50.00);
    });
  });

  describe('Correct Breakdown Structure', () => {
    it('should return complete breakdown with all fields', () => {
      const context = createContext();
      const result = calculateDriverIncentives(context);
      
      // Verify breakdown structure
      expect(result.breakdown).toHaveProperty('questBonus');
      expect(result.breakdown).toHaveProperty('boostZoneBonus');
      expect(result.breakdown).toHaveProperty('airportBonus');
      expect(result.breakdown).toHaveProperty('weatherBonus');
      expect(result.breakdown).toHaveProperty('lateNightBonus');
      expect(result.breakdown).toHaveProperty('totalIncentivePayout');
      
      // Verify flags structure
      expect(result.flags).toHaveProperty('questActive');
      expect(result.flags).toHaveProperty('questTier');
      expect(result.flags).toHaveProperty('ridesCompletedInCycle');
      expect(result.flags).toHaveProperty('questBonusEarned');
      expect(result.flags).toHaveProperty('boostActive');
      expect(result.flags).toHaveProperty('boostPercent');
      expect(result.flags).toHaveProperty('boostZoneId');
      expect(result.flags).toHaveProperty('airportBonusApplied');
      expect(result.flags).toHaveProperty('weatherBonusActive');
      expect(result.flags).toHaveProperty('weatherConditionType');
      expect(result.flags).toHaveProperty('lateNightBonusApplied');
    });

    it('should calculate totalDriverPayout correctly', () => {
      const context = createContext({
        driverEarningsBase: 35.00,
        pickupLocation: JFK_COORDS,
      });

      const result = calculateDriverIncentives(context);
      
      const expectedTotal = context.driverEarningsBase + result.breakdown.totalIncentivePayout;
      expect(result.totalDriverPayout).toBe(expectedTotal);
    });
  });
});

// ========================================
// EDGE CASES
// ========================================

describe('Edge Cases', () => {
  it('should handle zero driver earnings base', () => {
    const context = createContext({
      driverEarningsBase: 0,
      pickupLocation: JFK_COORDS,
    });

    const result = calculateDriverIncentives(context);
    
    expect(result.breakdown.boostZoneBonus).toBe(0); // 0 * boost% = 0
    expect(result.breakdown.airportBonus).toBe(4.00); // Fixed bonus still applies
    expect(result.totalDriverPayout).toBe(4.00);
  });

  it('should handle very large driver earnings', () => {
    const context = createContext({
      driverEarningsBase: 1000.00,
      pickupLocation: TIMES_SQUARE_COORDS,
      currentTime: createTestDate(6, 20), // Saturday 8 PM
    });

    const result = calculateDriverIncentives(context);
    
    expect(result.breakdown.boostZoneBonus).toBe(300.00); // 1000 * 30%
    expect(result.totalDriverPayout).toBe(1300.00);
  });

  it('should handle boundary time cases', () => {
    // Exactly at boundary of late-night window end
    const exactEnd = createTestDate(3, 3, 0);
    const result = calculateLateNightBonus(exactEnd);
    
    expect(result.lateNightBonusApplied).toBe(false);
  });

  it('should handle all incentive types independently', () => {
    // Verify each incentive can work alone
    const airportOnlyContext = createContext({
      pickupLocation: JFK_COORDS,
      driverEarningsBase: 20.00,
    });
    const airportResult = calculateDriverIncentives(airportOnlyContext);
    expect(airportResult.flags.airportBonusApplied).toBe(true);
    expect(airportResult.flags.boostActive).toBe(false);
    expect(airportResult.flags.weatherBonusActive).toBe(false);
    expect(airportResult.flags.lateNightBonusApplied).toBe(false);
  });
});
