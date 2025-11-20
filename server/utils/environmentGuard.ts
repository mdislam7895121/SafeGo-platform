/**
 * Environment Guard - Validates critical security configuration at startup
 * Fails fast with clear error messages if required secrets are missing or invalid
 * NEVER logs actual secret values - only names and generic validation hints
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates that a required environment variable exists and is not empty
 */
function validateRequired(name: string, value: string | undefined): string | null {
  if (!value || value.trim() === "") {
    return `${name} is required but not set`;
  }
  return null;
}

/**
 * Validates JWT_SECRET
 * Must be at least 32 characters for security
 * CRITICAL: Used for authentication tokens, document signing, and session security
 */
function validateJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  
  if (!secret || secret.trim() === "") {
    return "JWT_SECRET is required for authentication, document signing, and session security";
  }
  
  if (secret.length < 32) {
    return `JWT_SECRET must be at least 32 characters for security (currently ${secret.length})`;
  }
  
  // CRITICAL: Reject default/insecure values - these are production security risks
  if (secret.includes("default") || secret.includes("change-in-production") || 
      secret.includes("your-secret-key") || secret.includes("safego-secret")) {
    return "JWT_SECRET is using a default/placeholder value - THIS IS INSECURE! Generate a secure random key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
  }
  
  return null;
}

/**
 * Validates ENCRYPTION_KEY
 * Must be exactly 32 bytes
 * CRITICAL: Used for encrypting NID, SSN, bank accounts, 2FA secrets, recovery codes
 * Note: Two encryption modules exist with different encoding expectations:
 * - encryption.ts: expects 32-byte UTF-8 string
 * - crypto.ts: expects 64 hex characters (32 bytes)
 */
function validateEncryptionKey(): string | null {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key || key.trim() === "") {
    return "ENCRYPTION_KEY is required for encrypting sensitive data (NID, SSN, bank accounts, 2FA secrets)";
  }
  
  // Check if it's hex format (crypto.ts requirement)
  const isHexFormat = /^[0-9a-fA-F]{64}$/.test(key);
  
  // Check if it's 32-byte UTF-8 format (encryption.ts requirement)
  const isUtf8Format = key.length === 32;
  
  if (!isHexFormat && !isUtf8Format) {
    return "ENCRYPTION_KEY must be either 32 bytes (UTF-8) or 64 hex characters (32 bytes hex). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
  }
  
  // CRITICAL: Reject default/insecure values - these are production security risks
  if (key.includes("default") || key.includes("safego-default") || key.includes("your-encryption-key")) {
    return "ENCRYPTION_KEY is using a default/placeholder value - THIS IS INSECURE! All encrypted data would be compromised. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
  }
  
  return null;
}

/**
 * Validates DATABASE_URL
 * Must be a valid PostgreSQL connection string
 */
function validateDatabaseUrl(): string | null {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl || dbUrl.trim() === "") {
    return "DATABASE_URL is required for database connection";
  }
  
  // Basic PostgreSQL URL format check
  if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
    return "DATABASE_URL must be a valid PostgreSQL connection string (postgresql://...)";
  }
  
  return null;
}

/**
 * Validates SESSION_SECRET (if session middleware is used)
 * Should be at least 32 characters for security
 */
function validateSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  
  // SESSION_SECRET is optional if sessions aren't used
  if (!secret || secret.trim() === "") {
    return null; // Not critical - return null (no error)
  }
  
  if (secret.length < 32) {
    return `SESSION_SECRET should be at least 32 characters (currently ${secret.length})`;
  }
  
  if (secret.includes("default") || secret.includes("change-in-production")) {
    return "SESSION_SECRET appears to be a default/placeholder value - use a secure random key";
  }
  
  return null;
}

/**
 * Validates NODE_ENV
 * Must be set to 'production', 'development', or 'test'
 */
function validateNodeEnv(): string | null {
  const env = process.env.NODE_ENV;
  
  if (!env) {
    return null; // NODE_ENV is optional, defaults to 'development' in most cases
  }
  
  const validEnvs = ["production", "development", "test"];
  if (!validEnvs.includes(env)) {
    return `NODE_ENV must be one of: ${validEnvs.join(", ")} (got: ${env})`;
  }
  
  return null;
}

/**
 * Main environment validation function
 * Called at application startup
 * Throws error if critical validation fails
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Critical validations (will cause startup failure)
  const jwtError = validateJwtSecret();
  if (jwtError) errors.push(jwtError);
  
  const encryptionError = validateEncryptionKey();
  if (encryptionError) errors.push(encryptionError);
  
  const dbUrlError = validateDatabaseUrl();
  if (dbUrlError) errors.push(dbUrlError);
  
  // Non-critical validations (will show warnings)
  const sessionError = validateSessionSecret();
  if (sessionError) warnings.push(sessionError);
  
  const nodeEnvError = validateNodeEnv();
  if (nodeEnvError) warnings.push(nodeEnvError);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Run environment validation and fail fast if errors are found
 * Called at application startup before any routes or database connections
 * In development/test mode, shows warnings instead of failing
 */
export function guardEnvironment(): void {
  console.log("[Environment Guard] Validating security configuration...");
  
  const result = validateEnvironment();
  const isNonProduction = 
    process.env.NODE_ENV === "development" || 
    process.env.NODE_ENV === "test" || 
    !process.env.NODE_ENV;
  
  // Log warnings (non-critical issues)
  if (result.warnings.length > 0) {
    console.warn("\n[!] Environment Warnings:");
    result.warnings.forEach((warning, i) => {
      console.warn(`  ${i + 1}. ${warning}`);
    });
    console.warn("");
  }
  
  // Handle validation errors
  if (!result.valid) {
    console.error("\n[X] Environment Validation Issues:");
    result.errors.forEach((error, i) => {
      console.error(`  ${i + 1}. ${error}`);
    });
    
    if (isNonProduction) {
      // In development/test: show errors but allow startup with strong warning
      console.warn("\n[!] NON-PRODUCTION MODE: Application starting despite configuration issues.");
      console.warn("[!] FIX THESE ISSUES BEFORE DEPLOYING TO PRODUCTION!\n");
    } else {
      // In production: fail fast
      console.error("\nApplication startup aborted.");
      console.error("Fix the above issues and restart the application.\n");
      process.exit(1);
    }
  } else {
    console.log("[Environment Guard] All critical security configuration valid");
  }
}

/**
 * Helper to generate a secure random key
 * Usage: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateSecureKey(bytes: number = 32): string {
  const crypto = require("crypto");
  return crypto.randomBytes(bytes).toString("hex");
}
