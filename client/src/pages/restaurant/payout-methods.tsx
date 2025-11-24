import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, CreditCard, Wallet, Ban, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddPayoutMethodForm from "@/components/restaurant/AddPayoutMethodForm";

interface PayoutMethod {
  id: string;
  payoutType: string;
  provider: string | null;
  displayName: string;
  accountHolderName: string;
  maskedAccount: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

export default function PayoutMethodsPage() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch payout methods using unified API
  const { data, isLoading } = useQuery<{ methods: PayoutMethod[] }>({
    queryKey: ["/api/payout/methods"],
  });

  // Delete mutation (DELETE endpoint instead of set-default/deactivate)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/payout/methods/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
      toast({
        title: "Success",
        description: "Payout method removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove payout method",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="gap-1" data-testid={`badge-status-active`}>
            <CheckCircle2 className="h-3 w-3" />
            Active
          </Badge>
        );
      case "pending_verification":
        return (
          <Badge variant="secondary" className="gap-1" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="outline" className="gap-1" data-testid={`badge-status-inactive`}>
            <Ban className="h-3 w-3" />
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPayoutIcon = (payoutType: string) => {
    if (payoutType === "bank_account" || payoutType === "stripe_connect") {
      return <CreditCard className="h-5 w-5 text-muted-foreground" />;
    }
    return <Wallet className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="container mx-auto mt-6 py-6 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-payout-methods">Payout Methods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage how you receive payments from SafeGo Eats
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-payout-method">
              <Plus className="h-4 w-4" />
              Add Payout Method
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg mx-auto px-4 md:px-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Payout Method</DialogTitle>
              <DialogDescription>
                Add a new method to receive your earnings. All information is securely encrypted.
              </DialogDescription>
            </DialogHeader>
            <AddPayoutMethodForm onSuccess={() => setAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.methods && data.methods.length > 0 ? (
        <div className="space-y-3">
          {data.methods.map((method) => (
            <Card key={method.id} data-testid={`card-payout-method-${method.id}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                      {getPayoutIcon(method.payoutType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" data-testid={`text-account-holder-${method.id}`}>
                          {method.accountHolderName}
                        </h3>
                        {method.isDefault && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-default-${method.id}`}>
                            Default
                          </Badge>
                        )}
                        {getStatusBadge(method.status)}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-masked-account-${method.id}`}>
                        {method.displayName || method.provider || method.payoutType.replace(/_/g, " ")} ****{method.maskedAccount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {method.payoutType.replace(/_/g, " ").toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${method.id}`}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Payout Method?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove <strong>{method.accountHolderName} (****{method.maskedAccount})</strong> from your payout methods. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`button-cancel-delete-${method.id}`}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(method.id)}
                            data-testid={`button-confirm-delete-${method.id}`}
                          >
                            Remove Method
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center">No Payout Methods</CardTitle>
            <CardDescription className="text-center">
              Add a payout method to start receiving your earnings
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2" data-testid="button-add-first-payout-method">
              <Plus className="h-4 w-4" />
              Add Your First Payout Method
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Security Notice:</strong> All payout information is encrypted and stored securely. Some payout methods may require KYC verification before activation.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
