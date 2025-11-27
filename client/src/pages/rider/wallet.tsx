import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  CreditCard,
  Plus,
  Gift,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Percent,
} from "lucide-react";

interface WalletData {
  balance: number;
  currency: string;
  credits: number;
  paymentMethods: {
    id: string;
    type: string;
    last4: string;
    brand: string;
    isDefault: boolean;
  }[];
  transactions: {
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }[];
  promotions: {
    id: string;
    code: string;
    description: string;
    discount: number;
    expiresAt: string;
  }[];
}

export default function RiderWallet() {
  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/customer/wallet"],
  });

  const balance = walletData?.balance || 0;
  const credits = walletData?.credits || 0;
  const paymentMethods = walletData?.paymentMethods || [];
  const transactions = walletData?.transactions || [];
  const promotions = walletData?.promotions || [];

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-wallet-title">
          Wallet
        </h1>
        <p className="text-muted-foreground">
          Manage your balance and payment methods
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardHeader>
            <CardDescription className="text-primary-foreground/80">
              SafeGo Balance
            </CardDescription>
            <CardTitle className="text-3xl" data-testid="text-wallet-balance">
              ${balance.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" data-testid="button-add-funds">
                <Plus className="h-4 w-4 mr-1" />
                Add Funds
              </Button>
              <Button variant="secondary" size="sm" data-testid="button-withdraw">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Ride Credits</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2" data-testid="text-wallet-credits">
              <Gift className="h-6 w-6 text-purple-500" />
              ${credits.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Credits are applied automatically to your next ride
            </p>
            <Link href="/rider/promotions">
              <Button variant="outline" size="sm" data-testid="button-add-promo-code">
                <Percent className="h-4 w-4 mr-1" />
                Add Promo Code
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <Link href="/rider/wallet/methods">
              <Button variant="ghost" size="sm" data-testid="button-manage-payment-methods">
                Manage
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-6">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No payment methods added</p>
              <Link href="/rider/wallet/methods">
                <Button size="sm" data-testid="button-add-payment-method">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Payment Method
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.slice(0, 3).map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`payment-method-${method.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-background flex items-center justify-center">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {method.brand} ****{method.last4}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {method.type}
                      </p>
                    </div>
                  </div>
                  {method.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Transactions
            </CardTitle>
            <Link href="/rider/wallet/history">
              <Button variant="ghost" size="sm" data-testid="button-view-transaction-history">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between py-2"
                  data-testid={`transaction-${txn.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      txn.type === "credit" 
                        ? "bg-green-500/10 text-green-500" 
                        : "bg-red-500/10 text-red-500"
                    }`}>
                      {txn.type === "credit" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`font-medium ${
                    txn.type === "credit" ? "text-green-500" : "text-foreground"
                  }`}>
                    {txn.type === "credit" ? "+" : "-"}${Math.abs(txn.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {promotions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-500" />
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10"
                  data-testid={`promo-${promo.id}`}
                >
                  <div>
                    <p className="font-medium">{promo.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(promo.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className="bg-purple-500 text-white">
                    {promo.code}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
