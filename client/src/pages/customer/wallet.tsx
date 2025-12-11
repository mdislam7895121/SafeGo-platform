import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet as WalletIcon, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface WalletData {
  wallet?: {
    balance: string;
  };
  transactions?: Array<{
    type: string;
    amount: number;
    description?: string;
    createdAt: string;
    referenceId?: string;
  }>;
}

export default function CustomerWallet() {
  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/customer/wallet"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground"
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Wallet</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-2">
              <WalletIcon className="h-5 w-5" />
              <p className="text-sm opacity-90">Available Balance</p>
            </div>
            <p className="text-4xl font-bold mb-1" data-testid="text-balance">
              {formatCurrency(wallet?.balance ? parseFloat(wallet.balance) : 0, "USD")}
            </p>
            <p className="text-xs opacity-75">Last updated just now</p>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
                <p className="text-muted-foreground text-sm">
                  Your wallet activity will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                  >
                    <div className="flex items-center gap-3">
                      {transaction.type === "debit" || transaction.amount < 0 ? (
                        <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-950 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{transaction.description || transaction.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.type === "debit" || transaction.amount < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {transaction.type === "debit" || transaction.amount < 0 ? "-" : "+"}$
                        {Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                      </p>
                      {transaction.referenceId && (
                        <p className="text-xs text-muted-foreground">Ref: {transaction.referenceId.slice(0, 8)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top-up Card */}
        <Card className="bg-muted">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold mb-2">Need to add funds?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Contact support to top up your wallet balance
            </p>
            <Link href="/customer/support">
              <Button variant="outline" size="sm" data-testid="button-topup">
                Contact Support
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
