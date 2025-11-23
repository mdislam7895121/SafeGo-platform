import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Wallet, DollarSign, FileText, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface WalletData {
  id: string;
  currency: string;
  availableBalance: string;
  negativeBalance: string;
  lastTransactionDate: string | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string;
  createdAt: string;
}

interface RestaurantWalletResponse {
  wallet: WalletData;
  transactions: Transaction[];
}

export default function RestaurantWallet() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");

  const { data, isLoading } = useQuery<RestaurantWalletResponse>({
    queryKey: ["/api/restaurant/wallet"],
    refetchInterval: 10000,
  });

  const payoutMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("/api/restaurant/payout/request", {
        method: "POST",
        body: JSON.stringify({ amount }),
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payout requested",
        description: "Your payout request has been submitted successfully",
      });
      setPayoutDialogOpen(false);
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/wallet"] });
    },
    onError: (error: any) => {
      toast({
        title: "Payout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const symbol = currency === "BDT" ? "৳" : "$";
    return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getAmountDisplay = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const symbol = currency === "BDT" ? "৳" : "$";
    const absAmount = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatted = `${symbol}${absAmount}`;
    const isCredit = num > 0;

    return (
      <span className={isCredit ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
        {isCredit ? "+" : "-"}{formatted}
      </span>
    );
  };

  const getTransactionTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      FOOD_EARNING: "bg-green-500 dark:bg-green-700",
      COMMISSION_DEDUCTION: "bg-red-500 dark:bg-red-700",
      PAYOUT_DEDUCTION: "bg-orange-500 dark:bg-orange-700",
      SETTLEMENT: "bg-blue-500 dark:bg-blue-700",
      REFUND: "bg-purple-500 dark:bg-purple-700",
    };

    return (
      <Badge className={typeColors[type] || "bg-gray-500 dark:bg-gray-700"}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  const handleRequestPayout = () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (data && parseFloat(data.wallet.availableBalance) < amount) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough balance for this payout",
        variant: "destructive",
      });
      return;
    }

    payoutMutation.mutate(amount);
  };

  return (
    <div className="space-y-6">
      {/* Wallet Balance Card */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : data?.wallet ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              My Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-available-balance">
                  {formatCurrency(data.wallet.availableBalance, data.wallet.currency)}
                </p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-xs text-muted-foreground mb-1">Commission Owed</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="text-negative-balance">
                  {formatCurrency(data.wallet.negativeBalance, data.wallet.currency)}
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => setPayoutDialogOpen(true)}
              disabled={parseFloat(data.wallet.availableBalance) <= 0 || parseFloat(data.wallet.negativeBalance) > 0}
              data-testid="button-request-payout"
            >
              <Send className="h-4 w-4 mr-2" />
              Request Payout
            </Button>

            {parseFloat(data.wallet.negativeBalance) > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center">
                Clear commission debt before requesting payout
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : data?.transactions && data.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.slice(0, 20).map((txn) => (
                      <TableRow key={txn.id} data-testid={`row-transaction-${txn.id}`}>
                        <TableCell className="text-sm">
                          {format(new Date(txn.createdAt), "MMM d, yyyy")}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(txn.createdAt), "h:mm a")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getTransactionTypeBadge(txn.type)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {txn.description}
                        </TableCell>
                        <TableCell className="text-right">
                          {getAmountDisplay(txn.amount, data.wallet.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Payout Request Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent data-testid="dialog-payout">
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw from your wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {data?.wallet && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(data.wallet.availableBalance, data.wallet.currency)}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="payout-amount">Amount</Label>
              <Input
                id="payout-amount"
                type="number"
                step="0.01"
                min="0"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Enter amount"
                data-testid="input-payout-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPayoutDialogOpen(false);
                setPayoutAmount("");
              }}
              data-testid="button-cancel-payout"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayout}
              disabled={!payoutAmount || payoutMutation.isPending}
              data-testid="button-confirm-payout"
            >
              {payoutMutation.isPending ? "Requesting..." : "Request Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
