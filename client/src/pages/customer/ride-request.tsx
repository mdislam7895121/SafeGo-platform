import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function RideRequest() {
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [serviceFare, setServiceFare] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Build request body - GPS coordinates are optional
      const requestBody: any = {
        pickupAddress,
        dropoffAddress,
        serviceFare: parseFloat(serviceFare),
        paymentMethod,
      };

      // Include GPS coordinates only if provided
      if (pickupLat) requestBody.pickupLat = parseFloat(pickupLat);
      if (pickupLng) requestBody.pickupLng = parseFloat(pickupLng);
      if (dropoffLat) requestBody.dropoffLat = parseFloat(dropoffLat);
      if (dropoffLng) requestBody.dropoffLng = parseFloat(dropoffLng);

      await apiRequest("POST", "/api/rides", requestBody);

      toast({
        title: "Ride requested!",
        description: "Finding an available driver in your area...",
      });
      setLocation("/customer");
    } catch (error: any) {
      toast({
        title: "Request failed",
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
          <h1 className="text-2xl font-bold">Request Ride</h1>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Ride Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Pickup Location */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Navigation className="h-4 w-4 text-green-600" />
                  <span>Pickup Location</span>
                </div>
                <div className="space-y-3 pl-6 border-l-2 border-green-600">
                  <div>
                    <Label htmlFor="pickupAddress">Address</Label>
                    <Input
                      id="pickupAddress"
                      placeholder="123 Main St, Dhaka"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      required
                      data-testid="input-pickup-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="pickupLat" className="text-muted-foreground">Latitude (optional)</Label>
                      <Input
                        id="pickupLat"
                        type="number"
                        step="any"
                        placeholder="23.8103"
                        value={pickupLat}
                        onChange={(e) => setPickupLat(e.target.value)}
                        data-testid="input-pickup-lat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pickupLng" className="text-muted-foreground">Longitude (optional)</Label>
                      <Input
                        id="pickupLng"
                        type="number"
                        step="any"
                        placeholder="90.4125"
                        value={pickupLng}
                        onChange={(e) => setPickupLng(e.target.value)}
                        data-testid="input-pickup-lng"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dropoff Location */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span>Dropoff Location</span>
                </div>
                <div className="space-y-3 pl-6 border-l-2 border-red-600">
                  <div>
                    <Label htmlFor="dropoffAddress">Address</Label>
                    <Input
                      id="dropoffAddress"
                      placeholder="456 Airport Rd, Dhaka"
                      value={dropoffAddress}
                      onChange={(e) => setDropoffAddress(e.target.value)}
                      required
                      data-testid="input-dropoff-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="dropoffLat" className="text-muted-foreground">Latitude (optional)</Label>
                      <Input
                        id="dropoffLat"
                        type="number"
                        step="any"
                        placeholder="23.7900"
                        value={dropoffLat}
                        onChange={(e) => setDropoffLat(e.target.value)}
                        data-testid="input-dropoff-lat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dropoffLng" className="text-muted-foreground">Longitude (optional)</Label>
                      <Input
                        id="dropoffLng"
                        type="number"
                        step="any"
                        placeholder="90.4000"
                        value={dropoffLng}
                        onChange={(e) => setDropoffLng(e.target.value)}
                        data-testid="input-dropoff-lng"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fare and Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fare">Fare Amount</Label>
                  <Input
                    id="fare"
                    type="number"
                    step="any"
                    placeholder="250"
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

              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-request-ride">
                {isLoading ? "Requesting..." : "Request Ride"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
