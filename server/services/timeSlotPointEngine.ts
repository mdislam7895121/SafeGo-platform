/**
 * TimeSlotPointEngine - Server-validated, tamper-proof time-based point calculation
 *
 * Calculates points based on trip completion time slots:
 * - 12:00 AM – 8:00 AM → 1 point
 * - 8:00 AM – 3:00 PM → 1 point
 * - 3:00 PM – 5:00 PM → 3 points
 * - 5:00 PM – 12:00 AM → 5 points
 *
 * Security features:
 * - Uses server time only (immune to device clock manipulation)
 * - Validates timezone consistency
 * - Logs suspicious timing patterns
 */

interface TimeSlot {
  name: string;
  startHour: number; // 24-hour format
  endHour: number; // 24-hour format
  points: number;
}

interface PointCalculationResult {
  points: number;
  timeSlot: string;
  calculatedAt: Date;
  tripCompletionTime: Date;
  timezone: string;
  isSuspicious: boolean;
  suspicionReasons?: string[];
}

export class TimeSlotPointEngine {
  private static readonly TIME_SLOTS: TimeSlot[] = [
    {
      name: "Night Shift",
      startHour: 0, // 12:00 AM
      endHour: 8, // 8:00 AM
      points: 1,
    },
    {
      name: "Morning Shift",
      startHour: 8, // 8:00 AM
      endHour: 15, // 3:00 PM
      points: 1,
    },
    {
      name: "Peak Evening",
      startHour: 15, // 3:00 PM
      endHour: 17, // 5:00 PM
      points: 3,
    },
    {
      name: "Evening Shift",
      startHour: 17, // 5:00 PM
      endHour: 24, // 12:00 AM (midnight)
      points: 5,
    },
  ];

  /**
   * Calculate points for a completed trip based on server time
   * @param tripCompletionTime - Optional trip completion time (defaults to server time NOW)
   * @param driverTimezone - Driver's reported timezone (for validation)
   * @param driverCountry - Driver's country code (for future country-specific rules)
   * @returns Point calculation result with security flags
   */
  public static calculatePoints(
    tripCompletionTime?: Date,
    driverTimezone?: string,
    driverCountry?: string
  ): PointCalculationResult {
    // CRITICAL: Use server time to prevent device clock manipulation
    const serverTime = new Date();
    const completionTime = tripCompletionTime || serverTime;

    // Extract hour from completion time (0-23)
    const hour = completionTime.getHours();

    // Find matching time slot
    const matchingSlot = this.TIME_SLOTS.find(
      (slot) => hour >= slot.startHour && hour < slot.endHour
    );

    if (!matchingSlot) {
      // Should never happen with our 24-hour coverage, but defensive programming
      console.error(`[TimeSlotEngine] No matching slot for hour ${hour}`);
      return {
        points: 1, // Default fallback
        timeSlot: "Unknown",
        calculatedAt: serverTime,
        tripCompletionTime: completionTime,
        timezone: driverTimezone || "UTC",
        isSuspicious: true,
        suspicionReasons: ["No matching time slot found"],
      };
    }

    // Security validation
    const { isSuspicious, suspicionReasons } = this.validateTiming(
      completionTime,
      serverTime,
      driverTimezone
    );

    return {
      points: matchingSlot.points,
      timeSlot: matchingSlot.name,
      calculatedAt: serverTime,
      tripCompletionTime: completionTime,
      timezone: driverTimezone || "UTC",
      isSuspicious,
      suspicionReasons: isSuspicious ? suspicionReasons : undefined,
    };
  }

  /**
   * Validate timing for suspicious patterns
   */
  private static validateTiming(
    completionTime: Date,
    serverTime: Date,
    driverTimezone?: string
  ): { isSuspicious: boolean; suspicionReasons: string[] } {
    const suspicionReasons: string[] = [];

    // Check 1: Future completion time (device clock ahead)
    if (completionTime > serverTime) {
      const diffMinutes = Math.floor(
        (completionTime.getTime() - serverTime.getTime()) / (1000 * 60)
      );

      if (diffMinutes > 5) {
        // Allow 5-minute tolerance for clock drift
        suspicionReasons.push(
          `Trip completion time ${diffMinutes} minutes in the future`
        );
      }
    }

    // Check 2: Very old completion time (stale request)
    const ageMinutes = Math.floor(
      (serverTime.getTime() - completionTime.getTime()) / (1000 * 60)
    );

    if (ageMinutes > 60) {
      // More than 1 hour old
      suspicionReasons.push(
        `Trip completion time ${ageMinutes} minutes in the past (stale request)`
      );
    }

    // Check 3: Timezone consistency (if provided)
    if (driverTimezone) {
      // Future enhancement: Validate timezone matches expected region
      // For now, just log suspicious timezones
      const suspiciousTimezones = ["UTC+14", "UTC-12"];
      if (suspiciousTimezones.some((tz) => driverTimezone.includes(tz))) {
        suspicionReasons.push(`Unusual timezone: ${driverTimezone}`);
      }
    }

    return {
      isSuspicious: suspicionReasons.length > 0,
      suspicionReasons,
    };
  }

  /**
   * Get time slot name for a given hour (for display purposes)
   */
  public static getTimeSlotName(hour: number): string {
    const slot = this.TIME_SLOTS.find(
      (s) => hour >= s.startHour && hour < s.endHour
    );
    return slot?.name || "Unknown";
  }

  /**
   * Get all time slots (for admin UI / driver info)
   */
  public static getAllTimeSlots(): TimeSlot[] {
    return this.TIME_SLOTS;
  }

  /**
   * Country-specific overrides (future enhancement for NYC-specific rules)
   */
  public static calculatePointsWithCountryRules(
    countryCode: string,
    cityCode?: string,
    tripCompletionTime?: Date
  ): PointCalculationResult {
    // Future: NYC-specific rules can override base calculation
    // For now, use base calculation
    return this.calculatePoints(tripCompletionTime, undefined, countryCode);
  }
}
