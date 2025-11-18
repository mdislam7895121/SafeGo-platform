import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ParcelRequest() {
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [parcelDetails, setParcelDetails] = useState("");
  const [serviceFare, setServiceFare] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/deliveries", {
        pickupAddress,
        pickupLat: parseFloat(pickupLat),
        pickupLng: parseFloat(pickupLng),
        dropoffAddress,
        dropoffLat: parseFloat(dropoffLat),
        dropoffLng: parseFloat(dropoffLng),
        parcelDetails,
        serviceFare: parseFloat(serviceFare),
        paymentMethod,
      });

      toast({
        title: "Delivery requested!",
        description: "Searching for a nearby driver...",
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
          <h1 className="text-2xl font-bold">Send Parcel</h1>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parcel Details
            </CardTitle>
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
                      <Label htmlFor="pickupLat">Latitude</Label>
                      <Input
                        id="pickupLat"
                        type="number"
                        step="any"
                        placeholder="23.8103"
                        value={pickupLat}
                        onChange={(e) => setPickupLat(e.target.value)}
                        required
                        data-testid="input-pickup-lat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pickupLng">Longitude</Label>
                      <Input
                        id="pickupLng"
                        type="number"
                        step="any"
                        placeholder="90.4125"
                        value={pickupLng}
                        onChange={(e) => setPickupLng(e.target.value)}
                        required
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
                      <Label htmlFor="dropoffLat">Latitude</Label>
                      <Input
                        id="dropoffLat"
                        type="number"
                        step="any"
                        placeholder="23.7900"
                        value={dropoffLat}
                        onChange={(e) => setDropoffLat(e.target.value)}
                        required
                        data-testid="input-dropoff-lat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dropoffLng">Longitude</Label>
                      <Input
                        id="dropoffLng"
                        type="number"
                        step="any"
                        placeholder="90.4000"
                        value={dropoffLng}
                        onChange={(e) => setDropoffLng(e.target.value)}
                        required
                        data-testid="input-dropoff-lng"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="parcelDetails">Parcel Description</Label>
                <Textarea
                  id="parcelDetails"
                  placeholder="Electronics, Documents, etc."
                  value={parcelDetails}
                  onChange={(e) => setParcelDetails(e.target.value)}
                  required
                  rows={3}
                  data-testid="input-parcel-details"
                />
              </div>

              {/* Fare and Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fare">Delivery Fee</Label>
                  <Input
                    id="fare"
                    type="number"
                    step="any"
                    placeholder="150"
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

              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-request-delivery">
                {isLoading ? "Requesting..." : "Request Delivery"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
