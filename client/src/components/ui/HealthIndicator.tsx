import { useEffect, useState } from "react";
import { checkApiHealth, HealthStatus } from "@/lib/healthCheck";
import { Activity, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "@/config/api";

export function HealthIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      setIsLoading(true);
      const result = await checkApiHealth();
      setHealth(result);
      setIsLoading(false);
    };

    check();
    const interval = setInterval(check, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Activity className="h-3 w-3 animate-pulse" />
        <span>Checking API...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {health?.ok ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-gray-600 dark:text-gray-300">
            API Online
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span className="text-red-600 dark:text-red-400">
            API {health?.status === 0 ? "Offline" : `Error ${health?.status}`}
          </span>
        </>
      )}
      <span className="text-gray-400 dark:text-gray-500 text-[10px]">
        ({API_BASE_URL})
      </span>
    </div>
  );
}
