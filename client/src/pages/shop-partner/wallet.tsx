import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

export default function ShopPartnerWallet() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
  });
  const profile = profileData?.profile;

  const { data: earnings } = useQuery<{ totalOrders: number; transactions: any[] }>({
    queryKey: ["/api/shop-partner/earnings"],
  });

  const { data: payoutHistory } = useQuery<{ payouts: any[]; walletBalance: number }>({
    queryKey: ["/api/shop-partner/payout-history"],
  });

  const walletBalance = Number(profile?.walletBalance || 0);
  const negativeBalance = Number(profile?.negativeBalance || 0);
  const totalEarnings = Number(profile?.totalEarnings || 0);
  const pendingPayout = Number(profile?.pendingPayout || 0);
  const availableBalance = walletBalance - negativeBalance;

  const payoutMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("/api/shop-partner/payout-request", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/payout-history"] });
      toast({
        title: "সফল!",
        description: "পেআউট অনুরোধ জমা হয়েছে। অনুমোদনের জন্য অপেক্ষা করুন।",
      });
      setWithdrawAmount("");
      setIsWithdrawOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "পেআউট অনুরোধ ব্যর্থ হয়েছে।",
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "ত্রুটি",
        description: "সঠিক টাকার পরিমাণ লিখুন।",
        variant: "destructive",
      });
      return;
    }
    if (amount < 100) {
      toast({
        title: "ত্রুটি",
        description: "সর্বনিম্ন পেআউট পরিমাণ ৳১০০।",
        variant: "destructive",
      });
      return;
    }
    if (amount > availableBalance) {
      toast({
        title: "ত্রুটি",
        description: "পর্যাপ্ত ব্যালেন্স নেই।",
        variant: "destructive",
      });
      return;
    }
    payoutMutation.mutate(amount);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm opacity-80">ওয়ালেট ব্যালেন্স</p>
              <p className="text-4xl font-bold" data-testid="text-wallet-balance">
                ৳{walletBalance.toLocaleString("bn-BD")}
              </p>
            </div>
          </div>

          {negativeBalance > 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 rounded-lg p-3 mt-4">
              <AlertCircle className="h-5 w-5 text-red-200" />
              <div>
                <p className="text-sm font-medium">বকেয়া কমিশন</p>
                <p className="text-lg font-bold text-red-100" data-testid="text-negative-balance">
                  ৳{negativeBalance.toLocaleString("bn-BD")}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white/10 rounded-lg p-3 mt-4">
            <p className="text-sm opacity-80">প্রত্যাহারযোগ্য ব্যালেন্স</p>
            <p className="text-2xl font-bold" data-testid="text-available-balance">
              ৳{availableBalance.toLocaleString("bn-BD")}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-white"
                  disabled={availableBalance < 100}
                  data-testid="button-withdraw"
                >
                  টাকা তুলুন
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>পেআউট অনুরোধ</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">প্রত্যাহারযোগ্য ব্যালেন্স</p>
                    <p className="text-2xl font-bold text-primary">
                      ৳{availableBalance.toLocaleString("bn-BD")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">টাকার পরিমাণ (৳)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                        ৳
                      </span>
                      <Input
                        type="number"
                        placeholder="০"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="pl-8 h-14 text-2xl font-bold"
                        data-testid="input-withdraw-amount"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      সর্বনিম্ন পেআউট: ৳১০০
                    </p>
                  </div>
                  <Button
                    onClick={handleWithdraw}
                    disabled={payoutMutation.isPending}
                    className="w-full h-12"
                    data-testid="button-confirm-withdraw"
                  >
                    {payoutMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : null}
                    অনুরোধ জমা দিন
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-earnings">
              ৳{totalEarnings.toLocaleString("bn-BD")}
            </p>
            <p className="text-sm text-muted-foreground">মোট আয়</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold" data-testid="text-pending-payout">
              ৳{pendingPayout.toLocaleString("bn-BD")}
            </p>
            <p className="text-sm text-muted-foreground">অপেক্ষমান পেআউট</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold" data-testid="text-commission-rate">
              {profile?.commissionRate || 15}%
            </p>
            <p className="text-sm text-muted-foreground">কমিশন হার</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-orders">
              {earnings?.totalOrders || profile?.totalOrders || 0}
            </p>
            <p className="text-sm text-muted-foreground">মোট অর্ডার</p>
          </CardContent>
        </Card>
      </div>

      {payoutHistory?.payouts && payoutHistory.payouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">পেআউট ইতিহাস</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payoutHistory.payouts.map((payout: any) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`payout-item-${payout.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      payout.status === "completed" 
                        ? "bg-green-100 text-green-600" 
                        : payout.status === "pending"
                        ? "bg-orange-100 text-orange-600"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {payout.status === "completed" ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">পেআউট অনুরোধ</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payout.createdAt), "dd MMM yyyy, hh:mm a", { locale: bn })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      ৳{Number(payout.amount).toLocaleString("bn-BD")}
                    </p>
                    <Badge variant={
                      payout.status === "completed" ? "default" :
                      payout.status === "pending" ? "secondary" : "destructive"
                    }>
                      {payout.status === "completed" ? "সম্পন্ন" :
                       payout.status === "pending" ? "অপেক্ষমান" : "বাতিল"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">সাম্প্রতিক লেনদেন</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings?.transactions?.length > 0 ? (
            <div className="space-y-3">
              {earnings.transactions.slice(0, 10).map((tx: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`transaction-item-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        tx.type === "credit"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {tx.type === "credit" ? (
                        <ArrowDownLeft className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.createdAt), "dd MMM, hh:mm a", {
                          locale: bn,
                        })}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-bold ${
                      tx.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}৳
                    {Number(tx.amount).toLocaleString("bn-BD")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">এখনও কোন লেনদেন হয়নি।</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
