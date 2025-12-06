/**
 * Bangladesh Tax Settings Admin Page
 * 
 * Manage BD VAT tax rules for all 6 service types:
 * - Rides, Food Orders, Parcel Deliveries, Shop Orders, Ticket Bookings, Rental Bookings
 * 
 * Features:
 * - View tax rates per service type
 * - Update VAT percentage (default 15%)
 * - Enable/disable tax per service
 * - Tax calculation preview
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
  Utensils,
  Package,
  ShoppingBag,
  Ticket,
  Building2,
  Percent,
  RefreshCw,
  Calculator,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BdTaxRule {
  id: string;
  serviceType: string;
  serviceDisplayName: string;
  bdTaxType: string;
  bdTaxRatePercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TaxRulesResponse {
  success: boolean;
  rules: BdTaxRule[];
}

interface TaxPreviewResponse {
  success: boolean;
  preview: {
    serviceType: string;
    baseAmount: number;
    bdTaxType: string | null;
    bdTaxRate: number;
    bdTaxAmount: number;
    bdFareBeforeTax: number;
    bdFareAfterTax: number;
  };
}

const SERVICE_ICONS: Record<string, typeof Car> = {
  ride: Car,
  food: Utensils,
  parcel: Package,
  shop: ShoppingBag,
  ticket: Ticket,
  rental: Building2,
};

function getServiceIcon(serviceType: string) {
  const Icon = SERVICE_ICONS[serviceType] || Package;
  return <Icon className="h-4 w-4" />;
}

function getServiceColor(serviceType: string): string {
  const colors: Record<string, string> = {
    ride: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    food: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    parcel: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    shop: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    ticket: "bg-green-500/10 text-green-600 dark:text-green-400",
    rental: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  };
  return colors[serviceType] || "bg-gray-500/10 text-gray-600";
}

export default function BdTaxSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<BdTaxRule | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editRate, setEditRate] = useState<string>("");
  const [editActive, setEditActive] = useState<boolean>(true);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewService, setPreviewService] = useState<string>("ride");
  const [previewAmount, setPreviewAmount] = useState<string>("1000");

  const { data, isLoading, refetch, isFetching } = useQuery<TaxRulesResponse>({
    queryKey: ["/api/admin/bd-tax/rules"],
    queryFn: async () => {
      const response = await fetch("/api/admin/bd-tax/rules", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch BD tax rules");
      }
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ serviceType, updates }: { serviceType: string; updates: { bdTaxRatePercentage?: number; isActive?: boolean } }) => {
      return apiRequest(`/api/admin/bd-tax/rules/${serviceType}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-tax/rules"] });
      toast({
        title: "Tax Rule Updated",
        description: "Bangladesh tax rule has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update tax rule",
        variant: "destructive",
      });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/bd-tax/seed", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bd-tax/rules"] });
      toast({
        title: "Tax Rules Seeded",
        description: "Default Bangladesh tax rules have been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Seed Failed",
        description: error.message || "Failed to seed tax rules",
        variant: "destructive",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ serviceType, baseAmount }: { serviceType: string; baseAmount: number }) => {
      const response = await fetch("/api/admin/bd-tax/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ serviceType, baseAmount }),
      });
      if (!response.ok) {
        throw new Error("Failed to calculate preview");
      }
      return response.json() as Promise<TaxPreviewResponse>;
    },
  });

  const openEditDialog = (rule: BdTaxRule) => {
    setEditingRule(rule);
    setEditRate(rule.bdTaxRatePercentage.toString());
    setEditActive(rule.isActive);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;

    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast({
        title: "Invalid Rate",
        description: "Tax rate must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      serviceType: editingRule.serviceType,
      updates: {
        bdTaxRatePercentage: rate,
        isActive: editActive,
      },
    });
  };

  const toggleActive = (rule: BdTaxRule) => {
    updateMutation.mutate({
      serviceType: rule.serviceType,
      updates: { isActive: !rule.isActive },
    });
  };

  const handlePreview = () => {
    const amount = parseFloat(previewAmount);
    if (isNaN(amount) || amount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    previewMutation.mutate({ serviceType: previewService, baseAmount: amount });
  };

  const rules = data?.rules || [];
  const hasRules = rules.length > 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Bangladesh Tax Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure VAT rates for all SafeGo services in Bangladesh
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewDialogOpen(true)}
            data-testid="button-preview-tax"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Tax Preview
          </Button>
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
          {!hasRules && (
            <Button
              variant="default"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-rules"
            >
              Initialize Rules
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
              BD
            </Badge>
            <CardTitle>Tax Rules</CardTitle>
          </div>
          <CardDescription>
            Bangladesh applies 15% VAT to all services by default. Configure rates per service type below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !hasRules ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tax Rules Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Initialize Rules" to create default tax rules for all services
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Tax Type</TableHead>
                  <TableHead className="text-right">Rate (%)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} data-testid={`row-tax-rule-${rule.serviceType}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getServiceColor(rule.serviceType)}`}>
                          {getServiceIcon(rule.serviceType)}
                        </div>
                        <div>
                          <div className="font-medium">{rule.serviceDisplayName}</div>
                          <div className="text-xs text-muted-foreground">{rule.serviceType}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {rule.bdTaxType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-lg font-semibold">
                        {rule.bdTaxRatePercentage}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => toggleActive(rule)}
                        data-testid={`switch-active-${rule.serviceType}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(rule)}
                        data-testid={`button-edit-${rule.serviceType}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Tax Calculation Formula</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
            <div className="mb-2">
              <span className="text-muted-foreground">Tax Amount</span> = Base Amount × (Tax Rate / 100)
            </div>
            <div>
              <span className="text-muted-foreground">Total After Tax</span> = Base Amount + Tax Amount
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Example: For a ৳1,000 ride with 15% VAT:
            <br />
            Tax = ৳1,000 × 0.15 = ৳150
            <br />
            Total = ৳1,000 + ৳150 = ৳1,150
          </p>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tax Rule</DialogTitle>
            <DialogDescription>
              {editingRule && `Configure ${editingRule.serviceDisplayName} tax settings`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                {editingRule && getServiceIcon(editingRule.serviceType)}
                <span className="font-medium">{editingRule?.serviceDisplayName}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">VAT Rate (%)</Label>
              <div className="relative">
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="pr-8"
                  data-testid="input-tax-rate"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Tax Active</Label>
              <Switch
                id="active"
                checked={editActive}
                onCheckedChange={setEditActive}
                data-testid="switch-edit-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tax Calculator Preview</DialogTitle>
            <DialogDescription>
              Calculate tax for any service and amount
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={previewService} onValueChange={setPreviewService}>
                <SelectTrigger data-testid="select-preview-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ride">Rides</SelectItem>
                  <SelectItem value="food">Food Orders</SelectItem>
                  <SelectItem value="parcel">Parcel Deliveries</SelectItem>
                  <SelectItem value="shop">Shop Orders</SelectItem>
                  <SelectItem value="ticket">Ticket Bookings</SelectItem>
                  <SelectItem value="rental">Rental Bookings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="previewAmount">Base Amount (BDT)</Label>
              <Input
                id="previewAmount"
                type="number"
                min="0"
                value={previewAmount}
                onChange={(e) => setPreviewAmount(e.target.value)}
                data-testid="input-preview-amount"
              />
            </div>
            <Button
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="w-full"
              data-testid="button-calculate-preview"
            >
              {previewMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Calculate
            </Button>

            {previewMutation.data?.preview && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Amount</span>
                  <span className="font-medium">৳{previewMutation.data.preview.bdFareBeforeTax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Rate</span>
                  <span className="font-medium">{previewMutation.data.preview.bdTaxRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Amount</span>
                  <span className="font-medium text-orange-600">+৳{previewMutation.data.preview.bdTaxAmount.toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">৳{previewMutation.data.preview.bdFareAfterTax.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewDialogOpen(false)}
              data-testid="button-close-preview"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
