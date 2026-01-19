/**
 * Standardized Auth Error Response Builder
 * Ensures consistent error shapes across all auth endpoints
 */

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface StandardErrorResponse {
  error: AuthError;
}

/**
 * Build a standardized auth error response
 * All auth endpoints should use this to return errors
 */
export function createAuthError(
  code: string,
  message: string,
  details?: Record<string, any>
): StandardErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details && Object.keys(details).length > 0 && { details }),
    },
  };
}

// Predefined error codes and messages
export const AUTH_ERRORS = {
  INVALID_EMAIL: () =>
    createAuthError(
      "INVALID_EMAIL",
      "Please enter a valid email address"
    ),
  
  WEAK_PASSWORD: (reason?: string) =>
    createAuthError(
      "WEAK_PASSWORD",
      reason || "Password must be at least 8 characters with uppercase, lowercase, and number"
    ),
  
  PASSWORD_MISMATCH: () =>
    createAuthError(
      "PASSWORD_MISMATCH",
      "Passwords do not match"
    ),
  
  EMAIL_IN_USE: () =>
    createAuthError(
      "EMAIL_IN_USE",
      "An account with this email already exists"
    ),
  
  MISSING_FIELDS: () =>
    createAuthError(
      "MISSING_FIELDS",
      "Email and password are required"
    ),
  
  INVALID_CREDENTIALS: () =>
    createAuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password"
    ),
  
  USER_NOT_FOUND: () =>
    createAuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password"
    ),
  
  ACCOUNT_BLOCKED: () =>
    createAuthError(
      "ACCOUNT_BLOCKED",
      "Your account has been blocked. Please contact support."
    ),
  
  ACCOUNT_LOCKED: (minutesRemaining?: number) =>
    createAuthError(
      "ACCOUNT_LOCKED",
      `Too many failed login attempts. Please try again in ${minutesRemaining || 15} minutes.`,
      { retryAfterMinutes: minutesRemaining || 15 }
    ),
  
  ADMIN_PROFILE_NOT_FOUND: () =>
    createAuthError(
      "ADMIN_PROFILE_NOT_FOUND",
      "Admin profile not found. Please contact support."
    ),
  
  ADMIN_ACCOUNT_DEACTIVATED: () =>
    createAuthError(
      "ADMIN_ACCOUNT_DEACTIVATED",
      "Your admin account has been deactivated. Please contact support."
    ),
  
  TWO_FACTOR_REQUIRED: () =>
    createAuthError(
      "TWO_FACTOR_REQUIRED",
      "Two-factor authentication code required"
    ),
  
  INVALID_TWO_FACTOR_CODE: () =>
    createAuthError(
      "INVALID_TWO_FACTOR_CODE",
      "Invalid two-factor authentication code"
    ),
  
  SERVICE_UNAVAILABLE: () =>
    createAuthError(
      "SERVICE_UNAVAILABLE",
      "Authentication service is temporarily unavailable. Please try again later."
    ),
  
  INTERNAL_ERROR: () =>
    createAuthError(
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    ),

  MISSING_CONFIRM_PASSWORD: () =>
    createAuthError(
      "MISSING_CONFIRM_PASSWORD",
      "Please confirm your password"
    ),

  ACCOUNT_PENDING: () =>
    createAuthError(
      "ACCOUNT_PENDING",
      "Your account is pending verification. Please check your email or contact support."
    ),

  EMAIL_EXISTS_PENDING: () =>
    createAuthError(
      "EMAIL_EXISTS_PENDING",
      "This email already has an account pending verification. Please verify your account or contact support."
    ),
};

/**
 * HTTP status code for error
 * Convention used by all auth endpoints
 */
export function getHttpStatusForError(code: string): number {
  switch (code) {
    case "INVALID_EMAIL":
    case "WEAK_PASSWORD":
    case "PASSWORD_MISMATCH":
    case "MISSING_FIELDS":
    case "MISSING_CONFIRM_PASSWORD":
      return 400; // Bad Request

    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
    case "INVALID_TWO_FACTOR_CODE":
      return 401; // Unauthorized

    case "EMAIL_IN_USE":
      return 409; // Conflict

    case "ACCOUNT_BLOCKED":
      return 403; // Forbidden

    case "ACCOUNT_LOCKED":
      return 429; // Too Many Requests

    case "ADMIN_PROFILE_NOT_FOUND":
    case "ADMIN_ACCOUNT_DEACTIVATED":
    case "TWO_FACTOR_REQUIRED":
    case "ACCOUNT_PENDING":
      return 403; // Forbidden

    case "EMAIL_EXISTS_PENDING":
      return 409; // Conflict

    case "SERVICE_UNAVAILABLE":
      return 503; // Service Unavailable

    case "INTERNAL_ERROR":
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Helper to send error response with proper status
 */
export function sendAuthError(
  res: any,
  code: string,
  message?: string,
  details?: Record<string, any>
) {
  const statusCode = getHttpStatusForError(code);
  const errorResponse = message
    ? createAuthError(code, message, details)
    : AUTH_ERRORS[code as keyof typeof AUTH_ERRORS]?.();

  if (!errorResponse) {
    return res.status(500).json(AUTH_ERRORS.INTERNAL_ERROR());
  }

  res.status(statusCode).json(errorResponse);
}
