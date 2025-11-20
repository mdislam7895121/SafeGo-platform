import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

interface SessionRefreshBannerProps {
  message?: string;
  onDismiss?: () => void;
}

export function SessionRefreshBanner({ 
  message = "Your session has been updated. Please refresh to see the latest changes.",
  onDismiss 
}: SessionRefreshBannerProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top"
      data-testid="banner-session-refresh"
    >
      <Alert className="rounded-none border-x-0 border-t-0 border-b border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/50">
        <RefreshCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertDescription className="flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">{message}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              data-testid="button-refresh-now"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh Now
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              data-testid="button-dismiss-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
