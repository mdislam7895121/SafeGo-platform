/**
 * Format a duration in minutes to a human-readable string.
 * Examples:
 * - 0.5 minutes -> "1 min" (rounds up sub-minute values)
 * - 45 minutes -> "45 min"
 * - 90 minutes -> "1 h 30 min"
 * - 120 minutes -> "2 h"
 * - 326 minutes -> "5 h 26 min"
 * - 1500 minutes -> "25 h"
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '1 min'; // Minimum display value
  }
  
  // Round up sub-minute values to at least 1 minute
  const minutes = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours <= 0) {
    return `${rest} min`;
  }
  if (rest === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${rest} min`;
}

/**
 * Get a traffic multiplier based on the current time of day.
 * This simulates real-world traffic patterns:
 * - Peak hours (weekday 7-10am, 4-7pm): 1.30x (heavy traffic)
 * - Daytime (10am-10pm): 1.15x (moderate traffic)
 * - Night/early morning: 1.0x (light traffic)
 */
export function getTrafficMultiplier(date: Date = new Date()): number {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday

  const isWeekend = day === 0 || day === 6;

  // Peak hours on weekdays: 7–10am, 4–7pm
  const isMorningPeak = hour >= 7 && hour < 10;
  const isEveningPeak = hour >= 16 && hour < 19;

  if (!isWeekend && (isMorningPeak || isEveningPeak)) {
    return 1.30; // heavy traffic
  }

  // Moderate traffic during daytime
  if (hour >= 10 && hour < 22) {
    return 1.15;
  }

  // Night / very early morning - light traffic
  return 1.0;
}

/**
 * Apply traffic multiplier to a base duration.
 * Returns the traffic-adjusted duration in minutes.
 */
export function getTrafficAwareDuration(baseDurationMinutes: number, date: Date = new Date()): number {
  const multiplier = getTrafficMultiplier(date);
  return Math.ceil(baseDurationMinutes * multiplier);
}

/**
 * Get a human-readable description of current traffic conditions.
 */
export function getTrafficConditionLabel(date: Date = new Date()): string {
  const multiplier = getTrafficMultiplier(date);
  
  if (multiplier >= 1.25) {
    return "Heavy traffic expected";
  }
  if (multiplier >= 1.10) {
    return "Moderate traffic";
  }
  return "Light traffic";
}

/**
 * Compute traffic level based on the ratio of traffic duration to base duration.
 */
export function getTrafficLevel(durationInTrafficSeconds: number, durationSeconds: number): "light" | "moderate" | "heavy" {
  if (durationSeconds <= 0) return "light";
  const ratio = durationInTrafficSeconds / durationSeconds;
  if (ratio < 1.1) return "light";
  if (ratio < 1.3) return "moderate";
  return "heavy";
}

/**
 * Get traffic label based on computed traffic level.
 */
export function getTrafficLevelLabel(level: "light" | "moderate" | "heavy"): string {
  switch (level) {
    case "light": return "Light traffic on this route";
    case "moderate": return "Some traffic expected";
    case "heavy": return "Heavy traffic expected";
  }
}

/**
 * Decode a Google polyline string into an array of [lat, lng] coordinates.
 * Implementation based on the Google Polyline Algorithm.
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    // Convert to actual coordinates (divide by 1e5)
    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
