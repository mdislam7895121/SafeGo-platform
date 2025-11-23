import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Calendar } from "lucide-react";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

interface PayoutSummaryWidgetProps {
  wallet: {
    availableBalance: string;
    negativeBalance: string;
    currency: string;
  } | null;
  earnings: {
    totalEarnings: string;
    commission: string;
    netPayout: string;
  };
  nextSettlementDate?: string;
  isLoading?: boolean;
}

export function PayoutSummaryWidget({
  wallet,
  earnings,
  nextSettlementDate,
  isLoading = false,
}: PayoutSummaryWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Wallet & Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const balance = wallet ? parseFloat(wallet.availableBalance) : 0;
  const negBalance = wallet ? parseFloat(wallet.negativeBalance) : 0;
  const hasNegativeBalance = negBalance > 0;
  const currency = wallet?.currency || "USD";

  return (
    <Card data-testid="widget-payout-summary">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Wallet & Earnings</span>
          {hasNegativeBalance && (
            <Badge variant="destructive" className="text-xs">
              Negative Balance
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Balance */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Available Balance</span>
          </div>
          <div className="text-2xl font-bold" data-testid="text-wallet-balance">
            {formatCurrency(balance, currency)}
          </div>
          {hasNegativeBalance && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Negative: {formatCurrency(negBalance, currency)}
              </span>
            </div>
          )}
        </div>

        {/* Today's Earnings */}
        <div className="space-y-1 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Today's Net Payout</span>
          </div>
          <div className="text-xl font-semibold" data-testid="text-earnings-today">
            {formatCurrency(parseFloat(earnings.netPayout), currency)}
          </div>
          <div className="text-xs text-muted-foreground">
            Earnings: {formatCurrency(parseFloat(earnings.totalEarnings), currency)} - 
            Commission: {formatCurrency(parseFloat(earnings.commission), currency)}
          </div>
        </div>

        {/* Next Settlement */}
        {nextSettlementDate && (
          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Next Settlement</span>
            </div>
            <div className="text-sm font-medium" data-testid="text-next-settlement">
              {nextSettlementDate}
            </div>
          </div>
        )}

        {/* Warning for negative balance */}
        {hasNegativeBalance && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Settlement requires positive balance. Negative amounts will be deducted from future earnings.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
