import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Edit, Trash2, Check, X, Zap, Percent, DollarSign, Tag, Users, Calendar, MapPin } from "lucide-react";
import { SocialShareButton, formatPromotionForShare, generatePromotionShareUrl } from "@/components/ui/social-share-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RidePromotion {
  id: string;
  name: string;
  description: string | null;
  discountType: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount: number | null;
  appliesTo: "ALL" | "CITY" | "CATEGORY" | "USER_SEGMENT";
  targetCities: string[];
  targetCategories: string[];
  targetUserSegments: string[];
  userRule: "ALL_RIDES" | "FIRST_RIDE" | "N_RIDES";
  rideCountLimit: number | null;
  maxSurgeAllowed: number | null;
  startAt: string;
  endAt: string | null;
  globalUsageLimit: number | null;
  currentUsageCount: number;
  usagePerUserLimit: number | null;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const discountTypeLabels: Record<string, string> = {
  PERCENT: "Percentage",
  FLAT: "Flat Amount",
};

const appliesToLabels: Record<string, string> = {
  ALL: "All Rides",
  CITY: "Specific Cities",
  CATEGORY: "Vehicle Categories",
  USER_SEGMENT: "User Segments",
};

const userRuleLabels: Record<string, string> = {
  ALL_RIDES: "All Rides",
  FIRST_RIDE: "First Ride Only",
  N_RIDES: "Limited Rides",
};

export default function AdminRidePromotions() {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<RidePromotion | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discountType: "PERCENT" as "PERCENT" | "FLAT",
    value: "",
    maxDiscountAmount: "",
    appliesTo: "ALL" as "ALL" | "CITY" | "CATEGORY" | "USER_SEGMENT",
    targetCities: "",
    targetCategories: "",
    userRule: "ALL_RIDES" as "ALL_RIDES" | "FIRST_RIDE" | "N_RIDES",
    rideCountLimit: "",
    startAt: new Date().toISOString().slice(0, 16),
    endAt: "",
    isActive: true,
    isDefault: false,
    priority: "50",
  });

  const { data, isLoading } = useQuery<{ promotions: RidePromotion[] }>({
    queryKey: ["/api/admin/ride-promotions"],
  });

  const promotions = data?.promotions;

  const createMutation = useMutation({
    mutationFn: async (promoData: any) => {
      const response = await apiRequest("/api/admin/ride-promotions", {
        method: "POST",
        body: JSON.stringify(promoData),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ride-promotions"] });
      toast({ title: "Promotion created", description: "The promotion has been created successfully." });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create promotion", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...promoData }: any) => {
      const response = await apiRequest(`/api/admin/ride-promotions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(promoData),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ride-promotions"] });
      toast({ title: "Promotion updated", description: "The promotion has been updated successfully." });
      setEditingPromo(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update promotion", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/admin/ride-promotions/${id}`, {
        method: "DELETE"
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ride-promotions"] });
      toast({ title: "Promotion deleted", description: "The promotion has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete promotion", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest(`/api/admin/ride-promotions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ride-promotions"] });
      toast({ title: "Status updated", description: "Promotion status has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      discountType: "PERCENT",
      value: "",
      maxDiscountAmount: "",
      appliesTo: "ALL",
      targetCities: "",
      targetCategories: "",
      userRule: "ALL_RIDES",
      rideCountLimit: "",
      startAt: new Date().toISOString().slice(0, 16),
      endAt: "",
      isActive: true,
      isDefault: false,
      priority: "50",
    });
  };

  const handleEditPromo = (promo: RidePromotion) => {
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      description: promo.description || "",
      discountType: promo.discountType,
      value: promo.value.toString(),
      maxDiscountAmount: promo.maxDiscountAmount?.toString() || "",
      appliesTo: promo.appliesTo,
      targetCities: promo.targetCities.join(", "),
      targetCategories: promo.targetCategories.join(", "),
      userRule: promo.userRule,
      rideCountLimit: promo.rideCountLimit?.toString() || "",
      startAt: promo.startAt ? new Date(promo.startAt).toISOString().slice(0, 16) : "",
      endAt: promo.endAt ? new Date(promo.endAt).toISOString().slice(0, 16) : "",
      isActive: promo.isActive,
      isDefault: promo.isDefault,
      priority: promo.priority.toString(),
    });
  };

  const handleSubmit = () => {
    const promoData = {
      name: formData.name,
      description: formData.description || null,
      discountType: formData.discountType,
      value: parseFloat(formData.value),
      maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : null,
      appliesTo: formData.appliesTo,
      targetCities: formData.targetCities ? formData.targetCities.split(",").map(c => c.trim()).filter(Boolean) : [],
      targetCategories: formData.targetCategories ? formData.targetCategories.split(",").map(c => c.trim()).filter(Boolean) : [],
      userRule: formData.userRule,
      rideCountLimit: formData.rideCountLimit ? parseInt(formData.rideCountLimit) : null,
      startAt: formData.startAt ? new Date(formData.startAt).toISOString() : new Date().toISOString(),
      endAt: formData.endAt ? new Date(formData.endAt).toISOString() : null,
      isActive: formData.isActive,
      isDefault: formData.isDefault,
      priority: parseInt(formData.priority) || 50,
    };

    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, ...promoData });
    } else {
      createMutation.mutate(promoData);
    }
  };

  const filteredPromotions = promotions?.filter((promo) => {
    if (selectedStatus !== "all") {
      const now = new Date();
      const isExpired = promo.endAt && new Date(promo.endAt) < now;
      const isActive = promo.isActive && !isExpired;

      if (selectedStatus === "active" && !isActive) return false;
      if (selectedStatus === "inactive" && promo.isActive) return false;
      if (selectedStatus === "expired" && !isExpired) return false;
    }
    if (selectedType !== "all" && promo.discountType !== selectedType) return false;
    return true;
  });

  const getPromoStatus = (promo: RidePromotion) => {
    if (!promo.isActive) return "inactive";
    const now = new Date();
    if (promo.endAt && new Date(promo.endAt) < now) return "expired";
    return "active";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDiscount = (promo: RidePromotion) => {
    if (promo.discountType === "PERCENT") {
      return `${promo.value}%${promo.maxDiscountAmount ? ` (max $${promo.maxDiscountAmount})` : ""}`;
    }
    return `$${promo.value}`;
  };

  return (
    <div className="min-h-screen bg-background">
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
              <Zap className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Ride Promotions</h1>
            </div>
          </div>
          <Dialog open={isCreateDialogOpen || !!editingPromo} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingPromo(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-promotion">
                <Plus className="h-4 w-4 mr-2" />
                Create Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPromo ? "Edit Promotion" : "Create New Promotion"}</DialogTitle>
                <DialogDescription>
                  {editingPromo ? "Update the promotion details below." : "Configure a new ride promotion for customers."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Promotion Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Summer Special"
                      data-testid="input-promo-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority (higher = first)</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      placeholder="50"
                      data-testid="input-promo-priority"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the promotion..."
                    className="resize-none"
                    data-testid="input-promo-description"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select value={formData.discountType} onValueChange={(v: "PERCENT" | "FLAT") => setFormData(prev => ({ ...prev, discountType: v }))}>
                      <SelectTrigger data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                        <SelectItem value="FLAT">Flat Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Value</Label>
                    <Input
                      id="value"
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                      placeholder={formData.discountType === "PERCENT" ? "15" : "5.00"}
                      data-testid="input-promo-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDiscount">Max Discount ($)</Label>
                    <Input
                      id="maxDiscount"
                      type="number"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxDiscountAmount: e.target.value }))}
                      placeholder="10.00"
                      data-testid="input-promo-max-discount"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Applies To</Label>
                    <Select value={formData.appliesTo} onValueChange={(v: any) => setFormData(prev => ({ ...prev, appliesTo: v }))}>
                      <SelectTrigger data-testid="select-applies-to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Rides</SelectItem>
                        <SelectItem value="CITY">Specific Cities</SelectItem>
                        <SelectItem value="CATEGORY">Vehicle Categories</SelectItem>
                        <SelectItem value="USER_SEGMENT">User Segments</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>User Rule</Label>
                    <Select value={formData.userRule} onValueChange={(v: any) => setFormData(prev => ({ ...prev, userRule: v }))}>
                      <SelectTrigger data-testid="select-user-rule">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_RIDES">All Rides</SelectItem>
                        <SelectItem value="FIRST_RIDE">First Ride Only</SelectItem>
                        <SelectItem value="N_RIDES">Limited Rides</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.appliesTo === "CITY" && (
                  <div className="space-y-2">
                    <Label htmlFor="targetCities">Target Cities (comma-separated)</Label>
                    <Input
                      id="targetCities"
                      value={formData.targetCities}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetCities: e.target.value }))}
                      placeholder="New York, Los Angeles, Chicago"
                      data-testid="input-target-cities"
                    />
                  </div>
                )}

                {formData.appliesTo === "CATEGORY" && (
                  <div className="space-y-2">
                    <Label htmlFor="targetCategories">Target Categories (comma-separated)</Label>
                    <Input
                      id="targetCategories"
                      value={formData.targetCategories}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetCategories: e.target.value }))}
                      placeholder="SAFEGO_X, SAFEGO_COMFORT, SAFEGO_BLACK"
                      data-testid="input-target-categories"
                    />
                  </div>
                )}

                {formData.userRule === "N_RIDES" && (
                  <div className="space-y-2">
                    <Label htmlFor="rideCountLimit">Maximum Rides per User</Label>
                    <Input
                      id="rideCountLimit"
                      type="number"
                      value={formData.rideCountLimit}
                      onChange={(e) => setFormData(prev => ({ ...prev, rideCountLimit: e.target.value }))}
                      placeholder="5"
                      data-testid="input-ride-count-limit"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startAt">Start Date</Label>
                    <Input
                      id="startAt"
                      type="datetime-local"
                      value={formData.startAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endAt">End Date (optional)</Label>
                    <Input
                      id="endAt"
                      type="datetime-local"
                      value={formData.endAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, endAt: e.target.value }))}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      data-testid="switch-is-active"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isDefault"
                      checked={formData.isDefault}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                      data-testid="switch-is-default"
                    />
                    <Label htmlFor="isDefault">Auto-apply (Default)</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                  setEditingPromo(null);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-promotion"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingPromo ? "Update" : "Create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Discount Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                  <SelectItem value="FLAT">Flat Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promotions</CardTitle>
            <CardDescription>
              Manage ride promotions for customers. Promotions with higher priority are applied first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredPromotions && filteredPromotions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promotion</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Targeting</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((promo) => {
                    const status = getPromoStatus(promo);
                    return (
                      <TableRow key={promo.id} data-testid={`row-promo-${promo.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium flex items-center gap-2">
                              {promo.name}
                              {promo.isDefault && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </span>
                            {promo.description && (
                              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {promo.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {promo.discountType === "PERCENT" ? (
                              <Percent className="h-4 w-4 text-green-500" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-green-500" />
                            )}
                            <span className="font-medium">{formatDiscount(promo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit text-xs">
                              {appliesToLabels[promo.appliesTo]}
                            </Badge>
                            <Badge variant="outline" className="w-fit text-xs">
                              {userRuleLabels[promo.userRule]}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>From: {formatDate(promo.startAt)}</span>
                            <span className="text-muted-foreground">To: {formatDate(promo.endAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{promo.currentUsageCount} uses</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status === "active" ? "default" : status === "expired" ? "destructive" : "secondary"}
                            className={status === "active" ? "bg-green-600" : ""}
                          >
                            {status === "active" && <Check className="h-3 w-3 mr-1" />}
                            {status === "inactive" && <X className="h-3 w-3 mr-1" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(() => {
                              const shareData = formatPromotionForShare(promo);
                              return (
                                <SocialShareButton
                                  title={shareData.title}
                                  description={shareData.description}
                                  url={generatePromotionShareUrl(promo.id, "ride")}
                                  hashtags={shareData.hashtags}
                                  variant="ghost"
                                  size="icon"
                                />
                              );
                            })()}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleStatusMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                              data-testid={`button-toggle-${promo.id}`}
                            >
                              {promo.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPromo(promo)}
                              data-testid={`button-edit-${promo.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this promotion?")) {
                                  deleteMutation.mutate(promo.id);
                                }
                              }}
                              data-testid={`button-delete-${promo.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No promotions found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first ride promotion to attract more customers.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-promo">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Promotion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
