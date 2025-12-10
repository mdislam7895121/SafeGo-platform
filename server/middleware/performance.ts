import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

export const compressionMiddleware = compression({
  level: 6,
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

export function staticAssetCaching(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  
  if (path.match(/\.(js|css|woff2|woff|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
  } else if (path.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
  } else if (path.match(/\.(json|xml)$/) && !path.includes('/api/')) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  
  next();
}

export function cdnHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  next();
}

export function optimizedLogging(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production') {
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf|eot)$/)) {
      return next();
    }
  }
  
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const duration = Date.now() - start;
      if (duration > 100 || res.statusCode >= 400) {
        console.log(`[PERF] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      }
    }
  });
  
  next();
}

export function earlyHints(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/' || req.path === '/index.html') {
    res.setHeader('Link', [
      '</assets/index.css>; rel=preload; as=style',
      '<https://fonts.googleapis.com>; rel=preconnect',
      '<https://maps.googleapis.com>; rel=preconnect'
    ].join(', '));
  }
  next();
}
