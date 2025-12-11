/**
 * SafeGo Driver Incentive Engine
 * 
 * Comprehensive incentive system including:
 * - Quest Bonuses (Weekly Goals)
 * - Boost Zones (Time & Location Based)
 * - Airport Pickup Bonuses
 * - Weather Bonuses
 * - Late-Night Incentives
 * 
 * Integration Rules:
 * 1. Incentives are added AFTER fare calculation but BEFORE final payout
 * 2. Incentives NEVER reduce SafeGo's commission or rider fare
 * 3. Multiple incentives can stack
 * 4. Incentives must NEVER break minimum driver payout rule
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

export type WeatherConditionType = 'clear' | 'rain' | 'heavy_rain' | 'snow' | 'storm' | 'fog' | 'low_visibility';

export interface WeatherContext {
  type: WeatherConditionType;
  temperatureFahrenheit?: number;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface GeoPolygon {
  points: Location[];
}

// ========================================
// QUEST BONUS TYPES
// ========================================

export type QuestTier = 1 | 2 | 3;

export interface QuestConfig {
  tier1: { rides: number; bonus: number };  // 20 rides = $15
  tier2: { rides: number; bonus: number };  // 40 rides = $40
  tier3: { rides: number; bonus: number };  // 60 rides = $75
  cycleStartDay: number;  // 1 = Monday
  enabled: boolean;
}

export interface QuestProgress {
  driverId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  ridesCompletedInCycle: number;
  currentTier: QuestTier | null;
  questBonusEarned: number;
  questActive: boolean;
}

export interface QuestResult {
  questActive: boolean;
  questTier: QuestTier | null;
  ridesCompletedInCycle: number;
  questBonusEarned: number;
  progressPercent: number;
  nextTierRides: number | null;
  nextTierBonus: number | null;
}

// ========================================
// BOOST ZONE TYPES
// ========================================

export type BoostLevel = 'normal' | 'busy' | 'very_busy';

export interface BoostZone {
  id: string;
  name: string;
  polygon: GeoPolygon;
  boostLevel: BoostLevel;
  boostPercent: number;  // 10, 20, or 30
  activeWindows: BoostTimeWindow[];
  enabled: boolean;
}

export interface BoostTimeWindow {
  dayOfWeek: number[];  // 0 = Sunday, 1 = Monday, etc.
  startHour: number;
  endHour: number;
}

export interface BoostResult {
  boostActive: boolean;
  boostPercent: number;
  boostZoneId: string | null;
  boostZoneName: string | null;
  boostLevel: BoostLevel | null;
  boostAmount: number;
}

// ========================================
// AIRPORT BONUS TYPES
// ========================================

export interface AirportBonusConfig {
  code: string;
  name: string;
  location: Location;
  radiusMiles: number;
  bonusAmount: number;
  enabled: boolean;
}

export interface AirportBonusResult {
  airportBonusApplied: boolean;
  airportCode: string | null;
  airportBonusAmount: number;
}

// ========================================
// WEATHER BONUS TYPES
// ========================================

export interface WeatherBonusConfig {
  triggers: WeatherConditionType[];
  coldThresholdFahrenheit: number;
  bonusPerRide: number;
  enabled: boolean;
}

export interface WeatherBonusResult {
  weatherBonusActive: boolean;
  weatherConditionType: WeatherConditionType | null;
  weatherBonusAmount: number;
}

// ========================================
// LATE-NIGHT BONUS TYPES
// ========================================

export interface LateNightBonusConfig {
  startHour: number;  // 0 = 12:00 AM
  endHour: number;    // 3 = 3:00 AM
  bonusPerRide: number;
  enabled: boolean;
}

export interface LateNightBonusResult {
  lateNightBonusApplied: boolean;
  lateNightBonusAmount: number;
}

// ========================================
// COMBINED INCENTIVE TYPES
// ========================================

export interface IncentiveContext {
  driverId: string;
  pickupLocation: Location;
  currentTime: Date;
  weather?: WeatherContext;
  driverEarningsBase: number;  // Base earnings from fare calculation
  isQuestEnabled?: boolean;
  questProgress?: QuestProgress;
}

export interface IncentiveBreakdown {
  questBonus: number;
  boostZoneBonus: number;
  airportBonus: number;
  weatherBonus: number;
  lateNightBonus: number;
  totalIncentivePayout: number;
}

export interface IncentiveResult {
  breakdown: IncentiveBreakdown;
  flags: {
    questActive: boolean;
    questTier: QuestTier | null;
    ridesCompletedInCycle: number;
    questBonusEarned: number;
    boostActive: boolean;
    boostPercent: number;
    boostZoneId: string | null;
    airportBonusApplied: boolean;
    weatherBonusActive: boolean;
    weatherConditionType: WeatherConditionType | null;
    lateNightBonusApplied: boolean;
  };
  totalDriverPayout: number;
  questProgress?: QuestResult;
}

// ========================================
// DEFAULT CONFIGURATIONS
// ========================================

export const DEFAULT_QUEST_CONFIG: QuestConfig = {
  tier1: { rides: 20, bonus: 15 },
  tier2: { rides: 40, bonus: 40 },
  tier3: { rides: 60, bonus: 75 },
  cycleStartDay: 1,  // Monday
  enabled: true,
};

export const DEFAULT_BOOST_ZONES: BoostZone[] = [
  {
    id: 'manhattan_midtown',
    name: 'Midtown Manhattan',
    polygon: {
      points: [
        { lat: 40.7580, lng: -73.9855 },
        { lat: 40.7614, lng: -73.9776 },
        { lat: 40.7527, lng: -73.9772 },
        { lat: 40.7494, lng: -73.9851 },
      ],
    },
    boostLevel: 'busy',
    boostPercent: 20,
    activeWindows: [
      { dayOfWeek: [1, 2, 3, 4, 5], startHour: 17, endHour: 19 },  // Weekdays 5-7 PM
      { dayOfWeek: [0, 6], startHour: 16, endHour: 23 },  // Weekends 4-11 PM
    ],
    enabled: true,
  },
  {
    id: 'times_square',
    name: 'Times Square',
    polygon: {
      points: [
        { lat: 40.7580, lng: -73.9855 },
        { lat: 40.7614, lng: -73.9855 },
        { lat: 40.7614, lng: -73.9815 },
        { lat: 40.7580, lng: -73.9815 },
      ],
    },
    boostLevel: 'very_busy',
    boostPercent: 30,
    activeWindows: [
      { dayOfWeek: [5, 6], startHour: 18, endHour: 23 },  // Fri-Sat 6-11 PM
    ],
    enabled: true,
  },
  {
    id: 'brooklyn_downtown',
    name: 'Downtown Brooklyn',
    polygon: {
      points: [
        { lat: 40.6892, lng: -73.9857 },
        { lat: 40.6942, lng: -73.9857 },
        { lat: 40.6942, lng: -73.9797 },
        { lat: 40.6892, lng: -73.9797 },
      ],
    },
    boostLevel: 'normal',
    boostPercent: 10,
    activeWindows: [
      { dayOfWeek: [1, 2, 3, 4, 5], startHour: 17, endHour: 19 },
    ],
    enabled: true,
  },
];

export const DEFAULT_AIRPORT_BONUSES: AirportBonusConfig[] = [
  {
    code: 'JFK',
    name: 'John F. Kennedy International Airport',
    location: { lat: 40.6413, lng: -73.7781 },
    radiusMiles: 2.0,
    bonusAmount: 4.00,
    enabled: true,
  },
  {
    code: 'LGA',
    name: 'LaGuardia Airport',
    location: { lat: 40.7769, lng: -73.8740 },
    radiusMiles: 1.5,
    bonusAmount: 3.00,
    enabled: true,
  },
  {
    code: 'EWR',
    name: 'Newark Liberty International Airport',
    location: { lat: 40.6895, lng: -74.1745 },
    radiusMiles: 2.0,
    bonusAmount: 3.00,
    enabled: true,
  },
];

export const DEFAULT_WEATHER_BONUS_CONFIG: WeatherBonusConfig = {
  triggers: ['heavy_rain', 'snow', 'storm'],
  coldThresholdFahrenheit: 30,
  bonusPerRide: 2.00,
  enabled: true,
};

export const DEFAULT_LATE_NIGHT_CONFIG: LateNightBonusConfig = {
  startHour: 0,   // 12:00 AM
  endHour: 3,     // 3:00 AM
  bonusPerRide: 3.00,
  enabled: true,
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Calculate haversine distance between two points in miles
 */
function getHaversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(point: Location, polygon: GeoPolygon): boolean {
  const { lat, lng } = point;
  const { points } = polygon;
  
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].lng, yi = points[i].lat;
    const xj = points[j].lng, yj = points[j].lat;
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Get the start of the current quest cycle (Monday 00:00)
 */
export function getQuestCycleStart(date: Date, cycleStartDay: number = 1): Date {
  const result = new Date(date);
  const currentDay = result.getDay();
  const daysToSubtract = (currentDay - cycleStartDay + 7) % 7;
  result.setDate(result.getDate() - daysToSubtract);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of the current quest cycle (Sunday 23:59:59)
 */
export function getQuestCycleEnd(cycleStart: Date): Date {
  const result = new Date(cycleStart);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

// ========================================
// QUEST BONUS CALCULATION
// ========================================

/**
 * Calculate quest bonus based on rides completed
 */
export function calculateQuestBonus(
  ridesCompleted: number,
  config: QuestConfig = DEFAULT_QUEST_CONFIG
): QuestResult {
  if (!config.enabled) {
    return {
      questActive: false,
      questTier: null,
      ridesCompletedInCycle: ridesCompleted,
      questBonusEarned: 0,
      progressPercent: 0,
      nextTierRides: config.tier1.rides,
      nextTierBonus: config.tier1.bonus,
    };
  }

  let questTier: QuestTier | null = null;
  let questBonusEarned = 0;
  let nextTierRides: number | null = null;
  let nextTierBonus: number | null = null;

  if (ridesCompleted >= config.tier3.rides) {
    questTier = 3;
    questBonusEarned = config.tier3.bonus;
    nextTierRides = null;
    nextTierBonus = null;
  } else if (ridesCompleted >= config.tier2.rides) {
    questTier = 2;
    questBonusEarned = config.tier2.bonus;
    nextTierRides = config.tier3.rides;
    nextTierBonus = config.tier3.bonus;
  } else if (ridesCompleted >= config.tier1.rides) {
    questTier = 1;
    questBonusEarned = config.tier1.bonus;
    nextTierRides = config.tier2.rides;
    nextTierBonus = config.tier2.bonus;
  } else {
    nextTierRides = config.tier1.rides;
    nextTierBonus = config.tier1.bonus;
  }

  // Calculate progress percentage toward next tier or completion
  let progressPercent: number;
  if (questTier === 3) {
    progressPercent = 100;
  } else if (questTier === 2) {
    const tierProgress = ridesCompleted - config.tier2.rides;
    const tierTotal = config.tier3.rides - config.tier2.rides;
    progressPercent = Math.round(((config.tier2.rides + tierProgress) / config.tier3.rides) * 100);
  } else if (questTier === 1) {
    const tierProgress = ridesCompleted - config.tier1.rides;
    const tierTotal = config.tier2.rides - config.tier1.rides;
    progressPercent = Math.round(((config.tier1.rides + tierProgress) / config.tier3.rides) * 100);
  } else {
    progressPercent = Math.round((ridesCompleted / config.tier1.rides) * 100);
  }

  return {
    questActive: true,
    questTier,
    ridesCompletedInCycle: ridesCompleted,
    questBonusEarned,
    progressPercent: Math.min(progressPercent, 100),
    nextTierRides,
    nextTierBonus,
  };
}

// ========================================
// BOOST ZONE CALCULATION
// ========================================

/**
 * Check if current time falls within a boost window
 */
function isWithinBoostWindow(
  currentTime: Date,
  windows: BoostTimeWindow[]
): boolean {
  const dayOfWeek = currentTime.getDay();
  const hour = currentTime.getHours();

  for (const window of windows) {
    if (window.dayOfWeek.includes(dayOfWeek)) {
      if (hour >= window.startHour && hour < window.endHour) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate boost zone bonus
 */
export function calculateBoostZoneBonus(
  pickupLocation: Location,
  currentTime: Date,
  driverEarningsBase: number,
  boostZones: BoostZone[] = DEFAULT_BOOST_ZONES
): BoostResult {
  let bestBoost: BoostZone | null = null;
  let maxBoostPercent = 0;

  for (const zone of boostZones) {
    if (!zone.enabled) continue;

    // Check if pickup is in zone
    if (!isPointInPolygon(pickupLocation, zone.polygon)) continue;

    // Check if current time is within boost window
    if (!isWithinBoostWindow(currentTime, zone.activeWindows)) continue;

    // Take the highest boost if multiple zones overlap
    if (zone.boostPercent > maxBoostPercent) {
      maxBoostPercent = zone.boostPercent;
      bestBoost = zone;
    }
  }

  if (!bestBoost) {
    return {
      boostActive: false,
      boostPercent: 0,
      boostZoneId: null,
      boostZoneName: null,
      boostLevel: null,
      boostAmount: 0,
    };
  }

  const boostAmount = Math.round((driverEarningsBase * (bestBoost.boostPercent / 100)) * 100) / 100;

  return {
    boostActive: true,
    boostPercent: bestBoost.boostPercent,
    boostZoneId: bestBoost.id,
    boostZoneName: bestBoost.name,
    boostLevel: bestBoost.boostLevel,
    boostAmount,
  };
}

// ========================================
// AIRPORT BONUS CALCULATION
// ========================================

/**
 * Calculate airport pickup bonus
 */
export function calculateAirportBonus(
  pickupLocation: Location,
  airportConfigs: AirportBonusConfig[] = DEFAULT_AIRPORT_BONUSES
): AirportBonusResult {
  for (const airport of airportConfigs) {
    if (!airport.enabled) continue;

    const distance = getHaversineDistanceMiles(
      pickupLocation.lat, pickupLocation.lng,
      airport.location.lat, airport.location.lng
    );

    if (distance <= airport.radiusMiles) {
      return {
        airportBonusApplied: true,
        airportCode: airport.code,
        airportBonusAmount: airport.bonusAmount,
      };
    }
  }

  return {
    airportBonusApplied: false,
    airportCode: null,
    airportBonusAmount: 0,
  };
}

// ========================================
// WEATHER BONUS CALCULATION
// ========================================

/**
 * Calculate weather bonus
 */
export function calculateWeatherBonus(
  weather: WeatherContext | undefined,
  config: WeatherBonusConfig = DEFAULT_WEATHER_BONUS_CONFIG
): WeatherBonusResult {
  if (!config.enabled || !weather) {
    return {
      weatherBonusActive: false,
      weatherConditionType: null,
      weatherBonusAmount: 0,
    };
  }

  // Check if weather type triggers bonus
  const weatherTriggers = config.triggers.includes(weather.type);
  
  // Check for extreme cold
  const isCold = weather.temperatureFahrenheit !== undefined && 
                 weather.temperatureFahrenheit < config.coldThresholdFahrenheit;

  if (weatherTriggers || isCold) {
    return {
      weatherBonusActive: true,
      weatherConditionType: weather.type,
      weatherBonusAmount: config.bonusPerRide,
    };
  }

  return {
    weatherBonusActive: false,
    weatherConditionType: null,
    weatherBonusAmount: 0,
  };
}

// ========================================
// LATE-NIGHT BONUS CALCULATION
// ========================================

/**
 * Calculate late-night bonus
 */
export function calculateLateNightBonus(
  currentTime: Date,
  config: LateNightBonusConfig = DEFAULT_LATE_NIGHT_CONFIG
): LateNightBonusResult {
  if (!config.enabled) {
    return {
      lateNightBonusApplied: false,
      lateNightBonusAmount: 0,
    };
  }

  const hour = currentTime.getHours();

  // Check if within late-night window (handles midnight crossing)
  let isLateNight: boolean;
  if (config.startHour <= config.endHour) {
    isLateNight = hour >= config.startHour && hour < config.endHour;
  } else {
    // Window crosses midnight (e.g., 22 to 3)
    isLateNight = hour >= config.startHour || hour < config.endHour;
  }

  if (isLateNight) {
    return {
      lateNightBonusApplied: true,
      lateNightBonusAmount: config.bonusPerRide,
    };
  }

  return {
    lateNightBonusApplied: false,
    lateNightBonusAmount: 0,
  };
}

// ========================================
// MAIN INCENTIVE CALCULATION
// ========================================

export interface IncentiveConfig {
  questConfig?: QuestConfig;
  boostZones?: BoostZone[];
  airportBonuses?: AirportBonusConfig[];
  weatherBonusConfig?: WeatherBonusConfig;
  lateNightConfig?: LateNightBonusConfig;
}

/**
 * Calculate all driver incentives for a ride
 * 
 * Rules:
 * 1. Incentives are added AFTER fare calculation but BEFORE final payout
 * 2. Incentives NEVER reduce SafeGo's commission or rider fare
 * 3. Multiple incentives can stack
 * 4. Incentives must NEVER break minimum driver payout rule
 */
export function calculateDriverIncentives(
  context: IncentiveContext,
  config: IncentiveConfig = {}
): IncentiveResult {
  const {
    questConfig = DEFAULT_QUEST_CONFIG,
    boostZones = DEFAULT_BOOST_ZONES,
    airportBonuses = DEFAULT_AIRPORT_BONUSES,
    weatherBonusConfig = DEFAULT_WEATHER_BONUS_CONFIG,
    lateNightConfig = DEFAULT_LATE_NIGHT_CONFIG,
  } = config;

  // 1. Calculate Quest Bonus (based on progress tracking)
  const questResult = context.questProgress 
    ? calculateQuestBonus(context.questProgress.ridesCompletedInCycle, questConfig)
    : { questActive: false, questTier: null, ridesCompletedInCycle: 0, questBonusEarned: 0, progressPercent: 0, nextTierRides: null, nextTierBonus: null };

  // Quest bonus is awarded at cycle completion, not per-ride
  // For now, we track progress; actual bonus is applied when ride completes
  const questBonusThisRide = 0; // Quest bonus is tracked separately

  // 2. Calculate Boost Zone Bonus (percentage of driver earnings)
  const boostResult = calculateBoostZoneBonus(
    context.pickupLocation,
    context.currentTime,
    context.driverEarningsBase,
    boostZones
  );

  // 3. Calculate Airport Pickup Bonus
  const airportResult = calculateAirportBonus(
    context.pickupLocation,
    airportBonuses
  );

  // 4. Calculate Weather Bonus
  const weatherResult = calculateWeatherBonus(
    context.weather,
    weatherBonusConfig
  );

  // 5. Calculate Late-Night Bonus
  const lateNightResult = calculateLateNightBonus(
    context.currentTime,
    lateNightConfig
  );

  // Build breakdown
  const breakdown: IncentiveBreakdown = {
    questBonus: questBonusThisRide,
    boostZoneBonus: boostResult.boostAmount,
    airportBonus: airportResult.airportBonusAmount,
    weatherBonus: weatherResult.weatherBonusAmount,
    lateNightBonus: lateNightResult.lateNightBonusAmount,
    totalIncentivePayout: 0,
  };

  breakdown.totalIncentivePayout = 
    breakdown.questBonus +
    breakdown.boostZoneBonus +
    breakdown.airportBonus +
    breakdown.weatherBonus +
    breakdown.lateNightBonus;

  // Calculate total driver payout (base earnings + incentives)
  const totalDriverPayout = Math.round(
    (context.driverEarningsBase + breakdown.totalIncentivePayout) * 100
  ) / 100;

  return {
    breakdown,
    flags: {
      questActive: questResult.questActive,
      questTier: questResult.questTier,
      ridesCompletedInCycle: questResult.ridesCompletedInCycle,
      questBonusEarned: questResult.questBonusEarned,
      boostActive: boostResult.boostActive,
      boostPercent: boostResult.boostPercent,
      boostZoneId: boostResult.boostZoneId,
      airportBonusApplied: airportResult.airportBonusApplied,
      weatherBonusActive: weatherResult.weatherBonusActive,
      weatherConditionType: weatherResult.weatherConditionType,
      lateNightBonusApplied: lateNightResult.lateNightBonusApplied,
    },
    totalDriverPayout,
    questProgress: questResult,
  };
}

// ========================================
// QUEST PROGRESS MANAGEMENT
// ========================================

/**
 * Create a new quest progress for a driver
 */
export function createQuestProgress(
  driverId: string,
  currentDate: Date = new Date(),
  config: QuestConfig = DEFAULT_QUEST_CONFIG
): QuestProgress {
  const cycleStart = getQuestCycleStart(currentDate, config.cycleStartDay);
  const cycleEnd = getQuestCycleEnd(cycleStart);

  return {
    driverId,
    cycleStartDate: cycleStart,
    cycleEndDate: cycleEnd,
    ridesCompletedInCycle: 0,
    currentTier: null,
    questBonusEarned: 0,
    questActive: config.enabled,
  };
}

/**
 * Update quest progress after a ride completion
 */
export function updateQuestProgress(
  progress: QuestProgress,
  config: QuestConfig = DEFAULT_QUEST_CONFIG
): { progress: QuestProgress; tierCompleted: QuestTier | null; bonusAwarded: number } {
  const newRides = progress.ridesCompletedInCycle + 1;
  const previousTier = progress.currentTier;
  
  let newTier: QuestTier | null = null;
  let newBonus = 0;

  if (newRides >= config.tier3.rides) {
    newTier = 3;
    newBonus = config.tier3.bonus;
  } else if (newRides >= config.tier2.rides) {
    newTier = 2;
    newBonus = config.tier2.bonus;
  } else if (newRides >= config.tier1.rides) {
    newTier = 1;
    newBonus = config.tier1.bonus;
  }

  // Calculate bonus awarded for this ride (if tier changed)
  let bonusAwarded = 0;
  let tierCompleted: QuestTier | null = null;

  if (newTier !== null && newTier !== previousTier) {
    tierCompleted = newTier;
    // Award the difference if upgrading tiers
    if (previousTier === null) {
      bonusAwarded = newBonus;
    } else {
      const previousBonusMap = {
        1: config.tier1.bonus,
        2: config.tier2.bonus,
        3: config.tier3.bonus,
      };
      bonusAwarded = newBonus - previousBonusMap[previousTier];
    }
  }

  return {
    progress: {
      ...progress,
      ridesCompletedInCycle: newRides,
      currentTier: newTier,
      questBonusEarned: newBonus,
    },
    tierCompleted,
    bonusAwarded,
  };
}

/**
 * Check if quest cycle needs reset
 */
export function shouldResetQuestCycle(
  progress: QuestProgress,
  currentDate: Date
): boolean {
  return currentDate > progress.cycleEndDate;
}

/**
 * Reset quest progress for new cycle
 */
export function resetQuestCycle(
  driverId: string,
  currentDate: Date,
  config: QuestConfig = DEFAULT_QUEST_CONFIG
): QuestProgress {
  return createQuestProgress(driverId, currentDate, config);
}

// ========================================
// EXPORTS
// ========================================

export default {
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
};
