import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, CreditCard, Plus, Check, Trash2, Loader2,
  AlertCircle
} from "lucide-react";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

const cardBrandIcons: Record<string, typeof SiVisa> = {
  visa: SiVisa,
  mastercard: SiMastercard,
  amex: SiAmericanexpress,
  discover: CreditCard as any,
};

const cardBrandColors: Record<string, string> = {
  visa: "text-blue-600",
  mastercard: "text-red-500",
  amex: "text-blue-500",
  discover: "text-orange-500",
};

function getCardIcon(brand: string) {
  const Icon = cardBrandIcons[brand.toLowerCase()] || CreditCard;
  const colorClass = cardBrandColors[brand.toLowerCase()] || "text-muted-foreground";
  return <Icon className={`h-6 w-6 ${colorClass}`} />;
}

export default function PaymentMethods() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  
  const [newCard, setNewCard] = useState({
    brand: "visa",
    last4: "",
    expMonth: "",
    expYear: "",
    makeDefault: false,
  });

  const { data, isLoading, error } = useQuery<PaymentMethodsResponse>({
    queryKey: ["/api/customer/payment-methods"],
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (cardData: typeof newCard) => {
      const response = await apiRequest("/api/customer/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: cardData.brand,
          last4: cardData.last4,
          expMonth: parseInt(cardData.expMonth),
          expYear: parseInt(cardData.expYear),
          makeDefault: cardData.makeDefault,
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/payment-methods"] });
      toast({
        title: "Card added",
        description: "Your payment method has been added successfully.",
      });
      setShowAddDialog(false);
      resetNewCard();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add card",
        description: error.message || "Could not add your payment method. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/customer/payment-methods/${id}/default`, {
        method: "PUT",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/payment-methods"] });
      toast({
        title: "Default updated",
        description: "Your default payment method has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update default payment method.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/customer/payment-methods/${id}`, {
        method: "DELETE",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/payment-methods"] });
      toast({
        title: "Card removed",
        description: "Your payment method has been removed.",
      });
      setShowDeleteDialog(false);
      setSelectedMethod(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Could not remove your payment method.",
        variant: "destructive",
      });
    },
  });

  const resetNewCard = () => {
    setNewCard({
      brand: "visa",
      last4: "",
      expMonth: "",
      expYear: "",
      makeDefault: false,
    });
  };

  const handleAddCard = () => {
    if (newCard.last4.length !== 4 || !/^\d{4}$/.test(newCard.last4)) {
      toast({
        title: "Invalid card number",
        description: "Please enter the last 4 digits of your card.",
        variant: "destructive",
      });
      return;
    }

    const month = parseInt(newCard.expMonth);
    const year = parseInt(newCard.expYear);
    const currentYear = new Date().getFullYear();

    if (month < 1 || month > 12) {
      toast({
        title: "Invalid month",
        description: "Please enter a valid expiration month (1-12).",
        variant: "destructive",
      });
      return;
    }

    if (year < currentYear || year > currentYear + 20) {
      toast({
        title: "Invalid year",
        description: `Please enter a valid expiration year (${currentYear}-${currentYear + 20}).`,
        variant: "destructive",
      });
      return;
    }

    addPaymentMutation.mutate(newCard);
  };

  const handleDeleteClick = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setShowDeleteDialog(true);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  const paymentMethods = data?.paymentMethods || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Payment Methods</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Card className="border-dashed hover-elevate cursor-pointer" onClick={() => setShowAddDialog(true)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium" data-testid="button-add-payment">Add payment method</p>
                <p className="text-sm text-muted-foreground">Add a card for ride payments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Failed to load payment methods. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentMethods.length === 0 && !error && (
          <Card className="bg-muted/50">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No payment methods</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add a card to pay for your rides
              </p>
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-card">
                <Plus className="h-4 w-4 mr-2" />
                Add Card
              </Button>
            </CardContent>
          </Card>
        )}

        {paymentMethods.map((method) => (
          <Card 
            key={method.id} 
            className={`transition-all ${method.isDefault ? "ring-2 ring-primary" : ""}`}
            data-testid={`card-payment-${method.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  {getCardIcon(method.brand)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{method.brand}</p>
                    {method.isDefault && (
                      <Badge variant="default" className="text-[10px]" data-testid={`badge-default-${method.id}`}>
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    •••• {method.last4} · Expires {method.expMonth}/{method.expYear % 100}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                      disabled={setDefaultMutation.isPending}
                      data-testid={`button-set-default-${method.id}`}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(method)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-${method.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Test Mode</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  This is a demo environment. No real charges will be made to any cards added here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a card for ride payments. This is test mode - no real charges.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Card Type</Label>
              <Select
                value={newCard.brand}
                onValueChange={(value) => setNewCard({ ...newCard, brand: value })}
              >
                <SelectTrigger data-testid="select-card-brand">
                  <SelectValue placeholder="Select card type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                  <SelectItem value="amex">American Express</SelectItem>
                  <SelectItem value="discover">Discover</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="last4">Last 4 Digits</Label>
              <Input
                id="last4"
                value={newCard.last4}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setNewCard({ ...newCard, last4: value });
                }}
                placeholder="1234"
                maxLength={4}
                data-testid="input-last4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expMonth">Exp. Month</Label>
                <Input
                  id="expMonth"
                  value={newCard.expMonth}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setNewCard({ ...newCard, expMonth: value });
                  }}
                  placeholder="MM"
                  maxLength={2}
                  data-testid="input-exp-month"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expYear">Exp. Year</Label>
                <Input
                  id="expYear"
                  value={newCard.expYear}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setNewCard({ ...newCard, expYear: value });
                  }}
                  placeholder="YYYY"
                  maxLength={4}
                  data-testid="input-exp-year"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="makeDefault"
                checked={newCard.makeDefault}
                onChange={(e) => setNewCard({ ...newCard, makeDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-make-default"
              />
              <Label htmlFor="makeDefault" className="text-sm font-normal cursor-pointer">
                Set as default payment method
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddCard} 
              disabled={addPaymentMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Card"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this {selectedMethod?.brand} card ending in {selectedMethod?.last4}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMethod && deleteMutation.mutate(selectedMethod.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
