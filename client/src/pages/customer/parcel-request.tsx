import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation, Package, User, Phone, Scale, Ruler, Tag, Loader2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export default function ParcelRequest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  
  const [parcelCategory, setParcelCategory] = useState("");
  const [parcelWeight, setParcelWeight] = useState("");
  const [parcelSize, setParcelSize] = useState("");
  const [parcelDetails, setParcelDetails] = useState("");
  
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [isScheduledPickup, setIsScheduledPickup] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const categories = [
    { value: "documents", label: "Documents" },
    { value: "electronics", label: "Electronics" },
    { value: "clothing", label: "Clothing & Textiles" },
    { value: "food", label: "Food & Perishables" },
    { value: "fragile", label: "Fragile Items" },
    { value: "other", label: "Other" },
  ];

  const sizes = [
    { value: "small", label: "Small (fits in a bag)" },
    { value: "medium", label: "Medium (shoebox size)" },
    { value: "large", label: "Large (suitcase size)" },
    { value: "oversized", label: "Extra Large / Oversized" },
  ];

  const calculateEstimatedFare = () => {
    if (!pickupLocation || !dropoffLocation) return null;
    
    const baseRate = 5.00;
    const weightFee = parcelWeight ? Math.max(0, (parseFloat(parcelWeight) - 2) * 0.5) : 0;
    const sizeFee = parcelSize === "large" ? 3 : parcelSize === "oversized" ? 5 : parcelSize === "medium" ? 1 : 0;
    const fragileeFee = parcelCategory === "fragile" ? 2 : 0;
    
    const lat1 = pickupLocation.lat;
    const lon1 = pickupLocation.lng;
    const lat2 = dropoffLocation.lat;
    const lon2 = dropoffLocation.lng;
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const distanceFee = distance * 1.50;
    const total = baseRate + weightFee + sizeFee + fragileeFee + distanceFee;
    
    return total.toFixed(2);
  };

  const handlePickupSelect = (location: LocationData) => {
    setPickupLocation(location);
    setPickupAddress(location.address);
  };

  const handleDropoffSelect = (location: LocationData) => {
    setDropoffLocation(location);
    setDropoffAddress(location.address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pickupLocation || !dropoffLocation) {
      toast({
        title: "Location required",
        description: "Please select both pickup and dropoff locations.",
        variant: "destructive",
      });
      return;
    }

    if (!senderName || !senderPhone || !receiverName || !receiverPhone) {
      toast({
        title: "Contact info required",
        description: "Please provide sender and receiver contact details.",
        variant: "destructive",
      });
      return;
    }

    if (!parcelCategory || !parcelWeight || !parcelSize) {
      toast({
        title: "Package info required",
        description: "Please provide package category, weight, and size.",
        variant: "destructive",
      });
      return;
    }

    const weight = parseFloat(parcelWeight);
    if (isNaN(weight) || weight <= 0) {
      toast({
        title: "Invalid weight",
        description: "Please enter a valid package weight.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const estimatedFare = calculateEstimatedFare() || "15.00";
      
      const scheduledPickupTime = isScheduledPickup && scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null;

      await apiRequest("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress: pickupLocation.address,
          pickupLat: pickupLocation.lat,
          pickupLng: pickupLocation.lng,
          dropoffAddress: dropoffLocation.address,
          dropoffLat: dropoffLocation.lat,
          dropoffLng: dropoffLocation.lng,
          senderName,
          senderPhone,
          receiverName,
          receiverPhone,
          parcelCategory,
          parcelWeight: weight,
          parcelSize,
          parcelDetails,
          serviceFare: parseFloat(estimatedFare),
          paymentMethod,
          scheduledPickupTime,
        }),
      });

      toast({
        title: isScheduledPickup ? "Pickup scheduled!" : "Delivery requested!",
        description: isScheduledPickup 
          ? `Your pickup is scheduled for ${new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}`
          : "Searching for a nearby driver...",
      });
      setLocation("/customer");
    } catch (error: any) {
      const errorMessage = error?.message || "Could not submit your parcel request.";
      toast({
        title: "Request failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const estimatedFare = calculateEstimatedFare();

  return (
    <div className="min-h-screen bg-background pb-8">
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

      <div className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pickup Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-5 w-5 text-green-600" />
                Pickup Details
              </CardTitle>
              <CardDescription>Where should we pick up the parcel?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pickupAddress">Pickup Address</Label>
                <GooglePlacesInput
                  value={pickupAddress}
                  onChange={setPickupAddress}
                  onLocationSelect={handlePickupSelect}
                  placeholder="Enter pickup address"
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="senderName">Sender Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="senderName"
                      placeholder="Full name"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="pl-10"
                      data-testid="input-sender-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderPhone">Sender Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="senderPhone"
                      placeholder="+1 (555) 123-4567"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="pl-10"
                      data-testid="input-sender-phone"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dropoff Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-600" />
                Delivery Details
              </CardTitle>
              <CardDescription>Where should we deliver the parcel?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dropoffAddress">Delivery Address</Label>
                <GooglePlacesInput
                  value={dropoffAddress}
                  onChange={setDropoffAddress}
                  onLocationSelect={handleDropoffSelect}
                  placeholder="Enter delivery address"
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Receiver Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="receiverName"
                      placeholder="Full name"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="pl-10"
                      data-testid="input-receiver-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverPhone">Receiver Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="receiverPhone"
                      placeholder="+1 (555) 123-4567"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      className="pl-10"
                      data-testid="input-receiver-phone"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Package Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5" />
                Package Details
              </CardTitle>
              <CardDescription>Tell us about your parcel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={parcelCategory} onValueChange={setParcelCategory}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="What type of item?" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <div className="relative">
                    <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="e.g., 2.5"
                      value={parcelWeight}
                      onChange={(e) => setParcelWeight(e.target.value)}
                      className="pl-10"
                      data-testid="input-weight"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">Size</Label>
                  <Select value={parcelSize} onValueChange={setParcelSize}>
                    <SelectTrigger id="size" data-testid="select-size">
                      <Ruler className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Additional Details (optional)</Label>
                <Textarea
                  id="details"
                  placeholder="Any special handling instructions?"
                  value={parcelDetails}
                  onChange={(e) => setParcelDetails(e.target.value)}
                  rows={2}
                  data-testid="input-details"
                />
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Pickup - Phase 3 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pickup Time
              </CardTitle>
              <CardDescription>When should we pick up your parcel?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Schedule for later</p>
                  <p className="text-xs text-muted-foreground">
                    Pick a date and time for pickup
                  </p>
                </div>
                <Switch
                  checked={isScheduledPickup}
                  onCheckedChange={setIsScheduledPickup}
                  data-testid="switch-scheduled-pickup"
                />
              </div>

              {isScheduledPickup && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="pl-10"
                        data-testid="input-scheduled-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledTime">Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="pl-10"
                        data-testid="input-scheduled-time"
                      />
                    </div>
                  </div>
                </div>
              )}

              {!isScheduledPickup && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    A driver will be assigned immediately after you submit
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment" data-testid="select-payment">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash on Delivery</SelectItem>
                    <SelectItem value="card">Credit/Debit Card</SelectItem>
                    <SelectItem value="wallet">SafeGo Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {estimatedFare && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Delivery Fee</span>
                    <span className="text-2xl font-bold text-primary">${estimatedFare}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Final price may vary based on actual distance and conditions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full h-12" 
            disabled={isLoading || !pickupLocation || !dropoffLocation}
            data-testid="button-request-delivery"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Request Parcel Delivery
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
