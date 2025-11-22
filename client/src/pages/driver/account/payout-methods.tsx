import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Plus, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function PayoutMethods() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);

  // Form state
  const [payoutType, setPayoutType] = useState<"bank_account" | "mobile_wallet">("bank_account");
  const [provider, setProvider] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [bankName, setBankName] = useState("");

  // Fetch payout methods
  const { data, isLoading } = useQuery<PayoutMethodsResponse>({
    queryKey: ["/api/driver/payout-methods"],
  });

  const methods = data?.methods || [];
  
  // Detect country from first method if available, otherwise default to US
  const countryCode = methods.length > 0 ? methods[0].countryCode : "US";

  // Create payout method mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/payout-methods", {
        payoutType,
        provider: payoutType === "mobile_wallet" ? provider : undefined,
        accountHolderName,
        accountNumber,
        routingNumber: payoutType === "bank_account" ? routingNumber : undefined,
        bankName: payoutType === "bank_account" ? bankName : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Payout method added",
        description: "Your payout method has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-method"] });
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

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/driver/payout-methods/${id}/set-default`, {});
    },
    onSuccess: () => {
      toast({
        title: "Default method updated",
        description: "Your default payout method has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-method"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default method",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/driver/payout-methods/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Method removed",
        description: "Payout method has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/payout-method"] });
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
  };

  const handleAddMethod = () => {
    if (!accountHolderName || !accountNumber) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (payoutType === "mobile_wallet" && !provider) {
      toast({
        title: "Missing information",
        description: "Please select a provider for mobile wallet",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate();
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
      {/* Header */}
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
        {/* Empty state */}
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

        {/* Methods list */}
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
                        <CreditCard className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
                <p>• Payouts are processed weekly or on-demand via cash out</p>
                <p>• It may take 1-3 business days for funds to arrive</p>
                <p>• Ensure your payout method information is accurate</p>
                <p>• You can change your primary payout method at any time</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Add Method Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-payout-method">
          <DialogHeader>
            <DialogTitle>Add Payout Method</DialogTitle>
            <DialogDescription>
              {countryCode === "BD"
                ? "Add a bank account or mobile wallet to receive payments"
                : "Add a bank account to receive payments"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payout Type */}
            <div className="space-y-2">
              <Label htmlFor="payoutType">Payout Type</Label>
              <Select value={payoutType} onValueChange={(v: any) => setPayoutType(v)}>
                <SelectTrigger data-testid="select-payout-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_account">Bank Account</SelectItem>
                  {countryCode === "BD" && <SelectItem value="mobile_wallet">Mobile Wallet</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Mobile Wallet Provider (BD only) */}
            {payoutType === "mobile_wallet" && countryCode === "BD" && (
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="rocket">Rocket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Account Holder Name */}
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

            {/* Account Number */}
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

            {/* Bank-specific fields */}
            {payoutType === "bank_account" && (
              <>
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
                  </div>
                )}

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
              </>
            )}
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

      {/* Delete Confirmation Dialog */}
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
