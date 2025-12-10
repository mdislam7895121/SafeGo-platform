import { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../utils/ip';

const isProduction = process.env.NODE_ENV === 'production';

type SecurityEventType = 
  | 'BLOCKED_IP'
  | 'RATE_LIMIT_TRIGGERED'
  | 'CSP_VIOLATION'
  | 'SUSPICIOUS_USER_AGENT'
  | 'REPEATED_404_PROBE'
  | 'BOT_BLOCKED';

interface SecurityLogEntry {
  timestamp: string;
  type: SecurityEventType;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  details?: Record<string, unknown>;
}

const securityLogs: SecurityLogEntry[] = [];
const MAX_SECURITY_LOGS = 10000;

const notFoundProbes = new Map<string, { count: number; firstSeen: number; paths: string[] }>();
const PROBE_WINDOW_MS = 5 * 60 * 1000;
const PROBE_THRESHOLD = 10;

function logSecurityEvent(entry: Omit<SecurityLogEntry, 'timestamp'>): void {
  const logEntry: SecurityLogEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };
  
  securityLogs.push(logEntry);
  
  if (securityLogs.length > MAX_SECURITY_LOGS) {
    securityLogs.shift();
  }
  
  console.log(`[SecurityLog] ${logEntry.type} | IP: ${logEntry.ip} | Path: ${logEntry.path} | UA: ${logEntry.userAgent.substring(0, 50)}...`);
}

export function getSecurityLogs(limit = 100): SecurityLogEntry[] {
  return securityLogs.slice(-limit);
}

export function getSecurityStats(): {
  totalEvents: number;
  byType: Record<string, number>;
  recentBlocks: number;
} {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const stats = {
    totalEvents: securityLogs.length,
    byType: {} as Record<string, number>,
    recentBlocks: 0
  };
  
  for (const log of securityLogs) {
    stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
    
    if (new Date(log.timestamp).getTime() > oneHourAgo && 
        (log.type === 'BLOCKED_IP' || log.type === 'RATE_LIMIT_TRIGGERED')) {
      stats.recentBlocks++;
    }
  }
  
  return stats;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of notFoundProbes.entries()) {
    if (now - data.firstSeen > PROBE_WINDOW_MS * 2) {
      notFoundProbes.delete(ip);
    }
  }
}, 60 * 1000);

const ALLOWED_ORIGINS = isProduction
  ? [process.env.FRONTEND_URL || 'https://safego.replit.app']
  : ['http://localhost:5000', 'http://0.0.0.0:5000'];

const LANDING_ROUTES = ['/', '/ride', '/drive', '/business', '/safety', '/support', '/privacy', '/terms', '/cookies'];

function isLandingRoute(path: string): boolean {
  return LANDING_ROUTES.includes(path) || path.startsWith('/privacy') || path.startsWith('/terms') || path.startsWith('/cookies');
}

interface LandingRateWindow {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

const landingRateLimitStore = new Map<string, LandingRateWindow>();
const LANDING_MAX_REQUESTS = 100;
const LANDING_WINDOW_MS = 5 * 60 * 1000;
const LANDING_BLOCK_DURATION_MS = 15 * 60 * 1000;

const BOT_SIGNATURES = [
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /scrapy/i,
  /phantomjs/i,
  /headlesschrome/i,
  /python-urllib/i,
  /java\//i,
  /libwww-perl/i,
  /http-client/i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i
];

function isSuspiciousBot(userAgent: string): boolean {
  if (!userAgent) return true;
  return BOT_SIGNATURES.some(pattern => pattern.test(userAgent));
}

setInterval(() => {
  const now = Date.now();
  for (const [key, window] of landingRateLimitStore.entries()) {
    if (window.blockedUntil && window.blockedUntil < now) {
      landingRateLimitStore.delete(key);
    } else if (now - window.windowStart > LANDING_WINDOW_MS * 2) {
      landingRateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  if (isProduction) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto !== 'https') {
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      res.redirect(301, httpsUrl);
      return;
    }
  }
  next();
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  
  if (origin && (ALLOWED_ORIGINS.includes(origin) || !isProduction)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Frame-Options', 'DENY');
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=(self)',
    'geolocation=(self)',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=(self)',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()'
  ].join(', '));

  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  res.setHeader('X-Download-Options', 'noopen');
  
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  const trustedScriptDomains = [
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://js.stripe.com',
    'https://*.replit.app',
    'https://*.replit.dev'
  ];

  const trustedStyleDomains = [
    'https://fonts.googleapis.com',
    'https://maps.googleapis.com'
  ];

  const trustedFontDomains = [
    'https://fonts.gstatic.com'
  ];

  const trustedImageDomains = [
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://*.stripe.com',
    'https://*.replit.app',
    'https://*.replit.dev'
  ];

  const trustedConnectDomains = [
    'https://maps.googleapis.com',
    'https://api.stripe.com',
    'https://*.replit.app',
    'https://*.replit.dev'
  ];

  const trustedFrameDomains = [
    'https://js.stripe.com',
    'https://hooks.stripe.com',
    'https://www.google.com/maps'
  ];

  const cspDirectives = isProduction
    ? [
        "default-src 'self'",
        `script-src 'self' ${trustedScriptDomains.join(' ')}`,
        `style-src 'self' 'unsafe-inline' ${trustedStyleDomains.join(' ')}`,
        `font-src 'self' ${trustedFontDomains.join(' ')}`,
        `img-src 'self' data: ${trustedImageDomains.join(' ')}`,
        `connect-src 'self' wss://*.replit.app wss://*.replit.dev ${trustedConnectDomains.join(' ')}`,
        `frame-src 'self' ${trustedFrameDomains.join(' ')}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "media-src 'self'",
        "upgrade-insecure-requests",
        "block-all-mixed-content",
        "report-uri /api/csp-report"
      ]
    : [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${trustedScriptDomains.join(' ')}`,
        `style-src 'self' 'unsafe-inline' ${trustedStyleDomains.join(' ')}`,
        `font-src 'self' ${trustedFontDomains.join(' ')}`,
        `img-src 'self' data: blob: ${trustedImageDomains.join(' ')}`,
        `connect-src 'self' ws://localhost:* wss://localhost:* ws://*.replit.dev wss://*.replit.dev ${trustedConnectDomains.join(' ')}`,
        `frame-src 'self' ${trustedFrameDomains.join(' ')}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "media-src 'self'",
        "report-uri /api/csp-report"
      ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
}

export function landingRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (!isLandingRoute(req.path)) {
    return next();
  }

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const now = Date.now();

  if (isSuspiciousBot(userAgent)) {
    logSecurityEvent({
      type: 'SUSPICIOUS_USER_AGENT',
      ip,
      userAgent,
      path: req.path,
      method: req.method,
      details: { blocked: isProduction }
    });
    
    if (isProduction) {
      logSecurityEvent({
        type: 'BOT_BLOCKED',
        ip,
        userAgent,
        path: req.path,
        method: req.method
      });
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  const key = `landing:${ip}`;
  let window = landingRateLimitStore.get(key);

  if (window?.blockedUntil && window.blockedUntil > now) {
    const remainingMs = window.blockedUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60000);

    res.setHeader('Retry-After', Math.ceil(remainingMs / 1000).toString());
    res.setHeader('X-RateLimit-Limit', LANDING_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', '0');

    res.status(429).json({
      error: `Too many requests. Please try again in ${remainingMin} minutes.`
    });
    return;
  }

  if (!window || (now - window.windowStart > LANDING_WINDOW_MS)) {
    window = {
      count: 0,
      windowStart: now
    };
    landingRateLimitStore.set(key, window);
  }

  window.count++;

  const remaining = Math.max(0, LANDING_MAX_REQUESTS - window.count);
  res.setHeader('X-RateLimit-Limit', LANDING_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil((window.windowStart + LANDING_WINDOW_MS) / 1000).toString());

  if (window.count > LANDING_MAX_REQUESTS) {
    window.blockedUntil = now + LANDING_BLOCK_DURATION_MS;
    landingRateLimitStore.set(key, window);

    logSecurityEvent({
      type: 'RATE_LIMIT_TRIGGERED',
      ip,
      userAgent,
      path: req.path,
      method: req.method,
      details: { requestCount: window.count, blockDurationMs: LANDING_BLOCK_DURATION_MS }
    });

    logSecurityEvent({
      type: 'BLOCKED_IP',
      ip,
      userAgent,
      path: req.path,
      method: req.method,
      details: { reason: 'rate_limit', blockedUntil: new Date(window.blockedUntil).toISOString() }
    });

    res.setHeader('Retry-After', Math.ceil(LANDING_BLOCK_DURATION_MS / 1000).toString());
    res.status(429).json({
      error: 'Too many requests. IP temporarily blocked for 15 minutes.'
    });
    return;
  }

  landingRateLimitStore.set(key, window);
  next();
}

export function cspViolationHandler(req: Request, res: Response): void {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const violation = req.body;

  logSecurityEvent({
    type: 'CSP_VIOLATION',
    ip,
    userAgent,
    path: req.path,
    method: req.method,
    details: {
      documentUri: violation?.['document-uri'],
      violatedDirective: violation?.['violated-directive'],
      blockedUri: violation?.['blocked-uri'],
      sourceFile: violation?.['source-file'],
      lineNumber: violation?.['line-number']
    }
  });

  res.status(204).end();
}

export function notFoundProbeDetector(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (res.statusCode === 404) {
      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'] || '';
      const now = Date.now();

      let probe = notFoundProbes.get(ip);

      if (!probe || (now - probe.firstSeen > PROBE_WINDOW_MS)) {
        probe = { count: 0, firstSeen: now, paths: [] };
      }

      probe.count++;
      if (probe.paths.length < 20) {
        probe.paths.push(req.path);
      }
      notFoundProbes.set(ip, probe);

      if (probe.count >= PROBE_THRESHOLD) {
        logSecurityEvent({
          type: 'REPEATED_404_PROBE',
          ip,
          userAgent,
          path: req.path,
          method: req.method,
          details: {
            probeCount: probe.count,
            probedPaths: probe.paths,
            windowMs: PROBE_WINDOW_MS
          }
        });
      }
    }
  });

  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const origin = req.headers.origin;
  const host = req.headers.host;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHost = host?.split(':')[0];
      
      if (originUrl.hostname !== expectedHost && isProduction) {
        res.status(403).json({ error: 'CSRF validation failed' });
        return;
      }
    } catch {
      if (isProduction) {
        res.status(403).json({ error: 'Invalid origin header' });
        return;
      }
    }
  }

  next();
}
