import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS = isProduction
  ? [process.env.FRONTEND_URL || 'https://safego.replit.app']
  : ['http://localhost:5000', 'http://0.0.0.0:5000'];

const LANDING_ROUTES = ['/', '/ride', '/drive', '/business', '/safety', '/support', '/privacy', '/terms', '/cookies'];

function isLandingRoute(path: string): boolean {
  return LANDING_ROUTES.includes(path) || path.startsWith('/privacy') || path.startsWith('/terms') || path.startsWith('/cookies');
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

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

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
        "block-all-mixed-content"
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
        "media-src 'self'"
      ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

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
