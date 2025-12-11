import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Zap,
  Clock,
  Award,
  ChevronRight,
  CheckCircle,
  Timer,
  Sparkles,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface IncentiveRecommendation {
  id: string;
  type: "surge" | "quest" | "bonus" | "streak" | "referral";
  title: string;
  description: string;
  potentialEarnings: number;
  confidence: number;
  expiresAt: string;
  requirements: string[];
  progress?: number;
  targetValue?: number;
  currentValue?: number;
}

interface ActiveIncentive {
  id: string;
  type: string;
  title: string;
  description: string;
  bonusAmount: number;
  progress: number;
  target: number;
  expiresAt: string;
  status: "active" | "completed" | "expired";
}

interface IncentiveData {
  recommendations: IncentiveRecommendation[];
  activeIncentives: ActiveIncentive[];
  totalPotentialEarnings: number;
  completedThisWeek: number;
  streakDays: number;
}

interface DriverIncentiveDashboardProps {
  compact?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  
  if (diffMs <= 0) return "Expired";
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

function getIncentiveIcon(type: string) {
  switch (type) {
    case "surge": return <Zap className="h-4 w-4 text-yellow-500" />;
    case "quest": return <Target className="h-4 w-4 text-purple-500" />;
    case "bonus": return <DollarSign className="h-4 w-4 text-green-500" />;
    case "streak": return <Award className="h-4 w-4 text-orange-500" />;
    case "referral": return <TrendingUp className="h-4 w-4 text-blue-500" />;
    default: return <Sparkles className="h-4 w-4 text-primary" />;
  }
}

function RecommendationCard({ 
  recommendation, 
  onAccept 
}: { 
  recommendation: IncentiveRecommendation;
  onAccept: (id: string) => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`recommendation-${recommendation.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getIncentiveIcon(recommendation.type)}
            <div>
              <h4 className="font-medium">{recommendation.title}</h4>
              <p className="text-sm text-muted-foreground">{recommendation.description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-green-600">
            +{formatCurrency(recommendation.potentialEarnings)}
          </Badge>
        </div>

        {recommendation.progress !== undefined && recommendation.targetValue !== undefined && (
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{recommendation.currentValue || 0}/{recommendation.targetValue}</span>
            </div>
            <Progress value={recommendation.progress} className="h-2" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-3 w-3" />
            <span>{formatTimeRemaining(recommendation.expiresAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={recommendation.confidence >= 70 ? "text-green-600" : "text-yellow-600"}
            >
              {Math.round(recommendation.confidence)}% match
            </Badge>
            <Button 
              size="sm"
              onClick={() => onAccept(recommendation.id)}
              data-testid={`button-accept-${recommendation.id}`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveIncentiveCard({ incentive }: { incentive: ActiveIncentive }) {
  const progressPercent = (incentive.progress / incentive.target) * 100;
  const isCompleted = incentive.status === "completed";
  const isExpired = incentive.status === "expired";

  return (
    <Card 
      className={isExpired ? "opacity-60" : ""} 
      data-testid={`active-incentive-${incentive.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getIncentiveIcon(incentive.type)}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{incentive.title}</h4>
                {isCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{incentive.description}</p>
            </div>
          </div>
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? "Earned" : ""} +{formatCurrency(incentive.bonusAmount)}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{incentive.progress}/{incentive.target}</span>
          </div>
          <Progress 
            value={progressPercent} 
            className={`h-2 ${isCompleted ? "[&>div]:bg-green-500" : ""}`}
          />
        </div>

        {!isCompleted && !isExpired && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Timer className="h-3 w-3" />
            <span>{formatTimeRemaining(incentive.expiresAt)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DriverIncentiveDashboard({ compact = false }: DriverIncentiveDashboardProps) {
  const { toast } = useToast();
  const [selectedRecommendation, setSelectedRecommendation] = useState<IncentiveRecommendation | null>(null);

  const { data, isLoading } = useQuery<IncentiveData>({
    queryKey: ["/api/phase5/driver/incentives"],
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      return apiRequest(`/api/phase5/driver/incentives/${recommendationId}/accept`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({
        title: "Incentive Activated",
        description: "Track your progress in Active Incentives"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/phase5/driver/incentives"] });
      setSelectedRecommendation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to activate",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Unable to load incentives</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card data-testid="incentive-dashboard-compact">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Earn More Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.totalPotentialEarnings)}
              </p>
              <p className="text-xs text-muted-foreground">Potential</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.activeIncentives.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{data.streakDays}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
          </div>
          {data.recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                {data.recommendations.length} personalized opportunities
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="incentive-dashboard-full">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(data.totalPotentialEarnings)}</p>
            <p className="text-xs text-muted-foreground">Potential Earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.activeIncentives.length}</p>
            <p className="text-xs text-muted-foreground">Active Incentives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.completedThisWeek}</p>
            <p className="text-xs text-muted-foreground">Completed This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.streakDays}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recommendations">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            AI Recommendations ({data.recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({data.activeIncentives.filter(i => i.status === "active").length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="recommendations" className="space-y-3 mt-4">
          {data.recommendations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No new recommendations right now. Keep driving to unlock more!
                </p>
              </CardContent>
            </Card>
          ) : (
            data.recommendations.map(rec => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onAccept={(id) => setSelectedRecommendation(data.recommendations.find(r => r.id === id) || null)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-3 mt-4">
          {data.activeIncentives.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No active incentives. Check recommendations for opportunities!
                </p>
              </CardContent>
            </Card>
          ) : (
            data.activeIncentives.map(incentive => (
              <ActiveIncentiveCard key={incentive.id} incentive={incentive} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRecommendation} onOpenChange={() => setSelectedRecommendation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRecommendation && getIncentiveIcon(selectedRecommendation.type)}
              {selectedRecommendation?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedRecommendation?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedRecommendation && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm font-medium">Potential Earnings</span>
                <span className="text-xl font-bold text-green-600">
                  +{formatCurrency(selectedRecommendation.potentialEarnings)}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Requirements:</p>
                <ul className="space-y-1">
                  {selectedRecommendation.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Expires: {formatTimeRemaining(selectedRecommendation.expiresAt)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSelectedRecommendation(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedRecommendation && acceptMutation.mutate(selectedRecommendation.id)}
              disabled={acceptMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate Incentive"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
