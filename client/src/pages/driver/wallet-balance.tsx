import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  DollarSign,
  Car,
  TrendingUp,
  TrendingDown,
  Receipt,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {  
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";

interface TransactionSummary {
  currentBalance: number;
  negativeBalance: number;
  currency: string;
  summary: {
    totalEarnings: number;
    bonuses: number;
    adjustments: number;
    platformFees: number;
    netPayout: number;
  };
  transactionsByDate: {
    date: string;
    transactions: Transaction[];
  }[];
}

interface Transaction {
  id: string;
  type: string;
  direction: string;
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string | null;
  createdAt: string;
}

export default function DriverWalletBalance() {
  const [_, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState("all");
  const [summaryOpen, setSummaryOpen] = useState(true);

  // Build query key with filter
  const apiEndpoint = typeFilter !== "all" 
    ? `/api/driver/wallet/balance?type=${typeFilter}`
    : "/api/driver/wallet/balance";

  const { data, isLoading } = useQuery<TransactionSummary>({
    queryKey: [apiEndpoint],
  });

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "BDT") {
      return `৳${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const getTransactionIcon = (type: string) => {
    if (type === "ride" || type === "food" || type === "parcel") {
      return <Car className="h-5 w-5 text-primary" />;
    } else if (type === "adjustment") {
      return <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />;
    } else if (type === "commission" || type === "payout") {
      return <TrendingDown className="h-5 w-5 text-muted-foreground" />;
    }
    return <Receipt className="h-5 w-5 text-muted-foreground" />;
  };

  const getTransactionLabel = (type: string, description: string) => {
    const labels: Record<string, string> = {
      ride: "Ride",
      food: "Food Delivery",
      parcel: "Parcel Delivery",
      adjustment: description.includes("Bonus") ? "Bonus" : "Adjustment",
      commission: "Platform Fee",
      payout: "Payout",
    };
    return labels[type] || description;
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const currentBalance = data?.currentBalance || 0;
  const currency = data?.currency || "USD";
  const summary = data?.summary;

  return (
    <div className="bg-background min-h-screen">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/driver/wallet")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Balance</h1>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Available Balance</p>
                <h1 className="text-5xl font-bold mb-4" data-testid="text-balance">
                  {formatCurrency(currentBalance, currency)}
                </h1>
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => navigate("/driver/wallet")}
                  data-testid="button-cash-out"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Cash out
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSummaryOpen(!summaryOpen)}
                  data-testid="button-summary"
                >
                  Summary
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Breakdown */}
        {summaryOpen && summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Earnings Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Total Earnings</span>
                <span className="font-semibold text-lg text-green-600 dark:text-green-400">
                  +{formatCurrency(summary.totalEarnings, currency)}
                </span>
              </div>
              {summary.bonuses > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Bonuses</span>
                  <span className="font-semibold text-lg text-green-600 dark:text-green-400">
                    +{formatCurrency(summary.bonuses, currency)}
                  </span>
                </div>
              )}
              {summary.platformFees > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Platform Fees</span>
                  <span className="font-semibold text-lg text-muted-foreground">
                    -{formatCurrency(summary.platformFees, currency)}
                  </span>
                </div>
              )}
              {summary.adjustments > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Adjustments</span>
                  <span className="font-semibold text-lg text-muted-foreground">
                    -{formatCurrency(summary.adjustments, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-t">
                <span className="font-semibold">Net Earnings</span>
                <span className="font-bold text-xl">
                  {formatCurrency(summary.netPayout, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="select-type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="trips">Trips</SelectItem>
                <SelectItem value="bonuses">Bonuses</SelectItem>
                <SelectItem value="adjustments">Adjustments</SelectItem>
                <SelectItem value="payouts">Payouts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Earnings Timeline */}
        <div className="space-y-6">
          {data && data.transactionsByDate.length > 0 ? (
            data.transactionsByDate.map(({ date, transactions }) => (
              <Card key={date}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {format(new Date(date), "MMMM d, yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between py-3 px-4 rounded-lg hover-elevate cursor-pointer"
                        data-testid={`transaction-${txn.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getTransactionIcon(txn.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">
                              {getTransactionLabel(txn.type, txn.description)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(txn.createdAt), "h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold text-lg ${
                              txn.direction === "credit"
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {txn.direction === "credit" ? "+" : "-"}
                            {formatCurrency(txn.amount, currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No transactions found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your earnings and transactions will appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
