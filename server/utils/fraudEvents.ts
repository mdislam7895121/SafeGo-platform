import { prisma } from "../db";
import { FraudEventType, ActorType, RiskLevel } from "@prisma/client";

interface FraudEventInput {
  eventType: FraudEventType;
  actorType: ActorType;
  actorId: string;
  ipAddress?: string | null;
  deviceId?: string | null;
  userAgent?: string | null;
  location?: {
    lat: number;
    lng: number;
    city?: string;
    countryCode?: string;
  } | null;
  metadata?: Record<string, any> | null;
  source?: string;
}

/**
 * Serialize a value to JSON-compatible format
 * Handles special types: Date, Buffer, Decimal, objects with toJSON
 */
function serializeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Primitive types - return as-is
  if (typeof value !== "object") {
    return value;
  }

  // Date objects → ISO string
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Buffer objects → safe string representation
  if (Buffer.isBuffer(value)) {
    return `<Buffer ${value.length} bytes>`;
  }

  // Prisma Decimal (and any objects with toJSON method) → call toJSON
  if (typeof value.toJSON === "function") {
    const jsonValue = value.toJSON();
    // SECURITY: Sanitize toJSON output if it's an object (could contain sensitive fields)
    if (typeof jsonValue === "object" && jsonValue !== null && !Array.isArray(jsonValue)) {
      return sanitizeFraudMetadata(jsonValue);
    }
    return jsonValue;
  }

  // Prisma Decimal (fallback if toJSON not available) → convert to string
  if (value.constructor?.name === "Decimal" && typeof value.toString === "function") {
    return value.toString();
  }

  // Arrays → serialize each element
  if (Array.isArray(value)) {
    return value
      .map(item => serializeValue(item))
      .filter(item => item !== null && item !== undefined);
  }

  // Plain objects → recurse with sanitization
  return sanitizeFraudMetadata(value);
}

/**
 * Sanitize metadata to remove sensitive information  
 * NEVER log: passwords, SSN, NID, card numbers, tokens, secrets, raw document URLs
 */
function sanitizeFraudMetadata(metadata?: Record<string, any> | null): Record<string, any> | null {
  if (!metadata) return null;

  const sanitized = { ...metadata };

  // Remove sensitive fields - more comprehensive than audit logging
  const sensitiveFields = [
    "password",
    "passwordHash",
    "token",
    "secret",
    "apiKey",
    "nid",
    "nidNumber",
    "nidEncrypted",
    "ssn",
    "ssnLast4",
    "ssnEncrypted",
    "cardNumber",
    "cvv",
    "pin",
    "bankAccount",
    "routingNumber",
    "accountNumber",
    "twoFactorSecret",
    "recoveryCode",
  ];

  sensitiveFields.forEach(field => {
    delete sanitized[field];
  });

  // Serialize all values using comprehensive type handling
  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];
    if (typeof value === "object" && value !== null) {
      const serialized = serializeValue(value);
      
      // Remove keys that serialize to null/undefined or empty objects
      if (serialized === null || serialized === undefined) {
        delete sanitized[key];
      } else if (typeof serialized === "object" && !Array.isArray(serialized) && Object.keys(serialized).length === 0) {
        delete sanitized[key];
      } else {
        sanitized[key] = serialized;
      }
    }
  });

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Retryable Prisma upsert for DeviceProfile to handle concurrent requests
 * Implements retry loop to handle unique constraint violations
 */
async function upsertDeviceProfile(input: {
  actorType: ActorType;
  actorId: string;
  deviceId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  countryCode?: string | null;
  city?: string | null;
}): Promise<void> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await prisma.deviceProfile.upsert({
        where: {
          actorType_actorId_deviceId: {
            actorType: input.actorType,
            actorId: input.actorId,
            deviceId: input.deviceId,
          },
        },
        update: {
          lastSeenAt: new Date(),
          lastIpAddress: input.ipAddress,
          countryCode: input.countryCode,
          city: input.city,
          userAgent: input.userAgent,
        },
        create: {
          actorType: input.actorType,
          actorId: input.actorId,
          deviceId: input.deviceId,
          lastIpAddress: input.ipAddress,
          countryCode: input.countryCode,
          city: input.city,
          userAgent: input.userAgent,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
      return;
    } catch (error: any) {
      // P2002 is Prisma's unique constraint violation error code
      if (error.code === "P2002" && attempt < maxRetries - 1) {
        attempt++;
        // Short exponential backoff: 10ms, 20ms, 40ms
        await new Promise(resolve => setTimeout(resolve, 10 * Math.pow(2, attempt)));
        continue;
      }
      // Log error but don't throw - device profile tracking should never break the main flow
      console.error("Failed to upsert device profile:", error);
      return;
    }
  }
}

/**
 * Generate normalized composite key for RiskZone
 * Format: "countrycode|city|region" (all lowercase, trimmed)
 */
export function generateRiskZoneKey(
  countryCode: string,
  city?: string | null,
  region?: string | null
): string {
  const parts = [
    countryCode.trim().toLowerCase(),
    (city || "").trim().toLowerCase(),
    (region || "").trim().toLowerCase(),
  ];
  return parts.join("|");
}

/**
 * Log a fraud event to the database
 * This function is designed to be non-blocking and fail gracefully
 * 
 * @param input - Fraud event parameters
 */
export async function logFraudEvent(input: FraudEventInput): Promise<void> {
  try {
    const {
      eventType,
      actorType,
      actorId,
      ipAddress = null,
      deviceId = null,
      userAgent = null,
      location = null,
      metadata = null,
      source = "backend",
    } = input;

    // Sanitize metadata to remove sensitive information
    const safeMetadata = sanitizeFraudMetadata(metadata);

    // Create fraud event entry with default risk score and level
    await prisma.fraudEvent.create({
      data: {
        eventType,
        actorType,
        actorId,
        ipAddress,
        deviceId,
        locationLat: location?.lat ?? null,
        locationLng: location?.lng ?? null,
        city: location?.city ?? null,
        countryCode: location?.countryCode ?? null,
        riskScore: 0,
        riskLevel: RiskLevel.low,
        source,
        metadata: safeMetadata,
        processed: false,
      },
    });

    // Asynchronously upsert device profile if deviceId is provided
    // This runs in background and doesn't block fraud event creation
    if (deviceId) {
      // Fire and forget - don't await to avoid blocking
      upsertDeviceProfile({
        actorType,
        actorId,
        deviceId,
        ipAddress,
        userAgent,
        countryCode: location?.countryCode ?? null,
        city: location?.city ?? null,
      }).catch(error => {
        console.error("Background device profile upsert failed:", error);
      });
    }
  } catch (error) {
    // Log error but don't throw - fraud event logging should never break the main flow
    console.error("Failed to log fraud event:", error);
  }
}

/**
 * Helper to extract device ID from request headers or session
 * Returns null if not available
 */
export function getDeviceId(req: any): string | null {
  return (
    req.headers["x-device-id"] ||
    req.session?.deviceId ||
    null
  );
}

/**
 * Helper to extract user agent from request headers
 */
export function getUserAgent(req: any): string | null {
  return req.headers["user-agent"] || null;
}

/**
 * Helper to extract location from request if available
 * Returns null if geolocation headers are not present
 */
export function getLocationFromRequest(req: any): {
  lat: number;
  lng: number;
  city?: string;
  countryCode?: string;
} | null {
  const lat = req.headers["x-geo-lat"];
  const lng = req.headers["x-geo-lng"];
  
  if (!lat || !lng) return null;

  return {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    city: req.headers["x-geo-city"] || undefined,
    countryCode: req.headers["x-geo-country"] || undefined,
  };
}
