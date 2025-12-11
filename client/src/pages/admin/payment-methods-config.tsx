import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, Plus, Settings, Check, X, CreditCard, Smartphone, 
  Banknote, ToggleLeft, ToggleRight, Edit2, Trash2, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

interface PaymentConfig {
  id: string;
  countryCode: string;
  methodType: string;
  provider: string;
  serviceType: string;
  isEnabled: boolean;
  displayName: string | null;
  description: string | null;
  iconName: string | null;
  sortOrder: number;
  supportsSaving: boolean;
  isDefaultForCountry: boolean;
  priority: number;
  requiresKycLevel: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  supportsRecurring: boolean;
  createdAt: string;
}

interface ConfigsResponse {
  configs: PaymentConfig[];
  summary: {
    total: number;
    enabled: number;
    byCountry: Record<string, number>;
    byService: Record<string, number>;
  };
}

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  stripe_card: CreditCard,
  bkash: Smartphone,
  nagad: Smartphone,
  rocket: Smartphone,
  upay: Smartphone,
  cash: Banknote,
  apple_pay: Smartphone,
  google_pay: Smartphone,
};

const COUNTRY_NAMES: Record<string, string> = {
  BD: "Bangladesh",
  US: "United States",
};

const SERVICE_NAMES: Record<string, string> = {
  GLOBAL: "All Services",
  RIDE: "Ride-Hailing",
  FOOD: "Food Delivery",
  PARCEL: "Parcel Delivery",
};

const PROVIDER_OPTIONS = [
  { value: "stripe", label: "Stripe" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "upay", label: "Upay" },
  { value: "sslcommerz", label: "SSLCommerz" },
  { value: "cash", label: "Cash" },
];

const METHOD_OPTIONS = [
  { value: "stripe_card", label: "Stripe Card" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "upay", label: "Upay" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "google_pay", label: "Google Pay" },
  { value: "sslcommerz", label: "SSLCommerz" },
  { value: "cash", label: "Cash" },
];

export default function PaymentMethodsConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PaymentConfig | null>(null);

  const [formData, setFormData] = useState({
    countryCode: "US",
    methodType: "stripe_card",
    provider: "stripe",
    serviceType: "GLOBAL",
    isEnabled: true,
    displayName: "",
    description: "",
    iconName: "credit-card",
    sortOrder: 10,
    supportsSaving: true,
    isDefaultForCountry: false,
    priority: 50,
    requiresKycLevel: "",
    minAmount: "",
    maxAmount: "",
    supportsRecurring: false,
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (selectedCountry !== "all") params.append("country", selectedCountry);
    if (selectedService !== "all") params.append("service", selectedService);
    return params.toString();
  };

  const { data, isLoading } = useQuery<ConfigsResponse>({
    queryKey: ["/api/admin/payment-config", selectedCountry, selectedService],
    queryFn: async () => {
      const qs = buildQueryString();
      const response = await fetch(`/api/admin/payment-config${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch payment configs");
      return response.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/payment-config/${id}/toggle`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-config"] });
      toast({ title: "Status updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to toggle status",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingConfig
        ? `/api/admin/payment-config/${editingConfig.id}`
        : "/api/admin/payment-config";
      return apiRequest(url, {
        method: editingConfig ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          sortOrder: parseInt(data.sortOrder) || 10,
          priority: parseInt(data.priority) || 50,
          minAmount: data.minAmount ? parseFloat(data.minAmount) : null,
          maxAmount: data.maxAmount ? parseFloat(data.maxAmount) : null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-config"] });
      toast({
        title: editingConfig ? "Configuration updated" : "Configuration created",
        description: "Payment method configuration saved successfully.",
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
      return apiRequest(`/api/admin/payment-config/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-config"] });
      toast({ title: "Configuration deleted" });
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
      countryCode: "US",
      methodType: "stripe_card",
      provider: "stripe",
      serviceType: "GLOBAL",
      isEnabled: true,
      displayName: "",
      description: "",
      iconName: "credit-card",
      sortOrder: 10,
      supportsSaving: true,
      isDefaultForCountry: false,
      priority: 50,
      requiresKycLevel: "",
      minAmount: "",
      maxAmount: "",
      supportsRecurring: false,
    });
  };

  const handleEdit = (config: PaymentConfig) => {
    setEditingConfig(config);
    setFormData({
      countryCode: config.countryCode,
      methodType: config.methodType,
      provider: config.provider,
      serviceType: config.serviceType,
      isEnabled: config.isEnabled,
      displayName: config.displayName || "",
      description: config.description || "",
      iconName: config.iconName || "credit-card",
      sortOrder: config.sortOrder,
      supportsSaving: config.supportsSaving,
      isDefaultForCountry: config.isDefaultForCountry,
      priority: config.priority,
      requiresKycLevel: config.requiresKycLevel || "",
      minAmount: config.minAmount?.toString() || "",
      maxAmount: config.maxAmount?.toString() || "",
      supportsRecurring: config.supportsRecurring || false,
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.methodType || !formData.provider) {
      toast({
        title: "Validation error",
        description: "Method type and provider are required",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getMethodIcon = (methodType: string) => {
    const Icon = METHOD_ICONS[methodType] || CreditCard;
    return <Icon className="h-4 w-4" />;
  };

  const configs = data?.configs || [];
  const summary = data?.summary;

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
              <h1 className="text-2xl font-bold">Payment Methods Configuration</h1>
              <p className="text-sm opacity-80">Manage available payment methods by country and service</p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            onClick={() => {
              resetForm();
              setEditingConfig(null);
              setIsAddDialogOpen(true);
            }}
            data-testid="button-add-config"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Method
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-muted-foreground">Total Methods</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{summary.enabled}</div>
                <div className="text-sm text-muted-foreground">Enabled</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{Object.keys(summary.byCountry).length}</div>
                <div className="text-sm text-muted-foreground">Countries</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{Object.keys(summary.byService).length}</div>
                <div className="text-sm text-muted-foreground">Service Types</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-48">
                <Label>Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger data-testid="filter-country">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Label>Service Type</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger data-testid="filter-service">
                    <SelectValue placeholder="All services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="GLOBAL">Global</SelectItem>
                    <SelectItem value="RIDE">Ride-Hailing</SelectItem>
                    <SelectItem value="FOOD">Food Delivery</SelectItem>
                    <SelectItem value="PARCEL">Parcel Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Configure which payment methods are available for each country and service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment configurations found. Add one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id} data-testid={`row-config-${config.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getMethodIcon(config.methodType)}
                          <div>
                            <div className="font-medium">
                              {config.displayName || config.methodType}
                            </div>
                            {config.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {config.description}
                              </div>
                            )}
                          </div>
                          {config.isDefaultForCountry && (
                            <Badge variant="outline" className="text-[10px]">Default</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {COUNTRY_NAMES[config.countryCode] || config.countryCode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {SERVICE_NAMES[config.serviceType] || config.serviceType}
                      </TableCell>
                      <TableCell>{config.provider}</TableCell>
                      <TableCell>{config.priority}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMutation.mutate(config.id)}
                          disabled={toggleMutation.isPending}
                          data-testid={`toggle-${config.id}`}
                        >
                          {config.isEnabled ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(config)}
                            data-testid={`edit-${config.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this configuration?")) {
                                deleteMutation.mutate(config.id);
                              }
                            }}
                            data-testid={`delete-${config.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog 
        open={isAddDialogOpen} 
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            resetForm();
            setEditingConfig(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit" : "Add"} Payment Method Configuration
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="limits">Limits & Fees</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={formData.countryCode}
                    onValueChange={(v) => setFormData({ ...formData, countryCode: v })}
                    disabled={!!editingConfig}
                  >
                    <SelectTrigger data-testid="input-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(v) => setFormData({ ...formData, serviceType: v })}
                    disabled={!!editingConfig}
                  >
                    <SelectTrigger data-testid="input-service">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">All Services</SelectItem>
                      <SelectItem value="RIDE">Ride-Hailing</SelectItem>
                      <SelectItem value="FOOD">Food Delivery</SelectItem>
                      <SelectItem value="PARCEL">Parcel Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Method Type</Label>
                  <Select
                    value={formData.methodType}
                    onValueChange={(v) => setFormData({ ...formData, methodType: v })}
                    disabled={!!editingConfig}
                  >
                    <SelectTrigger data-testid="input-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(v) => setFormData({ ...formData, provider: v })}
                    disabled={!!editingConfig}
                  >
                    <SelectTrigger data-testid="input-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    data-testid="input-priority"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    data-testid="input-sort-order"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isEnabled}
                    onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
                    data-testid="switch-enabled"
                  />
                  <Label>Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.supportsSaving}
                    onCheckedChange={(v) => setFormData({ ...formData, supportsSaving: v })}
                    data-testid="switch-supports-saving"
                  />
                  <Label>Supports Saving</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isDefaultForCountry}
                    onCheckedChange={(v) => setFormData({ ...formData, isDefaultForCountry: v })}
                    data-testid="switch-default"
                  />
                  <Label>Default for Country</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g., Credit/Debit Card"
                  data-testid="input-display-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Pay securely with Visa, Mastercard, or AmEx"
                  data-testid="input-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Icon Name</Label>
                <Input
                  value={formData.iconName}
                  onChange={(e) => setFormData({ ...formData, iconName: e.target.value })}
                  placeholder="e.g., credit-card, smartphone, banknote"
                  data-testid="input-icon"
                />
              </div>
              <div className="space-y-2">
                <Label>Required KYC Level</Label>
                <Select
                  value={formData.requiresKycLevel}
                  onValueChange={(v) => setFormData({ ...formData, requiresKycLevel: v })}
                >
                  <SelectTrigger data-testid="input-kyc-level">
                    <SelectValue placeholder="No requirement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No requirement</SelectItem>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="BASIC">Basic</SelectItem>
                    <SelectItem value="FULL">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="limits" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                    placeholder="No minimum"
                    data-testid="input-min-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.maxAmount}
                    onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                    placeholder="No limit"
                    data-testid="input-max-amount"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={formData.supportsRecurring}
                  onCheckedChange={(v) => setFormData({ ...formData, supportsRecurring: v })}
                  data-testid="switch-recurring"
                />
                <Label>Supports Recurring Payments</Label>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save">
              {saveMutation.isPending ? "Saving..." : (editingConfig ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
