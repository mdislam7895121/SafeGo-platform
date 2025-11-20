import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";

interface AuditIndicatorProps {
  hasAuditEvents: boolean;
  eventCount?: number;
  className?: string;
}

export function AuditIndicator({ hasAuditEvents, eventCount, className = "" }: AuditIndicatorProps) {
  if (!hasAuditEvents) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`relative inline-flex ${className}`} data-testid="indicator-audit-events">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {eventCount !== undefined && eventCount > 0
            ? `${eventCount} security event${eventCount > 1 ? 's' : ''} detected`
            : "Security events detected"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
