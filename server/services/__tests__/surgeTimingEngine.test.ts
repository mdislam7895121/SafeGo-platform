/// <reference types="jest" />
/**
 * Surge Timing Engine Tests
 * 
 * Comprehensive test coverage for SafeGo's Uber-style surge timing system.
 * Tests cover all timing windows, weather conditions, events, airports,
 * driver shortage scenarios, and the integration with fare calculation.
 */

import {
  calculateSurgeTiming,
  isWeekdayPeakHour,
  isWeekendSurgeWindow,
  calculateWeatherSurge,
  calculateEventSurge,
  calculateAirportSurge,
  calculateDriverShortageSurge,
  getSurgeReasonLabel,
  getSurgeTimingWindowLabel,
  DEFAULT_SURGE_CONFIG,
  DEFAULT_AIRPORT_ZONES,
  SurgeTimingContext,
  WeatherCondition,
  EventInfo,
  SurgeConfig,
} from '../surgeTimingEngine';

// Test location coordinates
const NYC_TIMES_SQUARE = { lat: 40.7580, lng: -73.9855 };
const JFK_AIRPORT = { lat: 40.6413, lng: -73.7781 };
const LGA_AIRPORT = { lat: 40.7769, lng: -73.8740 };
const EWR_AIRPORT = { lat: 40.6895, lng: -74.1745 };
const BROOKLYN = { lat: 40.6782, lng: -73.9442 };

// Helper to create date at specific time
function createDate(
  dayOfWeek: number, 
  hour: number, 
  minute: number = 0,
  year: number = 2025,
  month: number = 5,
  day: number = 1
): Date {
  // Find the first occurrence of the desired day of week
  const date = new Date(year, month - 1, day, hour, minute);
  const currentDay = date.getDay();
  const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

// Helper to create basic surge context
function createContext(
  overrides: Partial<SurgeTimingContext> = {}
): SurgeTimingContext {
  return {
    currentTime: new Date('2025-06-15T14:00:00'), // Sunday 2 PM (off-peak)
    pickupLocation: NYC_TIMES_SQUARE,
    activeRequests: 100,
    availableDrivers: 120,
    ...overrides,
  };
}

describe('Surge Timing Engine', () => {
  describe('Weekday Peak Hour Detection', () => {
    it('should detect morning peak (7-10 AM) on Monday', () => {
      const result = isWeekdayPeakHour(createDate(1, 8)); // Monday 8 AM
      expect(result.isPeak).toBe(true);
      expect(result.window).toBe('morning');
    });

    it('should detect morning peak at 7 AM boundary', () => {
      const result = isWeekdayPeakHour(createDate(2, 7)); // Tuesday 7 AM
      expect(result.isPeak).toBe(true);
      expect(result.window).toBe('morning');
    });

    it('should not detect peak at 6:59 AM (before morning peak)', () => {
      const date = createDate(3, 6, 59); // Wednesday 6:59 AM
      const result = isWeekdayPeakHour(date);
      expect(result.isPeak).toBe(false);
    });

    it('should not detect peak at 10 AM (after morning peak)', () => {
      const result = isWeekdayPeakHour(createDate(4, 10)); // Thursday 10 AM
      expect(result.isPeak).toBe(false);
    });

    it('should detect evening peak (4-8 PM) on Friday', () => {
      const result = isWeekdayPeakHour(createDate(5, 17)); // Friday 5 PM
      expect(result.isPeak).toBe(true);
      expect(result.window).toBe('evening');
    });

    it('should detect evening peak at 4 PM boundary', () => {
      const result = isWeekdayPeakHour(createDate(1, 16)); // Monday 4 PM
      expect(result.isPeak).toBe(true);
      expect(result.window).toBe('evening');
    });

    it('should not detect peak at 8 PM (after evening peak)', () => {
      const result = isWeekdayPeakHour(createDate(2, 20)); // Tuesday 8 PM
      expect(result.isPeak).toBe(false);
    });

    it('should not detect peak on Saturday (weekend)', () => {
      const result = isWeekdayPeakHour(createDate(6, 8)); // Saturday 8 AM
      expect(result.isPeak).toBe(false);
    });

    it('should not detect peak on Sunday (weekend)', () => {
      const result = isWeekdayPeakHour(createDate(0, 17)); // Sunday 5 PM
      expect(result.isPeak).toBe(false);
    });
  });

  describe('Weekend Surge Window Detection', () => {
    it('should detect Friday night surge (6 PM onwards)', () => {
      const result = isWeekendSurgeWindow(createDate(5, 18)); // Friday 6 PM
      expect(result.isSurge).toBe(true);
      expect(result.window).toBe('friday_night');
    });

    it('should detect Friday night surge at 11 PM', () => {
      const result = isWeekendSurgeWindow(createDate(5, 23)); // Friday 11 PM
      expect(result.isSurge).toBe(true);
      expect(result.window).toBe('friday_night');
    });

    it('should not detect Friday surge before 6 PM', () => {
      const result = isWeekendSurgeWindow(createDate(5, 17)); // Friday 5 PM
      expect(result.isSurge).toBe(false);
    });

    it('should detect Saturday night surge (5 PM onwards)', () => {
      const result = isWeekendSurgeWindow(createDate(6, 17)); // Saturday 5 PM
      expect(result.isSurge).toBe(true);
      expect(result.window).toBe('saturday_night');
    });

    it('should detect Saturday early morning surge (continuation)', () => {
      const result = isWeekendSurgeWindow(createDate(6, 1)); // Saturday 1 AM
      expect(result.isSurge).toBe(true);
      expect(result.window).toBe('saturday_night');
    });

    it('should detect Sunday early morning surge (2 AM)', () => {
      const result = isWeekendSurgeWindow(createDate(0, 1)); // Sunday 1 AM
      expect(result.isSurge).toBe(true);
      expect(result.window).toBe('saturday_night');
    });

    it('should not detect Saturday surge at 2 AM or later', () => {
      const result = isWeekendSurgeWindow(createDate(6, 2)); // Saturday 2 AM
      expect(result.isSurge).toBe(false);
    });

    it('should detect Sunday evening surge (5-9 PM)', () => {
      const result = isWeekendSurgeWindow(createDate(0, 18)); // Sunday 6 PM
      expect(result.isSurge).toBe(true);
      expect(result.window).toBe('sunday_evening');
    });

    it('should not detect Sunday surge after 9 PM', () => {
      const result = isWeekendSurgeWindow(createDate(0, 21)); // Sunday 9 PM
      expect(result.isSurge).toBe(false);
    });
  });

  describe('Weather Surge Calculation', () => {
    it('should calculate zero surge for clear weather', () => {
      const weather: WeatherCondition = { type: 'clear' };
      const surge = calculateWeatherSurge(weather);
      expect(surge).toBe(0);
    });

    it('should calculate surge for rain', () => {
      const weather: WeatherCondition = { type: 'rain' };
      const surge = calculateWeatherSurge(weather);
      expect(surge).toBeGreaterThan(0);
      expect(surge).toBe(DEFAULT_SURGE_CONFIG.weatherSurgeBoost);
    });

    it('should calculate higher surge for heavy rain', () => {
      const weather: WeatherCondition = { type: 'heavy_rain' };
      const surge = calculateWeatherSurge(weather);
      expect(surge).toBe(DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 1.5);
    });

    it('should calculate highest surge for snow', () => {
      const weather: WeatherCondition = { type: 'snow' };
      const surge = calculateWeatherSurge(weather);
      expect(surge).toBe(DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 1.8);
    });

    it('should calculate maximum surge for storm', () => {
      const weather: WeatherCondition = { type: 'storm' };
      const surge = calculateWeatherSurge(weather);
      expect(surge).toBe(DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 2.0);
    });

    it('should add surge for extreme cold (< 30°F)', () => {
      const weather: WeatherCondition = { type: 'clear', temperatureFahrenheit: 25 };
      const surge = calculateWeatherSurge(weather);
      expect(surge).toBe(DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 0.8);
    });

    it('should combine weather type and extreme cold', () => {
      const weather: WeatherCondition = { type: 'snow', temperatureFahrenheit: 20 };
      const surge = calculateWeatherSurge(weather);
      const expectedSnow = DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 1.8;
      const expectedCold = DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 0.8;
      expect(surge).toBe(expectedSnow + expectedCold);
    });

    it('should add surge for heavy precipitation intensity', () => {
      const weather: WeatherCondition = { 
        type: 'rain', 
        precipitationIntensity: 'heavy' 
      };
      const surge = calculateWeatherSurge(weather);
      const expectedRain = DEFAULT_SURGE_CONFIG.weatherSurgeBoost;
      const expectedIntensity = DEFAULT_SURGE_CONFIG.weatherSurgeBoost * 0.5;
      expect(surge).toBe(expectedRain + expectedIntensity);
    });

    it('should return 0 for undefined weather', () => {
      const surge = calculateWeatherSurge(undefined);
      expect(surge).toBe(0);
    });
  });

  describe('Event Surge Calculation', () => {
    const createEvent = (
      startHoursFromNow: number,
      durationHours: number = 2,
      attendance: number = 10000
    ): EventInfo => {
      const now = new Date();
      return {
        type: 'concert',
        name: 'Test Concert',
        startTime: new Date(now.getTime() + startHoursFromNow * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + (startHoursFromNow + durationHours) * 60 * 60 * 1000),
        expectedAttendance: attendance,
        venueLocation: NYC_TIMES_SQUARE,
      };
    };

    it('should calculate pre-event surge (1 hour before)', () => {
      const event = createEvent(0.5); // Event starts in 30 mins
      const result = calculateEventSurge(
        NYC_TIMES_SQUARE,
        [event],
        new Date()
      );
      expect(result.contribution).toBeGreaterThan(0);
      expect(result.reason).toBe('event_pre');
    });

    it('should calculate post-event surge (1.5 hours after)', () => {
      const now = new Date();
      const event: EventInfo = {
        type: 'stadium',
        name: 'Baseball Game',
        startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000), // Started 3 hours ago
        endTime: new Date(now.getTime() - 30 * 60 * 1000), // Ended 30 mins ago
        expectedAttendance: 40000,
        venueLocation: NYC_TIMES_SQUARE,
      };
      const result = calculateEventSurge(NYC_TIMES_SQUARE, [event], now);
      expect(result.contribution).toBeGreaterThan(0);
      expect(result.reason).toBe('event_post');
    });

    it('should not calculate surge for distant events', () => {
      const event: EventInfo = {
        type: 'festival',
        name: 'Far Away Festival',
        startTime: new Date(Date.now() + 30 * 60 * 1000),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        expectedAttendance: 50000,
        venueLocation: { lat: 41.0, lng: -74.5 }, // Far away
      };
      const result = calculateEventSurge(NYC_TIMES_SQUARE, [event], new Date());
      expect(result.contribution).toBe(0);
      expect(result.reason).toBeNull();
    });

    it('should scale surge by event attendance (>50k)', () => {
      const smallEvent = createEvent(0.5, 2, 10000);
      const largeEvent = createEvent(0.5, 2, 60000);
      
      const smallResult = calculateEventSurge(NYC_TIMES_SQUARE, [smallEvent], new Date());
      const largeResult = calculateEventSurge(NYC_TIMES_SQUARE, [largeEvent], new Date());
      
      expect(largeResult.contribution).toBeGreaterThan(smallResult.contribution);
    });

    it('should return zero for no events', () => {
      const result = calculateEventSurge(NYC_TIMES_SQUARE, [], new Date());
      expect(result.contribution).toBe(0);
    });

    it('should return zero for undefined events', () => {
      const result = calculateEventSurge(NYC_TIMES_SQUARE, undefined, new Date());
      expect(result.contribution).toBe(0);
    });
  });

  describe('Airport Surge Calculation', () => {
    it('should calculate surge at JFK airport', () => {
      const result = calculateAirportSurge(JFK_AIRPORT);
      expect(result.contribution).toBeGreaterThan(0);
      expect(result.airportCode).toBe('JFK');
    });

    it('should calculate surge at LaGuardia airport', () => {
      const result = calculateAirportSurge(LGA_AIRPORT);
      expect(result.contribution).toBeGreaterThan(0);
      expect(result.airportCode).toBe('LGA');
    });

    it('should calculate surge at Newark airport', () => {
      const result = calculateAirportSurge(EWR_AIRPORT);
      expect(result.contribution).toBeGreaterThan(0);
      expect(result.airportCode).toBe('EWR');
    });

    it('should not calculate surge outside airport zones', () => {
      const result = calculateAirportSurge(NYC_TIMES_SQUARE);
      expect(result.contribution).toBe(0);
      expect(result.airportCode).toBeNull();
    });

    it('should calculate higher surge closer to airport center', () => {
      // Very close to JFK
      const closeResult = calculateAirportSurge(JFK_AIRPORT);
      // 2 miles from JFK
      const farResult = calculateAirportSurge({ 
        lat: JFK_AIRPORT.lat + 0.03, 
        lng: JFK_AIRPORT.lng 
      });
      expect(closeResult.contribution).toBeGreaterThan(farResult.contribution);
    });
  });

  describe('Driver Shortage Surge Calculation', () => {
    it('should return zero when drivers exceed requests', () => {
      const surge = calculateDriverShortageSurge(100, 150);
      expect(surge).toBe(0);
    });

    it('should return zero when drivers equal requests', () => {
      const surge = calculateDriverShortageSurge(100, 100);
      expect(surge).toBe(0);
    });

    it('should calculate mild surge when ratio is 1.2', () => {
      const surge = calculateDriverShortageSurge(120, 100);
      expect(surge).toBeGreaterThan(0);
      expect(surge).toBeLessThan(0.10);
    });

    it('should calculate higher surge at threshold ratio', () => {
      const surge = calculateDriverShortageSurge(150, 100); // 1.5 ratio
      expect(surge).toBeGreaterThan(0.05);
    });

    it('should calculate severe shortage surge', () => {
      const surge = calculateDriverShortageSurge(250, 100); // 2.5 ratio
      expect(surge).toBeGreaterThan(0.20);
    });

    it('should handle zero drivers (extreme shortage)', () => {
      const surge = calculateDriverShortageSurge(100, 0);
      expect(surge).toBe(0.50);
    });
  });

  describe('Full Surge Timing Calculation', () => {
    it('should return no surge during off-peak with balanced supply', () => {
      const context = createContext({
        currentTime: createDate(3, 12), // Wednesday noon
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(false);
      expect(result.surgeMultiplier).toBe(1.0);
      expect(result.surgeReason).toBe('none');
    });

    it('should apply weekday morning peak surge', () => {
      const context = createContext({
        currentTime: createDate(1, 8), // Monday 8 AM
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(true);
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
      expect(result.surgeReasons).toContain('weekday_morning_peak');
      expect(result.activeWindows).toContain('weekday_morning');
    });

    it('should apply weekday evening peak surge', () => {
      const context = createContext({
        currentTime: createDate(2, 17), // Tuesday 5 PM
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(true);
      expect(result.surgeReasons).toContain('weekday_evening_peak');
    });

    it('should apply Friday night surge', () => {
      const context = createContext({
        currentTime: createDate(5, 21), // Friday 9 PM
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(true);
      expect(result.surgeReasons).toContain('weekend_friday_night');
    });

    it('should apply Saturday night surge', () => {
      const context = createContext({
        currentTime: createDate(6, 22), // Saturday 10 PM
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(true);
      expect(result.surgeReasons).toContain('weekend_saturday_night');
    });

    it('should apply weather surge on top of timing surge', () => {
      const context = createContext({
        currentTime: createDate(1, 8), // Monday 8 AM
        weather: { type: 'rain' },
      });
      const result = calculateSurgeTiming(context);
      expect(result.surgeReasons).toContain('weekday_morning_peak');
      expect(result.surgeReasons).toContain('weather_rain');
      expect(result.surgeReason).toBe('combined');
    });

    it('should apply airport zone surge', () => {
      const context = createContext({
        pickupLocation: JFK_AIRPORT,
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(true);
      expect(result.surgeReasons).toContain('airport_jfk');
    });

    it('should apply driver shortage surge', () => {
      const context = createContext({
        activeRequests: 200,
        availableDrivers: 50, // Severe shortage
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(true);
      expect(result.surgeReasons).toContain('driver_shortage');
    });

    it('should enforce surge cap at 1.90x', () => {
      const context = createContext({
        currentTime: createDate(6, 22), // Saturday night
        pickupLocation: JFK_AIRPORT,
        weather: { type: 'storm' },
        activeRequests: 300,
        availableDrivers: 30,
      });
      const result = calculateSurgeTiming(context);
      expect(result.surgeMultiplier).toBeLessThanOrEqual(1.90);
      expect(result.surgeCapped).toBe(true);
    });

    it('should apply minimum surge when active', () => {
      // Create a scenario with very mild surge contribution
      const context = createContext({
        activeRequests: 105,
        availableDrivers: 100, // Very slight shortage
      });
      const result = calculateSurgeTiming(context);
      if (result.isActive) {
        expect(result.surgeMultiplier).toBeGreaterThanOrEqual(DEFAULT_SURGE_CONFIG.minimumSurge);
      }
    });

    it('should track all contributing reasons', () => {
      const context = createContext({
        currentTime: createDate(5, 21), // Friday 9 PM
        weather: { type: 'snow', temperatureFahrenheit: 20 },
        activeRequests: 180,
        availableDrivers: 100,
      });
      const result = calculateSurgeTiming(context);
      expect(result.surgeReasons.length).toBeGreaterThan(1);
      expect(result.surgeReason).toBe('combined');
    });

    it('should provide breakdown of surge contributions', () => {
      const context = createContext({
        currentTime: createDate(1, 8), // Monday 8 AM
        weather: { type: 'rain' },
        pickupLocation: JFK_AIRPORT,
      });
      const result = calculateSurgeTiming(context);
      expect(result.breakdown.timingContribution).toBeGreaterThan(0);
      expect(result.breakdown.weatherContribution).toBeGreaterThan(0);
      expect(result.breakdown.airportContribution).toBeGreaterThan(0);
    });
  });

  describe('Surge Reason and Window Labels', () => {
    it('should return correct label for morning peak', () => {
      expect(getSurgeReasonLabel('weekday_morning_peak')).toBe('Morning rush hour');
    });

    it('should return correct label for weather conditions', () => {
      expect(getSurgeReasonLabel('weather_rain')).toBe('Rainy weather');
      expect(getSurgeReasonLabel('weather_snow')).toBe('Snowy conditions');
      expect(getSurgeReasonLabel('weather_storm')).toBe('Storm conditions');
    });

    it('should return correct label for airports', () => {
      expect(getSurgeReasonLabel('airport_jfk')).toBe('JFK Airport zone');
      expect(getSurgeReasonLabel('airport_lga')).toBe('LaGuardia Airport zone');
    });

    it('should return correct label for driver shortage', () => {
      expect(getSurgeReasonLabel('driver_shortage')).toBe('High demand, fewer drivers');
    });

    it('should return correct window labels', () => {
      expect(getSurgeTimingWindowLabel('weekday_morning')).toBe('7-10 AM weekday');
      expect(getSurgeTimingWindowLabel('friday_night')).toBe('Friday 6 PM - midnight');
      expect(getSurgeTimingWindowLabel('airport_zone')).toBe('Airport zone');
    });
  });

  describe('Surge Config Customization', () => {
    it('should respect custom surge ranges', () => {
      const customConfig: SurgeConfig = {
        ...DEFAULT_SURGE_CONFIG,
        surgeCap: 1.50, // Lower cap
      };
      
      const context = createContext({
        currentTime: createDate(6, 22), // Saturday night
        pickupLocation: JFK_AIRPORT,
        weather: { type: 'storm' },
        activeRequests: 300,
        availableDrivers: 30,
      });
      
      const result = calculateSurgeTiming(context, customConfig);
      expect(result.surgeMultiplier).toBeLessThanOrEqual(1.50);
      expect(result.surgeCapped).toBe(true);
    });

    it('should respect custom weather surge boost', () => {
      const customConfig: SurgeConfig = {
        ...DEFAULT_SURGE_CONFIG,
        weatherSurgeBoost: 0.30, // Higher weather boost
      };
      
      const weather: WeatherCondition = { type: 'rain' };
      const surge = calculateWeatherSurge(weather, customConfig);
      expect(surge).toBe(0.30);
    });

    it('should respect custom driver shortage threshold', () => {
      const customConfig: SurgeConfig = {
        ...DEFAULT_SURGE_CONFIG,
        driverShortageThreshold: 2.0, // Higher threshold
      };
      
      // With 1.5 ratio, should be mild shortage with custom config
      const surge = calculateDriverShortageSurge(150, 100, customConfig);
      expect(surge).toBeGreaterThan(0);
      expect(surge).toBeLessThan(0.10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight transitions correctly', () => {
      // Saturday at 11:59 PM
      const saturdayNight = createDate(6, 23, 59);
      const satResult = isWeekendSurgeWindow(saturdayNight);
      expect(satResult.isSurge).toBe(true);
      expect(satResult.window).toBe('saturday_night');
    });

    it('should handle boundary between Friday night and Saturday morning', () => {
      // Saturday at 12:01 AM (still Friday night surge continuation)
      const earlyMorning = createDate(6, 0, 1);
      const result = isWeekendSurgeWindow(earlyMorning);
      expect(result.isSurge).toBe(true);
    });

    it('should handle very small driver numbers', () => {
      const surge = calculateDriverShortageSurge(50, 1);
      expect(surge).toBeGreaterThan(0);
      expect(surge).toBeLessThanOrEqual(0.55);
    });

    it('should handle zero requests', () => {
      const surge = calculateDriverShortageSurge(0, 100);
      expect(surge).toBe(0);
    });

    it('should round surge multiplier to 2 decimal places', () => {
      const context = createContext({
        currentTime: createDate(1, 8),
        weather: { type: 'rain' },
      });
      const result = calculateSurgeTiming(context);
      const decimalPlaces = result.surgeMultiplier.toString().split('.')[1]?.length ?? 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should handle all clear conditions', () => {
      const context = createContext({
        currentTime: createDate(3, 14), // Wednesday 2 PM
        pickupLocation: BROOKLYN, // Not at airport
        activeRequests: 80,
        availableDrivers: 100,
        weather: { type: 'clear' },
      });
      const result = calculateSurgeTiming(context);
      expect(result.isActive).toBe(false);
      expect(result.surgeMultiplier).toBe(1.0);
      expect(result.surgeReason).toBe('none');
      expect(result.surgeTimingWindow).toBe('off_peak');
    });
  });
});
