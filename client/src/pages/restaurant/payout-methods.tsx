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
  payoutRailType: string;
  provider: string;
  currency: string;
  countryCode: string;
  maskedDetails: string;
  status: string;
  isDefault: boolean;
  createdAt: string;
}

export default function PayoutMethodsPage() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch payout methods
  const { data, isLoading } = useQuery<{ payoutMethods: PayoutMethod[] }>({
    queryKey: ["/api/restaurants/me/payout-methods"],
  });

  // Set as default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/restaurants/me/payout-methods/${id}/set-default`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me/payout-methods"] });
      toast({
        title: "Success",
        description: "Default payout method updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default payout method",
        variant: "destructive",
      });
    },
  });

  // Disable mutation
  const disableMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/restaurants/me/payout-methods/${id}/disable`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me/payout-methods"] });
      toast({
        title: "Success",
        description: "Payout method disabled successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable payout method",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="default" className="gap-1" data-testid={`badge-status-active`}>
            <CheckCircle2 className="h-3 w-3" />
            Active
          </Badge>
        );
      case "PENDING_VERIFICATION":
        return (
          <Badge variant="secondary" className="gap-1" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "DISABLED":
        return (
          <Badge variant="outline" className="gap-1" data-testid={`badge-status-disabled`}>
            <Ban className="h-3 w-3" />
            Disabled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPayoutIcon = (railType: string) => {
    if (railType.includes("BANK") || railType.includes("ACH")) {
      return <CreditCard className="h-5 w-5 text-muted-foreground" />;
    }
    return <Wallet className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 p-6">
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
      ) : data?.payoutMethods && data.payoutMethods.length > 0 ? (
        <div className="space-y-3">
          {data.payoutMethods.map((method) => (
            <Card key={method.id} data-testid={`card-payout-method-${method.id}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                      {getPayoutIcon(method.payoutRailType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" data-testid={`text-payout-provider-${method.id}`}>
                          {method.provider}
                        </h3>
                        {method.isDefault && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-default-${method.id}`}>
                            Default
                          </Badge>
                        )}
                        {getStatusBadge(method.status)}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-masked-details-${method.id}`}>
                        {method.maskedDetails}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {method.payoutRailType} • {method.currency} • {method.countryCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && method.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(method.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${method.id}`}
                      >
                        Set as Default
                      </Button>
                    )}
                    {method.status !== "DISABLED" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={disableMutation.isPending}
                            data-testid={`button-disable-${method.id}`}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disable Payout Method?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will disable <strong>{method.maskedDetails}</strong>. You won't be able to receive payouts to this method until you re-enable it.
                              {method.isDefault && (
                                <span className="block mt-2 text-orange-600 dark:text-orange-400">
                                  <AlertCircle className="h-4 w-4 inline mr-1" />
                                  This is your default payout method. Please set another method as default before disabling.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid={`button-cancel-disable-${method.id}`}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => disableMutation.mutate(method.id)}
                              disabled={method.isDefault}
                              data-testid={`button-confirm-disable-${method.id}`}
                            >
                              Disable Method
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
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
