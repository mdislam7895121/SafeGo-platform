import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
} from "lucide-react";

interface WalletData {
  operator: {
    walletBalance: number;
    negativeBalance: number;
    totalEarnings: number;
    pendingPayout: number;
    ticketCommissionRate: number;
    rentalCommissionRate: number;
  };
}

export default function TicketOperatorWallet() {
  const { data, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/ticket-operator/profile"],
  });

  const wallet = data?.operator;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "মোট আয়",
      value: `৳${(wallet?.totalEarnings || 0).toLocaleString("bn-BD")}`,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      testId: "stat-earnings"
    },
    {
      label: "ওয়ালেট ব্যালেন্স",
      value: `৳${(wallet?.walletBalance || 0).toLocaleString("bn-BD")}`,
      icon: Wallet,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      testId: "stat-balance"
    },
    {
      label: "উত্তোলন অপেক্ষমান",
      value: `৳${(wallet?.pendingPayout || 0).toLocaleString("bn-BD")}`,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      testId: "stat-pending"
    },
    {
      label: "নেগেটিভ ব্যালেন্স",
      value: `৳${(wallet?.negativeBalance || 0).toLocaleString("bn-BD")}`,
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      testId: "stat-negative"
    },
  ];

  return (
    <div>
      <div className="space-y-6 pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">ওয়ালেট</h1>
          <p className="text-muted-foreground">আপনার আয় ও পেমেন্ট পরিচালনা করুন</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <Card key={stat.testId} className={stat.bgColor}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-xl font-bold ${stat.color}`} data-testid={stat.testId}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">কমিশন হার</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span>টিকিট কমিশন</span>
              <Badge variant="outline" data-testid="text-ticket-commission">
                {wallet?.ticketCommissionRate || 10}%
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span>রেন্টাল কমিশন</span>
              <Badge variant="outline" data-testid="text-rental-commission">
                {wallet?.rentalCommissionRate || 15}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">সাম্প্রতিক লেনদেন</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>কোনো সাম্প্রতিক লেনদেন নেই</p>
              <p className="text-sm">বুকিং সম্পন্ন হলে এখানে দেখতে পাবেন</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">পেআউট তথ্য</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">স্বয়ংক্রিয় পেআউট সক্রিয়</p>
                  <p className="text-sm text-muted-foreground">
                    প্রতি সপ্তাহে আপনার আয় স্বয়ংক্রিয়ভাবে আপনার অ্যাকাউন্টে পাঠানো হবে।
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              পেআউট সেটিংস পরিবর্তন করতে প্রোফাইল পেজে যান।
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
