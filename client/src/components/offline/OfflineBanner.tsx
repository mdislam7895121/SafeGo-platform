import { WifiOff, RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import { useNetworkStatus, useIsSlowConnection } from '@/hooks/useNetworkStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
  showPendingCount?: boolean;
  compact?: boolean;
}

export function OfflineBanner({ 
  className, 
  showPendingCount = true,
  compact = false 
}: OfflineBannerProps) {
  const { isOnline, wasOffline } = useNetworkStatus();
  const isSlowConnection = useIsSlowConnection();
  const { isSyncing, pendingActions, forcSync } = useOfflineSync();

  if (isOnline && !wasOffline && pendingActions === 0 && !isSlowConnection) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className={cn(
        'bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-2',
        compact ? 'py-1.5 text-sm' : 'py-2',
        className
      )}>
        <div className="flex items-center gap-2">
          <WifiOff className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          <span className="font-medium">
            {compact ? 'Offline' : 'You are offline'}
          </span>
          {showPendingCount && pendingActions > 0 && (
            <span className="text-amber-100 text-sm">
              ({pendingActions} pending)
            </span>
          )}
        </div>
        <span className="text-amber-100 text-sm">
          {compact ? 'Limited features' : 'Some features may be limited'}
        </span>
      </div>
    );
  }

  if (isSlowConnection) {
    return (
      <div className={cn(
        'bg-yellow-500 text-white px-4 py-2 flex items-center justify-between gap-2',
        compact ? 'py-1.5 text-sm' : 'py-2',
        className
      )}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          <span className="font-medium">
            {compact ? 'Slow connection' : 'Slow connection detected'}
          </span>
        </div>
      </div>
    );
  }

  if (wasOffline && pendingActions > 0) {
    return (
      <div className={cn(
        'bg-blue-500 text-white px-4 py-2 flex items-center justify-between gap-2',
        compact ? 'py-1.5 text-sm' : 'py-2',
        className
      )}>
        <div className="flex items-center gap-2">
          <Cloud className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          <span className="font-medium">
            {isSyncing ? 'Syncing...' : 'Back online'}
          </span>
          {showPendingCount && pendingActions > 0 && (
            <span className="text-blue-100 text-sm">
              {pendingActions} {pendingActions === 1 ? 'action' : 'actions'} pending
            </span>
          )}
        </div>
        {!isSyncing && pendingActions > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => forcSync()}
            className="text-white hover:bg-blue-600"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync now
          </Button>
        )}
        {isSyncing && (
          <RefreshCw className="h-4 w-4 animate-spin" />
        )}
      </div>
    );
  }

  return null;
}

export function OfflineIndicator({ className }: { className?: string }) {
  const { isOnline } = useNetworkStatus();
  const { pendingActions } = useOfflineSync();

  if (isOnline && pendingActions === 0) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center gap-1.5 text-sm',
      !isOnline ? 'text-amber-500' : 'text-blue-500',
      className
    )}>
      {!isOnline ? (
        <WifiOff className="h-4 w-4" />
      ) : (
        <Cloud className="h-4 w-4" />
      )}
      {pendingActions > 0 && (
        <span className="bg-current text-white rounded-full px-1.5 py-0.5 text-xs">
          {pendingActions}
        </span>
      )}
    </div>
  );
}
