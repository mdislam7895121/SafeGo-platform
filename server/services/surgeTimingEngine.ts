/**
 * SafeGo Surge Timing Engine
 * 
 * Implements Uber-style surge timing with SafeGo's pricing advantage.
 * Surge activates during the same windows as Uber but at LOWER multipliers.
 * 
 * Surge Ranges:
 * - Minimum surge: 1.05x
 * - Normal surge range: 1.15x – 1.35x
 * - Peak surge range: 1.40x – 1.90x
 * - Hard cap: 1.90x (never exceed)
 */

export type SurgeReason = 
  | 'weekday_morning_peak'
  | 'weekday_evening_peak'
  | 'weekend_friday_night'
  | 'weekend_saturday_night'
  | 'weekend_sunday_evening'
  | 'weather_rain'
  | 'weather_snow'
  | 'weather_storm'
  | 'weather_low_visibility'
  | 'weather_extreme_cold'
  | 'event_pre'
  | 'event_post'
  | 'airport_jfk'
  | 'airport_lga'
  | 'airport_ewr'
  | 'driver_shortage'
  | 'combined'
  | 'none';

export type SurgeTimingWindow = 
  | 'weekday_morning'    // 7:00 AM – 10:00 AM Mon-Fri
  | 'weekday_evening'    // 4:00 PM – 8:00 PM Mon-Fri
  | 'friday_night'       // 6 PM – 11:59 PM Friday
  | 'saturday_night'     // 5 PM – 2 AM Saturday
  | 'sunday_evening'     // 5 PM – 9 PM Sunday
  | 'event_window'       // 1 hour before to 1.5 hours after event
  | 'airport_zone'       // Always active at major airports
  | 'off_peak'           // No timing-based surge
  | 'combined';          // Multiple windows active

export interface WeatherCondition {
  type: 'clear' | 'rain' | 'heavy_rain' | 'snow' | 'storm' | 'fog' | 'low_visibility';
  temperatureFahrenheit?: number;
  precipitationIntensity?: 'light' | 'moderate' | 'heavy';
}

export interface EventInfo {
  type: 'stadium' | 'concert' | 'festival' | 'conference' | 'major_gathering';
  name: string;
  startTime: Date;
  endTime: Date;
  expectedAttendance: number;
  venueLocation: {
    lat: number;
    lng: number;
  };
}

export interface AirportSurgeZone {
  code: 'JFK' | 'LGA' | 'EWR' | string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  radiusMiles: number;
  baseSurgeMultiplier: number;
}

export interface SurgeTimingContext {
  currentTime: Date;
  pickupLocation: {
    lat: number;
    lng: number;
  };
  activeRequests: number;
  availableDrivers: number;
  weather?: WeatherCondition;
  nearbyEvents?: EventInfo[];
  airportZones?: AirportSurgeZone[];
}

export interface SurgeConfig {
  minimumSurge: number;           // 1.05x
  normalSurgeMin: number;         // 1.15x
  normalSurgeMax: number;         // 1.35x
  peakSurgeMin: number;           // 1.40x
  peakSurgeMax: number;           // 1.90x
  surgeCap: number;               // 1.90x hard cap
  driverShortageThreshold: number; // When requests exceed drivers by this ratio
  eventRadiusMiles: number;       // Radius around event venues for surge
  weatherSurgeBoost: number;      // Additional multiplier for weather
}

export interface SurgeTimingResult {
  surgeMultiplier: number;
  surgeCapped: boolean;
  rawSurgeMultiplier: number;     // Before capping
  surgeReason: SurgeReason;
  surgeReasons: SurgeReason[];    // All contributing reasons
  surgeTimingWindow: SurgeTimingWindow;
  activeWindows: SurgeTimingWindow[];
  isActive: boolean;
  breakdown: {
    timingContribution: number;
    weatherContribution: number;
    eventContribution: number;
    airportContribution: number;
    driverShortageContribution: number;
  };
}

export const DEFAULT_SURGE_CONFIG: SurgeConfig = {
  minimumSurge: 1.05,
  normalSurgeMin: 1.15,
  normalSurgeMax: 1.35,
  peakSurgeMin: 1.40,
  peakSurgeMax: 1.90,
  surgeCap: 1.90,
  driverShortageThreshold: 1.5,  // 50% more requests than drivers
  eventRadiusMiles: 2.0,
  weatherSurgeBoost: 0.15,
};

export const DEFAULT_AIRPORT_ZONES: AirportSurgeZone[] = [
  {
    code: 'JFK',
    name: 'John F. Kennedy International Airport',
    location: { lat: 40.6413, lng: -73.7781 },
    radiusMiles: 3.0,
    baseSurgeMultiplier: 1.20,
  },
  {
    code: 'LGA',
    name: 'LaGuardia Airport',
    location: { lat: 40.7769, lng: -73.8740 },
    radiusMiles: 2.0,
    baseSurgeMultiplier: 1.15,
  },
  {
    code: 'EWR',
    name: 'Newark Liberty International Airport',
    location: { lat: 40.6895, lng: -74.1745 },
    radiusMiles: 3.0,
    baseSurgeMultiplier: 1.18,
  },
];

function getHaversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determines if current time falls within weekday peak hours
 */
export function isWeekdayPeakHour(date: Date): { isPeak: boolean; window: 'morning' | 'evening' | null } {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = date.getHours();
  
  // Weekdays only (Monday = 1, Friday = 5)
  if (day === 0 || day === 6) {
    return { isPeak: false, window: null };
  }
  
  // Morning peak: 7:00 AM – 10:00 AM
  if (hour >= 7 && hour < 10) {
    return { isPeak: true, window: 'morning' };
  }
  
  // Evening peak: 4:00 PM – 8:00 PM
  if (hour >= 16 && hour < 20) {
    return { isPeak: true, window: 'evening' };
  }
  
  return { isPeak: false, window: null };
}

/**
 * Determines if current time falls within weekend surge windows
 */
export function isWeekendSurgeWindow(date: Date): { isSurge: boolean; window: 'friday_night' | 'saturday_night' | 'sunday_evening' | null } {
  const day = date.getDay();
  const hour = date.getHours();
  
  // Friday: 6 PM – 11:59 PM
  if (day === 5 && hour >= 18) {
    return { isSurge: true, window: 'friday_night' };
  }
  
  // Saturday: 5 PM – 2 AM (next day hours 0-2 are handled by Saturday logic)
  if (day === 6) {
    // Saturday 5 PM onwards
    if (hour >= 17) {
      return { isSurge: true, window: 'saturday_night' };
    }
    // Saturday early morning (12 AM - 2 AM, continuation of Friday night)
    if (hour < 2) {
      return { isSurge: true, window: 'saturday_night' };
    }
  }
  
  // Sunday early morning (12 AM - 2 AM, continuation of Saturday night)
  if (day === 0 && hour < 2) {
    return { isSurge: true, window: 'saturday_night' };
  }
  
  // Sunday: 5 PM – 9 PM
  if (day === 0 && hour >= 17 && hour < 21) {
    return { isSurge: true, window: 'sunday_evening' };
  }
  
  return { isSurge: false, window: null };
}

/**
 * Calculates weather-based surge contribution
 */
export function calculateWeatherSurge(weather: WeatherCondition | undefined, config: SurgeConfig = DEFAULT_SURGE_CONFIG): number {
  if (!weather) return 0;
  
  let contribution = 0;
  
  switch (weather.type) {
    case 'heavy_rain':
      contribution = config.weatherSurgeBoost * 1.5;
      break;
    case 'rain':
      contribution = config.weatherSurgeBoost;
      break;
    case 'snow':
      contribution = config.weatherSurgeBoost * 1.8;
      break;
    case 'storm':
      contribution = config.weatherSurgeBoost * 2.0;
      break;
    case 'fog':
    case 'low_visibility':
      contribution = config.weatherSurgeBoost * 1.2;
      break;
    default:
      contribution = 0;
  }
  
  // Extreme cold (< 30°F) adds additional surge
  if (weather.temperatureFahrenheit !== undefined && weather.temperatureFahrenheit < 30) {
    contribution += config.weatherSurgeBoost * 0.8;
  }
  
  // Heavy precipitation intensity adds more
  if (weather.precipitationIntensity === 'heavy') {
    contribution += config.weatherSurgeBoost * 0.5;
  }
  
  return contribution;
}

/**
 * Calculates event-based surge contribution
 */
export function calculateEventSurge(
  pickupLocation: { lat: number; lng: number },
  nearbyEvents: EventInfo[] | undefined,
  currentTime: Date,
  config: SurgeConfig = DEFAULT_SURGE_CONFIG
): { contribution: number; reason: 'event_pre' | 'event_post' | null; eventName: string | null } {
  if (!nearbyEvents || nearbyEvents.length === 0) {
    return { contribution: 0, reason: null, eventName: null };
  }
  
  let maxContribution = 0;
  let activeReason: 'event_pre' | 'event_post' | null = null;
  let activeEventName: string | null = null;
  
  for (const event of nearbyEvents) {
    // Check if pickup is within event radius
    const distanceToEvent = getHaversineDistanceMiles(
      pickupLocation.lat, pickupLocation.lng,
      event.venueLocation.lat, event.venueLocation.lng
    );
    
    if (distanceToEvent > config.eventRadiusMiles) continue;
    
    const currentTimeMs = currentTime.getTime();
    const eventStartMs = event.startTime.getTime();
    const eventEndMs = event.endTime.getTime();
    
    // Pre-event: 1 hour before
    const preEventStart = eventStartMs - (60 * 60 * 1000);
    // Post-event: 1.5 hours after
    const postEventEnd = eventEndMs + (90 * 60 * 1000);
    
    let contribution = 0;
    let reason: 'event_pre' | 'event_post' | null = null;
    
    if (currentTimeMs >= preEventStart && currentTimeMs < eventStartMs) {
      // Pre-event surge (ramping up)
      const timeToEvent = eventStartMs - currentTimeMs;
      const hoursToEvent = timeToEvent / (60 * 60 * 1000);
      // Surge increases as event approaches
      contribution = 0.25 + (1 - hoursToEvent) * 0.15;
      reason = 'event_pre';
    } else if (currentTimeMs >= eventEndMs && currentTimeMs <= postEventEnd) {
      // Post-event surge (highest right after event)
      const timeSinceEnd = currentTimeMs - eventEndMs;
      const hoursSinceEnd = timeSinceEnd / (60 * 60 * 1000);
      // Peak surge right after event, decreasing over 1.5 hours
      contribution = 0.40 - (hoursSinceEnd / 1.5) * 0.25;
      reason = 'event_post';
    } else if (currentTimeMs >= eventStartMs && currentTimeMs < eventEndMs) {
      // During event (moderate surge)
      contribution = 0.20;
      reason = 'event_pre'; // Still classify as event-related
    }
    
    // Scale by attendance
    if (event.expectedAttendance > 50000) {
      contribution *= 1.3;
    } else if (event.expectedAttendance > 20000) {
      contribution *= 1.15;
    }
    
    if (contribution > maxContribution) {
      maxContribution = contribution;
      activeReason = reason;
      activeEventName = event.name;
    }
  }
  
  return { contribution: maxContribution, reason: activeReason, eventName: activeEventName };
}

/**
 * Calculates airport-based surge contribution
 */
export function calculateAirportSurge(
  pickupLocation: { lat: number; lng: number },
  airportZones: AirportSurgeZone[] = DEFAULT_AIRPORT_ZONES
): { contribution: number; airportCode: string | null } {
  let maxContribution = 0;
  let activeAirport: string | null = null;
  
  for (const airport of airportZones) {
    const distance = getHaversineDistanceMiles(
      pickupLocation.lat, pickupLocation.lng,
      airport.location.lat, airport.location.lng
    );
    
    if (distance <= airport.radiusMiles) {
      // Surge is higher closer to the airport
      const proximityFactor = 1 - (distance / airport.radiusMiles);
      const contribution = (airport.baseSurgeMultiplier - 1) * (0.5 + 0.5 * proximityFactor);
      
      if (contribution > maxContribution) {
        maxContribution = contribution;
        activeAirport = airport.code;
      }
    }
  }
  
  return { contribution: maxContribution, airportCode: activeAirport };
}

/**
 * Calculates driver shortage surge contribution
 */
export function calculateDriverShortageSurge(
  activeRequests: number,
  availableDrivers: number,
  config: SurgeConfig = DEFAULT_SURGE_CONFIG
): number {
  if (availableDrivers === 0) {
    // Extreme shortage
    return 0.50;
  }
  
  const ratio = activeRequests / availableDrivers;
  
  if (ratio <= 1) {
    // No shortage
    return 0;
  }
  
  if (ratio <= config.driverShortageThreshold) {
    // Mild shortage
    return (ratio - 1) * 0.15;
  }
  
  // Severe shortage
  const excessRatio = ratio - config.driverShortageThreshold;
  return 0.075 + Math.min(excessRatio * 0.20, 0.45);
}

/**
 * Main surge calculation function
 */
export function calculateSurgeTiming(
  context: SurgeTimingContext,
  config: SurgeConfig = DEFAULT_SURGE_CONFIG
): SurgeTimingResult {
  const reasons: SurgeReason[] = [];
  const windows: SurgeTimingWindow[] = [];
  
  let totalContribution = 0;
  
  // 1. Timing-based surge (weekday peak / weekend)
  let timingContribution = 0;
  const weekdayPeak = isWeekdayPeakHour(context.currentTime);
  const weekendSurge = isWeekendSurgeWindow(context.currentTime);
  
  if (weekdayPeak.isPeak) {
    timingContribution = weekdayPeak.window === 'morning' ? 0.20 : 0.25;
    reasons.push(weekdayPeak.window === 'morning' ? 'weekday_morning_peak' : 'weekday_evening_peak');
    windows.push(weekdayPeak.window === 'morning' ? 'weekday_morning' : 'weekday_evening');
  } else if (weekendSurge.isSurge) {
    switch (weekendSurge.window) {
      case 'friday_night':
        timingContribution = 0.30;
        reasons.push('weekend_friday_night');
        windows.push('friday_night');
        break;
      case 'saturday_night':
        timingContribution = 0.35;
        reasons.push('weekend_saturday_night');
        windows.push('saturday_night');
        break;
      case 'sunday_evening':
        timingContribution = 0.20;
        reasons.push('weekend_sunday_evening');
        windows.push('sunday_evening');
        break;
    }
  }
  // Note: Do not push 'off_peak' here - it will be set as default later if no windows are active
  totalContribution += timingContribution;
  
  // 2. Weather-based surge
  const weatherContribution = calculateWeatherSurge(context.weather, config);
  if (weatherContribution > 0) {
    if (context.weather) {
      switch (context.weather.type) {
        case 'rain':
        case 'heavy_rain':
          reasons.push('weather_rain');
          break;
        case 'snow':
          reasons.push('weather_snow');
          break;
        case 'storm':
          reasons.push('weather_storm');
          break;
        case 'fog':
        case 'low_visibility':
          reasons.push('weather_low_visibility');
          break;
      }
      if (context.weather.temperatureFahrenheit !== undefined && context.weather.temperatureFahrenheit < 30) {
        reasons.push('weather_extreme_cold');
      }
    }
  }
  totalContribution += weatherContribution;
  
  // 3. Event-based surge
  const eventSurge = calculateEventSurge(
    context.pickupLocation,
    context.nearbyEvents,
    context.currentTime,
    config
  );
  if (eventSurge.contribution > 0 && eventSurge.reason) {
    reasons.push(eventSurge.reason);
    windows.push('event_window');
  }
  const eventContribution = eventSurge.contribution;
  totalContribution += eventContribution;
  
  // 4. Airport-based surge
  const airportSurge = calculateAirportSurge(
    context.pickupLocation,
    context.airportZones || DEFAULT_AIRPORT_ZONES
  );
  if (airportSurge.contribution > 0 && airportSurge.airportCode) {
    switch (airportSurge.airportCode) {
      case 'JFK':
        reasons.push('airport_jfk');
        break;
      case 'LGA':
        reasons.push('airport_lga');
        break;
      case 'EWR':
        reasons.push('airport_ewr');
        break;
    }
    windows.push('airport_zone');
  }
  const airportContribution = airportSurge.contribution;
  totalContribution += airportContribution;
  
  // 5. Driver shortage surge
  const driverShortageContribution = calculateDriverShortageSurge(
    context.activeRequests,
    context.availableDrivers,
    config
  );
  if (driverShortageContribution > 0) {
    reasons.push('driver_shortage');
  }
  totalContribution += driverShortageContribution;
  
  // Calculate raw surge multiplier (1.0 base + contributions)
  const rawSurgeMultiplier = 1.0 + totalContribution;
  
  // Apply minimum surge if any surge is active
  let surgeMultiplier: number;
  const isActive = rawSurgeMultiplier > 1.0;
  
  if (!isActive) {
    surgeMultiplier = 1.0;
  } else if (rawSurgeMultiplier < config.minimumSurge) {
    surgeMultiplier = config.minimumSurge;
  } else {
    surgeMultiplier = rawSurgeMultiplier;
  }
  
  // Apply hard cap
  const surgeCapped = surgeMultiplier > config.surgeCap;
  if (surgeCapped) {
    surgeMultiplier = config.surgeCap;
  }
  
  // Round to 2 decimal places
  surgeMultiplier = Math.round(surgeMultiplier * 100) / 100;
  
  // Determine primary reason and window
  let surgeReason: SurgeReason;
  let surgeTimingWindow: SurgeTimingWindow;
  
  if (reasons.length === 0) {
    surgeReason = 'none';
    surgeTimingWindow = 'off_peak';
  } else if (reasons.length === 1) {
    surgeReason = reasons[0];
    surgeTimingWindow = windows.length > 0 ? windows[0] : 'off_peak';
  } else {
    surgeReason = 'combined';
    surgeTimingWindow = 'combined';
  }
  
  return {
    surgeMultiplier,
    surgeCapped,
    rawSurgeMultiplier: Math.round(rawSurgeMultiplier * 100) / 100,
    surgeReason,
    surgeReasons: reasons.length > 0 ? reasons : ['none'],
    surgeTimingWindow,
    activeWindows: windows.length > 0 ? windows : ['off_peak'],
    isActive,
    breakdown: {
      timingContribution: Math.round(timingContribution * 100) / 100,
      weatherContribution: Math.round(weatherContribution * 100) / 100,
      eventContribution: Math.round(eventContribution * 100) / 100,
      airportContribution: Math.round(airportContribution * 100) / 100,
      driverShortageContribution: Math.round(driverShortageContribution * 100) / 100,
    },
  };
}

/**
 * Helper to get human-readable surge reason
 */
export function getSurgeReasonLabel(reason: SurgeReason): string {
  const labels: Record<SurgeReason, string> = {
    weekday_morning_peak: 'Morning rush hour',
    weekday_evening_peak: 'Evening rush hour',
    weekend_friday_night: 'Friday night demand',
    weekend_saturday_night: 'Saturday night demand',
    weekend_sunday_evening: 'Sunday evening demand',
    weather_rain: 'Rainy weather',
    weather_snow: 'Snowy conditions',
    weather_storm: 'Storm conditions',
    weather_low_visibility: 'Low visibility',
    weather_extreme_cold: 'Extreme cold',
    event_pre: 'Nearby event starting',
    event_post: 'Nearby event ended',
    airport_jfk: 'JFK Airport zone',
    airport_lga: 'LaGuardia Airport zone',
    airport_ewr: 'Newark Airport zone',
    driver_shortage: 'High demand, fewer drivers',
    combined: 'Multiple factors',
    none: 'No surge',
  };
  
  return labels[reason] || 'Unknown';
}

/**
 * Helper to get surge timing window label
 */
export function getSurgeTimingWindowLabel(window: SurgeTimingWindow): string {
  const labels: Record<SurgeTimingWindow, string> = {
    weekday_morning: '7-10 AM weekday',
    weekday_evening: '4-8 PM weekday',
    friday_night: 'Friday 6 PM - midnight',
    saturday_night: 'Saturday 5 PM - 2 AM',
    sunday_evening: 'Sunday 5-9 PM',
    event_window: 'Event nearby',
    airport_zone: 'Airport zone',
    off_peak: 'Off-peak hours',
    combined: 'Multiple windows',
  };
  
  return labels[window] || 'Unknown';
}
