import { useEffect, useCallback, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineStorage, OfflineAction } from '@/lib/offlineStorage';

const MAX_RETRY_COUNT = 3;
const SYNC_INTERVAL = 5000;

interface SyncState {
  isSyncing: boolean;
  pendingActions: number;
  lastSyncTime: number | null;
  syncErrors: string[];
}

export function useOfflineSync() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const syncInProgressRef = useRef(false);
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    pendingActions: offlineStorage.getActionQueue().length,
    lastSyncTime: null,
    syncErrors: [],
  });

  const processAction = useCallback(async (action: OfflineAction): Promise<boolean> => {
    try {
      const response = await fetch(action.endpoint, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: action.payload ? JSON.stringify(action.payload) : undefined,
      });

      if (response.ok) {
        offlineStorage.removeFromActionQueue(action.id);
        return true;
      }

      if (response.status >= 400 && response.status < 500) {
        offlineStorage.removeFromActionQueue(action.id);
        return false;
      }

      offlineStorage.incrementRetryCount(action.id);
      return false;
    } catch {
      offlineStorage.incrementRetryCount(action.id);
      return false;
    }
  }, []);

  const syncPendingActions = useCallback(async () => {
    if (syncInProgressRef.current || !isOnline) return;
    
    syncInProgressRef.current = true;
    setSyncState(prev => ({ ...prev, isSyncing: true, syncErrors: [] }));

    const queue = offlineStorage.getActionQueue();
    const errors: string[] = [];

    for (const action of queue) {
      if (action.retryCount >= MAX_RETRY_COUNT) {
        errors.push(`Action ${action.type} failed after ${MAX_RETRY_COUNT} retries`);
        offlineStorage.removeFromActionQueue(action.id);
        continue;
      }

      await processAction(action);
    }

    setSyncState({
      isSyncing: false,
      pendingActions: offlineStorage.getActionQueue().length,
      lastSyncTime: Date.now(),
      syncErrors: errors,
    });
    syncInProgressRef.current = false;
  }, [isOnline, processAction]);

  const syncDriverData = useCallback(async () => {
    if (!isOnline) return;

    const gpsQueue = offlineStorage.getDriverGPSQueue();
    if (gpsQueue.length > 0) {
      try {
        await fetch('/api/driver/location/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ locations: gpsQueue }),
        });
        offlineStorage.clearDriverGPSQueue();
      } catch {
        console.log('[OfflineSync] Failed to sync GPS data');
      }
    }

    const statusQueue = offlineStorage.getDriverStatusQueue();
    if (statusQueue.length > 0) {
      for (const update of statusQueue) {
        try {
          await fetch(`/api/rides/${update.rideId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              status: update.status,
              location: update.location,
              offlineTimestamp: update.timestamp,
            }),
          });
        } catch {
          console.log('[OfflineSync] Failed to sync status update');
        }
      }
      offlineStorage.clearDriverStatusQueue();
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && wasOffline) {
      console.log('[OfflineSync] Connection restored, syncing...');
      syncPendingActions();
      syncDriverData();
    }
  }, [isOnline, wasOffline, syncPendingActions, syncDriverData]);

  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      const pending = offlineStorage.getActionQueue().length;
      if (pending > 0) {
        syncPendingActions();
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isOnline, syncPendingActions]);

  const queueAction = useCallback((
    type: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    payload?: unknown
  ) => {
    offlineStorage.addToActionQueue({ type, endpoint, method, payload });
    setSyncState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions + 1,
    }));
  }, []);

  const forcSync = useCallback(async () => {
    await syncPendingActions();
    await syncDriverData();
  }, [syncPendingActions, syncDriverData]);

  return {
    ...syncState,
    queueAction,
    forcSync,
    isOnline,
  };
}
