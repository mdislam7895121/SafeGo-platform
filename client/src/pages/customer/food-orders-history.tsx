import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star, UtensilsCrossed, Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReviewSubmissionDialog } from "@/components/customer/ReviewSubmissionDialog";

interface FoodOrder {
  id: string;
  restaurantId: string;
  restaurantName: string;
  deliveryAddress: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  serviceFare: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  deliveredAt: string | null;
  hasReview: boolean;
}

interface FoodOrdersResponse {
  orders: FoodOrder[];
  total: number;
}

export default function FoodOrdersHistory() {
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<FoodOrder | null>(null);

  const { data, isLoading, refetch } = useQuery<FoodOrdersResponse>({
    queryKey: ["/api/customer/food-orders"],
    retry: 1,
  });

  const orders = data?.orders || [];
  const deliveredOrders = orders.filter(order => order.status.toUpperCase() === "DELIVERED");

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer/home">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Order History</h1>
            <p className="text-sm opacity-90">Your food delivery orders</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : deliveredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No delivered orders yet</h3>
              <p className="text-muted-foreground mb-6">
                Your completed food orders will appear here
              </p>
              <Link href="/customer/food">
                <Button data-testid="button-browse-restaurants">
                  Browse Restaurants
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          deliveredOrders.map((order) => (
            <Card key={order.id} className="hover-elevate">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1" data-testid={`text-restaurant-name-${order.id}`}>
                      {order.restaurantName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span data-testid={`text-order-date-${order.id}`}>
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500" data-testid={`badge-status-${order.id}`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Delivered
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm" data-testid={`item-${order.id}-${idx}`}>
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-medium">
                        ${(item.quantity * item.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="font-medium">${order.serviceFare.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span data-testid={`text-total-${order.id}`}>
                      ${(
                        order.items.reduce((sum, item) => sum + item.quantity * item.price, 0) +
                        order.serviceFare
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground mb-4">
                  <div>{order.deliveryAddress}</div>
                </div>

                {order.hasReview ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Star className="h-4 w-4 fill-current" />
                    <span data-testid={`text-reviewed-${order.id}`}>You reviewed this order</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedOrderForReview(order)}
                    data-testid={`button-leave-review-${order.id}`}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Leave a Review
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedOrderForReview && (
        <ReviewSubmissionDialog
          open={!!selectedOrderForReview}
          onOpenChange={(open) => !open && setSelectedOrderForReview(null)}
          orderId={selectedOrderForReview.id}
          restaurantName={selectedOrderForReview.restaurantName}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
