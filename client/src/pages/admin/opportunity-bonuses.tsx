import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Edit, Check, X, Target, TrendingUp, Zap, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OpportunitySetting {
  id: string;
  bonusType: "trip_boost" | "surge_boost" | "peak_hour_boost" | "per_ride_bonus";
  countryCode: string;
  currency: string;
  baseAmount: string;
  promoAmount?: string;
  promoMultiplier?: string;
  zoneId?: string;
  startAt?: string;
  endAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

const bonusTypeLabels: Record<string, string> = {
  trip_boost: "Trip Boost",
  surge_boost: "Surge Boost",
  peak_hour_boost: "Peak Hour Boost",
  per_ride_bonus: "Per-Ride Bonus",
};

const bonusTypeIcons: Record<string, any> = {
  trip_boost: Target,
  surge_boost: TrendingUp,
  peak_hour_boost: Zap,
  per_ride_bonus: DollarSign,
};

export default function AdminOpportunityBonuses() {
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedBonusType, setSelectedBonusType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Fetch opportunity settings
  const { data, isLoading } = useQuery<{ settings: OpportunitySetting[] }>({
    queryKey: ["/api/admin/opportunity-settings"],
  });

  const settings = data?.settings;

  // Filter settings
  const filteredSettings = settings?.filter((setting) => {
    if (selectedCountry !== "all" && setting.countryCode !== selectedCountry) {
      return false;
    }
    if (selectedBonusType !== "all" && setting.bonusType !== selectedBonusType) {
      return false;
    }
    if (selectedStatus !== "all") {
      const now = new Date();
      const isScheduled = setting.startAt && new Date(setting.startAt) > now;
      const isExpired = setting.endAt && new Date(setting.endAt) < now;
      const isActive = setting.isActive && !isExpired && !isScheduled;

      if (selectedStatus === "active" && !isActive) return false;
      if (selectedStatus === "scheduled" && !isScheduled) return false;
      if (selectedStatus === "expired" && !isExpired) return false;
      if (selectedStatus === "inactive" && setting.isActive) return false;
    }
    return true;
  });

  const currencySymbol = (currency: string) => {
    if (currency === "BDT") return "৳";
    if (currency === "USD") return "$";
    return currency;
  };

  const calculateEffectiveBonus = (setting: OpportunitySetting) => {
    const now = new Date();
    const isWithinDateRange =
      (!setting.startAt || new Date(setting.startAt) <= now) &&
      (!setting.endAt || new Date(setting.endAt) >= now);

    if (!isWithinDateRange) {
      return setting.baseAmount;
    }

    if (setting.promoAmount && parseFloat(setting.promoAmount) > parseFloat(setting.baseAmount)) {
      return setting.promoAmount;
    }

    if (setting.promoMultiplier) {
      return (parseFloat(setting.baseAmount) * parseFloat(setting.promoMultiplier)).toFixed(2);
    }

    return setting.baseAmount;
  };

  const getSettingStatus = (setting: OpportunitySetting) => {
    if (!setting.isActive) return "inactive";
    const now = new Date();
    if (setting.startAt && new Date(setting.startAt) > now) return "scheduled";
    if (setting.endAt && new Date(setting.endAt) < now) return "expired";
    return "active";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-back-admin">
                ← Back to Admin Panel
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Opportunity Bonus Management</h1>
            </div>
          </div>
          <Link href="/admin/opportunity-bonuses/create">
            <Button data-testid="button-create-opportunity">
              <Plus className="h-4 w-4 mr-2" />
              Create Opportunity Bonus
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="IN">India</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Bonus Type</label>
              <Select value={selectedBonusType} onValueChange={setSelectedBonusType}>
                <SelectTrigger data-testid="select-bonus-type">
                  <SelectValue placeholder="All Bonus Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bonus Types</SelectItem>
                  <SelectItem value="trip_boost">Trip Boost</SelectItem>
                  <SelectItem value="surge_boost">Surge Boost</SelectItem>
                  <SelectItem value="peak_hour_boost">Peak Hour Boost</SelectItem>
                  <SelectItem value="per_ride_bonus">Per-Ride Bonus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Settings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Opportunity Bonuses
            </CardTitle>
            <CardDescription>
              Manage ride incentives, boost zones, and promotional payout amounts for drivers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSettings && filteredSettings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bonus Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Base Amount</TableHead>
                    <TableHead>Effective Bonus</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSettings.map((setting) => {
                    const effectiveBonus = calculateEffectiveBonus(setting);
                    const hasPromo = effectiveBonus !== setting.baseAmount;
                    const status = getSettingStatus(setting);
                    const BonusIcon = bonusTypeIcons[setting.bonusType] || Target;

                    return (
                      <TableRow key={setting.id} data-testid={`row-opportunity-${setting.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BonusIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {bonusTypeLabels[setting.bonusType]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{setting.countryCode}</TableCell>
                        <TableCell>
                          {currencySymbol(setting.currency)}
                          {setting.baseAmount}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {currencySymbol(setting.currency)}
                          {effectiveBonus}
                          {hasPromo && (
                            <Badge variant="secondary" className="ml-2">
                              Promo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {setting.zoneId ? (
                            <Badge variant="secondary">{setting.zoneId}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">All zones</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {status === "active" && (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          {status === "scheduled" && (
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">
                              Scheduled
                            </Badge>
                          )}
                          {status === "expired" && (
                            <Badge variant="secondary">
                              Expired
                            </Badge>
                          )}
                          {status === "inactive" && (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {setting.startAt && setting.endAt ? (
                            <>
                              {new Date(setting.startAt).toLocaleDateString()} -{" "}
                              {new Date(setting.endAt).toLocaleDateString()}
                            </>
                          ) : setting.startAt ? (
                            `From ${new Date(setting.startAt).toLocaleDateString()}`
                          ) : setting.endAt ? (
                            `Until ${new Date(setting.endAt).toLocaleDateString()}`
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/admin/opportunity-bonuses/${setting.id}/edit`}>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-edit-${setting.id}`}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No opportunity bonuses found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first opportunity bonus to boost driver earnings
                </p>
                <Link href="/admin/opportunity-bonuses/create">
                  <Button data-testid="button-create-first-opportunity">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Opportunity Bonus
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              • <strong>Trip Boost:</strong> General ride incentive for completing trips
            </p>
            <p>
              • <strong>Surge Boost:</strong> Higher payouts during high-demand periods
            </p>
            <p>
              • <strong>Peak Hour Boost:</strong> Bonuses for driving during peak hours
            </p>
            <p>
              • <strong>Per-Ride Bonus:</strong> Fixed amount added to each completed ride
            </p>
            <p>
              • <strong>Zone-Based:</strong> Apply bonuses to specific geographic zones
            </p>
            <p>
              • <strong>Promotional Campaigns:</strong> Temporarily increase bonuses using promo amounts or multipliers
            </p>
            <p>
              • <strong>Date Ranges:</strong> Schedule bonuses for specific time periods
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
