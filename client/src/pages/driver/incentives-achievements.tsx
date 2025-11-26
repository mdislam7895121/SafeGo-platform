import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Trophy,
  Award,
  Star,
  Medal,
  Shield,
  Zap,
  Rocket,
  Crown,
  Sun,
  Moon,
  Calendar,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AchievementType = 
  | "FIRST_TRIP" 
  | "HUNDRED_RIDES" 
  | "THOUSAND_TRIPS" 
  | "FIVE_STAR_WEEK" 
  | "FIVE_STAR_MONTH" 
  | "ZERO_CANCEL_STREAK" 
  | "WEEKLY_PRO_DRIVER" 
  | "EARLY_BIRD" 
  | "NIGHT_OWL" 
  | "PERFECT_STREAK_10" 
  | "LOYALTY_30_DAYS" 
  | "LOYALTY_90_DAYS";

interface Achievement {
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  requiredCount: number;
  bonusAmount: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
  progressCount: number;
  progress: number;
  bonusPaid: boolean;
}

interface AchievementsSummary {
  unlocked: number;
  total: number;
  totalBonusEarned: number;
  progress: number;
}

interface AchievementsData {
  achievements: Achievement[];
  summary: AchievementsSummary;
  kycApproved: boolean;
}

const iconMap: Record<string, typeof Trophy> = {
  rocket: Rocket,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  crown: Crown,
  "shield-check": Shield,
  "badge-check": Award,
  sunrise: Sun,
  moon: Moon,
  zap: Zap,
  calendar: Calendar,
  award: Award,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function AchievementCard({ achievement, kycApproved }: { achievement: Achievement; kycApproved: boolean }) {
  const IconComponent = iconMap[achievement.icon] || Trophy;
  const isComplete = achievement.isUnlocked;

  return (
    <Card 
      className={`relative overflow-hidden transition-all ${isComplete ? "bg-primary/5 border-primary/30" : ""}`}
      data-testid={`card-achievement-${achievement.type.toLowerCase()}`}
    >
      {isComplete && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="h-5 w-5 text-primary" data-testid={`icon-unlocked-${achievement.type.toLowerCase()}`} />
        </div>
      )}
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={`p-4 rounded-full ${isComplete ? "bg-primary/20" : "bg-muted"}`}>
            {isComplete ? (
              <IconComponent className="h-8 w-8 text-primary" />
            ) : (
              <div className="relative">
                <IconComponent className="h-8 w-8 text-muted-foreground/50" />
                <Lock className="h-4 w-4 absolute -bottom-1 -right-1 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className={`font-semibold ${isComplete ? "" : "text-muted-foreground"}`} data-testid={`text-achievement-name-${achievement.type.toLowerCase()}`}>
              {achievement.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {achievement.description}
            </p>
          </div>

          {!isComplete && (
            <div className="w-full space-y-1">
              <Progress value={achievement.progress} className="h-2" data-testid={`progress-achievement-${achievement.type.toLowerCase()}`} />
              <p className="text-xs text-muted-foreground" data-testid={`text-progress-${achievement.type.toLowerCase()}`}>
                {achievement.progressCount} / {achievement.requiredCount}
              </p>
            </div>
          )}

          {isComplete && achievement.unlockedAt && (
            <p className="text-xs text-muted-foreground" data-testid={`text-unlocked-date-${achievement.type.toLowerCase()}`}>
              Unlocked {format(new Date(achievement.unlockedAt), "MMM d, yyyy")}
            </p>
          )}

          {kycApproved && achievement.bonusAmount > 0 && (
            <Badge 
              variant={isComplete && achievement.bonusPaid ? "secondary" : isComplete ? "default" : "outline"}
              className="text-xs"
              data-testid={`badge-bonus-${achievement.type.toLowerCase()}`}
            >
              {isComplete && achievement.bonusPaid ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {formatCurrency(achievement.bonusAmount)} Paid
                </>
              ) : isComplete ? (
                <>{formatCurrency(achievement.bonusAmount)} Bonus</>
              ) : (
                <>{formatCurrency(achievement.bonusAmount)} Reward</>
              )}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ summary, kycApproved }: { summary: AchievementsSummary; kycApproved: boolean }) {
  return (
    <Card data-testid="card-achievements-summary">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Achievement Progress</h3>
              <Badge variant="secondary" data-testid="badge-achievements-count">
                {summary.unlocked} / {summary.total}
              </Badge>
            </div>
            <div className="mt-2 space-y-1">
              <Progress value={summary.progress} className="h-2" data-testid="progress-achievements" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span data-testid="text-achievements-progress">{summary.progress}% complete</span>
                {kycApproved && summary.totalBonusEarned > 0 && (
                  <span className="font-medium text-primary" data-testid="text-total-bonus-earned">
                    {formatCurrency(summary.totalBonusEarned)} earned
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriverIncentivesAchievements() {
  const { data, isLoading, error } = useQuery<AchievementsData>({
    queryKey: ["/api/driver/incentives/achievements"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="loading-achievements">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="spinner-loading" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="error-achievements">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Achievements</AlertTitle>
          <AlertDescription>
            {(error as any)?.message || "Failed to load achievements data. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const unlockedAchievements = data.achievements.filter(a => a.isUnlocked);
  const lockedAchievements = data.achievements.filter(a => !a.isUnlocked);
  const inProgressAchievements = lockedAchievements.filter(a => a.progress > 0);
  const notStartedAchievements = lockedAchievements.filter(a => a.progress === 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/driver/incentives">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Award className="h-6 w-6 text-primary" />
            Achievements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Unlock badges and earn bonus rewards
          </p>
        </div>
      </div>

      {!data.kycApproved && (
        <Alert data-testid="alert-kyc-warning">
          <Info className="h-4 w-4" />
          <AlertTitle>Complete Verification</AlertTitle>
          <AlertDescription>
            Complete your identity verification to unlock achievement bonuses.
          </AlertDescription>
        </Alert>
      )}

      <SummaryCard summary={data.summary} kycApproved={data.kycApproved} />

      {unlockedAchievements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Unlocked ({unlockedAchievements.length})
          </h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {unlockedAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.type}
                achievement={achievement}
                kycApproved={data.kycApproved}
              />
            ))}
          </div>
        </div>
      )}

      {inProgressAchievements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            In Progress ({inProgressAchievements.length})
          </h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {inProgressAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.type}
                achievement={achievement}
                kycApproved={data.kycApproved}
              />
            ))}
          </div>
        </div>
      )}

      {notStartedAchievements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Locked ({notStartedAchievements.length})
          </h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {notStartedAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.type}
                achievement={achievement}
                kycApproved={data.kycApproved}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
