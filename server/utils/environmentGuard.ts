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
 * MANDATORY FOR PRODUCTION - App will fail to start without this
 */
function validateJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!secret || secret.trim() === "") {
    return `JWT_SECRET is MANDATORY FOR PRODUCTION - required for authentication, document signing, and session security${isProduction ? " [FATAL]" : ""}`;
  }
  
  if (secret.length < 32) {
    return `JWT_SECRET must be at least 32 characters for security (currently ${secret.length})${isProduction ? " [FATAL]" : ""}`;
  }
  
  // CRITICAL: Reject default/insecure values - these are production security risks
  if (secret.includes("default") || secret.includes("change-in-production") || 
      secret.includes("your-secret-key") || secret.includes("safego-secret")) {
    return `JWT_SECRET is using a default/placeholder value - THIS IS INSECURE! Generate a secure random key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"${isProduction ? " [FATAL]" : ""}`;
  }
  
  return null;
}

/**
 * Validates ENCRYPTION_KEY
 * Must be exactly 32 bytes
 * CRITICAL: Used for encrypting NID, SSN, bank accounts, 2FA secrets, recovery codes
 * MANDATORY FOR PRODUCTION - App will fail to start without this
 * Note: Two encryption modules exist with different encoding expectations:
 * - encryption.ts: expects 32-byte UTF-8 string
 * - crypto.ts: expects 64 hex characters (32 bytes)
 */
function validateEncryptionKey(): string | null {
  const rawKey = process.env.ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  const isNonProduction = 
    process.env.NODE_ENV === "development" || 
    process.env.NODE_ENV === "test" || 
    !process.env.NODE_ENV;
  
  if (!rawKey || rawKey.trim() === "") {
    if (isNonProduction) {
      return null;
    }
    return "ENCRYPTION_KEY is MANDATORY FOR PRODUCTION - required for encrypting sensitive data (NID, SSN, bank accounts, 2FA secrets) [FATAL]";
  }
  
  const key = rawKey.trim();
  
  const isHexFormat = /^[0-9a-fA-F]{64}$/.test(key);
  const isUtf8Format = key.length === 32;
  
  if (!isHexFormat && !isUtf8Format) {
    return `ENCRYPTION_KEY must be either 32 bytes (UTF-8) or 64 hex characters (32 bytes hex). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"${isProduction ? " [FATAL]" : ""}`;
  }
  
  if (key.includes("default") || key.includes("safego-default") || key.includes("your-encryption-key")) {
    return `ENCRYPTION_KEY is using a default/placeholder value - THIS IS INSECURE! All encrypted data would be compromised. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"${isProduction ? " [FATAL]" : ""}`;
  }
  
  return null;
}

let temporaryEncryptionKey: string | null = null;

export function getTemporaryEncryptionKey(): string | null {
  return temporaryEncryptionKey;
}

function generateTemporaryEncryptionKeyIfNeeded(): void {
  const rawKey = process.env.ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  const isNonProduction = 
    process.env.NODE_ENV === "development" || 
    process.env.NODE_ENV === "test" || 
    !process.env.NODE_ENV;
  
  if (isProduction) {
    return;
  }
  
  if ((!rawKey || rawKey.trim() === "") && isNonProduction) {
    const crypto = require("crypto");
    const generatedKey = crypto.randomBytes(32).toString("hex");
    temporaryEncryptionKey = generatedKey;
    process.env.ENCRYPTION_KEY = generatedKey;
    console.warn("\n" + "=".repeat(80));
    console.warn("[!] TEMPORARY ENCRYPTION_KEY generated for DEVELOPMENT/TEST use ONLY.");
    console.warn("[!] WARNING: This key is ephemeral - encrypted data will NOT be recoverable after restart!");
    console.warn("[!] ENCRYPTION_KEY is MANDATORY FOR PRODUCTION - set a permanent key before deploying.");
    console.warn("=".repeat(80) + "\n");
  }
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
 * Validates SESSION_SECRET
 * MANDATORY FOR PRODUCTION - required for session security
 * Should be at least 32 characters for security
 */
function validateSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!secret || secret.trim() === "") {
    if (isProduction) {
      return "SESSION_SECRET is MANDATORY FOR PRODUCTION - required for session security [FATAL]";
    }
    return null;
  }
  
  if (secret.length < 32) {
    return `SESSION_SECRET must be at least 32 characters for security (currently ${secret.length})${isProduction ? " [FATAL]" : ""}`;
  }
  
  if (secret.includes("default") || secret.includes("change-in-production")) {
    return `SESSION_SECRET is using a default/placeholder value - THIS IS INSECURE!${isProduction ? " [FATAL]" : ""}`;
  }
  
  return null;
}

/**
 * Validates GOOGLE_MAPS_API_KEY
 * MANDATORY FOR PRODUCTION - required for maps, places, directions
 */
function validateGoogleMapsApiKey(): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!apiKey || apiKey.trim() === "") {
    if (isProduction) {
      return "GOOGLE_MAPS_API_KEY is MANDATORY FOR PRODUCTION - required for maps, places, and directions [FATAL]";
    }
    return null;
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
 * 
 * PRODUCTION MANDATORY SECRETS:
 * - JWT_SECRET
 * - ENCRYPTION_KEY
 * - SESSION_SECRET
 * - DATABASE_URL
 * - GOOGLE_MAPS_API_KEY
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";
  
  // Critical validations (will cause startup failure)
  const jwtError = validateJwtSecret();
  if (jwtError) errors.push(jwtError);
  
  const encryptionError = validateEncryptionKey();
  if (encryptionError) errors.push(encryptionError);
  
  const dbUrlError = validateDatabaseUrl();
  if (dbUrlError) errors.push(dbUrlError);
  
  // Production-critical validations
  const sessionError = validateSessionSecret();
  if (sessionError) {
    if (isProduction) {
      errors.push(sessionError);
    } else {
      warnings.push(sessionError);
    }
  }
  
  const mapsError = validateGoogleMapsApiKey();
  if (mapsError) {
    if (isProduction) {
      errors.push(mapsError);
    } else {
      warnings.push(mapsError);
    }
  }
  
  // Non-critical validations (will show warnings)
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
 * 
 * PRODUCTION MODE: App will FAIL TO START if JWT_SECRET or ENCRYPTION_KEY is missing/invalid
 * DEVELOPMENT MODE: Shows warnings but allows startup with temporary keys
 */
export function guardEnvironment(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isNonProduction = 
    process.env.NODE_ENV === "development" || 
    process.env.NODE_ENV === "test" || 
    !process.env.NODE_ENV;
  
  console.log(`[Environment Guard] Validating security configuration (${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode)...`);
  
  if (isProduction) {
    console.log("[Environment Guard] PRODUCTION MODE: The following secrets are MANDATORY:");
    console.log("  - JWT_SECRET");
    console.log("  - ENCRYPTION_KEY");
    console.log("  - SESSION_SECRET");
    console.log("  - DATABASE_URL");
    console.log("  - GOOGLE_MAPS_API_KEY");
  }
  
  generateTemporaryEncryptionKeyIfNeeded();
  
  const result = validateEnvironment();
  
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
      console.warn("\n[!] NON-PRODUCTION MODE: Application starting despite configuration issues.");
      console.warn("[!] The following secrets are MANDATORY FOR PRODUCTION:");
      console.warn("    - JWT_SECRET");
      console.warn("    - ENCRYPTION_KEY");
      console.warn("    - SESSION_SECRET");
      console.warn("    - DATABASE_URL");
      console.warn("    - GOOGLE_MAPS_API_KEY");
      console.warn("[!] FIX THESE ISSUES BEFORE DEPLOYING TO PRODUCTION!\n");
    } else {
      console.error("\n" + "=".repeat(80));
      console.error("FATAL: PRODUCTION STARTUP ABORTED");
      console.error("=".repeat(80));
      console.error("\nThe following secrets are MANDATORY FOR PRODUCTION:");
      console.error("  - JWT_SECRET");
      console.error("  - ENCRYPTION_KEY");
      console.error("  - SESSION_SECRET");
      console.error("  - DATABASE_URL");
      console.error("  - GOOGLE_MAPS_API_KEY");
      console.error("\nFix the above issues and restart the application.\n");
      process.exit(1);
    }
  } else {
    console.log("[Environment Guard] All critical security configuration valid");
    if (isProduction) {
      console.log("[Environment Guard] PRODUCTION: All mandatory secrets verified (JWT_SECRET, ENCRYPTION_KEY, SESSION_SECRET, DATABASE_URL, GOOGLE_MAPS_API_KEY)");
    }
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

/**
 * Payment gateway configuration status (shared between startup and health checks)
 */
export interface PaymentGatewayStatus {
  configured: boolean;
  warnings: string[];
  errors: string[];
  providers: {
    stripe: boolean;
    sslcommerz: boolean;
    bkash: boolean;
    nagad: boolean;
  };
}

let paymentGatewayStatus: PaymentGatewayStatus = {
  configured: false,
  warnings: [],
  errors: [],
  providers: {
    stripe: false,
    sslcommerz: false,
    bkash: false,
    nagad: false,
  },
};

/**
 * Get current payment gateway configuration status
 * Used by health check endpoints
 */
export function getPaymentGatewayStatus(): PaymentGatewayStatus {
  return paymentGatewayStatus;
}

/**
 * Payment Gateway Validation (Non-Fatal)
 * Logs warnings for missing payment providers but does NOT exit
 * Health checks will report degraded status if providers are missing
 * This allows the app to start and serve traffic even without full payment config
 */
export function validatePaymentProviders(): PaymentGatewayStatus {
  const isProduction = process.env.NODE_ENV === "production";
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // US Payment Providers (Stripe is primary)
  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  
  // Bangladesh Payment Providers (SSLCOMMERZ, bKash, Nagad)
  // Support both _BD suffix variants and non-suffixed variants
  const hasSSLCommerz = !!(
    (process.env.SSLCOMMERZ_STORE_ID_BD && process.env.SSLCOMMERZ_STORE_PASSWORD_BD) ||
    (process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD)
  );
  const hasBkash = !!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET);
  const hasNagad = !!(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_MERCHANT_PRIVATE_KEY);
  
  if (!hasStripe) {
    warnings.push("US Payment: STRIPE_SECRET_KEY not configured - US payments will be unavailable");
  }
  
  if (!hasSSLCommerz && !hasBkash && !hasNagad) {
    warnings.push("BD Payment: No Bangladesh payment provider configured (SSLCOMMERZ/bKash/Nagad) - BD payments will be unavailable");
  }
  
  // Check sandbox mode flags in production - log warnings but don't exit
  if (isProduction) {
    if (hasSSLCommerz && process.env.SSLCOMMERZ_SANDBOX_ENABLED_BD === "true") {
      errors.push("SSLCOMMERZ_SANDBOX_ENABLED_BD is true in PRODUCTION - payments will use sandbox (non-real money)");
    }
    if (hasBkash && process.env.BKASH_SANDBOX_MODE === "true") {
      errors.push("BKASH_SANDBOX_MODE is true in PRODUCTION - payments will use sandbox (non-real money)");
    }
    if (hasNagad && process.env.NAGAD_SANDBOX_MODE === "true") {
      errors.push("NAGAD_SANDBOX_MODE is true in PRODUCTION - payments will use sandbox (non-real money)");
    }
  }
  
  const hasAnyUSProvider = hasStripe;
  const hasAnyBDProvider = hasSSLCommerz || hasBkash || hasNagad;
  
  paymentGatewayStatus = {
    configured: hasAnyUSProvider || hasAnyBDProvider,
    warnings,
    errors,
    providers: {
      stripe: hasStripe,
      sslcommerz: hasSSLCommerz,
      bkash: hasBkash,
      nagad: hasNagad,
    },
  };
  
  return paymentGatewayStatus;
}

/**
 * Log payment gateway status after server starts (non-blocking)
 * Called after the server is listening to report configuration status
 */
export function logPaymentGatewayStatus(): void {
  const status = validatePaymentProviders();
  const isProduction = process.env.NODE_ENV === "production";
  
  if (status.warnings.length > 0 || status.errors.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("PAYMENT GATEWAY CONFIGURATION STATUS");
    console.log("=".repeat(80));
    
    if (status.errors.length > 0) {
      console.warn("\n[!] Payment Configuration Errors:");
      status.errors.forEach((err, i) => console.warn(`  ${i + 1}. ${err}`));
    }
    
    if (status.warnings.length > 0) {
      console.warn("\n[!] Payment Configuration Warnings:");
      status.warnings.forEach((warn, i) => console.warn(`  ${i + 1}. ${warn}`));
    }
    
    console.log("\nPayment Provider Status:");
    console.log(`  Stripe (US):       ${status.providers.stripe ? "CONFIGURED" : "NOT CONFIGURED"}`);
    console.log(`  SSLCOMMERZ (BD):   ${status.providers.sslcommerz ? "CONFIGURED" : "NOT CONFIGURED"}`);
    console.log(`  bKash (BD):        ${status.providers.bkash ? "CONFIGURED" : "NOT CONFIGURED"}`);
    console.log(`  Nagad (BD):        ${status.providers.nagad ? "CONFIGURED" : "NOT CONFIGURED"}`);
    
    if (isProduction && !status.configured) {
      console.warn("\n[!] WARNING: No payment providers configured - payment features will be unavailable");
      console.warn("[!] Configure payment providers to enable real transactions");
    }
    
    console.log("\n" + "=".repeat(80) + "\n");
  } else {
    console.log("[Payment Gateway] All configured providers validated successfully");
  }
}

/**
 * @deprecated Use validatePaymentProviders() instead - this function now just calls the non-fatal version
 * Kept for backward compatibility during migration
 */
export function assertPaymentProvidersConfigured(): void {
  // No longer exits - just validates and logs
  // Actual validation happens in logPaymentGatewayStatus() after server starts
}

/**
 * Get payment provider warnings for logging (non-fatal)
 * Used in startup banner to show configuration status
 */
function getPaymentProviderWarnings(): string[] {
  const warnings: string[] = [];
  
  // US Payment Providers (Stripe is primary)
  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  
  // Bangladesh Payment Providers (SSLCOMMERZ, bKash, Nagad)
  // Support both _BD suffix variants and non-suffixed variants
  const hasSSLCommerz = !!(
    (process.env.SSLCOMMERZ_STORE_ID_BD && process.env.SSLCOMMERZ_STORE_PASSWORD_BD) ||
    (process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD)
  );
  const hasBkash = !!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET);
  const hasNagad = !!(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_MERCHANT_PRIVATE_KEY);
  
  if (!hasStripe) {
    warnings.push("[INFO] US Payment: Stripe not configured - using mock payments");
  }
  
  if (!hasSSLCommerz && !hasBkash && !hasNagad) {
    warnings.push("[INFO] BD Payment: No provider configured - using mock payments");
  }
  
  return warnings;
}

/**
 * Log production startup banner with environment details
 * Redacts sensitive values, shows only configuration status
 */
export function logProductionStartupBanner(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const nodeEnv = process.env.NODE_ENV || "development";
  const port = process.env.PORT || "5000";
  
  // Extract host from DATABASE_URL (redacted)
  let dbHost = "not-configured";
  if (process.env.DATABASE_URL) {
    const match = process.env.DATABASE_URL.match(/@([^:/]+)/);
    if (match) {
      dbHost = match[1].substring(0, 10) + "..."; // Show first 10 chars only
    }
  }
  
  const buildVersion = process.env.BUILD_VERSION || process.env.REPL_SLUG || "dev";
  const buildTime = new Date().toISOString();
  
  console.log("\n" + "=".repeat(80));
  console.log("SafeGo Platform - Production Startup");
  console.log("=".repeat(80));
  console.log(`  Environment:    ${nodeEnv.toUpperCase()}`);
  console.log(`  Port:           ${port}`);
  console.log(`  DB Host:        ${dbHost}`);
  console.log(`  Build Version:  ${buildVersion}`);
  console.log(`  Start Time:     ${buildTime}`);
  console.log("");
  
  // Security configuration status
  console.log("Security Configuration:");
  console.log(`  JWT_SECRET:        ${process.env.JWT_SECRET ? "CONFIGURED" : "MISSING"}`);
  console.log(`  ENCRYPTION_KEY:    ${process.env.ENCRYPTION_KEY ? "CONFIGURED" : "MISSING"}`);
  console.log(`  SESSION_SECRET:    ${process.env.SESSION_SECRET ? "CONFIGURED" : "MISSING"}`);
  console.log(`  GOOGLE_MAPS_API:   ${process.env.GOOGLE_MAPS_API_KEY ? "CONFIGURED" : "MISSING"}`);
  console.log("");
  
  // Payment providers status - support both _BD suffix variants and non-suffixed
  const hasSSLCommerz = !!(
    (process.env.SSLCOMMERZ_STORE_ID_BD && process.env.SSLCOMMERZ_STORE_PASSWORD_BD) ||
    (process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD)
  );
  console.log("Payment Providers:");
  console.log(`  Stripe (US):       ${process.env.STRIPE_SECRET_KEY ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log(`  SSLCOMMERZ (BD):   ${hasSSLCommerz ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log(`  bKash (BD):        ${process.env.BKASH_APP_KEY ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log(`  Nagad (BD):        ${process.env.NAGAD_MERCHANT_ID ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log("");
  
  // External services status
  console.log("External Services:");
  console.log(`  Twilio SMS:        ${process.env.TWILIO_ACCOUNT_SID ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log(`  Email Service:     ${process.env.SMTP_HOST || process.env.AGENTMAIL_API_KEY ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log(`  OpenAI:            ${process.env.OPENAI_API_KEY ? "CONFIGURED" : "NOT CONFIGURED"}`);
  console.log(`  Redis:             ${process.env.REDIS_URL ? "CONFIGURED" : "IN-MEMORY CACHE"}`);
  console.log("");
  
  // Payment provider informational notices (non-fatal)
  const paymentWarnings = getPaymentProviderWarnings();
  if (paymentWarnings.length > 0 && !isProduction) {
    console.log("Payment Provider Notices (Development):");
    paymentWarnings.forEach(w => console.log(`  ${w}`));
    console.log("");
  }
  
  console.log("=".repeat(80) + "\n");
}

/**
 * Production environment assertion
 * Validates that demo mode is disabled in production
 */
export function assertDemoModeDisabled(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeEnabled = process.env.DEMO_MODE_ENABLED === "true";
  
  if (isProduction && demoModeEnabled) {
    console.error("\n" + "=".repeat(80));
    console.error("FATAL: DEMO_MODE_ENABLED=true in PRODUCTION");
    console.error("=".repeat(80));
    console.error("\nDemo mode MUST be disabled in production to prevent test data creation.");
    console.error("Set DEMO_MODE_ENABLED=false or remove the environment variable.\n");
    process.exit(1);
  }
}
