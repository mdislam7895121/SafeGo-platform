import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Check, X, Smartphone, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface MobileWalletConfig {
  id: string;
  countryCode: string;
  provider: string;
  providerName: string;
  isEnabled: boolean;
  isDefault: boolean;
  enabledForRides: boolean;
  enabledForFood: boolean;
  enabledForParcels: boolean;
  merchantId?: string;
  merchantName?: string;
  sandboxMode: boolean;
  displayName?: string;
  logoUrl?: string;
  createdAt: string;
}

const WALLET_BRANDS = ["bkash", "nagad", "rocket", "upay"] as const;
const WALLET_DISPLAY_NAMES: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Dutch-Bangla Rocket",
  upay: "Upay",
};

export default function MobileWalletConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MobileWalletConfig | null>(null);

  const [formData, setFormData] = useState({
    countryCode: "BD",
    provider: "",
    providerName: "",
    isEnabled: false,
    isDefault: false,
    enabledForRides: true,
    enabledForFood: true,
    enabledForParcels: true,
    merchantId: "",
    merchantName: "",
    sandboxMode: true,
    displayName: "",
    logoUrl: "",
  });

  const { data: configs, isLoading } = useQuery<{ configs: MobileWalletConfig[] }>({
    queryKey: ["/api/admin/mobile-wallets/config"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/admin/mobile-wallets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mobile-wallets/config"] });
      toast({
        title: "Configuration saved",
        description: "Mobile wallet configuration has been updated.",
      });
      resetForm();
      setIsAddDialogOpen(false);
      setEditingConfig(null);
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/mobile-wallets/config/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mobile-wallets/config"] });
      toast({
        title: "Configuration deleted",
        description: "Mobile wallet configuration has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete configuration",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      countryCode: "BD",
      provider: "",
      providerName: "",
      isEnabled: false,
      isDefault: false,
      enabledForRides: true,
      enabledForFood: true,
      enabledForParcels: true,
      merchantId: "",
      merchantName: "",
      sandboxMode: true,
      displayName: "",
      logoUrl: "",
    });
  };

  const handleEdit = (config: MobileWalletConfig) => {
    setEditingConfig(config);
    setFormData({
      countryCode: config.countryCode,
      provider: config.provider,
      providerName: config.providerName,
      isEnabled: config.isEnabled,
      isDefault: config.isDefault,
      enabledForRides: config.enabledForRides,
      enabledForFood: config.enabledForFood,
      enabledForParcels: config.enabledForParcels,
      merchantId: config.merchantId || "",
      merchantName: config.merchantName || "",
      sandboxMode: config.sandboxMode,
      displayName: config.displayName || "",
      logoUrl: config.logoUrl || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.provider || !formData.providerName) {
      toast({
        title: "Validation error",
        description: "Provider and provider name are required",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/settings">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Mobile Wallet Configuration</h1>
              <p className="text-sm opacity-80">Configure Bangladesh mobile payment providers</p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              resetForm();
              setEditingConfig(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-add-config">
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? "Edit" : "Add"} Mobile Wallet Provider
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select
                      value={formData.countryCode}
                      onValueChange={(v) => setFormData({ ...formData, countryCode: v })}
                    >
                      <SelectTrigger data-testid="select-country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BD">Bangladesh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        provider: v,
                        providerName: WALLET_DISPLAY_NAMES[v] || v,
                        displayName: WALLET_DISPLAY_NAMES[v] || v,
                      })}
                      disabled={!!editingConfig}
                    >
                      <SelectTrigger data-testid="select-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {WALLET_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {WALLET_DISPLAY_NAMES[brand]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g., bKash"
                    data-testid="input-display-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Merchant ID</Label>
                    <Input
                      value={formData.merchantId}
                      onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                      placeholder="From provider dashboard"
                      data-testid="input-merchant-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Merchant Name</Label>
                    <Input
                      value={formData.merchantName}
                      onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                      placeholder="Business name"
                      data-testid="input-merchant-name"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <span>Enabled</span>
                    </Label>
                    <Switch
                      checked={formData.isEnabled}
                      onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
                      data-testid="switch-enabled"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Set as Default</Label>
                    <Switch
                      checked={formData.isDefault}
                      onCheckedChange={(v) => setFormData({ ...formData, isDefault: v })}
                      data-testid="switch-default"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Sandbox Mode</Label>
                    <Switch
                      checked={formData.sandboxMode}
                      onCheckedChange={(v) => setFormData({ ...formData, sandboxMode: v })}
                      data-testid="switch-sandbox"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-muted-foreground text-sm">Enabled For Services</Label>
                  <div className="flex items-center justify-between">
                    <Label>Rides</Label>
                    <Switch
                      checked={formData.enabledForRides}
                      onCheckedChange={(v) => setFormData({ ...formData, enabledForRides: v })}
                      data-testid="switch-rides"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Food Delivery</Label>
                    <Switch
                      checked={formData.enabledForFood}
                      onCheckedChange={(v) => setFormData({ ...formData, enabledForFood: v })}
                      data-testid="switch-food"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Parcels</Label>
                    <Switch
                      checked={formData.enabledForParcels}
                      onCheckedChange={(v) => setFormData({ ...formData, enabledForParcels: v })}
                      data-testid="switch-parcels"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  resetForm();
                  setIsAddDialogOpen(false);
                  setEditingConfig(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save">
                  {saveMutation.isPending ? "Saving..." : "Save Configuration"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !configs?.configs || configs.configs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Mobile Wallets Configured</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md mb-4">
                Configure mobile wallet providers like bKash or Nagad to enable mobile payments in Bangladesh.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Provider
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {configs.configs.map((config) => (
              <Card key={config.id} className={!config.isEnabled ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-provider-${config.id}`}>
                          {config.displayName || config.providerName}
                        </CardTitle>
                        <CardDescription>{config.provider.toUpperCase()}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.isDefault && (
                        <Badge variant="default">Default</Badge>
                      )}
                      {config.sandboxMode && (
                        <Badge variant="secondary">Sandbox</Badge>
                      )}
                      <Badge variant={config.isEnabled ? "default" : "outline"}>
                        {config.isEnabled ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {config.isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {config.enabledForRides && (
                        <Badge variant="outline">Rides</Badge>
                      )}
                      {config.enabledForFood && (
                        <Badge variant="outline">Food</Badge>
                      )}
                      {config.enabledForParcels && (
                        <Badge variant="outline">Parcels</Badge>
                      )}
                    </div>
                    {config.merchantId && (
                      <p className="text-sm text-muted-foreground">
                        Merchant: {config.merchantName || config.merchantId}
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(config)}
                        data-testid={`button-edit-${config.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this configuration?")) {
                            deleteMutation.mutate(config.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${config.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
