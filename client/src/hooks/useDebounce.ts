import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const callbackRef = useRef(callback);
  const lastCallRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = limit - (now - lastCallRef.current);

      if (remaining <= 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = undefined;
        }
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = undefined;
          callbackRef.current(...args);
        }, remaining);
      }
    },
    [limit]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  const memoizedOptions = useMemo(
    () => ({
      threshold: options.threshold ?? 0,
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? '0px',
    }),
    [options.threshold, options.root, options.rootMargin]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, memoizedOptions);

    observer.observe(element);
    return () => observer.disconnect();
  }, [memoizedOptions]);

  return [ref, isIntersecting];
}
