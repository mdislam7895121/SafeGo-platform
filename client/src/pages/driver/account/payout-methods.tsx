import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Plus, Check, Trash2, Building2, Smartphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  PayoutRailType,
  BankAccountType,
  BankAccountTypeLabels,
  CountryPayoutTypes,
  CountryMobileWalletProviders,
} from "@shared/types";

interface PayoutMethod {
  id: string;
  type: string;
  provider: string | null;
  displayName: string;
  accountHolderName: string;
  maskedAccount: string;
  countryCode: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

interface PayoutMethodsResponse {
  methods: PayoutMethod[];
}

interface DriverProfile {
  countryCode?: string;
}

type PayoutType = "bank_account" | "mobile_wallet" | "stripe_connect";

export default function PayoutMethods() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);

  const [payoutType, setPayoutType] = useState<PayoutType>("bank_account");
  const [provider, setProvider] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState<string>(BankAccountType.CHECKING);

  const { data, isLoading } = useQuery<PayoutMethodsResponse>({
    queryKey: ["/api/driver/payout-methods"],
  });

  const { data: profileData } = useQuery<DriverProfile>({
    queryKey: ["/api/driver/profile"],
  });

  const methods = data?.methods || [];
  const countryCode = profileData?.countryCode || (methods.length > 0 ? methods[0].countryCode : "US");

  const availablePayoutTypes = CountryPayoutTypes[countryCode] || [PayoutRailType.BANK_ACCOUNT];
  const availableWalletProviders = CountryMobileWalletProviders[countryCode] || [];

  useEffect(() => {
    if (!availablePayoutTypes.includes(PayoutRailType.BANK_ACCOUNT) && payoutType === "bank_account") {
      if (availablePayoutTypes.includes(PayoutRailType.MOBILE_WALLET)) {
        setPayoutType("mobile_wallet");
      } else if (availablePayoutTypes.includes(PayoutRailType.EXTERNAL_PROVIDER)) {
        setPayoutType("stripe_connect");
      }
    }
  }, [countryCode, availablePayoutTypes, payoutType]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        payoutType,
        accountHolderName,
      };

      if (payoutType === "bank_account") {
        payload.accountNumber = accountNumber;
        payload.routingNumber = routingNumber;
        payload.bankName = bankName;
        payload.accountType = accountType;
      } else if (payoutType === "mobile_wallet") {
        payload.provider = provider;
        payload.accountNumber = accountNumber;
      } else if (payoutType === "stripe_connect") {
        payload.accountNumber = "";
      }

      return await apiRequest("/api/driver/payout-methods", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Payout method added",
        description: "Your payout method has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-method"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add payout method",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/driver/payout-methods/${id}/set-default`, {
        method: "PATCH",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Default method updated",
        description: "Your default payout method has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-method"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default method",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/driver/payout-methods/${id}`, {
        method: "DELETE",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Method removed",
        description: "Payout method has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-method"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
      setDeleteDialogOpen(false);
      setSelectedMethod(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove payout method",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setPayoutType("bank_account");
    setProvider("");
    setAccountHolderName("");
    setAccountNumber("");
    setRoutingNumber("");
    setBankName("");
    setAccountType(BankAccountType.CHECKING);
  };

  const handleAddMethod = () => {
    if (!accountHolderName) {
      toast({
        title: "Missing information",
        description: "Please enter the account holder name",
        variant: "destructive",
      });
      return;
    }

    if (payoutType === "bank_account") {
      if (!accountNumber) {
        toast({
          title: "Missing information",
          description: "Please enter the account number",
          variant: "destructive",
        });
        return;
      }
      if (!accountType) {
        toast({
          title: "Missing information",
          description: "Please select an account type",
          variant: "destructive",
        });
        return;
      }
    }

    if (payoutType === "mobile_wallet") {
      if (!provider) {
        toast({
          title: "Missing information",
          description: "Please select a wallet provider",
          variant: "destructive",
        });
        return;
      }
      if (!accountNumber) {
        toast({
          title: "Missing information",
          description: "Please enter your mobile wallet number",
          variant: "destructive",
        });
        return;
      }
    }

    createMutation.mutate();
  };

  const handlePayoutTypeChange = (value: PayoutType) => {
    setPayoutType(value);
    setProvider("");
    setAccountNumber("");
    setRoutingNumber("");
    setBankName("");
    setAccountType(BankAccountType.CHECKING);
  };

  const getPayoutTypeLabel = () => {
    if (countryCode === "BD") {
      return "Add a bank account or mobile wallet to receive payments";
    } else if (countryCode === "US") {
      return "Add a bank account or connect with Stripe to receive payments";
    }
    return "Add a bank account to receive payments";
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="bg-primary text-primary-foreground p-6">
          <div className="flex items-center gap-4">
            <Link href="/driver/wallet">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Payout Methods</h1>
          </div>
        </div>
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/wallet">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Payout Methods</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {methods.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payout methods yet</h3>
              <p className="text-muted-foreground mb-6">
                Add a payout method to receive your earnings
              </p>
              <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-first-method">
                <Plus className="h-4 w-4 mr-2" />
                Add Payout Method
              </Button>
            </CardContent>
          </Card>
        )}

        {methods.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Your Payout Methods</CardTitle>
                <CardDescription>Manage how you receive your earnings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                    data-testid={`method-${method.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {method.type === "mobile_wallet" ? (
                          <Smartphone className="h-6 w-6 text-primary" />
                        ) : (
                          <Building2 className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium truncate">{method.displayName}</p>
                          {method.isDefault && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <Check className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{method.accountHolderName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!method.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(method.id)}
                          disabled={setDefaultMutation.isPending}
                          data-testid={`button-set-default-${method.id}`}
                        >
                          Set as primary
                        </Button>
                      )}
                      {!method.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedMethod(method);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-${method.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setAddDialogOpen(true)}
                  data-testid="button-add-another"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Method
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About Payouts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Payouts are processed weekly or on-demand via cash out</p>
                <p>It may take 1-3 business days for funds to arrive</p>
                <p>Ensure your payout method information is accurate</p>
                <p>You can change your primary payout method at any time</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-add-payout-method">
          <DialogHeader>
            <DialogTitle>Add Payout Method</DialogTitle>
            <DialogDescription>
              {getPayoutTypeLabel()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payoutType">Payout Type</Label>
              <Select value={payoutType} onValueChange={handlePayoutTypeChange}>
                <SelectTrigger data-testid="select-payout-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availablePayoutTypes.includes(PayoutRailType.BANK_ACCOUNT) && (
                    <SelectItem value="bank_account">
                      <span className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2" />
                        Bank Account
                      </span>
                    </SelectItem>
                  )}
                  {availablePayoutTypes.includes(PayoutRailType.MOBILE_WALLET) && (
                    <SelectItem value="mobile_wallet">
                      <span className="flex items-center">
                        <Smartphone className="h-4 w-4 mr-2" />
                        Mobile Wallet
                      </span>
                    </SelectItem>
                  )}
                  {availablePayoutTypes.includes(PayoutRailType.EXTERNAL_PROVIDER) && (
                    <SelectItem value="stripe_connect">
                      <span className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Stripe Connect
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {payoutType === "mobile_wallet" && availableWalletProviders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="provider">Wallet Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWalletProviders.map((walletProvider) => (
                      <SelectItem key={walletProvider} value={walletProvider.toLowerCase()}>
                        {walletProvider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="accountHolderName">Account Holder Name</Label>
              <Input
                id="accountHolderName"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Full name on account"
                data-testid="input-account-holder"
              />
            </div>

            {payoutType !== "stripe_connect" && (
              <div className="space-y-2">
                <Label htmlFor="accountNumber">
                  {payoutType === "mobile_wallet" ? "Mobile Number" : "Account Number"}
                </Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={
                    payoutType === "mobile_wallet"
                      ? "01XXXXXXXXX"
                      : "Account number"
                  }
                  data-testid="input-account-number"
                />
              </div>
            )}

            {payoutType === "bank_account" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Name of your bank"
                    data-testid="input-bank-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger data-testid="select-account-type">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BankAccountTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Select the type of bank account (checking, savings, or business)
                  </p>
                </div>

                {countryCode === "US" && (
                  <div className="space-y-2">
                    <Label htmlFor="routingNumber">Routing Number</Label>
                    <Input
                      id="routingNumber"
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value)}
                      placeholder="9-digit routing number"
                      data-testid="input-routing-number"
                    />
                    <p className="text-sm text-muted-foreground">
                      The 9-digit ABA routing number for your bank
                    </p>
                  </div>
                )}
              </>
            )}

            {payoutType === "stripe_connect" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Stripe Connect setup will be initiated after saving. You'll be redirected to complete 
                  the Stripe onboarding process to verify your identity and connect your bank account.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This payout method requires <strong>FULL</strong> KYC verification. 
                Please ensure your identity documents are submitted and verified.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMethod}
              disabled={createMutation.isPending}
              data-testid="button-confirm-add"
            >
              {createMutation.isPending ? "Adding..." : "Add Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle>Remove Payout Method</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this payout method? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedMethod && (
            <div className="p-4 rounded-lg border">
              <p className="font-medium">{selectedMethod.displayName}</p>
              <p className="text-sm text-muted-foreground">{selectedMethod.accountHolderName}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setSelectedMethod(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedMethod && deleteMutation.mutate(selectedMethod.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
