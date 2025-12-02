import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

export default function ShopPartnerWallet() {
  const { data: profileData, isLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
  });
  const profile = profileData?.profile;

  const { data: earnings } = useQuery<{ totalOrders: number; transactions: any[] }>({
    queryKey: ["/api/shop-partner/earnings"],
  });

  const walletBalance = Number(profile?.walletBalance || 0);
  const negativeBalance = Number(profile?.negativeBalance || 0);
  const totalEarnings = Number(profile?.totalEarnings || 0);
  const pendingPayout = Number(profile?.pendingPayout || 0);

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
              <p className="text-4xl font-bold">
                ৳{walletBalance.toLocaleString("bn-BD")}
              </p>
            </div>
          </div>

          {negativeBalance > 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 rounded-lg p-3 mt-4">
              <AlertCircle className="h-5 w-5 text-red-200" />
              <div>
                <p className="text-sm font-medium">বকেয়া কমিশন</p>
                <p className="text-lg font-bold text-red-100">
                  ৳{negativeBalance.toLocaleString("bn-BD")}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-white"
              data-testid="button-withdraw"
            >
              টাকা তুলুন
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold">
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
            <p className="text-2xl font-bold">
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
            <p className="text-2xl font-bold">
              {profile?.commissionRate || 10}%
            </p>
            <p className="text-sm text-muted-foreground">কমিশন হার</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">
              {earnings?.totalOrders || 0}
            </p>
            <p className="text-sm text-muted-foreground">মোট অর্ডার</p>
          </CardContent>
        </Card>
      </div>

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
