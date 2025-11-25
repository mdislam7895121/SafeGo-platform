import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { 
  Plus, Edit, Play, Pause, Square, Trash2, Gift, Target, 
  TrendingUp, Calendar, Users, DollarSign, ArrowLeft, ChevronRight, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DriverPromotion {
  id: string;
  name: string;
  description?: string;
  type: "PER_TRIP_BONUS" | "QUEST_TRIPS" | "EARNINGS_THRESHOLD";
  serviceType: "RIDES" | "FOOD" | "PARCEL" | "ANY";
  countryCode?: string;
  cityCode?: string;
  minDriverRating?: number;
  requireKycApproved: boolean;
  startAt: string;
  endAt: string;
  rewardPerUnit: number;
  targetTrips?: number;
  targetEarnings?: number;
  maxRewardPerDriver?: number;
  globalBudget?: number;
  currentSpend: number;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  createdAt: string;
  _count: {
    progress: number;
    payouts: number;
  };
}

interface PromotionStats {
  totalPaidOut: number;
  totalPayouts: number;
  participatingDrivers: number;
}

const typeLabels: Record<string, string> = {
  PER_TRIP_BONUS: "Per-Trip Bonus",
  QUEST_TRIPS: "Quest (Complete X Trips)",
  EARNINGS_THRESHOLD: "Earnings Threshold",
};

const typeIcons: Record<string, any> = {
  PER_TRIP_BONUS: DollarSign,
  QUEST_TRIPS: Target,
  EARNINGS_THRESHOLD: TrendingUp,
};

const serviceTypeLabels: Record<string, string> = {
  RIDES: "Rides",
  FOOD: "Food Delivery",
  PARCEL: "Parcel Delivery",
  ANY: "All Services",
};

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  PAUSED: "outline",
  ENDED: "destructive",
};

function formatCurrency(amount: number, country?: string): string {
  if (country === "BD") return `৳${amount.toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

type PromotionType = "PER_TRIP_BONUS" | "QUEST_TRIPS" | "EARNINGS_THRESHOLD";
type ServiceType = "RIDES" | "FOOD" | "PARCEL" | "ANY";
type PromotionStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";

interface PromotionFormData {
  name: string;
  description: string;
  type: PromotionType;
  serviceType: ServiceType;
  countryCode: string;
  cityCode: string;
  minDriverRating: string;
  requireKycApproved: boolean;
  startAt: string;
  endAt: string;
  rewardPerUnit: string;
  targetTrips: string;
  targetEarnings: string;
  maxRewardPerDriver: string;
  globalBudget: string;
  status: PromotionStatus;
}

const initialFormData: PromotionFormData = {
  name: "",
  description: "",
  type: "PER_TRIP_BONUS",
  serviceType: "ANY",
  countryCode: "",
  cityCode: "",
  minDriverRating: "",
  requireKycApproved: true,
  startAt: "",
  endAt: "",
  rewardPerUnit: "",
  targetTrips: "",
  targetEarnings: "",
  maxRewardPerDriver: "",
  globalBudget: "",
  status: "DRAFT",
};

export default function AdminDriverPromotions() {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<DriverPromotion | null>(null);
  
  const [formData, setFormData] = useState<PromotionFormData>(initialFormData);

  const { data, isLoading, refetch } = useQuery<{ 
    promotions: DriverPromotion[]; 
    pagination: { page: number; limit: number; total: number; pages: number } 
  }>({
    queryKey: ["/api/admin/driver-promotions"],
  });

  const promotions = data?.promotions || [];

  const filteredPromotions = promotions.filter((promo) => {
    if (selectedStatus !== "all" && promo.status !== selectedStatus) return false;
    if (selectedType !== "all" && promo.type !== selectedType) return false;
    if (selectedCountry !== "all" && promo.countryCode !== selectedCountry) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("/api/admin/driver-promotions", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          rewardPerUnit: parseFloat(data.rewardPerUnit) || 0,
          targetTrips: data.targetTrips ? parseInt(data.targetTrips) : null,
          targetEarnings: data.targetEarnings ? parseFloat(data.targetEarnings) : null,
          maxRewardPerDriver: data.maxRewardPerDriver ? parseFloat(data.maxRewardPerDriver) : null,
          globalBudget: data.globalBudget ? parseFloat(data.globalBudget) : null,
          minDriverRating: data.minDriverRating ? parseFloat(data.minDriverRating) : null,
          countryCode: data.countryCode || null,
          cityCode: data.cityCode || null,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Promotion created successfully" });
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-promotions"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create promotion", 
        description: error.message || "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/driver-promotions/${id}/activate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Promotion activated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-promotions"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to activate", description: error.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/driver-promotions/${id}/pause`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Promotion paused" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-promotions"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to pause", description: error.message, variant: "destructive" });
    },
  });

  const endMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/driver-promotions/${id}/end`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Promotion ended" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-promotions"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to end", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/driver-promotions/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Promotion deleted" });
      setDeleteDialogOpen(false);
      setSelectedPromotion(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-promotions"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const activeCount = promotions.filter(p => p.status === "ACTIVE").length;
  const totalSpend = promotions.reduce((sum, p) => sum + p.currentSpend, 0);
  const totalParticipants = promotions.reduce((sum, p) => sum + p._count.progress, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-back-admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Driver Promotions & Incentives</h1>
            </div>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-promotion">
                <Plus className="h-4 w-4 mr-2" />
                Create Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Driver Promotion</DialogTitle>
                <DialogDescription>
                  Set up a new promotion or incentive campaign for drivers.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Promotion Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Weekend Quest - Complete 10 Rides"
                      required
                      data-testid="input-promotion-name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the promotion details..."
                      data-testid="input-promotion-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Promotion Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger data-testid="select-promotion-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PER_TRIP_BONUS">Per-Trip Bonus</SelectItem>
                        <SelectItem value="QUEST_TRIPS">Quest (Complete X Trips)</SelectItem>
                        <SelectItem value="EARNINGS_THRESHOLD">Earnings Threshold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="serviceType">Service Type</Label>
                    <Select
                      value={formData.serviceType}
                      onValueChange={(value: any) => setFormData({ ...formData, serviceType: value })}
                    >
                      <SelectTrigger data-testid="select-service-type">
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANY">All Services</SelectItem>
                        <SelectItem value="RIDES">Rides Only</SelectItem>
                        <SelectItem value="FOOD">Food Delivery Only</SelectItem>
                        <SelectItem value="PARCEL">Parcel Delivery Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="countryCode">Country</Label>
                    <Select
                      value={formData.countryCode || "all"}
                      onValueChange={(value) => setFormData({ ...formData, countryCode: value === "all" ? "" : value })}
                    >
                      <SelectTrigger data-testid="select-country-code">
                        <SelectValue placeholder="All Countries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Countries</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="BD">Bangladesh</SelectItem>
                        <SelectItem value="IN">India</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rewardPerUnit">Reward Amount *</Label>
                    <Input
                      id="rewardPerUnit"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.rewardPerUnit}
                      onChange={(e) => setFormData({ ...formData, rewardPerUnit: e.target.value })}
                      placeholder="e.g., 50.00"
                      required
                      data-testid="input-reward-amount"
                    />
                  </div>
                  {formData.type === "QUEST_TRIPS" && (
                    <div>
                      <Label htmlFor="targetTrips">Target Trips *</Label>
                      <Input
                        id="targetTrips"
                        type="number"
                        min="1"
                        value={formData.targetTrips}
                        onChange={(e) => setFormData({ ...formData, targetTrips: e.target.value })}
                        placeholder="e.g., 10"
                        required
                        data-testid="input-target-trips"
                      />
                    </div>
                  )}
                  {formData.type === "EARNINGS_THRESHOLD" && (
                    <div>
                      <Label htmlFor="targetEarnings">Target Earnings *</Label>
                      <Input
                        id="targetEarnings"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.targetEarnings}
                        onChange={(e) => setFormData({ ...formData, targetEarnings: e.target.value })}
                        placeholder="e.g., 200.00"
                        required
                        data-testid="input-target-earnings"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="startAt">Start Date *</Label>
                    <Input
                      id="startAt"
                      type="datetime-local"
                      value={formData.startAt}
                      onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                      required
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endAt">End Date *</Label>
                    <Input
                      id="endAt"
                      type="datetime-local"
                      value={formData.endAt}
                      onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                      required
                      data-testid="input-end-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxRewardPerDriver">Max Reward per Driver</Label>
                    <Input
                      id="maxRewardPerDriver"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.maxRewardPerDriver}
                      onChange={(e) => setFormData({ ...formData, maxRewardPerDriver: e.target.value })}
                      placeholder="No limit"
                      data-testid="input-max-reward"
                    />
                  </div>
                  <div>
                    <Label htmlFor="globalBudget">Global Budget</Label>
                    <Input
                      id="globalBudget"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.globalBudget}
                      onChange={(e) => setFormData({ ...formData, globalBudget: e.target.value })}
                      placeholder="No limit"
                      data-testid="input-global-budget"
                    />
                  </div>
                  <div>
                    <Label htmlFor="minDriverRating">Min Driver Rating</Label>
                    <Input
                      id="minDriverRating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.minDriverRating}
                      onChange={(e) => setFormData({ ...formData, minDriverRating: e.target.value })}
                      placeholder="No minimum"
                      data-testid="input-min-rating"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      id="requireKycApproved"
                      checked={formData.requireKycApproved}
                      onCheckedChange={(checked) => setFormData({ ...formData, requireKycApproved: checked })}
                      data-testid="switch-require-kyc"
                    />
                    <Label htmlFor="requireKycApproved">Require KYC Approved</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Promotion"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Promotions</p>
                  <p className="text-2xl font-bold" data-testid="text-total-promotions">
                    {promotions.length}
                  </p>
                </div>
                <Gift className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-active-promotions">
                    {activeCount}
                  </p>
                </div>
                <Play className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spend</p>
                  <p className="text-2xl font-bold" data-testid="text-total-spend">
                    ${totalSpend.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Participants</p>
                  <p className="text-2xl font-bold" data-testid="text-total-participants">
                    {totalParticipants}
                  </p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <div className="min-w-[150px]">
              <Label className="mb-2 block">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="ENDED">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Label className="mb-2 block">Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger data-testid="filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PER_TRIP_BONUS">Per-Trip Bonus</SelectItem>
                  <SelectItem value="QUEST_TRIPS">Quest</SelectItem>
                  <SelectItem value="EARNINGS_THRESHOLD">Earnings Threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Label className="mb-2 block">Country</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger data-testid="filter-country">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="IN">India</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promotions</CardTitle>
            <CardDescription>
              Manage driver promotions, quests, and incentive campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No promotions found</p>
                <p className="text-sm">Create your first driver promotion to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promotion</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((promo) => {
                    const TypeIcon = typeIcons[promo.type] || Gift;
                    const budgetUsed = promo.globalBudget 
                      ? (promo.currentSpend / promo.globalBudget) * 100 
                      : 0;

                    return (
                      <TableRow key={promo.id} data-testid={`row-promotion-${promo.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <TypeIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{promo.name}</p>
                              {promo.countryCode && (
                                <p className="text-xs text-muted-foreground">
                                  {promo.countryCode === "BD" ? "Bangladesh" : 
                                   promo.countryCode === "US" ? "United States" : promo.countryCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{typeLabels[promo.type]}</Badge>
                        </TableCell>
                        <TableCell>{serviceTypeLabels[promo.serviceType]}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(promo.startAt), "MMM d, yyyy")}</p>
                            <p className="text-muted-foreground">
                              to {format(new Date(promo.endAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {formatCurrency(promo.rewardPerUnit, promo.countryCode || "US")}
                            </p>
                            {promo.type === "QUEST_TRIPS" && promo.targetTrips && (
                              <p className="text-xs text-muted-foreground">
                                for {promo.targetTrips} trips
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-3 w-3" />
                              <span>{promo._count.progress}</span>
                            </div>
                            {promo.globalBudget && (
                              <div>
                                <Progress value={budgetUsed} className="h-1.5" />
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatCurrency(promo.currentSpend, promo.countryCode)} / 
                                  {formatCurrency(promo.globalBudget, promo.countryCode)}
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[promo.status] as any}>
                            {promo.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {promo.status === "DRAFT" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => activateMutation.mutate(promo.id)}
                                disabled={activateMutation.isPending}
                                title="Activate"
                                data-testid={`button-activate-${promo.id}`}
                              >
                                <Play className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {promo.status === "ACTIVE" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => pauseMutation.mutate(promo.id)}
                                disabled={pauseMutation.isPending}
                                title="Pause"
                                data-testid={`button-pause-${promo.id}`}
                              >
                                <Pause className="h-4 w-4 text-yellow-600" />
                              </Button>
                            )}
                            {promo.status === "PAUSED" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => activateMutation.mutate(promo.id)}
                                  disabled={activateMutation.isPending}
                                  title="Resume"
                                  data-testid={`button-resume-${promo.id}`}
                                >
                                  <Play className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => endMutation.mutate(promo.id)}
                                  disabled={endMutation.isPending}
                                  title="End"
                                  data-testid={`button-end-${promo.id}`}
                                >
                                  <Square className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {(promo.status === "DRAFT" || promo._count.payouts === 0) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedPromotion(promo);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Delete"
                                data-testid={`button-delete-${promo.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPromotion?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPromotion && deleteMutation.mutate(selectedPromotion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
