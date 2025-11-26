import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  ArrowLeft,
  Plus,
  CreditCard,
  Building2,
  Smartphone,
  Trash2,
  Check,
  AlertCircle,
  ShieldCheck,
  Clock,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PayoutMethod {
  id: string;
  payoutType: string;
  provider: string | null;
  displayName: string;
  accountHolderName: string | null;
  maskedAccount: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

interface PayoutMethodsResponse {
  methods: PayoutMethod[];
  kycStatus?: string;
  kycApproved?: boolean;
  canAddMethod?: boolean;
}

const statusConfig: Record<string, { icon: typeof Check; color: string; label: string }> = {
  active: { icon: ShieldCheck, color: "text-green-600", label: "Verified" },
  pending: { icon: Clock, color: "text-amber-600", label: "Pending Verification" },
  failed: { icon: XCircle, color: "text-destructive", label: "Verification Failed" },
};

const payoutTypeLabels: Record<string, string> = {
  bank_account: "Bank Account",
  BANK_ACCOUNT: "Bank Account",
  mobile_wallet: "Mobile Wallet",
  MOBILE_WALLET: "Mobile Wallet",
  stripe: "Stripe",
  paypal: "PayPal",
};

const mobileProviders = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "upay", label: "Upay" },
];

export default function DriverWalletMethods() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);

  const [formData, setFormData] = useState({
    payoutType: "bank_account" as "bank_account" | "mobile_wallet",
    accountHolderName: "",
    accountNumber: "",
    routingNumber: "",
    bankName: "",
    branchName: "",
    mobileWalletNumber: "",
    provider: "",
  });

  const { data, isLoading, error } = useQuery<PayoutMethodsResponse>({
    queryKey: ["/api/payout/methods"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        payoutType: formData.payoutType,
        accountHolderName: formData.accountHolderName,
      };

      if (formData.payoutType === "bank_account") {
        payload.accountNumber = formData.accountNumber;
        payload.routingNumber = formData.routingNumber;
        payload.bankName = formData.bankName;
        payload.branchName = formData.branchName;
      } else {
        payload.mobileWalletNumber = formData.mobileWalletNumber;
        payload.provider = formData.provider;
      }

      return apiRequest("/api/payout/methods", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Payout method added",
        description: "Your payout method has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/summary"] });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const message = err.message || "Failed to add payout method";
      if (message.includes("KYC") || message.includes("verification")) {
        toast({
          title: "Verification Required",
          description: "Please complete your identity verification to add payout methods.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/payout/methods/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Method removed",
        description: "Payout method has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/summary"] });
      setDeleteDialogOpen(false);
      setSelectedMethod(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to remove payout method",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      payoutType: "bank_account",
      accountHolderName: "",
      accountNumber: "",
      routingNumber: "",
      bankName: "",
      branchName: "",
      mobileWalletNumber: "",
      provider: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.accountHolderName) {
      toast({
        title: "Missing information",
        description: "Please enter account holder name",
        variant: "destructive",
      });
      return;
    }

    if (formData.payoutType === "bank_account") {
      if (!formData.accountNumber || !formData.bankName) {
        toast({
          title: "Missing information",
          description: "Please fill in all required bank details",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!formData.mobileWalletNumber || !formData.provider) {
        toast({
          title: "Missing information",
          description: "Please select a provider and enter your mobile number",
          variant: "destructive",
        });
        return;
      }
    }

    createMutation.mutate();
  };

  const methods = data?.methods || [];
  const kycApproved = data?.kycApproved ?? false;
  const canAddMethod = data?.canAddMethod ?? kycApproved;

  const isKycError = !kycApproved || (error && (
    (error as any).message?.includes("KYC") ||
    (error as any).message?.includes("verification") ||
    (error as any).status === 403
  ));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver/wallet")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Payout Methods</h1>
            <p className="text-sm text-muted-foreground">Manage how you receive your earnings</p>
          </div>
        </div>

        {!kycApproved && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-medium text-amber-800 dark:text-amber-200">
                    Verification Required
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Please complete your identity and bank verification to enable payouts.
                  </p>
                  <Link href="/driver/account">
                    <Button size="sm" variant="outline" data-testid="button-review-status">
                      Review Account Status
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {methods.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">No payout methods yet</h3>
              <p className="text-muted-foreground mb-6">
                Add a payout method to receive your earnings
              </p>
              <Button
                onClick={() => setAddDialogOpen(true)}
                disabled={!canAddMethod}
                data-testid="button-add-first"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Payout Method
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {methods.map((method) => {
                const StatusIcon = statusConfig[method.status]?.icon || Clock;
                const statusColor = statusConfig[method.status]?.color || "text-muted-foreground";
                const statusLabel = statusConfig[method.status]?.label || method.status;
                const typeLabel = payoutTypeLabels[method.payoutType] || method.payoutType;

                return (
                  <Card key={method.id} data-testid={`card-method-${method.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {method.payoutType.toLowerCase().includes("mobile") ? (
                              <Smartphone className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{method.displayName || typeLabel}</p>
                              {method.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {method.accountHolderName}
                            </p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {method.maskedAccount}
                            </p>
                            <div className={`flex items-center gap-1.5 mt-1 text-xs ${statusColor}`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              <span>{statusLabel}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedMethod(method);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${method.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
              disabled={!canAddMethod}
              data-testid="button-add-method"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payout Method
            </Button>
          </>
        )}

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-add-method">
            <DialogHeader>
              <DialogTitle>Add Payout Method</DialogTitle>
              <DialogDescription>
                Add a bank account or mobile wallet to receive your earnings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Method Type</Label>
                <Select
                  value={formData.payoutType}
                  onValueChange={(value: "bank_account" | "mobile_wallet") =>
                    setFormData({ ...formData, payoutType: value })
                  }
                >
                  <SelectTrigger data-testid="select-payout-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Bank Account
                      </div>
                    </SelectItem>
                    <SelectItem value="mobile_wallet">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Mobile Wallet
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                <Input
                  id="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                  placeholder="Full legal name"
                  data-testid="input-holder-name"
                />
              </div>

              {formData.payoutType === "bank_account" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g., Chase Bank"
                      data-testid="input-bank-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input
                        id="accountNumber"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        placeholder="••••••••"
                        data-testid="input-account-number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="routingNumber">Routing Number</Label>
                      <Input
                        id="routingNumber"
                        value={formData.routingNumber}
                        onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
                        placeholder="9 digits"
                        data-testid="input-routing-number"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branchName">Branch Name (Optional)</Label>
                    <Input
                      id="branchName"
                      value={formData.branchName}
                      onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                      placeholder="Branch location"
                      data-testid="input-branch-name"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Provider *</Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value) => setFormData({ ...formData, provider: value })}
                    >
                      <SelectTrigger data-testid="select-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {mobileProviders.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobileWalletNumber">Mobile Number *</Label>
                    <Input
                      id="mobileWalletNumber"
                      value={formData.mobileWalletNumber}
                      onChange={(e) => setFormData({ ...formData, mobileWalletNumber: e.target.value })}
                      placeholder="+880 1XXX-XXXXXX"
                      data-testid="input-mobile-number"
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false);
                  resetForm();
                }}
                disabled={createMutation.isPending}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="button-submit-method"
              >
                {createMutation.isPending ? "Adding..." : "Add Method"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-method">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Payout Method?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this payout method? You won't be able to receive
                payouts to this account anymore.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedMethod && deleteMutation.mutate(selectedMethod.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
