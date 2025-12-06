/**
 * Admin Ride Pricing Config Page
 * 
 * Manage ride pricing rules for BD and US markets with:
 * - View/edit pricing rules per city and vehicle type
 * - Configure base fare, per km/min rates
 * - Set night/peak multipliers
 * - Toggle cash/online payment options
 * - Commission rate management
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Car,
  Bike,
  Truck,
  Crown,
  Moon,
  Zap,
  BanknoteIcon,
  CreditCard,
  Globe,
  MapPin,
  DollarSign,
  Percent,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PricingRule {
  id: string;
  countryCode: string;
  cityCode: string;
  cityName: string;
  vehicleType: string;
  vehicleDisplayName: string;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  minimumFare: number;
  bookingFee: number;
  nightStartHour: number;
  nightEndHour: number;
  nightMultiplier: number;
  peakMultiplier: number;
  peakTimeRanges: string[] | null;
  commissionRate: number;
  currency: string;
  allowCash: boolean;
  allowOnline: boolean;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface PricingRulesResponse {
  success: boolean;
  rules: PricingRule[];
}

const COUNTRIES = [
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "US", name: "United States", currency: "USD" },
];

const VEHICLE_TYPES = [
  { type: "bike", name: "Bike", icon: Bike },
  { type: "cng", name: "CNG Auto", icon: Truck },
  { type: "car_economy", name: "Economy Car", icon: Car },
  { type: "car_premium", name: "Premium Car", icon: Crown },
];

function getVehicleIcon(vehicleType: string) {
  switch (vehicleType) {
    case "bike":
      return <Bike className="h-4 w-4" />;
    case "cng":
      return <Truck className="h-4 w-4" />;
    case "car_premium":
      return <Crown className="h-4 w-4" />;
    default:
      return <Car className="h-4 w-4" />;
  }
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "BDT") {
    return `৳${amount.toLocaleString()}`;
  }
  return `$${amount.toFixed(2)}`;
}

export default function RidePricingConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>("BD");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<PricingRulesResponse>({
    queryKey: ["/api/rides/bd/pricing-rules", selectedCountry, selectedCity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCountry) params.set("countryCode", selectedCountry);
      if (selectedCity) params.set("cityCode", selectedCity);
      const response = await fetch(`/api/rides/bd/pricing-rules?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch pricing rules");
      }
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<PricingRule> & { id: string }) => {
      return apiRequest(`/api/admin/ride-pricing/${updates.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides/bd/pricing-rules"] });
      toast({
        title: "Rule Updated",
        description: "Pricing rule has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update pricing rule",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/admin/ride-pricing/${id}/toggle`, {
        method: "POST",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides/bd/pricing-rules"] });
      toast({
        title: "Status Updated",
        description: "Pricing rule status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const rules = data?.rules || [];
  const cities = [...new Set(rules.map((r) => r.cityCode))];

  const filteredRules = selectedCity
    ? rules.filter((r) => r.cityCode === selectedCity)
    : rules;

  const handleEditRule = (rule: PricingRule) => {
    setEditingRule({ ...rule });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;
    updateMutation.mutate({
      id: editingRule.id,
      baseFare: editingRule.baseFare,
      perKmRate: editingRule.perKmRate,
      perMinRate: editingRule.perMinRate,
      minimumFare: editingRule.minimumFare,
      bookingFee: editingRule.bookingFee,
      nightMultiplier: editingRule.nightMultiplier,
      peakMultiplier: editingRule.peakMultiplier,
      commissionRate: editingRule.commissionRate,
      allowCash: editingRule.allowCash,
      allowOnline: editingRule.allowOnline,
    });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="ride-pricing-config-page">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">Ride Pricing Configuration</h1>
                <p className="text-sm text-muted-foreground">
                  Manage pricing rules for rides across regions
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-[200px]" data-testid="select-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {country.name} ({country.currency})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Select
                  value={selectedCity || "all"}
                  onValueChange={(v) => setSelectedCity(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-city">
                    <SelectValue placeholder="All cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        All Cities
                      </div>
                    </SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Pricing Rules</CardTitle>
              <Badge variant="secondary">{filteredRules.length} rules</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pricing rules found</p>
                <p className="text-sm">Try changing the filters or adding new rules</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Base Fare</TableHead>
                      <TableHead className="text-right">Per Km</TableHead>
                      <TableHead className="text-right">Per Min</TableHead>
                      <TableHead className="text-right">Min Fare</TableHead>
                      <TableHead className="text-center">Night</TableHead>
                      <TableHead className="text-center">Peak</TableHead>
                      <TableHead className="text-center">Payments</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule.id} data-testid={`rule-row-${rule.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getVehicleIcon(rule.vehicleType)}
                            <span className="font-medium">{rule.vehicleDisplayName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.cityCode}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(rule.baseFare, rule.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rule.perKmRate, rule.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rule.perMinRate, rule.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rule.minimumFare, rule.currency)}
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.nightMultiplier > 1 ? (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                              <Moon className="h-3 w-3 mr-1" />
                              ×{rule.nightMultiplier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.peakMultiplier > 1 ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              <Zap className="h-3 w-3 mr-1" />
                              ×{rule.peakMultiplier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {rule.allowCash && (
                              <Badge variant="secondary" className="text-xs">
                                <BanknoteIcon className="h-3 w-3" />
                              </Badge>
                            )}
                            {rule.allowOnline && (
                              <Badge variant="secondary" className="text-xs">
                                <CreditCard className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">
                            <Percent className="h-3 w-3 mr-1" />
                            {rule.commissionRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: rule.id, isActive: checked })
                            }
                            disabled={toggleActiveMutation.isPending}
                            data-testid={`toggle-active-${rule.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                            data-testid={`button-edit-${rule.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold text-green-600">
                  {rules.filter((r) => r.isActive).length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Cities</p>
                <p className="text-2xl font-bold">{cities.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Cash Enabled</p>
                <p className="text-2xl font-bold">
                  {rules.filter((r) => r.allowCash).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRule && getVehicleIcon(editingRule.vehicleType)}
              Edit Pricing Rule
              {editingRule && (
                <Badge variant="outline" className="ml-2">
                  {editingRule.cityCode} - {editingRule.vehicleDisplayName}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {editingRule && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Fare ({editingRule.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRule.baseFare}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, baseFare: parseFloat(e.target.value) || 0 })
                    }
                    data-testid="input-base-fare"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Fare ({editingRule.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRule.minimumFare}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        minimumFare: parseFloat(e.target.value) || 0,
                      })
                    }
                    data-testid="input-min-fare"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Per Km Rate ({editingRule.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRule.perKmRate}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, perKmRate: parseFloat(e.target.value) || 0 })
                    }
                    data-testid="input-per-km"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Per Minute Rate ({editingRule.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRule.perMinRate}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        perMinRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    data-testid="input-per-min"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Booking Fee ({editingRule.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRule.bookingFee}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        bookingFee: parseFloat(e.target.value) || 0,
                      })
                    }
                    data-testid="input-booking-fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingRule.commissionRate}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        commissionRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    data-testid="input-commission"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Night Multiplier
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={editingRule.nightMultiplier}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        nightMultiplier: parseFloat(e.target.value) || 1,
                      })
                    }
                    data-testid="input-night-mult"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Peak Multiplier
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={editingRule.peakMultiplier}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        peakMultiplier: parseFloat(e.target.value) || 1,
                      })
                    }
                    data-testid="input-peak-mult"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editingRule.allowCash}
                    onCheckedChange={(checked) =>
                      setEditingRule({ ...editingRule, allowCash: checked })
                    }
                    data-testid="switch-cash"
                  />
                  <Label className="flex items-center gap-2">
                    <BanknoteIcon className="h-4 w-4" />
                    Allow Cash
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editingRule.allowOnline}
                    onCheckedChange={(checked) =>
                      setEditingRule({ ...editingRule, allowOnline: checked })
                    }
                    data-testid="switch-online"
                  />
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Allow Online
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingRule(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              data-testid="button-save-rule"
            >
              {updateMutation.isPending ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
