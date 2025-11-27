import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  UtensilsCrossed,
  Clock,
  Calendar,
  Search,
  Plus,
  ChevronRight,
  Star,
  RefreshCw,
  MapPin,
  Store,
} from "lucide-react";

interface FoodOrder {
  id: string;
  status: string;
  restaurantName: string;
  restaurantImage?: string;
  items: { name: string; quantity: number }[];
  totalAmount: number;
  deliveryAddress: string;
  estimatedDelivery?: string;
  driverName?: string;
  createdAt: string;
  completedAt?: string;
}

function OrderCard({ order }: { order: FoodOrder }) {
  const statusColors: Record<string, string> = {
    placed: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    accepted: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    being_prepared: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
    picked_up: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    delivered: "bg-muted text-muted-foreground",
    canceled: "bg-red-500/20 text-red-700 dark:text-red-400",
  };

  return (
    <Card className="hover-elevate" data-testid={`order-card-${order.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
              {order.restaurantImage ? (
                <img
                  src={order.restaurantImage}
                  alt={order.restaurantName}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <Store className="h-6 w-6 text-orange-500" />
              )}
            </div>
            <div>
              <p className="font-medium">{order.restaurantName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleDateString()} at{" "}
                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <Badge className={statusColors[order.status] || "bg-muted"}>
            {order.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="mb-3">
          <p className="text-sm text-muted-foreground">
            {order.items.slice(0, 3).map((item, i) => (
              <span key={i}>
                {item.quantity}x {item.name}
                {i < Math.min(order.items.length, 3) - 1 ? ", " : ""}
              </span>
            ))}
            {order.items.length > 3 && (
              <span> +{order.items.length - 3} more</span>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">${order.totalAmount.toFixed(2)}</span>
          <div className="flex gap-2">
            <Link href={`/rider/orders?reorder=${order.id}`}>
              <Button variant="outline" size="sm" data-testid={`button-reorder-${order.id}`}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Reorder
              </Button>
            </Link>
            <Link href={`/rider/orders/${order.id}`}>
              <Button variant="ghost" size="sm" data-testid={`button-order-details-${order.id}`}>
                Details
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {order.estimatedDelivery && order.status !== "delivered" && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Estimated delivery:</span>
            <span className="font-medium">{order.estimatedDelivery}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RiderOrders() {
  const searchParams = useSearch();
  const isNewOrder = searchParams.includes("start=new");
  const [activeTab, setActiveTab] = useState<string>(isNewOrder ? "new" : "active");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: ordersData, isLoading } = useQuery<{
    active: FoodOrder[];
    past: FoodOrder[];
  }>({
    queryKey: ["/api/customer/food-orders"],
  });

  const activeOrders = ordersData?.active || [];
  const pastOrders = ordersData?.past || [];

  const filteredPastOrders = pastOrders.filter((order) =>
    order.restaurantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">
            Food Orders
          </h1>
          <p className="text-muted-foreground">
            Track and manage your food deliveries
          </p>
        </div>
        <Link href="/rider/orders?start=new">
          <Button data-testid="button-new-order">
            <Plus className="h-4 w-4 mr-2" />
            Order Food
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-orders">
            <Clock className="h-4 w-4 mr-2" />
            Active
            {activeOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past-orders">
            <Calendar className="h-4 w-4 mr-2" />
            Past
          </TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-new-order">
            <Plus className="h-4 w-4 mr-2" />
            Browse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No active orders</h3>
                <p className="text-muted-foreground mb-4">
                  Order from your favorite restaurants
                </p>
                <Link href="/rider/orders?start=new">
                  <Button data-testid="button-browse-restaurants-empty-state">
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Restaurants
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-orders"
            />
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPastOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No past orders</h3>
                <p className="text-muted-foreground">
                  Your order history will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPastOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-orange-500" />
                Find Restaurants
              </CardTitle>
              <CardDescription>
                Discover restaurants near you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for food or restaurants..."
                  className="pl-10"
                  data-testid="input-search-restaurants"
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Delivering to:</span>
                <Button variant="ghost" className="p-0 h-auto text-primary" data-testid="button-change-delivery-location">
                  Current Location
                </Button>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Popular Categories</p>
                <div className="grid grid-cols-3 gap-2">
                  {["Pizza", "Burgers", "Sushi", "Chinese", "Indian", "Thai"].map((cat) => (
                    <Button key={cat} variant="outline" className="h-auto py-3" data-testid={`button-category-${cat.toLowerCase()}`}>
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>

              <Link href="/customer/food">
                <Button className="w-full" size="lg" data-testid="button-browse-restaurants">
                  <Store className="h-4 w-4 mr-2" />
                  Browse All Restaurants
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
