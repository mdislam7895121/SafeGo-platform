import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, CreditCard, Plus, Check, Trash2, Loader2,
  AlertCircle, Smartphone, Wallet
} from "lucide-react";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface MobileWallet {
  id: string;
  walletBrand: string;
  walletPhoneMasked: string;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
}

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

interface MobileWalletsResponse {
  wallets: MobileWallet[];
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

const walletBrandColors: Record<string, string> = {
  bkash: "bg-pink-500",
  nagad: "bg-orange-500",
  rocket: "bg-purple-600",
  upay: "bg-green-500",
};

const walletBrandDisplayNames: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  upay: "Upay",
};

function getCardIcon(brand: string) {
  const Icon = cardBrandIcons[brand.toLowerCase()] || CreditCard;
  const colorClass = cardBrandColors[brand.toLowerCase()] || "text-muted-foreground";
  return <Icon className={`h-6 w-6 ${colorClass}`} />;
}

function getWalletIcon(brand: string) {
  const bgClass = walletBrandColors[brand.toLowerCase()] || "bg-gray-500";
  return (
    <div className={`h-10 w-10 rounded-lg ${bgClass} flex items-center justify-center`}>
      <Smartphone className="h-5 w-5 text-white" />
    </div>
  );
}

export default function PaymentMethods() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("cards");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
  const [showDeleteWalletDialog, setShowDeleteWalletDialog] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<MobileWallet | null>(null);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  
  const [newCard, setNewCard] = useState({
    brand: "visa",
    last4: "",
    expMonth: "",
    expYear: "",
    makeDefault: false,
  });

  const [newWallet, setNewWallet] = useState({
    walletBrand: "bkash",
    phoneNumber: "",
    makeDefault: false,
  });

  const { data, isLoading, error } = useQuery<PaymentMethodsResponse>({
    queryKey: ["/api/customer/payment-methods"],
  });

  const { data: walletsData, isLoading: walletsLoading } = useQuery<MobileWalletsResponse>({
    queryKey: ["/api/customer/mobile-wallets"],
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

  const addWalletMutation = useMutation({
    mutationFn: async (walletData: typeof newWallet) => {
      const response = await apiRequest("/api/customer/mobile-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletBrand: walletData.walletBrand,
          phoneNumber: walletData.phoneNumber,
          makeDefault: walletData.makeDefault,
        }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/mobile-wallets"] });
      if (data.requiresVerification && data.walletId) {
        setPendingWalletId(data.walletId);
        setShowAddWalletDialog(false);
        setShowOtpDialog(true);
        toast({
          title: "Verification required",
          description: "Please enter the OTP sent to your phone.",
        });
      } else {
        toast({
          title: "Wallet linked",
          description: "Your mobile wallet has been linked successfully.",
        });
        setShowAddWalletDialog(false);
        resetNewWallet();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to link wallet",
        description: error.message || "Could not link your mobile wallet. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyWalletMutation = useMutation({
    mutationFn: async ({ walletId, otp }: { walletId: string; otp: string }) => {
      const response = await apiRequest(`/api/customer/mobile-wallets/${walletId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/mobile-wallets"] });
      toast({
        title: "Wallet verified",
        description: "Your mobile wallet has been verified successfully.",
      });
      setShowOtpDialog(false);
      setPendingWalletId(null);
      setOtpCode("");
      resetNewWallet();
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setWalletDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/customer/mobile-wallets/${id}/default`, {
        method: "PUT",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/mobile-wallets"] });
      toast({
        title: "Default updated",
        description: "Your default mobile wallet has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update default wallet.",
        variant: "destructive",
      });
    },
  });

  const deleteWalletMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/customer/mobile-wallets/${id}`, {
        method: "DELETE",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/mobile-wallets"] });
      toast({
        title: "Wallet removed",
        description: "Your mobile wallet has been removed.",
      });
      setShowDeleteWalletDialog(false);
      setSelectedWallet(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Could not remove your wallet.",
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

  const resetNewWallet = () => {
    setNewWallet({
      walletBrand: "bkash",
      phoneNumber: "",
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

  const handleAddWallet = () => {
    const bdPhoneRegex = /^(?:\+?880|0)?1[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(newWallet.phoneNumber.replace(/\s/g, ""))) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Bangladeshi phone number.",
        variant: "destructive",
      });
      return;
    }
    addWalletMutation.mutate(newWallet);
  };

  const handleVerifyOtp = () => {
    if (!pendingWalletId || otpCode.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a 6-digit OTP.",
        variant: "destructive",
      });
      return;
    }
    verifyWalletMutation.mutate({ walletId: pendingWalletId, otp: otpCode });
  };

  const handleDeleteClick = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setShowDeleteDialog(true);
  };

  const handleDeleteWalletClick = (wallet: MobileWallet) => {
    setSelectedWallet(wallet);
    setShowDeleteWalletDialog(true);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  const handleSetWalletDefault = (id: string) => {
    setWalletDefaultMutation.mutate(id);
  };

  const paymentMethods = data?.paymentMethods || [];
  const mobileWallets = walletsData?.wallets || [];

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

      <div className="p-4 max-w-lg mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cards" data-testid="tab-cards">
              <CreditCard className="h-4 w-4 mr-2" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="wallets" data-testid="tab-wallets">
              <Wallet className="h-4 w-4 mr-2" />
              Mobile Wallets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4 space-y-4">
            <Card className="border-dashed hover-elevate cursor-pointer" onClick={() => setShowAddDialog(true)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium" data-testid="button-add-payment">Add payment card</p>
                    <p className="text-sm text-muted-foreground">Add a card for payments</p>
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
                  <h3 className="font-semibold mb-2">No cards added</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add a card to pay for your services
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
          </TabsContent>

          <TabsContent value="wallets" className="mt-4 space-y-4">
            <Card className="border-dashed hover-elevate cursor-pointer" onClick={() => setShowAddWalletDialog(true)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium" data-testid="button-add-wallet">Link mobile wallet</p>
                    <p className="text-sm text-muted-foreground">bKash, Nagad, Rocket, Upay</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {walletsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : mobileWallets.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="p-8 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">No wallets linked</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Link your bKash, Nagad, or other mobile wallets
                  </p>
                  <Button onClick={() => setShowAddWalletDialog(true)} data-testid="button-add-first-wallet">
                    <Plus className="h-4 w-4 mr-2" />
                    Link Wallet
                  </Button>
                </CardContent>
              </Card>
            ) : (
              mobileWallets.map((wallet) => (
                <Card 
                  key={wallet.id} 
                  className={`transition-all ${wallet.isDefault ? "ring-2 ring-primary" : ""}`}
                  data-testid={`wallet-${wallet.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {getWalletIcon(wallet.walletBrand)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {walletBrandDisplayNames[wallet.walletBrand] || wallet.walletBrand}
                          </p>
                          {wallet.isDefault && (
                            <Badge variant="default" className="text-[10px]">Default</Badge>
                          )}
                          {!wallet.isVerified && (
                            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {wallet.walletPhoneMasked}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {wallet.isVerified && !wallet.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetWalletDefault(wallet.id)}
                            disabled={setWalletDefaultMutation.isPending}
                            data-testid={`button-wallet-default-${wallet.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWalletClick(wallet)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-wallet-delete-${wallet.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Bangladesh Mobile Wallets</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Link your bKash, Nagad, Rocket, or Upay account to pay for rides and deliveries.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Test Mode</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  This is a demo environment. No real charges will be made.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Card</DialogTitle>
            <DialogDescription>
              Add a card for payments. This is test mode - no real charges.
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

      <Dialog open={showAddWalletDialog} onOpenChange={setShowAddWalletDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Mobile Wallet</DialogTitle>
            <DialogDescription>
              Link your bKash, Nagad, or other mobile wallet for easy payments.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Wallet Provider</Label>
              <Select
                value={newWallet.walletBrand}
                onValueChange={(value) => setNewWallet({ ...newWallet, walletBrand: value })}
              >
                <SelectTrigger data-testid="select-wallet-brand">
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="rocket">Rocket</SelectItem>
                  <SelectItem value="upay">Upay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={newWallet.phoneNumber}
                onChange={(e) => setNewWallet({ ...newWallet, phoneNumber: e.target.value })}
                placeholder="01XXXXXXXXX"
                data-testid="input-wallet-phone"
              />
              <p className="text-xs text-muted-foreground">
                Enter the phone number linked to your {walletBrandDisplayNames[newWallet.walletBrand]} account
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="walletMakeDefault"
                checked={newWallet.makeDefault}
                onChange={(e) => setNewWallet({ ...newWallet, makeDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-wallet-default"
              />
              <Label htmlFor="walletMakeDefault" className="text-sm font-normal cursor-pointer">
                Set as default payment method
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWalletDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddWallet} 
              disabled={addWalletMutation.isPending}
              data-testid="button-confirm-add-wallet"
            >
              {addWalletMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                "Link Wallet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOtpDialog} onOpenChange={(open) => {
        if (!open) {
          setShowOtpDialog(false);
          setPendingWalletId(null);
          setOtpCode("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Wallet</DialogTitle>
            <DialogDescription>
              Enter the 6-digit OTP sent to your phone to verify your wallet.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(value);
                }}
                placeholder="123456"
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                data-testid="input-otp"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowOtpDialog(false);
              setPendingWalletId(null);
              setOtpCode("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleVerifyOtp} 
              disabled={verifyWalletMutation.isPending || otpCode.length !== 6}
              data-testid="button-verify-otp"
            >
              {verifyWalletMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
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

      <AlertDialog open={showDeleteWalletDialog} onOpenChange={setShowDeleteWalletDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove mobile wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your {selectedWallet ? walletBrandDisplayNames[selectedWallet.walletBrand] : ""} wallet ({selectedWallet?.walletPhoneMasked})? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedWallet && deleteWalletMutation.mutate(selectedWallet.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-wallet"
            >
              {deleteWalletMutation.isPending ? (
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
