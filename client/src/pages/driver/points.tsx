import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Award, TrendingUp, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Tier {
  id: string;
  name: string;
  color: string;
  description: string;
  requiredPoints: number;
  benefits: { id: string; text: string }[];
}

interface PointsData {
  currentTier: Tier;
  totalPoints: number;
  lifetimePoints: number;
  lastEarnedAt: string | null;
  nextTier: {
    name: string;
    requiredPoints: number;
    color: string;
  } | null;
  progressPercentage: number;
  pointsToNextTier: number;
  allTiers: {
    name: string;
    requiredPoints: number;
    color: string;
    isCurrentTier: boolean;
    isUnlocked: boolean;
  }[];
}

export default function DriverPoints() {
  const { data, isLoading } = useQuery<PointsData>({
    queryKey: ["/api/driver/points"],
  });

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load points data</p>
      </div>
    );
  }

  const { currentTier, totalPoints, nextTier, progressPercentage, pointsToNextTier, allTiers } = data;

  return (
    <div className="bg-background min-h-screen">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Current Tier Card */}
        <Card className="border-2" style={{ borderColor: currentTier.color }}>
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Award className="h-8 w-8" style={{ color: currentTier.color }} />
                  <h1 className="text-3xl font-bold" style={{ color: currentTier.color }}>
                    {currentTier.name} Tier
                  </h1>
                </div>
                <p className="text-muted-foreground">{currentTier.description}</p>
              </div>
              <Badge
                variant="outline"
                className="text-lg px-4 py-2"
                style={{ borderColor: currentTier.color, color: currentTier.color }}
                data-testid="badge-total-points"
              >
                <Star className="h-4 w-4 mr-2" />
                {totalPoints} points
              </Badge>
            </div>

            {/* Progress to Next Tier */}
            {nextTier && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Progress to {nextTier.name} tier
                  </span>
                  <span className="font-semibold" style={{ color: nextTier.color }}>
                    {pointsToNextTier} points needed
                  </span>
                </div>
                <Progress
                  value={progressPercentage}
                  className="h-3"
                  data-testid="progress-next-tier"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {progressPercentage}% complete
                </p>
              </div>
            )}

            {!nextTier && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm font-medium">🎉 You've reached the highest tier!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tier Roadmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tier Roadmap</CardTitle>
            <CardDescription>Track your progress across all tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allTiers.map((tier, index) => (
                <div
                  key={tier.name}
                  className="flex items-center gap-4 p-4 rounded-lg border"
                  style={{
                    borderColor: tier.isCurrentTier ? tier.color : "transparent",
                    backgroundColor: tier.isCurrentTier
                      ? `${tier.color}10`
                      : tier.isUnlocked
                      ? "transparent"
                      : "transparent",
                  }}
                  data-testid={`tier-${tier.name.toLowerCase()}`}
                >
                  <div
                    className="flex items-center justify-center h-12 w-12 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: tier.isUnlocked ? `${tier.color}20` : "#F3F4F6",
                    }}
                  >
                    {tier.isUnlocked ? (
                      <Check className="h-6 w-6" style={{ color: tier.color }} />
                    ) : (
                      <span className="text-muted-foreground font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className="font-semibold"
                        style={{ color: tier.isUnlocked ? tier.color : undefined }}
                      >
                        {tier.name}
                      </h3>
                      {tier.isCurrentTier && (
                        <Badge variant="outline" style={{ borderColor: tier.color, color: tier.color }}>
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tier.requiredPoints} points required
                    </p>
                  </div>
                  {tier.isUnlocked ? (
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <span className="text-sm text-muted-foreground flex-shrink-0">Locked</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Tier Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Your Benefits</CardTitle>
            <CardDescription>Perks you enjoy at {currentTier.name} tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentTier.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                  data-testid={`benefit-${benefit.id}`}
                >
                  <Check className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: currentTier.color }} />
                  <p className="text-sm">{benefit.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* How to Earn Points */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">How to Earn Points</CardTitle>
            <CardDescription>Complete trips to accumulate loyalty points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 flex-shrink-0"
              >
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">Complete Trips</h4>
                <p className="text-sm text-muted-foreground">
                  Earn 10 points for every ride you complete. The more trips you complete, the faster you climb
                  tiers and unlock better benefits.
                </p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm">Tips for Earning More Points</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                  <span>Maintain a high acceptance rate to get priority access to trips</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                  <span>Complete trips consistently to maximize your points</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                  <span>Provide excellent service to earn 5-star ratings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                  <span>Stay active during peak hours for bonus opportunities</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
