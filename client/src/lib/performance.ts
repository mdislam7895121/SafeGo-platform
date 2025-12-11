import { lazy, ComponentType, LazyExoticComponent } from 'react';

export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> } {
  const Component = lazy(factory) as LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
  };
  Component.preload = factory;
  return Component;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);
    
    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  };
}

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

export function measureWebVitals() {
  if (typeof window === 'undefined') return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('[WebVitals] LCP:', Math.round((entry as any).startTime), 'ms');
        }
        if (entry.entryType === 'first-input') {
          const fid = (entry as any).processingStart - entry.startTime;
          console.log('[WebVitals] FID:', Math.round(fid), 'ms');
        }
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          console.log('[WebVitals] CLS:', (entry as any).value.toFixed(4));
        }
      }
    });
    
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observer.observe({ type: 'first-input', buffered: true });
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
  }
}

export const imageOptimization = {
  getWebPSrc: (src: string): string => {
    if (src.endsWith('.webp')) return src;
    return src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  },
  
  getSrcSet: (src: string, sizes: number[] = [320, 640, 960, 1280]): string => {
    const ext = src.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg';
    const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    return sizes.map(size => `${base}-${size}w${ext} ${size}w`).join(', ');
  }
};
