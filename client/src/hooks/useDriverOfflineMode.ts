import { useEffect, useCallback, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineStorage, CachedRoute, DriverGPSPoint, DriverStatusUpdate } from '@/lib/offlineStorage';

interface DriverOfflineState {
  hasActiveRoute: boolean;
  gpsQueueCount: number;
  statusQueueCount: number;
  lastGPSTime: number | null;
  isTrackingGPS: boolean;
}

export function useDriverOfflineMode() {
  const { isOnline } = useNetworkStatus();
  const gpsWatchId = useRef<number | null>(null);
  const [state, setState] = useState<DriverOfflineState>({
    hasActiveRoute: offlineStorage.getDriverActiveRoute() !== null,
    gpsQueueCount: offlineStorage.getDriverGPSQueue().length,
    statusQueueCount: offlineStorage.getDriverStatusQueue().length,
    lastGPSTime: null,
    isTrackingGPS: false,
  });

  const cacheActiveRoute = useCallback((route: Omit<CachedRoute, 'timestamp'>) => {
    offlineStorage.setDriverActiveRoute(route);
    setState(prev => ({ ...prev, hasActiveRoute: true }));
    console.log('[DriverOffline] Cached active route');
  }, []);

  const clearActiveRoute = useCallback(() => {
    offlineStorage.clearDriverActiveRoute();
    setState(prev => ({ ...prev, hasActiveRoute: false }));
    console.log('[DriverOffline] Cleared active route');
  }, []);

  const getActiveRoute = useCallback((): CachedRoute | null => {
    return offlineStorage.getDriverActiveRoute();
  }, []);

  const queueStatusUpdate = useCallback((update: DriverStatusUpdate) => {
    if (!isOnline) {
      offlineStorage.addToDriverStatusQueue(update);
      setState(prev => ({ 
        ...prev, 
        statusQueueCount: prev.statusQueueCount + 1 
      }));
      console.log('[DriverOffline] Queued status update:', update.status);
    }
  }, [isOnline]);

  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('[DriverOffline] Geolocation not available');
      return;
    }

    if (gpsWatchId.current !== null) {
      return;
    }

    gpsWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: DriverGPSPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
        };

        offlineStorage.setLastKnownLocation({
          lat: point.lat,
          lng: point.lng,
          address: 'Current location',
        });

        if (!isOnline) {
          offlineStorage.addToDriverGPSQueue(point);
          setState(prev => ({
            ...prev,
            gpsQueueCount: prev.gpsQueueCount + 1,
            lastGPSTime: Date.now(),
          }));
        }
      },
      (error) => {
        console.error('[DriverOffline] GPS error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    setState(prev => ({ ...prev, isTrackingGPS: true }));
    console.log('[DriverOffline] Started GPS tracking');
  }, [isOnline]);

  const stopGPSTracking = useCallback(() => {
    if (gpsWatchId.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchId.current);
      gpsWatchId.current = null;
      setState(prev => ({ ...prev, isTrackingGPS: false }));
      console.log('[DriverOffline] Stopped GPS tracking');
    }
  }, []);

  const getLastKnownLocation = useCallback(() => {
    return offlineStorage.getLastKnownLocation();
  }, []);

  const getSummary = useCallback(() => {
    return offlineStorage.getOfflineDataSummary();
  }, []);

  useEffect(() => {
    return () => {
      if (gpsWatchId.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      const gpsQueue = offlineStorage.getDriverGPSQueue();
      const statusQueue = offlineStorage.getDriverStatusQueue();
      
      if (gpsQueue.length > 0 || statusQueue.length > 0) {
        console.log('[DriverOffline] Connection restored, ready to sync:', {
          gpsPoints: gpsQueue.length,
          statusUpdates: statusQueue.length,
        });
      }
    }
  }, [isOnline]);

  return {
    ...state,
    isOnline,
    cacheActiveRoute,
    clearActiveRoute,
    getActiveRoute,
    queueStatusUpdate,
    startGPSTracking,
    stopGPSTracking,
    getLastKnownLocation,
    getSummary,
  };
}
