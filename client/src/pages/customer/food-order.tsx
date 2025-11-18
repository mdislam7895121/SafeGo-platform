import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function FoodOrder() {
  const [restaurantId, setRestaurantId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState("");
  const [deliveryLng, setDeliveryLng] = useState("");
  const [items, setItems] = useState("[{\"name\":\"Burger\",\"quantity\":2,\"price\":10}]");
  const [serviceFare, setServiceFare] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const parsedItems = JSON.parse(items);
      await apiRequest("POST", "/api/food-orders", {
        restaurantId,
        deliveryAddress,
        deliveryLat: parseFloat(deliveryLat),
        deliveryLng: parseFloat(deliveryLng),
        items: parsedItems,
        serviceFare: parseFloat(serviceFare),
        paymentMethod,
      });

      toast({
        title: "Order placed!",
        description: "Waiting for restaurant confirmation...",
      });
      setLocation("/customer");
    } catch (error: any) {
      toast({
        title: "Order failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Order Food</h1>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="restaurantId">Restaurant ID (for testing)</Label>
                <Input
                  id="restaurantId"
                  placeholder="Enter restaurant ID"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  required
                  data-testid="input-restaurant-id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Create a restaurant account first to get an ID
                </p>
              </div>

              {/* Delivery Location */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  <span>Delivery Location</span>
                </div>
                <div className="space-y-3 pl-6 border-l-2 border-orange-600">
                  <div>
                    <Label htmlFor="deliveryAddress">Address</Label>
                    <Input
                      id="deliveryAddress"
                      placeholder="123 Main St, Dhaka"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                      data-testid="input-delivery-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="deliveryLat">Latitude</Label>
                      <Input
                        id="deliveryLat"
                        type="number"
                        step="any"
                        placeholder="23.8103"
                        value={deliveryLat}
                        onChange={(e) => setDeliveryLat(e.target.value)}
                        required
                        data-testid="input-delivery-lat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deliveryLng">Longitude</Label>
                      <Input
                        id="deliveryLng"
                        type="number"
                        step="any"
                        placeholder="90.4125"
                        value={deliveryLng}
                        onChange={(e) => setDeliveryLng(e.target.value)}
                        required
                        data-testid="input-delivery-lng"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="items">Order Items (JSON)</Label>
                <Textarea
                  id="items"
                  placeholder='[{"name":"Burger","quantity":2,"price":10}]'
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                  required
                  rows={3}
                  data-testid="input-items"
                />
              </div>

              {/* Fare and Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fare">Total Amount</Label>
                  <Input
                    id="fare"
                    type="number"
                    step="any"
                    placeholder="100"
                    value={serviceFare}
                    onChange={(e) => setServiceFare(e.target.value)}
                    required
                    data-testid="input-fare"
                  />
                </div>
                <div>
                  <Label htmlFor="payment">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                    <SelectTrigger id="payment" data-testid="select-payment">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-place-order">
                {isLoading ? "Placing order..." : "Place Order"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
