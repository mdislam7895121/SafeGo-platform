import { createContext, useContext, ReactNode } from 'react';
import { useNetworkStatus, NetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { offlineStorage } from '@/lib/offlineStorage';

interface OfflineContextValue {
  network: NetworkStatus;
  sync: ReturnType<typeof useOfflineSync>;
  storage: typeof offlineStorage;
  featureEnabled: boolean;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isEnabled } = useFeatureFlags();
  const featureEnabled = isEnabled('offline_mode_enabled');
  const network = useNetworkStatus();
  const sync = useOfflineSync();

  return (
    <OfflineContext.Provider value={{ 
      network, 
      sync, 
      storage: offlineStorage,
      featureEnabled,
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext must be used within OfflineProvider');
  }
  return context;
}

export function useOfflineAwareAction() {
  const { network, sync, featureEnabled } = useOfflineContext();

  const executeWithOfflineSupport = async <T,>(
    action: () => Promise<T>,
    offlineAction?: {
      type: string;
      endpoint: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      payload?: unknown;
    }
  ): Promise<{ success: boolean; data?: T; queued?: boolean }> => {
    if (network.isOnline) {
      try {
        const data = await action();
        return { success: true, data };
      } catch (error) {
        if (featureEnabled && offlineAction) {
          sync.queueAction(
            offlineAction.type,
            offlineAction.endpoint,
            offlineAction.method,
            offlineAction.payload
          );
          return { success: false, queued: true };
        }
        throw error;
      }
    }

    if (featureEnabled && offlineAction) {
      sync.queueAction(
        offlineAction.type,
        offlineAction.endpoint,
        offlineAction.method,
        offlineAction.payload
      );
      return { success: false, queued: true };
    }

    throw new Error('You are offline and this action cannot be queued');
  };

  return { executeWithOfflineSupport, isOnline: network.isOnline };
}
