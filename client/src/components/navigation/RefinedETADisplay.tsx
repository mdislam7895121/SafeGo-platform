import { useQuery } from "@tanstack/react-query";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Activity,
  AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ETAData {
  originalEtaMinutes: number;
  refinedEtaMinutes: number;
  confidence: number;
  factors: {
    driverPerformance: number;
    trafficConditions: number;
    timeOfDay: number;
    weatherImpact: number;
  };
  lastUpdated: string;
}

interface RefinedETADisplayProps {
  tripId?: string;
  tripType?: "ride" | "food" | "parcel";
  compact?: boolean;
  showFactors?: boolean;
}

function formatETA(minutes: number): string {
  if (minutes < 1) {
    return "< 1 min";
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function getDifferenceIcon(original: number, refined: number) {
  const diff = refined - original;
  if (diff > 2) {
    return <TrendingUp className="h-4 w-4 text-red-500" />;
  }
  if (diff < -2) {
    return <TrendingDown className="h-4 w-4 text-green-500" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-green-600 bg-green-100 dark:bg-green-900/30";
  if (confidence >= 60) return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
  return "text-red-600 bg-red-100 dark:bg-red-900/30";
}

function getFactorLabel(factor: number): { label: string; color: string } {
  if (factor >= 90) return { label: "Excellent", color: "text-green-600" };
  if (factor >= 70) return { label: "Good", color: "text-blue-600" };
  if (factor >= 50) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Poor", color: "text-red-600" };
}

export function RefinedETADisplay({ 
  tripId, 
  tripType = "ride",
  compact = false,
  showFactors = false 
}: RefinedETADisplayProps) {
  const { data, isLoading } = useQuery<ETAData>({
    queryKey: ["/api/phase5/eta/refined", tripId, tripType],
    enabled: !!tripId,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!data) {
    return null;
  }

  const { originalEtaMinutes, refinedEtaMinutes, confidence, factors } = data;
  const etaDifference = refinedEtaMinutes - originalEtaMinutes;

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="eta-display-compact">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{formatETA(refinedEtaMinutes)}</span>
        {Math.abs(etaDifference) > 2 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                {getDifferenceIcon(originalEtaMinutes, refinedEtaMinutes)}
                <span className={`text-xs ${etaDifference > 0 ? "text-red-500" : "text-green-500"}`}>
                  {etaDifference > 0 ? "+" : ""}{Math.round(etaDifference)} min
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI-refined ETA based on driver performance</p>
              <p className="text-xs text-muted-foreground">
                Original: {formatETA(originalEtaMinutes)}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        <Badge 
          variant="outline" 
          className={`text-xs ${getConfidenceColor(confidence)}`}
          data-testid="badge-eta-confidence"
        >
          {Math.round(confidence)}%
        </Badge>
      </div>
    );
  }

  return (
    <Card data-testid="eta-display-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">AI-Refined ETA</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" data-testid="text-refined-eta">
                {formatETA(refinedEtaMinutes)}
              </span>
              {Math.abs(etaDifference) > 1 && (
                <span className={`text-sm ${etaDifference > 0 ? "text-red-500" : "text-green-500"}`}>
                  {etaDifference > 0 ? "+" : ""}{Math.round(etaDifference)} min from estimate
                </span>
              )}
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={getConfidenceColor(confidence)}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            {Math.round(confidence)}% confidence
          </Badge>
        </div>

        {showFactors && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Refinement Factors</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <FactorItem label="Driver Performance" value={factors.driverPerformance} />
              <FactorItem label="Traffic" value={factors.trafficConditions} />
              <FactorItem label="Time of Day" value={factors.timeOfDay} />
              <FactorItem label="Weather" value={factors.weatherImpact} />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Updated {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}

function FactorItem({ label, value }: { label: string; value: number }) {
  const { label: factorLabel, color } = getFactorLabel(value);
  
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{factorLabel}</span>
    </div>
  );
}

export function ETABadge({ minutes, confidence }: { minutes: number; confidence?: number }) {
  return (
    <Badge 
      variant="secondary" 
      className="flex items-center gap-1"
      data-testid="badge-eta"
    >
      <Clock className="h-3 w-3" />
      {formatETA(minutes)}
      {confidence && (
        <span className="text-xs opacity-70">
          ({Math.round(confidence)}%)
        </span>
      )}
    </Badge>
  );
}
