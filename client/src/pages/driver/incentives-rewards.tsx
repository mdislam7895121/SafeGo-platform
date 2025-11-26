import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Trophy,
  Award,
  Star,
  Medal,
  Shield,
  Crown,
  Gift,
  Calendar,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Zap,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DriverRewardTier = "BRONZE" | "SILVER" | "GOLD";

interface TierReward {
  tier: string;
  name: string;
  color: string;
  benefits: string[];
  minPoints: number;
  isUnlocked: boolean;
  isCurrent: boolean;
  pointsNeeded: number;
}

interface ActivePromotion {
  id: string;
  name: string;
  description: string | null;
  type: string;
  serviceType: string | null;
  startAt: string;
  endAt: string;
  rewardPerUnit: number;
  targetTrips: number | null;
  targetEarnings: number | null;
}

interface RewardHistoryItem {
  id: string;
  rewardType: string;
  tier: string | null;
  amount: number;
  currency: string;
  description: string | null;
  promotionName: string | null;
  isPaid: boolean;
  paidAt: string | null;
  issuedAt: string;
}

interface TierInfo {
  name: string;
  color: string;
  benefits: string[];
  minPoints: number;
}

interface NextTierInfo {
  tier: string;
  name: string;
  pointsNeeded: number;
  benefits: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RewardsData {
  currentTier: DriverRewardTier;
  tierInfo: TierInfo;
  totalPoints: number;
  nextTier: NextTierInfo | null;
  tierRewards: TierReward[];
  activePromotions: ActivePromotion[];
  rewardHistory: RewardHistoryItem[];
  totalEarnedRewards: number;
  pagination: Pagination;
  kycApproved: boolean;
}

const tierConfig: Record<DriverRewardTier, { icon: typeof Medal; color: string; bgColor: string }> = {
  BRONZE: { icon: Medal, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  SILVER: { icon: Shield, color: "text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800/50" },
  GOLD: { icon: Crown, color: "text-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
};

const rewardTypeLabels: Record<string, { label: string; icon: typeof Gift }> = {
  TIER_BONUS: { label: "Tier Bonus", icon: Medal },
  PROMO_BONUS: { label: "Promotion Bonus", icon: Gift },
  ACHIEVEMENT_BONUS: { label: "Achievement Bonus", icon: Trophy },
  INCENTIVE_BONUS: { label: "Incentive Bonus", icon: Zap },
  REFERRAL_BONUS: { label: "Referral Bonus", icon: TrendingUp },
};

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function TierProgressCard({ 
  currentTier, 
  tierInfo, 
  totalPoints, 
  nextTier 
}: { 
  currentTier: DriverRewardTier;
  tierInfo: TierInfo;
  totalPoints: number;
  nextTier: NextTierInfo | null;
}) {
  const { icon: TierIcon, color, bgColor } = tierConfig[currentTier];
  const progressToNext = nextTier 
    ? Math.min(100, Math.round((totalPoints / (totalPoints + nextTier.pointsNeeded)) * 100)) 
    : 100;

  return (
    <Card data-testid="card-tier-progress">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${bgColor}`}>
            <TierIcon className={`h-8 w-8 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg" data-testid="text-current-tier-name">{tierInfo.name} Tier</h3>
              <Badge variant="outline" style={{ borderColor: tierInfo.color, color: tierInfo.color }} data-testid="badge-points">
                {totalPoints} pts
              </Badge>
            </div>
            {nextTier && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress to {nextTier.name}</span>
                  <span data-testid="text-points-needed">{nextTier.pointsNeeded} pts needed</span>
                </div>
                <Progress value={progressToNext} className="h-2" data-testid="progress-tier" />
              </div>
            )}
            {!nextTier && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-max-tier">
                You've reached the highest tier
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TierCard({ tier }: { tier: TierReward }) {
  const tierKey = tier.tier as DriverRewardTier;
  const { icon: TierIcon, color, bgColor } = tierConfig[tierKey] || tierConfig.BRONZE;

  return (
    <Card 
      className={`relative overflow-hidden ${tier.isCurrent ? "border-primary" : tier.isUnlocked ? "" : "opacity-60"}`}
      data-testid={`card-tier-${tier.tier.toLowerCase()}`}
    >
      {tier.isCurrent && (
        <div className="absolute top-2 right-2">
          <Badge data-testid={`badge-current-${tier.tier.toLowerCase()}`}>Current</Badge>
        </div>
      )}
      {tier.isUnlocked && !tier.isCurrent && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={`p-4 rounded-full ${tier.isUnlocked ? bgColor : "bg-muted"}`}>
            <TierIcon className={`h-8 w-8 ${tier.isUnlocked ? color : "text-muted-foreground"}`} />
          </div>
          <div>
            <h3 className="font-semibold" data-testid={`text-tier-name-${tier.tier.toLowerCase()}`}>{tier.name}</h3>
            <p className="text-xs text-muted-foreground">{tier.minPoints}+ points</p>
          </div>
          <div className="space-y-1 w-full">
            {tier.benefits.slice(0, 3).map((benefit, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="truncate">{benefit}</span>
              </div>
            ))}
          </div>
          {!tier.isUnlocked && tier.pointsNeeded > 0 && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-unlock-${tier.tier.toLowerCase()}`}>
              {tier.pointsNeeded} pts to unlock
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PromotionCard({ promotion }: { promotion: ActivePromotion }) {
  const timeLeft = formatDistanceToNow(new Date(promotion.endAt), { addSuffix: true });
  const isEndingSoon = new Date(promotion.endAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <Card className={isEndingSoon ? "border-destructive/50" : ""} data-testid={`card-promotion-${promotion.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm" data-testid={`text-promotion-name-${promotion.id}`}>{promotion.name}</h4>
              {isEndingSoon && (
                <Badge variant="destructive" className="text-xs flex-shrink-0" data-testid={`badge-ending-soon-${promotion.id}`}>
                  Ending Soon
                </Badge>
              )}
            </div>
            {promotion.description && (
              <p className="text-xs text-muted-foreground">{promotion.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {promotion.serviceType && (
                <Badge variant="secondary" className="text-xs">
                  {promotion.serviceType}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {formatCurrency(promotion.rewardPerUnit)}/trip
              </Badge>
              {promotion.targetTrips && (
                <Badge variant="outline" className="text-xs">
                  Target: {promotion.targetTrips} trips
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Ends {timeLeft}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RewardHistoryTable({ history, kycApproved }: { history: RewardHistoryItem[]; kycApproved: boolean }) {
  if (!kycApproved) {
    return (
      <Alert data-testid="alert-kyc-required">
        <Info className="h-4 w-4" />
        <AlertTitle>Verification Required</AlertTitle>
        <AlertDescription>
          Complete your identity verification to view reward history.
        </AlertDescription>
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="empty-rewards-history">
        <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No rewards earned yet</p>
        <p className="text-sm">Complete goals and achievements to earn rewards</p>
      </div>
    );
  }

  return (
    <Table data-testid="table-reward-history">
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((item) => {
          const typeConfig = rewardTypeLabels[item.rewardType] || { label: item.rewardType, icon: Gift };
          const TypeIcon = typeConfig.icon;
          
          return (
            <TableRow key={item.id} data-testid={`row-reward-${item.id}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm" data-testid={`text-reward-type-${item.id}`}>{typeConfig.label}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground" data-testid={`text-reward-desc-${item.id}`}>
                {item.description || item.promotionName || "-"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground" data-testid={`text-reward-date-${item.id}`}>
                {format(new Date(item.issuedAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right font-medium" data-testid={`text-reward-amount-${item.id}`}>
                {formatCurrency(item.amount, item.currency)}
              </TableCell>
              <TableCell>
                <Badge variant={item.isPaid ? "secondary" : "default"} className="text-xs" data-testid={`badge-reward-status-${item.id}`}>
                  {item.isPaid ? "Paid" : "Pending"}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function DriverIncentivesRewards() {
  const { data, isLoading, error } = useQuery<RewardsData>({
    queryKey: ["/api/driver/incentives/rewards"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="loading-rewards">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="spinner-loading" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="error-rewards">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Rewards</AlertTitle>
          <AlertDescription>
            {(error as any)?.message || "Failed to load rewards data. Please try again."}
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
      <div className="flex items-center gap-4">
        <Link href="/driver/incentives">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Medal className="h-6 w-6 text-primary" />
            Rewards & Tiers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View your tier benefits and reward history
          </p>
        </div>
      </div>

      {!data.kycApproved && (
        <Alert data-testid="alert-kyc-warning">
          <Info className="h-4 w-4" />
          <AlertTitle>Complete Verification</AlertTitle>
          <AlertDescription>
            Complete your identity verification to receive reward payouts.
          </AlertDescription>
        </Alert>
      )}

      <TierProgressCard
        currentTier={data.currentTier}
        tierInfo={data.tierInfo}
        totalPoints={data.totalPoints}
        nextTier={data.nextTier}
      />

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Crown className="h-5 w-5 text-muted-foreground" />
          Tier Levels
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {data.tierRewards.map((tier) => (
            <TierCard key={tier.tier} tier={tier} />
          ))}
        </div>
      </div>

      {data.activePromotions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-muted-foreground" />
            Active Promotions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.activePromotions.map((promo) => (
              <PromotionCard key={promo.id} promotion={promo} />
            ))}
          </div>
        </div>
      )}

      <Card data-testid="card-reward-history">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Reward History
              </CardTitle>
              {data.kycApproved && data.totalEarnedRewards > 0 && (
                <CardDescription data-testid="text-total-earned">
                  Total earned: {formatCurrency(data.totalEarnedRewards)}
                </CardDescription>
              )}
            </div>
            {data.pagination.totalPages > 1 && (
              <Badge variant="secondary" data-testid="badge-pagination">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <RewardHistoryTable history={data.rewardHistory} kycApproved={data.kycApproved} />
        </CardContent>
      </Card>
    </div>
  );
}
