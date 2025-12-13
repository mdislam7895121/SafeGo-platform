import { MapPin, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { resetMapsState } from "@/hooks/useGoogleMaps";

interface MapUnavailableProps {
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function MapUnavailable({ 
  message = "Map service is temporarily unavailable", 
  showRetry = true,
  onRetry,
  className = ""
}: MapUnavailableProps) {
  const handleRetry = () => {
    resetMapsState();
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="relative mb-4">
        <MapPin className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        <AlertTriangle className="w-5 h-5 text-amber-500 absolute -bottom-1 -right-1" />
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        Maps Unavailable
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4 max-w-xs">
        {message}
      </p>
      
      <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-4">
        You can still enter addresses manually below
      </p>
      
      {showRetry && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRetry}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}

export function MapUnavailableInline({
  message = "Location services unavailable",
  className = ""
}: { message?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md ${className}`}>
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
      <span className="text-sm text-amber-800 dark:text-amber-400">
        {message}
      </span>
    </div>
  );
}

export function MapLoadingState({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="relative mb-4">
        <MapPin className="w-12 h-12 text-gray-400 dark:text-gray-500 animate-pulse" />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Loading map services...
      </p>
    </div>
  );
}
