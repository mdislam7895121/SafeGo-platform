import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Trophy,
  Target,
  TrendingUp,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
  Zap,
  Award,
  Medal,
  Crown,
  CheckCircle2,
  Star,
  Shield,
  Calendar,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type GoalPeriod = "daily" | "weekly" | "monthly";
type DriverRewardTier = "BRONZE" | "SILVER" | "GOLD";

interface GoalProgress {
  current: number;
  target: number;
  progress: number;
}

interface GoalSet {
  trips: GoalProgress;
  earnings: GoalProgress | null;
}

interface Milestone {
  type: string;
  current: number;
  target: number;
  progress: number;
  description: string;
  expiresAt: string;
}

interface IncentiveCycle {
  id: string;
  period: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  progress: number;
  bonusAmount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: string;
}

interface TierInfo {
  name: string;
  color: string;
  benefits: string[];
  minPoints: number;
}

interface IncentivesData {
  goals: {
    daily: GoalSet;
    weekly: GoalSet;
    monthly: GoalSet;
  };
  upcomingMilestones: Milestone[];
  activeCycles: IncentiveCycle[];
  currentTier: DriverRewardTier;
  tierInfo: TierInfo;
  totalPoints: number;
  kycApproved: boolean;
}

const tierConfig: Record<DriverRewardTier, { icon: typeof Medal; color: string; bgColor: string }> = {
  BRONZE: { icon: Medal, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  SILVER: { icon: Shield, color: "text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800/50" },
  GOLD: { icon: Crown, color: "text-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function GoalCard({ 
  title, 
  period,
  goals, 
  kycApproved 
}: { 
  title: string;
  period: GoalPeriod;
  goals: GoalSet;
  kycApproved: boolean;
}) {
  const periodLabels: Record<GoalPeriod, { time: string; icon: typeof Clock }> = {
    daily: { time: "Today", icon: Clock },
    weekly: { time: "This Week", icon: Calendar },
    monthly: { time: "This Month", icon: Calendar },
  };

  const { time, icon: TimeIcon } = periodLabels[period];

  return (
    <Card className="overflow-hidden" data-testid={`card-goal-${period}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TimeIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {time}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Trips</span>
            <span className="font-medium" data-testid={`text-trips-${period}`}>
              {goals.trips.current} / {goals.trips.target}
            </span>
          </div>
          <Progress value={goals.trips.progress} className="h-2" data-testid={`progress-trips-${period}`} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid={`text-trips-progress-${period}`}>{goals.trips.progress}% complete</span>
            {goals.trips.current >= goals.trips.target && (
              <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-goal-reached-${period}`}>
                <CheckCircle2 className="h-3 w-3" />
                Goal Reached
              </Badge>
            )}
          </div>
        </div>

        {kycApproved && goals.earnings && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Earnings</span>
              <span className="font-medium" data-testid={`text-earnings-${period}`}>
                {formatCurrency(goals.earnings.current)} / {formatCurrency(goals.earnings.target)}
              </span>
            </div>
            <Progress value={goals.earnings.progress} className="h-2" data-testid={`progress-earnings-${period}`} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span data-testid={`text-earnings-progress-${period}`}>{goals.earnings.progress}% complete</span>
              {goals.earnings.current >= goals.earnings.target && (
                <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-earnings-reached-${period}`}>
                  <CheckCircle2 className="h-3 w-3" />
                  Goal Reached
                </Badge>
              )}
            </div>
          </div>
        )}

        {!kycApproved && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Complete verification to track earnings goals
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneCard({ milestone, index }: { milestone: Milestone; index: number }) {
  const timeLeft = formatDistanceToNow(new Date(milestone.expiresAt), { addSuffix: true });
  const isUrgent = milestone.progress >= 70 && new Date(milestone.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <Card className={isUrgent ? "border-primary" : ""} data-testid={`card-milestone-${index}`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm" data-testid={`text-milestone-${index}`}>{milestone.description}</p>
              {isUrgent && (
                <Badge variant="destructive" className="text-xs flex-shrink-0" data-testid={`badge-urgent-${index}`}>
                  Ending Soon
                </Badge>
              )}
            </div>
            <Progress value={milestone.progress} className="h-2" data-testid={`progress-milestone-${index}`} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span data-testid={`text-milestone-progress-${index}`}>
                {milestone.current} / {milestone.target} ({milestone.progress}%)
              </span>
              <span className="flex items-center gap-1" data-testid={`text-milestone-expires-${index}`}>
                <Clock className="h-3 w-3" />
                Ends {timeLeft}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TierStatusCard({ tier, tierInfo, totalPoints }: { tier: DriverRewardTier; tierInfo: TierInfo; totalPoints: number }) {
  const { icon: TierIcon, color, bgColor } = tierConfig[tier];
  const nextTierPoints: Record<DriverRewardTier, number | null> = {
    BRONZE: 500,
    SILVER: 1500,
    GOLD: null,
  };
  const nextTier = nextTierPoints[tier];
  const progressToNext = nextTier ? Math.min(100, Math.round((totalPoints / nextTier) * 100)) : 100;

  return (
    <Card data-testid="card-tier-status">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${bgColor}`}>
            <TierIcon className={`h-8 w-8 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg" data-testid="text-tier-name">{tierInfo.name} Tier</h3>
              <Badge variant="outline" style={{ borderColor: tierInfo.color, color: tierInfo.color }} data-testid="badge-total-points">
                {totalPoints} pts
              </Badge>
            </div>
            {nextTier && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress to next tier</span>
                  <span>{nextTier - totalPoints} pts needed</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
              </div>
            )}
            {!nextTier && (
              <p className="text-sm text-muted-foreground mt-1">
                You've reached the highest tier
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t" data-testid="section-tier-benefits">
          <p className="text-xs font-medium text-muted-foreground mb-2">Your Benefits:</p>
          <div className="flex flex-wrap gap-1.5">
            {tierInfo.benefits.slice(0, 3).map((benefit, i) => (
              <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-benefit-${i}`}>
                {benefit}
              </Badge>
            ))}
            {tierInfo.benefits.length > 3 && (
              <Badge variant="outline" className="text-xs" data-testid="badge-more-benefits">
                +{tierInfo.benefits.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveCycleCard({ cycle }: { cycle: IncentiveCycle }) {
  const timeLeft = formatDistanceToNow(new Date(cycle.periodEnd), { addSuffix: true });
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid={`card-cycle-${cycle.id}`}>
      <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
        <Zap className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm truncate" data-testid={`text-cycle-name-${cycle.id}`}>
            {cycle.period} {cycle.goalType.toLowerCase()} goal
          </p>
          <Badge variant="outline" className="text-xs flex-shrink-0" data-testid={`badge-cycle-bonus-${cycle.id}`}>
            {formatCurrency(cycle.bonusAmount)} bonus
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-1">
          <Progress value={cycle.progress} className="flex-1 h-1.5 mr-3" data-testid={`progress-cycle-${cycle.id}`} />
          <span className="text-xs text-muted-foreground" data-testid={`text-cycle-progress-${cycle.id}`}>{cycle.progress}%</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-cycle-details-${cycle.id}`}>
          {cycle.currentValue} / {cycle.targetValue} • Ends {timeLeft}
        </p>
      </div>
    </div>
  );
}

export default function DriverIncentives() {
  const { data, isLoading, error } = useQuery<IncentivesData>({
    queryKey: ["/api/driver/incentives"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="loading-incentives">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="spinner-loading" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Incentives</AlertTitle>
          <AlertDescription>
            {(error as any)?.message || "Failed to load incentives data. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Trophy className="h-6 w-6 text-primary" />
            Incentives & Milestones
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your goals, unlock achievements, and earn rewards
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/driver/incentives/achievements">
            <Button variant="outline" size="sm" data-testid="link-achievements">
              <Award className="h-4 w-4 mr-2" />
              Achievements
            </Button>
          </Link>
          <Link href="/driver/incentives/rewards">
            <Button variant="outline" size="sm" data-testid="link-rewards">
              <Medal className="h-4 w-4 mr-2" />
              Rewards
            </Button>
          </Link>
        </div>
      </div>

      {!data.kycApproved && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Complete Verification</AlertTitle>
          <AlertDescription>
            Complete your identity verification to unlock earnings goals and bonus payouts.{" "}
            <Link href="/driver/documents" className="inline-flex items-center text-primary hover:underline" data-testid="link-verify-now">
              Verify Now
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <TierStatusCard 
        tier={data.currentTier} 
        tierInfo={data.tierInfo} 
        totalPoints={data.totalPoints} 
      />

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          Your Goals
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <GoalCard 
            title="Daily Goal" 
            period="daily"
            goals={data.goals.daily} 
            kycApproved={data.kycApproved}
          />
          <GoalCard 
            title="Weekly Goal" 
            period="weekly"
            goals={data.goals.weekly} 
            kycApproved={data.kycApproved}
          />
          <GoalCard 
            title="Monthly Goal" 
            period="monthly"
            goals={data.goals.monthly} 
            kycApproved={data.kycApproved}
          />
        </div>
      </div>

      {data.upcomingMilestones.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Upcoming Milestones
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.upcomingMilestones.map((milestone, i) => (
              <MilestoneCard key={i} milestone={milestone} index={i} />
            ))}
          </div>
        </div>
      )}

      {data.activeCycles.length > 0 && (
        <Card data-testid="card-active-cycles">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Active Incentive Cycles
              </CardTitle>
              <Badge variant="secondary" data-testid="badge-active-cycles">{data.activeCycles.length} active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activeCycles.map((cycle) => (
              <ActiveCycleCard key={cycle.id} cycle={cycle} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/driver/incentives/achievements" data-testid="link-achievements-card">
          <Card className="hover-elevate cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Achievements</h3>
                  <p className="text-sm text-muted-foreground">
                    View and unlock achievement badges
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/driver/incentives/rewards" data-testid="link-rewards-card">
          <Card className="hover-elevate cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Medal className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Rewards & Promotions</h3>
                  <p className="text-sm text-muted-foreground">
                    View tier rewards and active promotions
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
