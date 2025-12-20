import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

interface NetworkInformation extends EventTarget {
  effectiveType: string;
  downlink: number;
  rtt: number;
  type: string;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';

function getConnection(): NetworkInformation | null {
  if (!isBrowser) return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function getInitialStatus(): NetworkStatus {
  if (!isBrowser) {
    return {
      isOnline: true,
      wasOffline: false,
      connectionType: null,
      effectiveType: null,
      downlink: null,
      rtt: null,
    };
  }
  const connection = getConnection();
  return {
    isOnline: navigator.onLine,
    wasOffline: false,
    connectionType: connection?.type || null,
    effectiveType: connection?.effectiveType || null,
    downlink: connection?.downlink || null,
    rtt: connection?.rtt || null,
  };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(getInitialStatus);

  const updateStatus = useCallback((isOnline: boolean) => {
    const connection = getConnection();
    setStatus(prev => ({
      isOnline,
      wasOffline: prev.wasOffline || (!prev.isOnline && isOnline),
      connectionType: connection?.type || null,
      effectiveType: connection?.effectiveType || null,
      downlink: connection?.downlink || null,
      rtt: connection?.rtt || null,
    }));
  }, []);

  useEffect(() => {
    if (!isBrowser) return;

    const handleOnline = () => updateStatus(true);
    const handleOffline = () => updateStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = getConnection();
    if (connection) {
      const handleConnectionChange = () => {
        updateStatus(navigator.onLine);
      };
      connection.addEventListener('change', handleConnectionChange);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateStatus]);

  return status;
}

export function useIsSlowConnection(): boolean {
  const { effectiveType, rtt } = useNetworkStatus();
  
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return true;
  }
  if (rtt && rtt > 1000) {
    return true;
  }
  return false;
}
