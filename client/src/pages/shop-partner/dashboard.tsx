import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Package,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  Store,
} from "lucide-react";

export default function ShopPartnerDashboard() {
  const { data: profileData, isLoading: profileLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
  });

  const { data: productsData } = useQuery<{ products: any[] }>({
    queryKey: ["/api/shop-partner/products"],
  });

  const { data: ordersData } = useQuery<{ orders: any[] }>({
    queryKey: ["/api/shop-partner/orders"],
  });

  const shopProfile = profileData?.profile;
  const products = productsData?.products || [];
  const orders = ordersData?.orders || [];
  const isApproved = shopProfile?.verificationStatus === "approved";
  const isPending = shopProfile?.verificationStatus === "pending";

  if (profileLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!shopProfile) {
    return (
      <div className="p-4 md:p-6">
        <Card className="max-w-lg mx-auto text-center p-8">
          <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">স্বাগতম সেফগোতে!</h2>
          <p className="text-muted-foreground mb-6">
            আপনার দোকান সেটআপ করুন এবং অনলাইনে বিক্রি শুরু করুন।
          </p>
          <Link href="/shop-partner/onboarding">
            <Button size="lg" className="h-14 text-lg px-8" data-testid="button-start-setup">
              দোকান সেটআপ শুরু করুন
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const activeProducts = products.filter((p: any) => p.isActive).length;
  const totalProducts = products.length;
  const pendingOrders = orders.filter((o: any) => 
    ["placed", "accepted", "packing"].includes(o.status)
  ).length;
  const todayEarnings = shopProfile?.walletBalance || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {!isApproved && (
        <Alert variant={isPending ? "default" : "destructive"}>
          {isPending ? (
            <Clock className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <AlertTitle className="text-lg">
            {isPending ? "অনুমোদন অপেক্ষমান" : "দোকান অনুমোদিত হয়নি"}
          </AlertTitle>
          <AlertDescription className="text-base">
            {isPending
              ? "আপনার দোকান যাচাই করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।"
              : shopProfile?.rejectionReason || "আপনার আবেদন প্রত্যাখ্যাত হয়েছে।"}
          </AlertDescription>
        </Alert>
      )}

      {isApproved && (
        <Card className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                দোকান সক্রিয়
              </p>
              <p className="text-sm text-muted-foreground">
                আপনার দোকান গ্রাহকদের কাছে দৃশ্যমান।
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-6 w-6 text-primary opacity-70" />
            </div>
            <p className="text-3xl font-bold">{activeProducts}</p>
            <p className="text-sm text-muted-foreground">সক্রিয় পণ্য</p>
            <p className="text-xs text-muted-foreground mt-1">
              মোট {totalProducts} টি পণ্য
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="h-6 w-6 text-orange-500 opacity-70" />
              {pendingOrders > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {pendingOrders}
                </Badge>
              )}
            </div>
            <p className="text-3xl font-bold">{pendingOrders}</p>
            <p className="text-sm text-muted-foreground">অপেক্ষমান অর্ডার</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="h-6 w-6 text-green-500 opacity-70" />
            </div>
            <p className="text-3xl font-bold">৳{Number(todayEarnings).toLocaleString("bn-BD")}</p>
            <p className="text-sm text-muted-foreground">ওয়ালেট ব্যালেন্স</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-6 w-6 text-blue-500 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{shopProfile?.commissionRate || 10}%</p>
            <p className="text-sm text-muted-foreground">কমিশন হার</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">দ্রুত অ্যাকশন</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/shop-partner/products/new">
              <Button
                variant="outline"
                className="w-full h-14 justify-start text-base gap-4"
                data-testid="button-add-product"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                নতুন পণ্য যোগ করুন
              </Button>
            </Link>
            <Link href="/shop-partner/orders">
              <Button
                variant="outline"
                className="w-full h-14 justify-start text-base gap-4"
                data-testid="button-view-orders"
              >
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                </div>
                অর্ডার দেখুন
                {pendingOrders > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {pendingOrders} নতুন
                  </Badge>
                )}
              </Button>
            </Link>
            <Link href="/shop-partner/wallet">
              <Button
                variant="outline"
                className="w-full h-14 justify-start text-base gap-4"
                data-testid="button-view-wallet"
              >
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-green-500" />
                </div>
                আয় দেখুন
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">দোকানের তথ্য</CardTitle>
            <Link href="/shop-partner/settings">
              <Button variant="ghost" size="sm" data-testid="button-edit-shop">
                সম্পাদনা
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                {shopProfile?.logoUrl ? (
                  <img
                    src={shopProfile.logoUrl}
                    alt="Shop logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-semibold text-lg">{shopProfile?.shopName}</p>
                <p className="text-sm text-muted-foreground">{shopProfile?.shopType}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ঠিকানা:</span>
                <span className="text-right max-w-[60%]">{shopProfile?.shopAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ডেলিভারি:</span>
                <span>
                  {shopProfile?.deliveryEnabled ? (
                    <Badge variant="default">চালু</Badge>
                  ) : (
                    <Badge variant="secondary">বন্ধ</Badge>
                  )}
                </span>
              </div>
              {shopProfile?.deliveryEnabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ডেলিভারি দূরত্ব:</span>
                  <span>{shopProfile?.deliveryRadius || 5} কি.মি.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
