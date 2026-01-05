import { Request, Response, NextFunction } from "express";

const SENSITIVE_KEYS = [
  "password",
  "confirmPassword",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "otp",
  "otpCode",
  "secret",
  "apiKey",
  "api_key",
  "secretKey",
  "secret_key",
  "privateKey",
  "private_key",
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "ssn",
  "pin",
  "encryptionKey",
  "jwtSecret",
  "stripe_secret",
  "stripeSecret",
];

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b[a-f0-9]{64}\b/gi,
  /sk_(?:live|test)_[A-Za-z0-9]{24,}/gi,
  /pk_(?:live|test)_[A-Za-z0-9]{24,}/gi,
];

export function redactSensitiveData(obj: any, depth = 0): any {
  if (depth > 10) return "[MAX_DEPTH_REACHED]";
  
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    let redacted = obj;
    for (const pattern of SENSITIVE_PATTERNS) {
      redacted = redacted.replace(pattern, "[REDACTED]");
    }
    return redacted;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveData(obj[key], depth + 1);
      }
    }
    return result;
  }

  return obj;
}

export function redactHeaders(headers: Record<string, any>): Record<string, any> {
  const redacted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "authorization" ||
      lowerKey === "cookie" ||
      lowerKey === "x-api-key" ||
      lowerKey === "x-auth-token"
    ) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

export function safeLogRequest(req: Request): object {
  return {
    method: req.method,
    path: req.path,
    query: redactSensitiveData(req.query),
    body: redactSensitiveData(req.body),
    headers: redactHeaders(req.headers as Record<string, any>),
    ip: req.ip,
  };
}

export function safeLogError(error: any): object {
  const isProduction = process.env.NODE_ENV === "production";
  
  return {
    message: error?.message || "Unknown error",
    code: error?.code,
    stack: isProduction ? undefined : error?.stack,
  };
}

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|map)$/)) {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    if (req.path.startsWith("/api") && (duration > 100 || res.statusCode >= 400)) {
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      };
      
      if (res.statusCode >= 400) {
        console.log(`[Request] ${JSON.stringify(logData)}`);
      }
    }
  });

  next();
}

export const secureErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === "production";
  
  console.error("[Error]", safeLogError(err));

  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    error: err.message || "Internal server error",
    code: err.code,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
