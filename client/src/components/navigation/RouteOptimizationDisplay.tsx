import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Route, 
  Clock, 
  Navigation2, 
  Shield,
  Zap,
  Car,
  Gauge,
  ChevronDown,
  ChevronUp,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RouteOption {
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  distanceScore: number;
  timeScore: number;
  safetyScore: number;
  overallScore: number;
  isSelected?: boolean;
}

interface RouteOptimizationData {
  selectedRoute: RouteOption;
  alternativeRoutes: RouteOption[];
  optimizationFactors: {
    distanceWeight: number;
    timeWeight: number;
    trafficWeight: number;
    safetyWeight: number;
  };
}

interface RouteOptimizationDisplayProps {
  sessionId?: string;
  compact?: boolean;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function RouteCard({ 
  route, 
  isSelected, 
  onSelect,
  showDetails = false 
}: { 
  route: RouteOption; 
  isSelected: boolean;
  onSelect?: () => void;
  showDetails?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card 
      className={`transition-all ${isSelected ? "ring-2 ring-primary" : "hover-elevate cursor-pointer"}`}
      onClick={onSelect}
      data-testid={`route-option-${route.index}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <Route className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Route {route.index + 1}</span>
                {isSelected && (
                  <Badge variant="default" className="text-xs">Optimal</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Navigation2 className="h-3 w-3" />
                  {formatDistance(route.distanceMeters)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(route.durationSeconds)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={getScoreColor(route.overallScore)}
            >
              {Math.round(route.overallScore)}%
            </Badge>
            {showDetails && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                data-testid={`toggle-details-${route.index}`}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {showDetails && expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <ScoreBar label="Distance" score={route.distanceScore} icon={<Navigation2 className="h-4 w-4" />} />
            <ScoreBar label="Time" score={route.timeScore} icon={<Clock className="h-4 w-4" />} />
            <ScoreBar label="Safety" score={route.safetyScore} icon={<Shield className="h-4 w-4" />} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={`font-medium ${getScoreColor(score)}`}>
          {Math.round(score)}%
        </span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  );
}

export function RouteOptimizationDisplay({ sessionId, compact = false }: RouteOptimizationDisplayProps) {
  const [isOpen, setIsOpen] = useState(!compact);

  const { data, isLoading } = useQuery<RouteOptimizationData>({
    queryKey: ["/api/phase5/driver/route-optimization", sessionId],
    enabled: !!sessionId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { selectedRoute, alternativeRoutes, optimizationFactors } = data;
  const allRoutes = [selectedRoute, ...alternativeRoutes];

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Route Optimization
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    {Math.round(selectedRoute.overallScore)}% optimal
                  </Badge>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Navigation2 className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDistance(selectedRoute.distanceMeters)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDuration(selectedRoute.durationSeconds)}</span>
                </div>
              </div>
              {alternativeRoutes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {alternativeRoutes.length} alternative route{alternativeRoutes.length > 1 ? 's' : ''} available
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Optimization Weights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Navigation2 className="h-3 w-3" /> Distance
              </span>
              <span className="font-medium">{optimizationFactors.distanceWeight}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Time
              </span>
              <span className="font-medium">{optimizationFactors.timeWeight}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Car className="h-3 w-3" /> Traffic
              </span>
              <span className="font-medium">{optimizationFactors.trafficWeight}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" /> Safety
              </span>
              <span className="font-medium">{optimizationFactors.safetyWeight}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Route className="h-4 w-4" />
          Available Routes ({allRoutes.length})
        </h3>
        {allRoutes.map((route, idx) => (
          <RouteCard
            key={route.index}
            route={route}
            isSelected={idx === 0}
            showDetails
          />
        ))}
      </div>
    </div>
  );
}

export function RouteOptimizationBadge({ score }: { score: number }) {
  return (
    <Badge 
      variant="outline" 
      className={`${getScoreColor(score)} flex items-center gap-1`}
      data-testid="badge-route-score"
    >
      <Zap className="h-3 w-3" />
      {Math.round(score)}%
    </Badge>
  );
}
