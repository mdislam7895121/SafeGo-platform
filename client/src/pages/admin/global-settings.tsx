import { useState } from "react";
import { useLocation } from "wouter";
import { 
  ArrowLeft, Settings2, Lock, Shield, Globe, MapPin, DollarSign, 
  Phone, Mail, AlertTriangle, Clock, History, RefreshCw, Save, X,
  ChevronDown, ChevronRight, Percent, Users, Car, ShoppingBag,
  UtensilsCrossed, Edit2, Eye, LockKeyhole, CheckCircle, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdminSetting {
  key: string;
  value: any;
  description: string;
  isSensitive: boolean;
  countryScope: "GLOBAL" | "BD_ONLY" | "US_ONLY";
  category: "PLATFORM_ECONOMICS" | "SECURITY_ABUSE" | "CONTACTS_SUPPORT" | "OPERATIONAL";
  updatedAt: string;
  updatedByAdminId: string | null;
  displayLabel: string;
  unit?: string;
  defaultValue: any;
}

interface SettingChange {
  id: string;
  oldValue: any;
  newValue: any;
  changedById: string;
  changedByEmail: string;
  reason: string | null;
  createdAt: string;
}

interface SettingsResponse {
  settings: AdminSetting[];
  categories: string[];
  countryScopes: string[];
}

const categoryConfig: Record<string, { label: string; icon: any; description: string; color: string }> = {
  PLATFORM_ECONOMICS: { 
    label: "Platform Economics", 
    icon: DollarSign, 
    description: "Commission rates, payout limits, and financial settings",
    color: "text-green-600 dark:text-green-400"
  },
  SECURITY_ABUSE: { 
    label: "Security & Abuse Protection", 
    icon: Shield, 
    description: "Login rate limiting, account lockout, and session security",
    color: "text-red-600 dark:text-red-400"
  },
  CONTACTS_SUPPORT: { 
    label: "Contacts & Support", 
    icon: Phone, 
    description: "Support contact information per country",
    color: "text-blue-600 dark:text-blue-400"
  },
  OPERATIONAL: { 
    label: "Operational", 
    icon: Settings2, 
    description: "Driver requirements, pricing rules, and platform controls",
    color: "text-purple-600 dark:text-purple-400"
  },
};

const countryScopeConfig: Record<string, { label: string; flag: string }> = {
  GLOBAL: { label: "Global", flag: "🌎" },
  BD_ONLY: { label: "Bangladesh", flag: "🇧🇩" },
  US_ONLY: { label: "USA", flag: "🇺🇸" },
};

function SettingHistoryDialog({ 
  open, 
  onOpenChange, 
  settingKey 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  settingKey: string;
}) {
  const { data, isLoading } = useQuery<{ key: string; history: SettingChange[] }>({
    queryKey: ["/api/admin/global-settings", settingKey, "history"],
    enabled: open && !!settingKey,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Setting History: {settingKey}
          </DialogTitle>
          <DialogDescription>
            View recent changes to this setting
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : data?.history && data.history.length > 0 ? (
            <div className="space-y-4">
              {data.history.map((change) => (
                <Card key={change.id} className="p-4" data-testid={`history-change-${change.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-medium">{change.changedByEmail}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(change.createdAt), "MMM d, yyyy HH:mm")}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Old Value:</span>
                      <div className="font-mono bg-muted p-2 rounded mt-1">
                        {JSON.stringify(change.oldValue)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">New Value:</span>
                      <div className="font-mono bg-muted p-2 rounded mt-1">
                        {JSON.stringify(change.newValue)}
                      </div>
                    </div>
                  </div>
                  {change.reason && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Reason:</span> {change.reason}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No history available for this setting
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function EditSettingDialog({ 
  open, 
  onOpenChange, 
  setting,
  onSuccess
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  setting: AdminSetting | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirmationKey, setConfirmationKey] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      let parsedValue: any = value;
      if (typeof setting?.value === "number") {
        parsedValue = parseFloat(value);
      } else if (typeof setting?.value === "boolean") {
        parsedValue = value === "true";
      }

      return apiRequest("PATCH", `/api/admin/global-settings/${setting?.key}`, {
        value: parsedValue,
        reason: reason || undefined,
        confirmationKey: setting?.isSensitive ? confirmationKey : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Setting Updated",
        description: `${setting?.displayLabel} has been updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-settings"] });
      onSuccess();
      onOpenChange(false);
      setShowConfirmation(false);
      setConfirmationKey("");
      setReason("");
    },
    onError: (error: any) => {
      const errorData = error?.response?.data || error;
      if (errorData?.requiresConfirmation) {
        setShowConfirmation(true);
      } else {
        toast({
          title: "Update Failed",
          description: errorData?.error || "Failed to update setting",
          variant: "destructive",
        });
      }
    },
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && setting) {
      setValue(String(setting.value));
      setReason("");
      setConfirmationKey("");
      setShowConfirmation(false);
    }
    onOpenChange(isOpen);
  };

  if (!setting) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {setting.isSensitive && <Lock className="h-4 w-4 text-amber-500" />}
            Edit: {setting.displayLabel}
          </DialogTitle>
          <DialogDescription>
            {setting.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {setting.isSensitive && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                This is a sensitive setting. Changes require confirmation.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="value">Value {setting.unit && `(${setting.unit})`}</Label>
            {typeof setting.value === "boolean" ? (
              <div className="flex items-center gap-3">
                <Switch 
                  checked={value === "true"}
                  onCheckedChange={(checked) => setValue(String(checked))}
                  data-testid="input-setting-value"
                />
                <span className="text-sm">{value === "true" ? "Enabled" : "Disabled"}</span>
              </div>
            ) : (
              <Input
                id="value"
                type={typeof setting.value === "number" ? "number" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                data-testid="input-setting-value"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Default: {String(setting.defaultValue)}{setting.unit && ` ${setting.unit}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for change (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're making this change..."
              rows={2}
              data-testid="input-setting-reason"
            />
          </div>

          {showConfirmation && setting.isSensitive && (
            <div className="space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <Label htmlFor="confirmationKey" className="text-destructive">
                Type "{setting.key}" to confirm
              </Label>
              <Input
                id="confirmationKey"
                value={confirmationKey}
                onChange={(e) => setConfirmationKey(e.target.value)}
                placeholder={setting.key}
                data-testid="input-confirmation-key"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button 
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (showConfirmation && confirmationKey !== setting.key)}
            data-testid="button-save-setting"
          >
            {mutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
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
  );
}

function SettingCard({ 
  setting, 
  onEdit, 
  onViewHistory,
  canEdit 
}: { 
  setting: AdminSetting; 
  onEdit: () => void;
  onViewHistory: () => void;
  canEdit: boolean;
}) {
  const scopeInfo = countryScopeConfig[setting.countryScope];
  
  return (
    <Card 
      className="group hover-elevate transition-all"
      data-testid={`setting-card-${setting.key}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate" data-testid={`setting-label-${setting.key}`}>
                {setting.displayLabel}
              </h4>
              {setting.isSensitive && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <Lock className="h-3 w-3 mr-1" />
                  Safety Lock
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {scopeInfo.flag} {scopeInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2" data-testid={`setting-description-${setting.key}`}>
              {setting.description}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Value:</span>
                <span 
                  className="font-mono text-sm font-medium bg-muted px-2 py-0.5 rounded"
                  data-testid={`setting-value-${setting.key}`}
                >
                  {typeof setting.value === "boolean" 
                    ? (setting.value ? "Enabled" : "Disabled")
                    : String(setting.value)}{setting.unit && ` ${setting.unit}`}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Updated: {format(new Date(setting.updatedAt), "MMM d, yyyy")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              onClick={onViewHistory}
              data-testid={`button-history-${setting.key}`}
            >
              <History className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onEdit}
                data-testid={`button-edit-${setting.key}`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GlobalSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("PLATFORM_ECONOMICS");
  const [editSetting, setEditSetting] = useState<AdminSetting | null>(null);
  const [historySetting, setHistorySetting] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["PLATFORM_ECONOMICS", "SECURITY_ABUSE", "CONTACTS_SUPPORT", "OPERATIONAL"])
  );

  const { data, isLoading, refetch } = useQuery<SettingsResponse>({
    queryKey: ["/api/admin/global-settings"],
  });

  const { data: capabilities } = useQuery<{ permissions: string[] }>({
    queryKey: ["/api/admin/capabilities"],
  });

  const canManageSensitive = capabilities?.permissions?.includes("MANAGE_SENSITIVE_SETTINGS") ?? false;
  const canManageSettings = capabilities?.permissions?.includes("MANAGE_GLOBAL_SETTINGS") ?? false;

  const settingsByCategory = data?.settings?.reduce((acc, setting) => {
    const category = setting.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, AdminSetting[]>) ?? {};

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-global-settings">
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <LockKeyhole className="h-6 w-6 text-primary" />
                  Global Settings & Safety Locks
                </h1>
                <p className="text-sm text-muted-foreground">
                  Configure critical platform settings with audit trail
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManageSensitive && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Full Access
                </Badge>
              )}
              {!canManageSensitive && canManageSettings && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                  <Eye className="h-3 w-3 mr-1" />
                  Limited Edit Access
                </Badge>
              )}
              {!canManageSettings && (
                <Badge className="bg-muted text-muted-foreground">
                  <Eye className="h-3 w-3 mr-1" />
                  View Only
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4" data-testid="metric-total-settings">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.settings?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Settings</p>
              </div>
            </div>
          </Card>
          <Card className="p-4" data-testid="metric-sensitive-settings">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Lock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data?.settings?.filter(s => s.isSensitive).length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Safety Locked</p>
              </div>
            </div>
          </Card>
          <Card className="p-4" data-testid="metric-global-settings">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data?.settings?.filter(s => s.countryScope === "GLOBAL").length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Global Scope</p>
              </div>
            </div>
          </Card>
          <Card className="p-4" data-testid="metric-country-settings">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MapPin className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data?.settings?.filter(s => s.countryScope !== "GLOBAL").length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Country Specific</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6" data-testid="tabs-categories">
            {Object.entries(categoryConfig).map(([key, config]) => (
              <TabsTrigger key={key} value={key} data-testid={`tab-${key.toLowerCase()}`}>
                <config.icon className={`h-4 w-4 mr-2 ${config.color}`} />
                {config.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(categoryConfig).map(([category, config]) => (
            <TabsContent key={category} value={category} className="space-y-4">
              <div className="flex items-start gap-3 mb-6">
                <div className={`p-3 rounded-lg bg-muted`}>
                  <config.icon className={`h-6 w-6 ${config.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{config.label}</h2>
                  <p className="text-muted-foreground">{config.description}</p>
                </div>
              </div>

              <div className="grid gap-4">
                {settingsByCategory[category]?.map(setting => (
                  <SettingCard
                    key={setting.key}
                    setting={setting}
                    onEdit={() => setEditSetting(setting)}
                    onViewHistory={() => setHistorySetting(setting.key)}
                    canEdit={setting.isSensitive ? canManageSensitive : canManageSettings}
                  />
                )) ?? (
                  <div className="text-center py-8 text-muted-foreground">
                    No settings in this category
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <EditSettingDialog
        open={!!editSetting}
        onOpenChange={(open) => !open && setEditSetting(null)}
        setting={editSetting}
        onSuccess={() => refetch()}
      />

      <SettingHistoryDialog
        open={!!historySetting}
        onOpenChange={(open) => !open && setHistorySetting("")}
        settingKey={historySetting}
      />
    </div>
  );
}
