import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket,
  Plus,
  Copy,
  DollarSign,
  Percent,
  Calendar,
  Users,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountPercentage: number | null;
  discountValue: number | null;
  minOrderAmount: number | null;
  maxDiscountCap: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isFlagged: boolean;
  globalUsageLimit: number | null;
  usageLimitPerCustomer: number | null;
  currentUsageCount: number;
}

interface CouponFormData {
  code: string;
  description: string;
  discountType: string;
  discountPercentage: string;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountCap: string;
  startDate: string;
  endDate: string;
  globalUsageLimit: string;
  usageLimitPerCustomer: string;
}

export default function PromotionsCoupons() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    description: "",
    discountType: "percentage",
    discountPercentage: "",
    discountValue: "",
    minOrderAmount: "",
    maxDiscountCap: "",
    startDate: "",
    endDate: "",
    globalUsageLimit: "",
    usageLimitPerCustomer: "",
  });

  // Fetch coupons
  const { data: couponsData, isLoading } = useQuery<{ coupons: Coupon[] }>({
    queryKey: ["/api/restaurant/coupons"],
  });

  const coupons = couponsData?.coupons || [];
  const activeCoupons = coupons.filter(c => c.isActive && !c.isFlagged);
  const expiredCoupons = coupons.filter(c => {
    const now = new Date();
    const endDate = new Date(c.endDate);
    return endDate < now || !c.isActive;
  });

  // Create coupon mutation
  const createCoupon = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/restaurant/coupons", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/coupons"] });
      toast({ title: "Coupon created successfully" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating coupon",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountPercentage: "",
      discountValue: "",
      minOrderAmount: "",
      maxDiscountCap: "",
      startDate: "",
      endDate: "",
      globalUsageLimit: "",
      usageLimitPerCustomer: "",
    });
  };

  const generateCouponCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleSubmit = () => {
    const payload: any = {
      code: formData.code.toUpperCase(),
      description: formData.description,
      discountType: formData.discountType,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
    };

    // Add required discount field
    if (formData.discountType === "percentage") {
      payload.discountPercentage = parseFloat(formData.discountPercentage);
    } else {
      payload.discountValue = parseFloat(formData.discountValue);
    }

    // Add optional fields
    if (formData.minOrderAmount) payload.minOrderAmount = parseFloat(formData.minOrderAmount);
    if (formData.maxDiscountCap) payload.maxDiscountCap = parseFloat(formData.maxDiscountCap);
    if (formData.globalUsageLimit) payload.globalUsageLimit = parseInt(formData.globalUsageLimit);
    if (formData.usageLimitPerCustomer) payload.usageLimitPerCustomer = parseInt(formData.usageLimitPerCustomer);

    createCoupon.mutate(payload);
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Coupon code copied to clipboard" });
  };

  const renderCouponCard = (coupon: Coupon) => {
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);
    const now = new Date();
    const isExpired = endDate < now;
    const isUpcoming = startDate > now;

    return (
      <Card key={coupon.id} data-testid={`card-coupon-${coupon.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Ticket className="h-4 w-4" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-mono" data-testid={`text-coupon-code-${coupon.id}`}>
                    {coupon.code}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyCouponCode(coupon.code)}
                    data-testid={`button-copy-${coupon.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <CardDescription className="line-clamp-1 mt-1">
                  {coupon.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {coupon.isFlagged && (
                <Badge variant="destructive" data-testid={`badge-flagged-${coupon.id}`}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Flagged
                </Badge>
              )}
              {isUpcoming && (
                <Badge variant="secondary">Upcoming</Badge>
              )}
              {isExpired && (
                <Badge variant="outline">Expired</Badge>
              )}
              {!isExpired && !isUpcoming && coupon.isActive && (
                <Badge variant="default" className="bg-green-600">Active</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <Badge variant="outline" data-testid={`badge-type-${coupon.id}`}>
                {coupon.discountType === "percentage" ? "Percentage" : "Fixed Amount"}
              </Badge>
              {coupon.discountPercentage && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Percent className="h-3 w-3" />
                  <span>{coupon.discountPercentage}% off</span>
                </div>
              )}
              {coupon.discountValue && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>${coupon.discountValue} off</span>
                </div>
              )}
              {coupon.minOrderAmount && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>Min: ${coupon.minOrderAmount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1" data-testid={`text-usage-${coupon.id}`}>
                <Users className="h-3 w-3" />
                <span>
                  {coupon.currentUsageCount}
                  {coupon.globalUsageLimit ? `/${coupon.globalUsageLimit}` : ""} uses
                </span>
              </div>
            </div>

            {coupon.globalUsageLimit && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Usage</span>
                  <span>{Math.round((coupon.currentUsageCount / coupon.globalUsageLimit) * 100)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min((coupon.currentUsageCount / coupon.globalUsageLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coupon Codes</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage discount coupon codes for your customers
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-coupon">
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Coupons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCoupons.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.reduce((sum, c) => sum + c.currentUsageCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredCoupons.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Grid */}
      {coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No coupon codes yet</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Create Your First Coupon
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map(renderCouponCard)}
        </div>
      )}

      {/* Create Coupon Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-coupon">Create Coupon Code</DialogTitle>
            <DialogDescription>
              Generate a new discount coupon code for your customers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SUMMER2024"
                  className="font-mono"
                  data-testid="input-coupon-code"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateCouponCode}
                  data-testid="button-generate-code"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use letters and numbers only, no spaces or special characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this coupon"
                rows={2}
                data-testid="input-coupon-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type *</Label>
              <Select
                value={formData.discountType}
                onValueChange={(value) => setFormData({ ...formData, discountType: value })}
              >
                <SelectTrigger data-testid="select-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Off</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.discountType === "percentage" ? (
              <div className="space-y-2">
                <Label htmlFor="discountPercentage">Discount Percentage * (%)</Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                  placeholder="e.g., 20"
                  min="0"
                  max="100"
                  data-testid="input-coupon-percentage"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="discountValue">Discount Amount * ($)</Label>
                <Input
                  id="discountValue"
                  type="number"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder="e.g., 10.00"
                  min="0"
                  data-testid="input-coupon-amount"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minOrderAmount">Minimum Order ($)</Label>
                <Input
                  id="minOrderAmount"
                  type="number"
                  step="0.01"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  placeholder="e.g., 25.00"
                  data-testid="input-coupon-min-order"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDiscountCap">Max Discount ($)</Label>
                <Input
                  id="maxDiscountCap"
                  type="number"
                  step="0.01"
                  value={formData.maxDiscountCap}
                  onChange={(e) => setFormData({ ...formData, maxDiscountCap: e.target.value })}
                  placeholder="e.g., 50.00"
                  data-testid="input-coupon-max-discount"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-coupon-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-coupon-end-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="globalUsageLimit">Total Usage Limit</Label>
                <Input
                  id="globalUsageLimit"
                  type="number"
                  value={formData.globalUsageLimit}
                  onChange={(e) => setFormData({ ...formData, globalUsageLimit: e.target.value })}
                  placeholder="Unlimited"
                  data-testid="input-coupon-global-limit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usageLimitPerCustomer">Per Customer Limit</Label>
                <Input
                  id="usageLimitPerCustomer"
                  type="number"
                  value={formData.usageLimitPerCustomer}
                  onChange={(e) => setFormData({ ...formData, usageLimitPerCustomer: e.target.value })}
                  placeholder="Unlimited"
                  data-testid="input-coupon-customer-limit"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              data-testid="button-cancel-coupon"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createCoupon.isPending ||
                !formData.code ||
                !formData.startDate ||
                !formData.endDate ||
                (formData.discountType === "percentage" && !formData.discountPercentage) ||
                (formData.discountType === "fixed_amount" && !formData.discountValue)
              }
              data-testid="button-submit-coupon"
            >
              {createCoupon.isPending ? "Creating..." : "Create Coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
