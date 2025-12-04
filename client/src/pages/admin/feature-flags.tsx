import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Search, Filter, ToggleLeft, ToggleRight, Globe, MapPin, User, Truck, Settings2, Trash2, Edit2, CheckCircle, XCircle, Percent, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  isEnabled: boolean;
  countryScope: string;
  roleScope: string | null;
  serviceScope: string | null;
  rolloutPercentage: number;
  createdAt: string;
  updatedAt: string;
}

const countryScopeLabels: Record<string, { label: string; icon: any }> = {
  GLOBAL: { label: "Global", icon: Globe },
  BD: { label: "Bangladesh", icon: MapPin },
  US: { label: "United States", icon: MapPin },
};

const roleScopeLabels: Record<string, string> = {
  customer: "Customers",
  driver: "Drivers",
  restaurant: "Restaurants",
  shop_partner: "Shop Partners",
  ticket_operator: "Ticket Operators",
  admin: "Admins",
};

const serviceScopeLabels: Record<string, string> = {
  ride: "Ride-Hailing",
  food: "Food Delivery",
  parcel: "Parcel Delivery",
  ticket: "Tickets",
  rental: "Rentals",
};

function CreateFlagDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    key: "",
    description: "",
    isEnabled: false,
    countryScope: "GLOBAL",
    roleScope: "",
    serviceScope: "",
    rolloutPercentage: 100,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        roleScope: data.roleScope || null,
        serviceScope: data.serviceScope || null,
      };
      const response = await apiRequest("/api/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Feature flag created successfully" });
      onSuccess();
      onOpenChange(false);
      setFormData({
        key: "",
        description: "",
        isEnabled: false,
        countryScope: "GLOBAL",
        roleScope: "",
        serviceScope: "",
        rolloutPercentage: 100,
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create feature flag", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key || !formData.description) {
      toast({ title: "Key and description are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
          <DialogDescription>Add a new feature flag to control feature rollouts</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="key">Flag Key</Label>
            <Input
              id="key"
              placeholder="e.g., enable_new_checkout"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
              pattern="^[a-z0-9_]+$"
              className="font-mono"
              data-testid="input-flag-key"
            />
            <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and underscores only</p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this feature flag controls..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-20"
              data-testid="input-flag-description"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isEnabled">Enabled</Label>
            <Switch
              id="isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
              data-testid="switch-flag-enabled"
            />
          </div>

          <Separator />

          <div>
            <Label>Country Scope</Label>
            <Select value={formData.countryScope} onValueChange={(v) => setFormData(prev => ({ ...prev, countryScope: v }))}>
              <SelectTrigger data-testid="select-country-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Global (All Countries)</SelectItem>
                <SelectItem value="BD">Bangladesh Only</SelectItem>
                <SelectItem value="US">United States Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Role Scope (Optional)</Label>
            <Select value={formData.roleScope} onValueChange={(v) => setFormData(prev => ({ ...prev, roleScope: v }))}>
              <SelectTrigger data-testid="select-role-scope">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="driver">Drivers</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="shop_partner">Shop Partners</SelectItem>
                <SelectItem value="ticket_operator">Ticket Operators</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Service Scope (Optional)</Label>
            <Select value={formData.serviceScope} onValueChange={(v) => setFormData(prev => ({ ...prev, serviceScope: v }))}>
              <SelectTrigger data-testid="select-service-scope">
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Services</SelectItem>
                <SelectItem value="ride">Ride-Hailing</SelectItem>
                <SelectItem value="food">Food Delivery</SelectItem>
                <SelectItem value="parcel">Parcel Delivery</SelectItem>
                <SelectItem value="ticket">Tickets</SelectItem>
                <SelectItem value="rental">Rentals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Rollout Percentage</Label>
              <span className="text-sm font-medium">{formData.rolloutPercentage}%</span>
            </div>
            <Slider
              value={[formData.rolloutPercentage]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, rolloutPercentage: value }))}
              max={100}
              step={5}
              data-testid="slider-rollout"
            />
            <p className="text-xs text-muted-foreground mt-1">Percentage of eligible users who see this feature</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-flag">
              {createMutation.isPending ? "Creating..." : "Create Flag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditFlagDialog({ flag, open, onOpenChange, onSuccess }: { flag: FeatureFlag | null; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    description: flag?.description || "",
    isEnabled: flag?.isEnabled || false,
    countryScope: flag?.countryScope || "GLOBAL",
    roleScope: flag?.roleScope || "",
    serviceScope: flag?.serviceScope || "",
    rolloutPercentage: flag?.rolloutPercentage || 100,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        roleScope: data.roleScope || null,
        serviceScope: data.serviceScope || null,
      };
      const response = await apiRequest(`/api/admin/feature-flags/${flag?.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Feature flag updated successfully" });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update feature flag", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!flag) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Feature Flag</DialogTitle>
          <DialogDescription>
            <code className="text-sm bg-muted px-2 py-0.5 rounded">{flag.key}</code>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-20"
              data-testid="input-edit-description"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-isEnabled">Enabled</Label>
            <Switch
              id="edit-isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
              data-testid="switch-edit-enabled"
            />
          </div>

          <Separator />

          <div>
            <Label>Country Scope</Label>
            <Select value={formData.countryScope} onValueChange={(v) => setFormData(prev => ({ ...prev, countryScope: v }))}>
              <SelectTrigger data-testid="select-edit-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Global (All Countries)</SelectItem>
                <SelectItem value="BD">Bangladesh Only</SelectItem>
                <SelectItem value="US">United States Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Role Scope</Label>
            <Select value={formData.roleScope} onValueChange={(v) => setFormData(prev => ({ ...prev, roleScope: v }))}>
              <SelectTrigger data-testid="select-edit-role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="driver">Drivers</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="shop_partner">Shop Partners</SelectItem>
                <SelectItem value="ticket_operator">Ticket Operators</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Service Scope</Label>
            <Select value={formData.serviceScope} onValueChange={(v) => setFormData(prev => ({ ...prev, serviceScope: v }))}>
              <SelectTrigger data-testid="select-edit-service">
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Services</SelectItem>
                <SelectItem value="ride">Ride-Hailing</SelectItem>
                <SelectItem value="food">Food Delivery</SelectItem>
                <SelectItem value="parcel">Parcel Delivery</SelectItem>
                <SelectItem value="ticket">Tickets</SelectItem>
                <SelectItem value="rental">Rentals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Rollout Percentage</Label>
              <span className="text-sm font-medium">{formData.rolloutPercentage}%</span>
            </div>
            <Slider
              value={[formData.rolloutPercentage]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, rolloutPercentage: value }))}
              max={100}
              step={5}
              data-testid="slider-edit-rollout"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-edit-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-flag">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FeatureFlags() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);

  const { data: flags, isLoading, refetch } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/admin/feature-flags"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const response = await apiRequest(`/api/admin/feature-flags/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled }),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Feature flag updated" });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to update feature flag", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/admin/feature-flags/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Feature flag deleted" });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to delete feature flag", variant: "destructive" });
    },
  });

  const filteredFlags = flags?.filter(flag => 
    flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flag.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const enabledCount = flags?.filter(f => f.isEnabled).length || 0;
  const disabledCount = flags?.filter(f => !f.isEnabled).length || 0;

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground px-4 sm:px-6 md:px-8 py-5 sm:py-6 rounded-b-2xl sm:rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin/settings")}
            className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Settings2 className="h-6 w-6" />
              Feature Flags
            </h1>
            <p className="text-xs sm:text-sm opacity-90">Control feature rollouts and experiments</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-1.5"
            data-testid="button-create-flag"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Flag</span>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-foreground/20">
                  <Settings2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-foreground">{flags?.length || 0}</p>
                  <p className="text-xs text-primary-foreground/80">Total Flags</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <ToggleRight className="h-4 w-4 text-green-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-foreground">{enabledCount}</p>
                  <p className="text-xs text-primary-foreground/80">Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary-foreground/10 border-primary-foreground/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <ToggleLeft className="h-4 w-4 text-red-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-foreground">{disabledCount}</p>
                  <p className="text-xs text-primary-foreground/80">Disabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search flags by key or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-flags"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredFlags.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {searchQuery ? "No flags found" : "No feature flags yet"}
              </p>
              <p className="text-sm">
                {searchQuery ? "Try a different search" : "Create your first feature flag to get started"}
              </p>
              {!searchQuery && (
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Flag
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredFlags.map((flag) => {
              const CountryIcon = countryScopeLabels[flag.countryScope]?.icon || Globe;
              
              return (
                <Card key={flag.id} className={`${!flag.isEnabled ? "opacity-75" : ""}`} data-testid={`card-flag-${flag.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Switch
                        checked={flag.isEnabled}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: flag.id, isEnabled: checked })}
                        disabled={toggleMutation.isPending}
                        data-testid={`switch-flag-${flag.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{flag.key}</code>
                              {flag.isEnabled ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Disabled
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{flag.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingFlag(flag)}
                              data-testid={`button-edit-${flag.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" data-testid={`button-delete-${flag.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Feature Flag</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <code className="bg-muted px-1 rounded">{flag.key}</code>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(flag.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid="button-confirm-delete"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <CountryIcon className="h-3 w-3" />
                            {countryScopeLabels[flag.countryScope]?.label || flag.countryScope}
                          </Badge>
                          {flag.roleScope && (
                            <Badge variant="outline" className="gap-1">
                              <User className="h-3 w-3" />
                              {roleScopeLabels[flag.roleScope] || flag.roleScope}
                            </Badge>
                          )}
                          {flag.serviceScope && (
                            <Badge variant="outline" className="gap-1">
                              <Truck className="h-3 w-3" />
                              {serviceScopeLabels[flag.serviceScope] || flag.serviceScope}
                            </Badge>
                          )}
                          <Badge variant="outline" className="gap-1">
                            <Percent className="h-3 w-3" />
                            {flag.rolloutPercentage}% Rollout
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(flag.updatedAt || flag.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateFlagDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={refetch}
      />

      <EditFlagDialog
        flag={editingFlag}
        open={!!editingFlag}
        onOpenChange={(open) => !open && setEditingFlag(null)}
        onSuccess={refetch}
      />
    </div>
  );
}
