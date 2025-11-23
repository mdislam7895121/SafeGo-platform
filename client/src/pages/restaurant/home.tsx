import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { UtensilsCrossed, DollarSign, Clock, User, Settings, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

export default function RestaurantHome() {
  const { user, logout } = useAuth();

  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/restaurant/home"],
    refetchInterval: 5000,
  });

  // Fetch recent orders
  const { data: ordersData } = useQuery({
    queryKey: ["/api/restaurant/orders", { limit: 5 }],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (restaurantData as any)?.profile;
  const wallet = (restaurantData as any)?.wallet;

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Restaurant Dashboard</h1>
            <p className="text-sm opacity-90">{profile?.restaurantName || user?.email}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={logout}
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>

        {/* Restaurant Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-6 w-6 text-orange-600" />
              <div className="flex-1">
                <p className="font-semibold">Restaurant Status</p>
                <Badge variant={profile?.isVerified ? "default" : "secondary"} data-testid="badge-verification">
                  {profile?.isVerified ? "✓ Verified & Active" : "Pending Verification"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Verification Status */}
        {!profile?.isVerified && (
          <Card className="border-orange-500">
            <CardContent className="p-4">
              <p className="text-sm">
                ⚠️ Your restaurant is pending verification. You can't accept orders until approved.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wallet Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-2xl font-bold" data-testid="text-balance">
                    ${wallet?.balance != null ? Number(wallet.balance).toFixed(2) : "0.00"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Owed</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-negative-balance">
                    ${wallet?.negativeBalance != null ? Number(wallet.negativeBalance).toFixed(2) : "0.00"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Restaurant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Restaurant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{profile?.restaurantName || "Not set"}</span>
            </div>
            {profile?.cuisine && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cuisine</span>
                <Badge>{profile.cuisine}</Badge>
              </div>
            )}
            {profile?.address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium text-right">{profile.address}</span>
              </div>
            )}
            {profile?.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{profile.phone}</span>
              </div>
            )}
            <Link href="/restaurant/profile">
              <Button variant="outline" className="w-full mt-2" data-testid="button-edit-profile">
                Edit Restaurant Info
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Orders Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersData?.orders && ordersData.orders.length > 0 ? (
              <div className="space-y-3">
                {ordersData.orders.slice(0, 5).map((order: any) => (
                  <div 
                    key={order.id} 
                    className="p-4 border rounded-lg hover-elevate cursor-pointer"
                    data-testid={`order-${order.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium">Order #{order.id.substring(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                      </div>
                      <Badge 
                        variant={
                          order.status === 'placed' ? 'default' :
                          order.status === 'accepted' ? 'secondary' :
                          order.status === 'preparing' ? 'secondary' :
                          order.status === 'ready_for_pickup' ? 'default' :
                          'default'
                        }
                        data-testid={`badge-status-${order.id}`}
                      >
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </span>
                      <span className="font-semibold" data-testid={`text-amount-${order.id}`}>
                        ${Number(order.serviceFare).toFixed(2)}
                      </span>
                    </div>
                    {order.status === 'placed' && profile?.isVerified && (
                      <div className="mt-3 pt-3 border-t">
                        <Link href={`/restaurant/orders/${order.id}`}>
                          <Button size="sm" className="w-full" data-testid={`button-accept-${order.id}`}>
                            Accept Order
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No orders yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/restaurant/profile">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-profile">
              <User className="h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Link href="/restaurant/wallet">
            <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-wallet">
              <Wallet className="h-4 w-4" />
              Wallet
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
