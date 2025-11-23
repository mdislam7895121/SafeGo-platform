import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Tag,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  Clock,
  Percent,
  AlertCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Promotion {
  id: string;
  title: string;
  description: string;
  promoType: string;
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
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  isFirstTimeCustomerOnly: boolean;
}

interface PromotionFormData {
  title: string;
  description: string;
  promoType: string;
  discountPercentage: string;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountCap: string;
  startDate: string;
  endDate: string;
  globalUsageLimit: string;
  usageLimitPerCustomer: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  isFirstTimeCustomerOnly: boolean;
}

export default function PromotionsCampaigns() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);

  const [formData, setFormData] = useState<PromotionFormData>({
    title: "",
    description: "",
    promoType: "percentage_discount",
    discountPercentage: "",
    discountValue: "",
    minOrderAmount: "",
    maxDiscountCap: "",
    startDate: "",
    endDate: "",
    globalUsageLimit: "",
    usageLimitPerCustomer: "",
    timeWindowStart: "",
    timeWindowEnd: "",
    isFirstTimeCustomerOnly: false,
  });

  // Fetch promotions
  const { data: promotionsData, isLoading } = useQuery<{ promotions: Promotion[] }>({
    queryKey: ["/api/restaurant/promotions"],
  });

  const promotions = promotionsData?.promotions || [];
  const activePromotions = promotions.filter(p => p.isActive && !p.isFlagged);
  const scheduledPromotions = promotions.filter(p => {
    const now = new Date();
    const startDate = new Date(p.startDate);
    return p.isActive && !p.isFlagged && startDate > now;
  });
  const expiredPromotions = promotions.filter(p => {
    const now = new Date();
    const endDate = new Date(p.endDate);
    return endDate < now || !p.isActive;
  });

  // Create promotion mutation
  const createPromotion = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/restaurant/promotions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/promotions"] });
      toast({ title: "Promotion created successfully" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating promotion",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Update promotion mutation
  const updatePromotion = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/restaurant/promotions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/promotions"] });
      toast({ title: "Promotion updated successfully" });
      setEditingPromotion(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating promotion",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Delete promotion mutation
  const deletePromotion = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/restaurant/promotions/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/promotions"] });
      toast({ title: "Promotion deleted successfully" });
      setDeletingPromotion(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting promotion",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/restaurant/promotions/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/promotions"] });
      toast({ title: "Status updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating status",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      promoType: "percentage_discount",
      discountPercentage: "",
      discountValue: "",
      minOrderAmount: "",
      maxDiscountCap: "",
      startDate: "",
      endDate: "",
      globalUsageLimit: "",
      usageLimitPerCustomer: "",
      timeWindowStart: "",
      timeWindowEnd: "",
      isFirstTimeCustomerOnly: false,
    });
  };

  const handleOpenEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      title: promotion.title,
      description: promotion.description,
      promoType: promotion.promoType,
      discountPercentage: promotion.discountPercentage?.toString() || "",
      discountValue: promotion.discountValue?.toString() || "",
      minOrderAmount: promotion.minOrderAmount?.toString() || "",
      maxDiscountCap: promotion.maxDiscountCap?.toString() || "",
      startDate: promotion.startDate.split('T')[0],
      endDate: promotion.endDate.split('T')[0],
      globalUsageLimit: promotion.globalUsageLimit?.toString() || "",
      usageLimitPerCustomer: promotion.usageLimitPerCustomer?.toString() || "",
      timeWindowStart: promotion.timeWindowStart || "",
      timeWindowEnd: promotion.timeWindowEnd || "",
      isFirstTimeCustomerOnly: promotion.isFirstTimeCustomerOnly,
    });
  };

  const handleSubmit = () => {
    const payload: any = {
      title: formData.title,
      description: formData.description,
      promoType: formData.promoType,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      isFirstTimeCustomerOnly: formData.isFirstTimeCustomerOnly,
    };

    // Add optional fields
    if (formData.discountPercentage) payload.discountPercentage = parseFloat(formData.discountPercentage);
    if (formData.discountValue) payload.discountValue = parseFloat(formData.discountValue);
    if (formData.minOrderAmount) payload.minOrderAmount = parseFloat(formData.minOrderAmount);
    if (formData.maxDiscountCap) payload.maxDiscountCap = parseFloat(formData.maxDiscountCap);
    if (formData.globalUsageLimit) payload.globalUsageLimit = parseInt(formData.globalUsageLimit);
    if (formData.usageLimitPerCustomer) payload.usageLimitPerCustomer = parseInt(formData.usageLimitPerCustomer);
    if (formData.timeWindowStart) payload.timeWindowStart = formData.timeWindowStart;
    if (formData.timeWindowEnd) payload.timeWindowEnd = formData.timeWindowEnd;

    if (editingPromotion) {
      updatePromotion.mutate({ id: editingPromotion.id, data: payload });
    } else {
      createPromotion.mutate(payload);
    }
  };

  const getPromotionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      percentage_discount: "Percentage Discount",
      fixed_discount: "Fixed Amount Off",
      bogo: "Buy One Get One",
      category_discount: "Category Discount",
      time_window: "Time-Based Discount",
      first_time_customer: "First-Time Customer",
    };
    return labels[type] || type;
  };

  const getPromotionIcon = (type: string) => {
    const icons: Record<string, any> = {
      percentage_discount: Percent,
      fixed_discount: DollarSign,
      bogo: Tag,
      category_discount: Tag,
      time_window: Clock,
      first_time_customer: Users,
    };
    const Icon = icons[type] || Tag;
    return <Icon className="h-4 w-4" />;
  };

  const renderPromotionCard = (promotion: Promotion) => {
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);
    const now = new Date();
    const isScheduled = startDate > now;
    const isExpired = endDate < now;

    return (
      <Card key={promotion.id} data-testid={`card-promotion-${promotion.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              {getPromotionIcon(promotion.promoType)}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg" data-testid={`text-promotion-title-${promotion.id}`}>
                  {promotion.title}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {promotion.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {promotion.isFlagged && (
                <Badge variant="destructive" data-testid={`badge-flagged-${promotion.id}`}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Flagged
                </Badge>
              )}
              {isScheduled && (
                <Badge variant="secondary">Scheduled</Badge>
              )}
              {isExpired && (
                <Badge variant="outline">Expired</Badge>
              )}
              <Switch
                checked={promotion.isActive}
                onCheckedChange={(checked) => 
                  toggleActiveStatus.mutate({ id: promotion.id, isActive: checked })
                }
                disabled={promotion.isFlagged}
                data-testid={`switch-active-${promotion.id}`}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <Badge variant="outline" data-testid={`badge-type-${promotion.id}`}>
                {getPromotionTypeLabel(promotion.promoType)}
              </Badge>
              {promotion.discountPercentage && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Percent className="h-3 w-3" />
                  <span>{promotion.discountPercentage}% off</span>
                </div>
              )}
              {promotion.discountValue && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>${promotion.discountValue} off</span>
                </div>
              )}
              {promotion.minOrderAmount && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>Min: ${promotion.minOrderAmount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1" data-testid={`text-usage-${promotion.id}`}>
                <Users className="h-3 w-3" />
                <span>{promotion.currentUsageCount} uses</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEdit(promotion)}
                data-testid={`button-edit-${promotion.id}`}
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingPromotion(promotion)}
                disabled={promotion.currentUsageCount > 0}
                data-testid={`button-delete-${promotion.id}`}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
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
          <h1 className="text-3xl font-bold">Promotions & Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage promotional campaigns for your restaurant
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-promotion">
          <Plus className="h-4 w-4 mr-2" />
          Create Promotion
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePromotions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledPromotions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Uses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {promotions.reduce((sum, p) => sum + p.currentUsageCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activePromotions.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            Scheduled ({scheduledPromotions.length})
          </TabsTrigger>
          <TabsTrigger value="expired" data-testid="tab-expired">
            Expired ({expiredPromotions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-6">
          {activePromotions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active promotions</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowCreateDialog(true)}
                >
                  Create Your First Promotion
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activePromotions.map(renderPromotionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4 mt-6">
          {scheduledPromotions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No scheduled promotions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scheduledPromotions.map(renderPromotionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-4 mt-6">
          {expiredPromotions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No expired promotions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {expiredPromotions.map(renderPromotionCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || editingPromotion !== null} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingPromotion(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-promotion">
              {editingPromotion ? "Edit Promotion" : "Create Promotion"}
            </DialogTitle>
            <DialogDescription>
              Set up a promotional campaign for your restaurant
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Campaign Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Summer Sale 2024"
                data-testid="input-promotion-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this promotion"
                rows={3}
                data-testid="input-promotion-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promoType">Promotion Type *</Label>
              <Select
                value={formData.promoType}
                onValueChange={(value) => setFormData({ ...formData, promoType: value })}
              >
                <SelectTrigger data-testid="select-promotion-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage_discount">Percentage Discount</SelectItem>
                  <SelectItem value="fixed_discount">Fixed Amount Off</SelectItem>
                  <SelectItem value="bogo">Buy One Get One</SelectItem>
                  <SelectItem value="category_discount">Category Discount</SelectItem>
                  <SelectItem value="time_window">Time-Based Discount</SelectItem>
                  <SelectItem value="first_time_customer">First-Time Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountPercentage">Discount % (if applicable)</Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                  placeholder="e.g., 20"
                  data-testid="input-discount-percentage"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountValue">Discount $ (if applicable)</Label>
                <Input
                  id="discountValue"
                  type="number"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder="e.g., 10.00"
                  data-testid="input-discount-value"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minOrderAmount">Minimum Order Amount ($)</Label>
                <Input
                  id="minOrderAmount"
                  type="number"
                  step="0.01"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  placeholder="e.g., 25.00"
                  data-testid="input-min-order"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDiscountCap">Max Discount Cap ($)</Label>
                <Input
                  id="maxDiscountCap"
                  type="number"
                  step="0.01"
                  value={formData.maxDiscountCap}
                  onChange={(e) => setFormData({ ...formData, maxDiscountCap: e.target.value })}
                  placeholder="e.g., 50.00"
                  data-testid="input-max-discount"
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
                  data-testid="input-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            {formData.promoType === "time_window" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeWindowStart">Start Time (HH:MM)</Label>
                  <Input
                    id="timeWindowStart"
                    type="time"
                    value={formData.timeWindowStart}
                    onChange={(e) => setFormData({ ...formData, timeWindowStart: e.target.value })}
                    data-testid="input-time-start"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeWindowEnd">End Time (HH:MM)</Label>
                  <Input
                    id="timeWindowEnd"
                    type="time"
                    value={formData.timeWindowEnd}
                    onChange={(e) => setFormData({ ...formData, timeWindowEnd: e.target.value })}
                    data-testid="input-time-end"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="globalUsageLimit">Total Usage Limit</Label>
                <Input
                  id="globalUsageLimit"
                  type="number"
                  value={formData.globalUsageLimit}
                  onChange={(e) => setFormData({ ...formData, globalUsageLimit: e.target.value })}
                  placeholder="Leave blank for unlimited"
                  data-testid="input-global-limit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usageLimitPerCustomer">Per Customer Limit</Label>
                <Input
                  id="usageLimitPerCustomer"
                  type="number"
                  value={formData.usageLimitPerCustomer}
                  onChange={(e) => setFormData({ ...formData, usageLimitPerCustomer: e.target.value })}
                  placeholder="Leave blank for unlimited"
                  data-testid="input-customer-limit"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="firstTimeOnly"
                checked={formData.isFirstTimeCustomerOnly}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, isFirstTimeCustomerOnly: checked })
                }
                data-testid="switch-first-time-only"
              />
              <Label htmlFor="firstTimeOnly">First-time customers only</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingPromotion(null);
                resetForm();
              }}
              data-testid="button-cancel-promotion"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createPromotion.isPending || updatePromotion.isPending || !formData.title || !formData.startDate || !formData.endDate}
              data-testid="button-submit-promotion"
            >
              {createPromotion.isPending || updatePromotion.isPending
                ? "Saving..."
                : editingPromotion
                ? "Update Promotion"
                : "Create Promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingPromotion !== null} onOpenChange={(open) => {
        if (!open) setDeletingPromotion(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Promotion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingPromotion?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPromotion(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingPromotion && deletePromotion.mutate(deletingPromotion.id)}
              disabled={deletePromotion.isPending}
              data-testid="button-confirm-delete-promotion"
            >
              {deletePromotion.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
