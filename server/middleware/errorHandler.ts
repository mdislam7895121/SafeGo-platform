import { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../utils/ip';
import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

interface ErrorLogEntry {
  timestamp: string;
  errorId: string;
  statusCode: number;
  message: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  stack?: string;
  userId?: string;
}

const errorLogs: ErrorLogEntry[] = [];
const MAX_ERROR_LOGS = 5000;

function generateErrorId(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function sanitizeErrorMessage(message: string): string {
  const sensitivePatterns = [
    /password[=:]\s*["']?[^"'\s]+["']?/gi,
    /api[_-]?key[=:]\s*["']?[^"'\s]+["']?/gi,
    /secret[=:]\s*["']?[^"'\s]+["']?/gi,
    /token[=:]\s*["']?[^"'\s]+["']?/gi,
    /bearer\s+[a-zA-Z0-9._-]+/gi,
    /authorization[=:]\s*["']?[^"'\s]+["']?/gi,
    /database_url[=:]\s*["']?[^"'\s]+["']?/gi,
    /postgres:\/\/[^\s]+/gi,
    /mysql:\/\/[^\s]+/gi,
    /mongodb:\/\/[^\s]+/gi,
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g
  ];

  let sanitized = message;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

function logError(entry: ErrorLogEntry): void {
  errorLogs.push(entry);
  
  if (errorLogs.length > MAX_ERROR_LOGS) {
    errorLogs.shift();
  }
  
  console.error(`[ErrorHandler] ${entry.errorId} | ${entry.statusCode} | ${entry.path} | ${sanitizeErrorMessage(entry.message)}`);
}

export function getErrorLogs(limit = 100): ErrorLogEntry[] {
  return errorLogs.slice(-limit).map(log => ({
    ...log,
    message: sanitizeErrorMessage(log.message),
    stack: undefined
  }));
}

export function secureErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const errorId = generateErrorId();
  const statusCode = err.status || err.statusCode || 500;
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const userId = (req as any).user?.id;

  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    errorId,
    statusCode,
    message: err.message || 'Unknown error',
    ip,
    userAgent,
    path: req.path,
    method: req.method,
    stack: isProduction ? undefined : err.stack,
    userId
  };

  logError(logEntry);

  if (res.headersSent) {
    return;
  }

  const isApiRequest = req.path.startsWith('/api');

  if (isApiRequest) {
    const response: Record<string, unknown> = {
      error: true,
      errorId,
      message: isProduction ? getPublicErrorMessage(statusCode) : sanitizeErrorMessage(err.message)
    };

    if (!isProduction && err.stack) {
      response.stack = sanitizeErrorMessage(err.stack);
    }

    res.status(statusCode).json(response);
  } else {
    res.status(statusCode).send(generateErrorPage(statusCode, errorId));
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const errorId = generateErrorId();
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';

  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    errorId,
    statusCode: 404,
    message: `Not found: ${req.path}`,
    ip,
    userAgent,
    path: req.path,
    method: req.method
  };

  logError(logEntry);

  const isApiRequest = req.path.startsWith('/api');

  if (isApiRequest) {
    res.status(404).json({
      error: true,
      errorId,
      message: 'The requested resource was not found'
    });
  } else {
    res.status(404).send(generateErrorPage(404, errorId));
  }
}

function getPublicErrorMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input and try again.',
    401: 'Authentication required. Please log in to continue.',
    403: 'Access denied. You do not have permission to access this resource.',
    404: 'The requested resource was not found.',
    405: 'This action is not allowed.',
    408: 'Request timed out. Please try again.',
    409: 'A conflict occurred. Please refresh and try again.',
    410: 'This resource is no longer available.',
    413: 'The request is too large.',
    422: 'Unable to process your request. Please check your input.',
    429: 'Too many requests. Please wait and try again.',
    500: 'An unexpected error occurred. Please try again later.',
    502: 'Service temporarily unavailable. Please try again.',
    503: 'Service is currently unavailable. Please try again later.',
    504: 'Request timed out. Please try again.'
  };

  return messages[statusCode] || 'An error occurred. Please try again.';
}

function generateErrorPage(statusCode: number, errorId: string): string {
  const title = statusCode === 404 ? 'Page Not Found' : 'Something Went Wrong';
  const message = statusCode === 404
    ? "The page you're looking for doesn't exist or has been moved."
    : 'We encountered an unexpected error. Our team has been notified.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusCode} - ${title} | SafeGo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1e3a5f 0%, #0f1c2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #ffffff;
    }
    .container {
      text-align: center;
      max-width: 500px;
    }
    .logo {
      width: 60px;
      height: 60px;
      background: #3b82f6;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
      font-weight: bold;
    }
    .error-code {
      font-size: 120px;
      font-weight: 700;
      line-height: 1;
      background: linear-gradient(135deg, #3b82f6, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    h1 {
      font-size: 28px;
      margin: 16px 0;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .error-id {
      font-size: 12px;
      color: #64748b;
      margin-top: 24px;
    }
    .btn {
      display: inline-block;
      padding: 12px 32px;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">S</div>
    <div class="error-code">${statusCode}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Go to Homepage</a>
    <p class="error-id">Error ID: ${errorId}</p>
  </div>
</body>
</html>`;
}
