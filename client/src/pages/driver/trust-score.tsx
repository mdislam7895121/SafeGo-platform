import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield,
  TrendingUp,
  Clock,
  Star,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Info,
  RefreshCw,
  Award,
  Zap,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TrustScoreBreakdown {
  onTimeArrivals: { score: number; weight: number; weighted: number; rawValue: number };
  riderRatings: { score: number; weight: number; weighted: number; rawValue: number };
  cancellationRate: { score: number; weight: number; weighted: number; rawValue: number };
  safetyBehavior: { score: number; weight: number; weighted: number; rawValue: number };
  supportTickets: { score: number; weight: number; weighted: number; rawValue: number };
}

interface TrustScoreStatus {
  color: string;
  label: string;
  description: string;
}

interface TrustScoreData {
  trustScore: number;
  status: TrustScoreStatus;
  breakdown: TrustScoreBreakdown;
  tips: string[];
  bonusEligible: boolean;
  penaltyApplied: boolean;
  lastUpdated: string;
  stats: {
    totalTrips: number;
    rating: number;
    onTimeArrivals: number;
    lateArrivals: number;
    cancellations: number;
  };
}

const breakdownConfig = {
  onTimeArrivals: {
    label: "On-Time Arrivals",
    icon: Clock,
    description: "Percentage of trips where you arrived on time at pickup",
    color: "text-blue-500",
  },
  riderRatings: {
    label: "Rider Ratings",
    icon: Star,
    description: "Average rating from customer feedback",
    color: "text-yellow-500",
  },
  cancellationRate: {
    label: "Cancellation Rate",
    icon: XCircle,
    description: "Lower cancellation rate = higher score",
    color: "text-red-500",
  },
  safetyBehavior: {
    label: "Safety Behavior",
    icon: Shield,
    description: "Driving habits including speed and braking patterns",
    color: "text-green-500",
  },
  supportTickets: {
    label: "Support & Disputes",
    icon: MessageSquare,
    description: "Resolution quality of customer disputes",
    color: "text-purple-500",
  },
};

function CircularProgress({ score, color }: { score: number; color: string }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorClass = color === "green" 
    ? "stroke-green-500" 
    : color === "yellow" 
    ? "stroke-yellow-500" 
    : "stroke-red-500";

  return (
    <div className="relative w-40 h-40" data-testid="trust-score-circle">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={colorClass}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: "stroke-dashoffset 0.5s ease-in-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" data-testid="text-trust-score-value">{score}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function TrustScoreSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Skeleton className="h-40 w-40 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KYCRequiredAlert() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Trust Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Verification Required</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Your trust score will be available once you complete identity verification.
                This helps us maintain safety and trust on the platform.
              </p>
              <Link href="/driver/documents">
                <Button size="sm" data-testid="button-complete-kyc">
                  Complete Verification
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DriverTrustScore() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<TrustScoreData>({
    queryKey: ["/api/driver/trust-score"],
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/driver/trust-score/recalculate", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/trust-score"] });
      toast({
        title: "Trust Score Updated",
        description: "Your trust score has been recalculated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to recalculate trust score. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <TrustScoreSkeleton />;
  }

  if (error) {
    const errorMessage = (error as any)?.message || "";
    if (errorMessage.includes("KYC") || errorMessage.includes("verification")) {
      return <KYCRequiredAlert />;
    }
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load trust score. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return <KYCRequiredAlert />;
  }

  const { trustScore, status, breakdown, tips, bonusEligible, penaltyApplied, lastUpdated, stats } = data;

  return (
    <div className="space-y-6">
      <Card data-testid="card-trust-score-main">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your Trust Score
            </CardTitle>
            <CardDescription>
              Updated {new Date(lastUpdated).toLocaleDateString()}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            data-testid="button-recalculate-score"
          >
            {recalculateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <CircularProgress score={trustScore} color={status.color} />
          
          <Badge
            variant={status.color === "green" ? "default" : status.color === "yellow" ? "secondary" : "destructive"}
            className="text-sm px-3 py-1"
            data-testid="badge-trust-score-status"
          >
            {status.label}
          </Badge>
          
          <p className="text-center text-muted-foreground max-w-md" data-testid="text-trust-score-description">
            {status.description}
          </p>

          {bonusEligible && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <Award className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-400">Bonus Eligible</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-500">
                Your excellent trust score qualifies you for incentive boosts and priority dispatch!
              </AlertDescription>
            </Alert>
          )}

          {penaltyApplied && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Priority Reduced</AlertTitle>
              <AlertDescription>
                Your low trust score is affecting your trip priority. Follow the improvement tips below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-score-breakdown">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Score Breakdown
          </CardTitle>
          <CardDescription>
            How each factor contributes to your trust score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(breakdown).map(([key, value]) => {
            const config = breakdownConfig[key as keyof typeof breakdownConfig];
            if (!config) return null;
            const Icon = config.icon;
            
            return (
              <div key={key} className="space-y-2" data-testid={`breakdown-${key}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="font-medium">{config.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(value.weight * 100)}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{value.score}/100</span>
                    <span className="text-xs text-muted-foreground">
                      (+{value.weighted} pts)
                    </span>
                  </div>
                </div>
                <Progress value={value.score} className="h-2" />
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-testid="card-improvement-tips">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Improvement Tips
          </CardTitle>
          <CardDescription>
            Actions to boost your trust score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-3" data-testid={`tip-${index}`}>
                {trustScore >= 80 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                )}
                <span className="text-sm">{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card data-testid="card-quick-stats">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-total-trips">
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
              <p className="text-xs text-muted-foreground">Total Trips</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-rating">
              <p className="text-2xl font-bold">{stats.rating.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-on-time">
              <p className="text-2xl font-bold">{stats.onTimeArrivals}</p>
              <p className="text-xs text-muted-foreground">On-Time</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-late">
              <p className="text-2xl font-bold">{stats.lateArrivals}</p>
              <p className="text-xs text-muted-foreground">Late Arrivals</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-cancellations">
              <p className="text-2xl font-bold">{stats.cancellations}</p>
              <p className="text-xs text-muted-foreground">Cancellations</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/driver/performance" className="flex-1">
          <Button variant="outline" className="w-full" data-testid="link-performance">
            View Full Performance
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        <Link href="/driver/safety" className="flex-1">
          <Button variant="outline" className="w-full" data-testid="link-safety">
            Safety Center
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
