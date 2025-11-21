import { Gift, TrendingUp, Clock, MapPin, Target, Zap, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

interface OpportunityBonus {
  bonusType: "trip_boost" | "surge_boost" | "peak_hour_boost" | "per_ride_bonus";
  baseAmount: string;
  effectiveBonus: string;
  currency: string;
  currencySymbol: string;
  isPromoActive: boolean;
  zoneId?: string;
  startAt?: string;
  endAt?: string;
}

const bonusTypeLabels: Record<string, string> = {
  trip_boost: "Trip Boost",
  surge_boost: "Surge Boost",
  peak_hour_boost: "Peak Hour Boost",
  per_ride_bonus: "Per-Ride Bonus",
};

const bonusTypeDescriptions: Record<string, string> = {
  trip_boost: "General ride incentive for completing trips",
  surge_boost: "Higher payouts during high-demand periods",
  peak_hour_boost: "Bonuses for driving during peak hours",
  per_ride_bonus: "Fixed amount added to each completed ride",
};

const bonusTypeIcons: Record<string, any> = {
  trip_boost: Target,
  surge_boost: TrendingUp,
  peak_hour_boost: Clock,
  per_ride_bonus: DollarSign,
};

export default function DriverPromotions() {
  // Fetch opportunity bonuses
  const { data: bonusData, isLoading } = useQuery<{ bonuses: OpportunityBonus[] }>({
    queryKey: ["/api/driver/opportunity-bonuses"],
  });

  const bonuses = bonusData?.bonuses || [];

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 ">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Promotions</h1>
        </div>
        <p className="text-sm opacity-90">Active bonuses and special offers</p>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : bonuses.length > 0 ? (
          bonuses.map((bonus, index) => {
            const BonusIcon = bonusTypeIcons[bonus.bonusType] || Gift;
            return (
              <Card key={index} className="border-l-4 border-l-purple-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
                        <BonusIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{bonusTypeLabels[bonus.bonusType]}</CardTitle>
                        <CardDescription className="mt-1">
                          {bonusTypeDescriptions[bonus.bonusType]}
                          {bonus.zoneId && (
                            <Badge variant="secondary" className="ml-2">
                              {bonus.zoneId}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0 ml-2">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Bonus</p>
                      <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                        {bonus.currencySymbol}{bonus.effectiveBonus}
                        {bonus.isPromoActive && (
                          <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                            Promo
                          </Badge>
                        )}
                      </p>
                      {bonus.isPromoActive && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Base: {bonus.currencySymbol}{bonus.baseAmount}
                        </p>
                      )}
                    </div>
                    {bonus.endAt && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {bonus.isPromoActive ? "Promo Ends" : "Ends"}
                        </p>
                        <p className="text-sm font-medium">
                          {new Date(bonus.endAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Active Promotions</h3>
              <p className="text-sm text-muted-foreground">
                Check back later for new bonuses and special offers
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
