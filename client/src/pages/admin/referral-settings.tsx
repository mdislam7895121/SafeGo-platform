import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Edit, Trash2, Check, X, Gift, DollarSign } from "lucide-react";
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

interface ReferralSetting {
  id: string;
  countryCode: string;
  userType: "driver" | "customer" | "restaurant";
  currency: string;
  baseAmount: string;
  promoAmount?: string;
  promoMultiplier?: string;
  promoLabel?: string;
  startAt?: string;
  endAt?: string;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminReferralSettings() {
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedUserType, setSelectedUserType] = useState<string>("all");

  // Fetch referral settings
  const { data: settings, isLoading } = useQuery<ReferralSetting[]>({
    queryKey: ["/api/admin/referral-settings"],
  });

  // Filter settings
  const filteredSettings = settings?.filter((setting) => {
    if (selectedCountry !== "all" && setting.countryCode !== selectedCountry) {
      return false;
    }
    if (selectedUserType !== "all" && setting.userType !== selectedUserType) {
      return false;
    }
    return true;
  });

  const currencySymbol = (currency: string) => {
    if (currency === "BDT") return "৳";
    if (currency === "USD") return "$";
    return currency;
  };

  const calculateEffectiveBonus = (setting: ReferralSetting) => {
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
              <Gift className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Referral Bonus Management</h1>
            </div>
          </div>
          <Link href="/admin/referral-settings/create">
            <Button data-testid="button-create-setting">
              <Plus className="h-4 w-4 mr-2" />
              Create Setting
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
              <label className="text-sm font-medium mb-2 block">User Type</label>
              <Select value={selectedUserType} onValueChange={setSelectedUserType}>
                <SelectTrigger data-testid="select-user-type">
                  <SelectValue placeholder="All User Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All User Types</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Settings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Referral Settings
            </CardTitle>
            <CardDescription>
              Manage referral bonus amounts and promotional campaigns for each country and user type
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
                    <TableHead>Country</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Base Amount</TableHead>
                    <TableHead>Effective Bonus</TableHead>
                    <TableHead>Promo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSettings.map((setting) => {
                    const effectiveBonus = calculateEffectiveBonus(setting);
                    const hasPromo = effectiveBonus !== setting.baseAmount;

                    return (
                      <TableRow key={setting.id} data-testid={`row-setting-${setting.id}`}>
                        <TableCell className="font-medium">
                          {setting.countryCode}
                        </TableCell>
                        <TableCell className="capitalize">{setting.userType}</TableCell>
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
                          {setting.promoLabel ? (
                            <span className="text-sm text-muted-foreground">
                              {setting.promoLabel}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {setting.isActive ? (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/admin/referral-settings/${setting.id}/edit`}>
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
                <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No referral settings found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first referral bonus setting to get started
                </p>
                <Link href="/admin/referral-settings/create">
                  <Button data-testid="button-create-first-setting">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Setting
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
              • <strong>Base Amount:</strong> The default referral bonus amount for the country and user type
            </p>
            <p>
              • <strong>Promotional Campaigns:</strong> Temporarily increase bonuses using promo amounts or multipliers
            </p>
            <p>
              • <strong>Effective Bonus:</strong> The actual amount displayed to users (base or promo, whichever applies)
            </p>
            <p>
              • <strong>Date Range:</strong> Set start and end dates for promotional campaigns
            </p>
            <p>
              • <strong>Active Status:</strong> Only active settings are displayed to users
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
