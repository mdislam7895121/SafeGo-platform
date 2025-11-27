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
