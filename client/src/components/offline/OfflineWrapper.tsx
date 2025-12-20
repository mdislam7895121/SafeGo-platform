import { ReactNode } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { cn } from '@/lib/utils';

interface OfflineWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  disableWhenOffline?: boolean;
  className?: string;
}

export function OfflineWrapper({
  children,
  fallback,
  disableWhenOffline = false,
  className,
}: OfflineWrapperProps) {
  const { isOnline } = useNetworkStatus();
  const { isEnabled } = useFeatureFlags();
  const offlineModeEnabled = isEnabled('offline_mode_enabled');

  if (!isOnline && disableWhenOffline) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className={cn('opacity-50 pointer-events-none', className)}>
        {children}
      </div>
    );
  }

  if (!offlineModeEnabled && !isOnline) {
    return (
      <div className="flex items-center justify-center p-4 bg-amber-50 text-amber-700 rounded-md">
        <span>You are offline. Please check your connection.</span>
      </div>
    );
  }

  return <>{children}</>;
}

interface RequiresOnlineProps {
  children: ReactNode;
  message?: string;
}

export function RequiresOnline({ children, message }: RequiresOnlineProps) {
  const { isOnline } = useNetworkStatus();

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-100 rounded-md text-gray-600">
        <span className="text-sm">
          {message || 'This feature requires an internet connection'}
        </span>
      </div>
    );
  }

  return <>{children}</>;
}

interface OfflineAvailableProps {
  children: ReactNode;
  offlineContent?: ReactNode;
}

export function OfflineAvailable({ children, offlineContent }: OfflineAvailableProps) {
  const { isOnline } = useNetworkStatus();

  if (!isOnline && offlineContent) {
    return <>{offlineContent}</>;
  }

  return <>{children}</>;
}
