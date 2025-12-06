import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  Plus, Search, Settings2, Trash2, Edit2, Flag,
  ToggleLeft, ToggleRight, Globe, MapPin, User, Car, UtensilsCrossed,
  ShoppingBag, Ticket, Key, Server, Code, Layers, Shield, History,
  ChevronDown, ChevronRight, Filter, AlertTriangle, Lock, Users,
  Percent, Clock, CheckCircle, XCircle, Laptop, Smartphone
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MetricCard, MetricGrid, EmptyState } from "@/components/admin";

interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  isEnabled: boolean;
  category: "RIDE" | "FOOD" | "SHOP" | "TICKET" | "RENTAL" | "SYSTEM" | null;
  environment: "DEVELOPMENT" | "STAGING" | "PRODUCTION" | "ALL" | null;
  countryScope: string | null;
  roleScope: string | null;
  serviceScope: string | null;
  partnerTypeScope: string | null;
  rolloutPercentage: number | null;
  createdAt: string;
  updatedAt: string;
  lastToggleAt: string | null;
  lastToggleByAdminId: string | null;
}

interface AdminCapabilities {
  adminRole: string;
  permissions: string[];
}

function getCategory(flag: FeatureFlag): string {
  return flag.category || "SYSTEM";
}

function getEnvironment(flag: FeatureFlag): string {
  return flag.environment || "ALL";
}

function getCountryScope(flag: FeatureFlag): string {
  return flag.countryScope || "GLOBAL";
}

function getRolloutPercentage(flag: FeatureFlag): number {
  return flag.rolloutPercentage ?? 100;
}

const categoryConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  RIDE: { label: "Ride-Hailing", icon: Car, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  FOOD: { label: "Food Delivery", icon: UtensilsCrossed, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/10" },
  SHOP: { label: "Shop Partner", icon: ShoppingBag, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-500/10" },
  TICKET: { label: "Ticket Operator", icon: Ticket, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  RENTAL: { label: "Rental Vehicle", icon: Key, color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-500/10" },
  SYSTEM: { label: "System", icon: Server, color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500/10" },
};

const environmentConfig: Record<string, { label: string; icon: any; color: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }> = {
  DEVELOPMENT: { label: "Development", icon: Code, color: "text-yellow-600", badgeVariant: "secondary" },
  STAGING: { label: "Staging", icon: Layers, color: "text-blue-600", badgeVariant: "outline" },
  PRODUCTION: { label: "Production", icon: Shield, color: "text-green-600", badgeVariant: "default" },
  ALL: { label: "All Environments", icon: Globe, color: "text-purple-600", badgeVariant: "outline" },
};

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

const partnerTypeLabels: Record<string, string> = {
  standard: "Standard Partners",
  premium: "Premium Partners",
  enterprise: "Enterprise Partners",
  new: "New Partners",
  verified: "Verified Partners",
};

function CreateFlagDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    key: "",
    description: "",
    isEnabled: false,
    category: "SYSTEM" as const,
    environment: "ALL" as const,
    countryScope: "GLOBAL",
    roleScope: "",
    serviceScope: "",
    partnerTypeScope: "",
    rolloutPercentage: 100,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        roleScope: data.roleScope || null,
        serviceScope: data.serviceScope || null,
        partnerTypeScope: data.partnerTypeScope || null,
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
        category: "SYSTEM",
        environment: "ALL",
        countryScope: "GLOBAL",
        roleScope: "",
        serviceScope: "",
        partnerTypeScope: "",
        rolloutPercentage: 100,
      });
    },
    onError: (error: any) => {
      const message = error.message || "Failed to create feature flag";
      if (message.includes("Super Admin")) {
        toast({ title: "Access Denied", description: "Only Super Admins can create feature flags.", variant: "destructive" });
      } else {
        toast({ title: message, variant: "destructive" });
      }
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Create Feature Flag
          </DialogTitle>
          <DialogDescription>Add a new feature flag with environment and category targeting</DialogDescription>
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
              className="min-h-16"
              data-testid="input-flag-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v: any) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Environment</Label>
              <Select value={formData.environment} onValueChange={(v: any) => setFormData(prev => ({ ...prev, environment: v }))}>
                <SelectTrigger data-testid="select-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(environmentConfig).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <ToggleRight className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="isEnabled" className="cursor-pointer">Enable on creation</Label>
            </div>
            <Switch
              id="isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
              data-testid="switch-flag-enabled"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Targeting Options
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Region</Label>
                <Select value={formData.countryScope} onValueChange={(v) => setFormData(prev => ({ ...prev, countryScope: v }))}>
                  <SelectTrigger data-testid="select-country-scope" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">Global</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={formData.roleScope} onValueChange={(v) => setFormData(prev => ({ ...prev, roleScope: v }))}>
                  <SelectTrigger data-testid="select-role-scope" className="h-9">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Roles</SelectItem>
                    {Object.entries(roleScopeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Partner Type</Label>
              <Select value={formData.partnerTypeScope} onValueChange={(v) => setFormData(prev => ({ ...prev, partnerTypeScope: v }))}>
                <SelectTrigger data-testid="select-partner-type" className="h-9">
                  <SelectValue placeholder="All partner types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Partner Types</SelectItem>
                  {Object.entries(partnerTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" />
                  Rollout Percentage
                </Label>
                <Badge variant="secondary" className="text-xs">{formData.rolloutPercentage}%</Badge>
              </div>
              <Slider
                value={[formData.rolloutPercentage]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, rolloutPercentage: value }))}
                max={100}
                step={5}
                data-testid="slider-rollout"
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">Percentage of eligible users who see this feature</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
    category: flag?.category || "SYSTEM",
    environment: flag?.environment || "ALL",
    countryScope: flag?.countryScope || "GLOBAL",
    roleScope: flag?.roleScope || "",
    serviceScope: flag?.serviceScope || "",
    partnerTypeScope: flag?.partnerTypeScope || "",
    rolloutPercentage: flag?.rolloutPercentage || 100,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        roleScope: data.roleScope || null,
        serviceScope: data.serviceScope || null,
        partnerTypeScope: data.partnerTypeScope || null,
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
    onError: (error: any) => {
      const message = error.message || "Failed to update feature flag";
      if (message.includes("Super Admin")) {
        toast({ title: "Access Denied", description: "Only Super Admins can modify feature flags.", variant: "destructive" });
      } else {
        toast({ title: message, variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!flag) return null;

  const CategoryIcon = categoryConfig[flag.category]?.icon || Server;
  const EnvIcon = environmentConfig[flag.environment]?.icon || Globe;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Edit Feature Flag
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">{flag.key}</code>
            <Badge variant="outline" className="text-xs">
              <CategoryIcon className="h-3 w-3 mr-1" />
              {categoryConfig[flag.category]?.label}
            </Badge>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-16"
              data-testid="input-edit-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v: any) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Environment</Label>
              <Select value={formData.environment} onValueChange={(v: any) => setFormData(prev => ({ ...prev, environment: v }))}>
                <SelectTrigger data-testid="select-edit-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(environmentConfig).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {formData.isEnabled ? (
                <ToggleRight className="h-4 w-4 text-green-500" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
              )}
              <Label htmlFor="edit-isEnabled" className="cursor-pointer">
                {formData.isEnabled ? "Enabled" : "Disabled"}
              </Label>
            </div>
            <Switch
              id="edit-isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
              data-testid="switch-edit-enabled"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Targeting
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Region</Label>
                <Select value={formData.countryScope} onValueChange={(v) => setFormData(prev => ({ ...prev, countryScope: v }))}>
                  <SelectTrigger data-testid="select-edit-country" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">Global</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={formData.roleScope} onValueChange={(v) => setFormData(prev => ({ ...prev, roleScope: v }))}>
                  <SelectTrigger data-testid="select-edit-role" className="h-9">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Roles</SelectItem>
                    {Object.entries(roleScopeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Partner Type</Label>
              <Select value={formData.partnerTypeScope || ""} onValueChange={(v) => setFormData(prev => ({ ...prev, partnerTypeScope: v }))}>
                <SelectTrigger data-testid="select-edit-partner-type" className="h-9">
                  <SelectValue placeholder="All partner types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Partner Types</SelectItem>
                  {Object.entries(partnerTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" />
                  Rollout
                </Label>
                <Badge variant="secondary" className="text-xs">{formData.rolloutPercentage}%</Badge>
              </div>
              <Slider
                value={[formData.rolloutPercentage]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, rolloutPercentage: value }))}
                max={100}
                step={5}
                data-testid="slider-edit-rollout"
                className="py-2"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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

function FlagCard({ flag, onEdit, onToggle, onDelete, togglePending, isSuperAdmin }: { 
  flag: FeatureFlag; 
  onEdit: () => void; 
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  togglePending: boolean;
  isSuperAdmin: boolean;
}) {
  const category = getCategory(flag);
  const environment = getEnvironment(flag);
  const countryScope = getCountryScope(flag);
  const rolloutPercentage = getRolloutPercentage(flag);
  
  const CategoryIcon = categoryConfig[category]?.icon || Server;
  const EnvIcon = environmentConfig[environment]?.icon || Globe;
  const CountryIcon = countryScopeLabels[countryScope]?.icon || Globe;

  return (
    <Card className={`transition-all ${!flag.isEnabled ? "opacity-70" : ""}`} data-testid={`card-flag-${flag.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Switch
                  checked={flag.isEnabled}
                  onCheckedChange={onToggle}
                  disabled={togglePending || !isSuperAdmin}
                  data-testid={`switch-flag-${flag.id}`}
                  className="mt-1"
                />
              </div>
            </TooltipTrigger>
            {!isSuperAdmin && (
              <TooltipContent>
                <p>Super Admin access required to toggle flags</p>
              </TooltipContent>
            )}
          </Tooltip>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded truncate max-w-[200px] sm:max-w-none">{flag.key}</code>
                  <Badge 
                    variant={flag.isEnabled ? "default" : "secondary"} 
                    className="text-[10px] px-1.5"
                  >
                    {flag.isEnabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{flag.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-${flag.id}`}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit flag</TooltipContent>
                </Tooltip>
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
                        Are you sure you want to delete <code className="bg-muted px-1 rounded">{flag.key}</code>? 
                        This action cannot be undone and may affect live features.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className={`text-xs ${categoryConfig[category]?.color || "text-gray-500"}`}>
                <CategoryIcon className="h-3 w-3 mr-1" />
                {categoryConfig[category]?.label || "System"}
              </Badge>
              <Badge variant={environmentConfig[environment]?.badgeVariant || "outline"} className="text-xs">
                <EnvIcon className="h-3 w-3 mr-1" />
                {environmentConfig[environment]?.label || "All Environments"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <CountryIcon className="h-3 w-3 mr-1" />
                {countryScopeLabels[countryScope]?.label || "Global"}
              </Badge>
              {rolloutPercentage < 100 && (
                <Badge variant="secondary" className="text-xs">
                  <Percent className="h-3 w-3 mr-1" />
                  {rolloutPercentage}%
                </Badge>
              )}
              {flag.roleScope && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {roleScopeLabels[flag.roleScope] || flag.roleScope}
                </Badge>
              )}
              {flag.partnerTypeScope && (
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {partnerTypeLabels[flag.partnerTypeScope] || flag.partnerTypeScope}
                </Badge>
              )}
            </div>

            {flag.lastToggleAt && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <History className="h-3 w-3" />
                Last toggled {new Date(flag.lastToggleAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryGroup({ 
  category, 
  flags, 
  onEdit, 
  onToggle, 
  onDelete, 
  togglePending,
  isSuperAdmin 
}: { 
  category: string; 
  flags: FeatureFlag[];
  onEdit: (flag: FeatureFlag) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  togglePending: boolean;
  isSuperAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const config = categoryConfig[category] || categoryConfig.SYSTEM;
  const CategoryIcon = config.icon;
  const enabledCount = flags.filter(f => f.isEnabled).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center justify-between p-3 rounded-lg ${config.bgColor} hover-elevate cursor-pointer`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-background ${config.color}`}>
              <CategoryIcon className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h3 className="font-medium">{config.label}</h3>
              <p className="text-xs text-muted-foreground">{flags.length} flags, {enabledCount} enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{flags.length}</Badge>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        {flags.map(flag => (
          <FlagCard
            key={flag.id}
            flag={flag}
            onEdit={() => onEdit(flag)}
            onToggle={(enabled) => onToggle(flag.id, enabled)}
            onDelete={() => onDelete(flag.id)}
            togglePending={togglePending}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FeatureFlags() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grouped" | "list">("grouped");

  const { data: capabilities } = useQuery<AdminCapabilities>({
    queryKey: ["/api/admin/me"],
  });
  
  const isSuperAdmin = capabilities?.adminRole === "SUPER_ADMIN";

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
    onError: (error: any) => {
      const message = error.message || "Failed to update feature flag";
      if (message.includes("Super Admin")) {
        toast({ title: "Access Denied", description: "Only Super Admins can toggle feature flags.", variant: "destructive" });
      } else {
        toast({ title: message, variant: "destructive" });
      }
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
    onError: (error: any) => {
      const message = error.message || "Failed to delete feature flag";
      if (message.includes("Super Admin")) {
        toast({ title: "Access Denied", description: "Only Super Admins can delete feature flags.", variant: "destructive" });
      } else {
        toast({ title: message, variant: "destructive" });
      }
    },
  });

  const filteredFlags = useMemo(() => {
    if (!flags) return [];
    return flags.filter(flag => {
      const matchesSearch = 
        flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || getCategory(flag) === categoryFilter;
      const matchesEnvironment = environmentFilter === "all" || getEnvironment(flag) === environmentFilter;
      return matchesSearch && matchesCategory && matchesEnvironment;
    });
  }, [flags, searchQuery, categoryFilter, environmentFilter]);

  const groupedFlags = useMemo(() => {
    const groups: Record<string, FeatureFlag[]> = {};
    for (const category of Object.keys(categoryConfig)) {
      groups[category] = filteredFlags.filter(f => getCategory(f) === category);
    }
    return groups;
  }, [filteredFlags]);

  const stats = useMemo(() => ({
    total: flags?.length || 0,
    enabled: flags?.filter(f => f.isEnabled).length || 0,
    disabled: flags?.filter(f => !f.isEnabled).length || 0,
    production: flags?.filter(f => getEnvironment(f) === "PRODUCTION" || getEnvironment(f) === "ALL").length || 0,
  }), [flags]);

  const metrics = [
    { label: "Total Flags", value: stats.total, icon: Settings2, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { label: "Enabled", value: stats.enabled, icon: ToggleRight, color: "text-green-500", bgColor: "bg-green-500/10" },
    { label: "Disabled", value: stats.disabled, icon: ToggleLeft, color: "text-gray-500", bgColor: "bg-gray-500/10" },
    { label: "Production", value: stats.production, icon: Shield, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  ];

  const quickFilters = [
    { id: "all", label: "All", count: stats.total },
    { id: "enabled", label: "Enabled", count: stats.enabled },
    { id: "production", label: "Production", count: stats.production },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Feature Flags"
        description="Control feature rollouts and experiments"
        icon={Flag}
        backButton={{ label: "Back to Settings", href: "/admin/settings" }}
        actions={
          <>
            <Badge variant="secondary" className="hidden sm:flex gap-1">
              <Lock className="h-3 w-3" />
              Super Admin Only
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    size="sm"
                    disabled={!isSuperAdmin}
                    data-testid="button-create-flag"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">New Flag</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!isSuperAdmin && (
                <TooltipContent>
                  <p>Super Admin access required</p>
                </TooltipContent>
              )}
            </Tooltip>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((metric, idx) => (
            <Card key={idx} className="bg-card border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                    <metric.icon className={`h-4 w-4 ${metric.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary-foreground">{metric.value}</p>
                    <p className="text-xs text-primary-foreground/80">{metric.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6">
        
        {!isSuperAdmin && capabilities && (
          <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="font-medium text-sm">View-Only Mode</p>
                <p className="text-xs text-muted-foreground">
                  Feature flag modifications require Super Admin access. Contact your system administrator for elevated permissions.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search flags by key or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-flags"
                />
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="filter-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(categoryConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="filter-environment">
                    <SelectValue placeholder="Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Envs</SelectItem>
                    {Object.entries(environmentConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredFlags.length} flag{filteredFlags.length !== 1 ? "s" : ""} found
              </p>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="grouped" className="text-xs px-3">
                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                    Grouped
                  </TabsTrigger>
                  <TabsTrigger value="list" className="text-xs px-3">
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    List
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredFlags.length === 0 ? (
          <EmptyState
            icon={Settings2}
            title={searchQuery || categoryFilter !== "all" || environmentFilter !== "all" ? "No flags found" : "No feature flags yet"}
            description={searchQuery || categoryFilter !== "all" || environmentFilter !== "all" ? "Try adjusting your filters" : "Create your first feature flag to get started"}
            action={
              !searchQuery && categoryFilter === "all" && environmentFilter === "all" && (
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Flag
                </Button>
              )
            }
          />
        ) : viewMode === "grouped" ? (
          <div className="space-y-6">
            {Object.entries(groupedFlags)
              .filter(([_, flags]) => flags.length > 0)
              .map(([category, categoryFlags]) => (
                <CategoryGroup
                  key={category}
                  category={category}
                  flags={categoryFlags}
                  onEdit={setEditingFlag}
                  onToggle={(id, enabled) => toggleMutation.mutate({ id, isEnabled: enabled })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  togglePending={toggleMutation.isPending}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFlags.map(flag => (
              <FlagCard
                key={flag.id}
                flag={flag}
                onEdit={() => setEditingFlag(flag)}
                onToggle={(enabled) => toggleMutation.mutate({ id: flag.id, isEnabled: enabled })}
                onDelete={() => deleteMutation.mutate(flag.id)}
                togglePending={toggleMutation.isPending}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
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
