import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Package, MapPin, Navigation, Scale, Ruler, Tag, Loader2, Calendar, Clock, User, Phone, CreditCard, Wallet, Banknote, ChevronRight, ChevronLeft, Zap, Truck, Info } from "lucide-react";
import { CustomerBackButton } from "./CustomerBackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { cn } from "@/lib/utils";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

const parcelTypes = [
  { value: "documents", label: "Documents", description: "Papers, letters, contracts", icon: "📄", baseRate: 0 },
  { value: "small_package", label: "Small Package", description: "Fits in a bag", icon: "📦", baseRate: 2 },
  { value: "medium_box", label: "Medium Box", description: "Shoebox size", icon: "📦", baseRate: 4 },
  { value: "large_box", label: "Large Box", description: "Suitcase size", icon: "📦", baseRate: 8 },
];

const deliverySpeeds = [
  { value: "standard", label: "Standard", description: "2-4 hours", multiplier: 1.0, icon: Truck },
  { value: "express", label: "Express", description: "Under 1 hour", multiplier: 1.5, icon: Zap },
];

const paymentMethods = [
  { value: "cash", label: "Cash on Delivery", description: "Pay driver directly", icon: Banknote },
  { value: "online", label: "Pay Online", description: "Card or SafeGo Wallet", icon: CreditCard },
];

interface CustomerParcelBookingProps {
  onBack?: () => void;
}

export function CustomerParcelBooking({ onBack }: CustomerParcelBookingProps) {
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
  
  const [parcelType, setParcelType] = useState("");
  const [parcelWeight, setParcelWeight] = useState("");
  const [deliverySpeed, setDeliverySpeed] = useState("standard");
  const [parcelDetails, setParcelDetails] = useState("");
  
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [isScheduledPickup, setIsScheduledPickup] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const [step, setStep] = useState<"locations" | "details" | "payment">("locations");

  const handleStepBack = () => {
    if (step === "payment") {
      setStep("details");
      return true;
    } else if (step === "details") {
      setStep("locations");
      return true;
    }
    return false;
  };

  const calculateEstimatedFare = useCallback(() => {
    if (!pickupLocation || !dropoffLocation) return null;
    
    const baseRate = 5.00;
    const selectedType = parcelTypes.find(t => t.value === parcelType);
    const typeFee = selectedType?.baseRate || 0;
    const weightFee = parcelWeight ? Math.max(0, (parseFloat(parcelWeight) - 2) * 0.5) : 0;
    
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
    const speedMultiplier = deliverySpeeds.find(s => s.value === deliverySpeed)?.multiplier || 1.0;
    const total = (baseRate + typeFee + weightFee + distanceFee) * speedMultiplier;
    
    return {
      subtotal: total,
      distance: distance.toFixed(1),
      formatted: total.toFixed(2),
    };
  }, [pickupLocation, dropoffLocation, parcelType, parcelWeight, deliverySpeed]);

  const handlePickupSelect = (location: LocationData) => {
    setPickupLocation(location);
    setPickupAddress(location.address);
  };

  const handleDropoffSelect = (location: LocationData) => {
    setDropoffLocation(location);
    setDropoffAddress(location.address);
  };

  const canProceedToDetails = pickupLocation && dropoffLocation && senderName && senderPhone && receiverName && receiverPhone;
  const canProceedToPayment = parcelType && deliverySpeed;
  const fare = calculateEstimatedFare();

  const handleSubmit = async () => {
    if (!pickupLocation || !dropoffLocation || !paymentMethod || !fare || !parcelType || !deliverySpeed) {
      toast({
        title: "Missing information",
        description: "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Build scheduled datetime if scheduling is enabled
      let scheduledFor: string | null = null;
      if (isScheduledPickup && scheduledDate && scheduledTime) {
        scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }
      
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
          parcelType,
          parcelWeightKg: parcelWeight ? parseFloat(parcelWeight) : null,
          deliverySpeed,
          serviceFare: parseFloat(fare.formatted),
          paymentMethod: paymentMethod === "cash" ? "cash" : "online",
          scheduledFor,
        }),
      });

      toast({
        title: "Delivery requested!",
        description: isScheduledPickup 
          ? `Scheduled for ${scheduledDate} at ${scheduledTime}` 
          : "Searching for a nearby driver...",
      });
      
      setLocation("/customer/activity");
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

  return (
    <div className="space-y-4 p-1">
      {/* Back Button Header */}
      <div className="flex items-center gap-2 pb-2">
        <CustomerBackButton
          fallbackRoute="/customer"
          fallbackTab="parcel"
          onBack={() => {
            const steppedBack = handleStepBack();
            if (steppedBack) return true;
            if (onBack) {
              onBack();
              return true;
            }
            return false;
          }}
          label={step === "locations" ? "Back" : step === "details" ? "Pickup & Delivery" : "Package Details"}
        />
        <div className="flex-1 text-center">
          <span className="text-sm text-muted-foreground">
            Step {step === "locations" ? "1" : step === "details" ? "2" : "3"} of 3
          </span>
        </div>
        <div className="w-16" />
      </div>

      {step === "locations" && (
        <div className="space-y-4">
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

          <Button
            onClick={() => setStep("details")}
            disabled={!canProceedToDetails}
            className="w-full h-12"
            data-testid="button-continue-to-details"
          >
            Continue
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5" />
                Package Type
              </CardTitle>
              <CardDescription>What are you sending?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {parcelTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setParcelType(type.value)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      parcelType === type.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover-elevate"
                    )}
                    data-testid={`button-parcel-type-${type.value}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{type.icon}</span>
                      <span className="font-medium text-sm">{type.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                    {type.baseRate > 0 && (
                      <Badge variant="secondary" className="mt-2 text-xs">+${type.baseRate}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Delivery Speed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={deliverySpeed} onValueChange={setDeliverySpeed} className="space-y-2">
                {deliverySpeeds.map((speed) => {
                  const SpeedIcon = speed.icon;
                  return (
                    <label
                      key={speed.value}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        deliverySpeed === speed.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover-elevate"
                      )}
                      data-testid={`radio-speed-${speed.value}`}
                    >
                      <RadioGroupItem value={speed.value} className="sr-only" />
                      <SpeedIcon className={cn(
                        "h-5 w-5",
                        speed.value === "express" ? "text-orange-500" : "text-blue-500"
                      )} />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{speed.label}</p>
                        <p className="text-xs text-muted-foreground">{speed.description}</p>
                      </div>
                      {speed.multiplier > 1 && (
                        <Badge variant="outline" className="text-xs">+50%</Badge>
                      )}
                    </label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Weight (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g., 2.5 kg"
                  value={parcelWeight}
                  onChange={(e) => setParcelWeight(e.target.value)}
                  className="pl-10"
                  data-testid="input-weight"
                />
              </div>
              <div className="space-y-2">
                <Label>Special Instructions (Optional)</Label>
                <Textarea
                  placeholder="Handle with care, fragile items, etc."
                  value={parcelDetails}
                  onChange={(e) => setParcelDetails(e.target.value)}
                  rows={2}
                  data-testid="input-details"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("locations")}
              className="flex-1 h-12"
              data-testid="button-back-to-locations"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep("payment")}
              disabled={!canProceedToPayment}
              className="flex-1 h-12"
              data-testid="button-continue-to-payment"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "payment" && (
        <div className="space-y-4">
          {fare && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Estimated Delivery Fee</span>
                  <span className="text-2xl font-bold text-primary">${fare.formatted}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {fare.distance} mi
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {parcelTypes.find(t => t.value === parcelType)?.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {deliverySpeeds.find(s => s.value === deliverySpeed)?.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <Info className="h-3 w-3 inline mr-1" />
                  Final price may vary based on actual distance.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                {paymentMethods.map((method) => {
                  const MethodIcon = method.icon;
                  return (
                    <label
                      key={method.value}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        paymentMethod === method.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover-elevate"
                      )}
                      data-testid={`radio-payment-${method.value}`}
                    >
                      <RadioGroupItem value={method.value} className="sr-only" />
                      <MethodIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pickup Time
              </CardTitle>
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

          <Separator />

          <Card className="border-0 shadow-none bg-muted/30">
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From</span>
                  <span className="font-medium truncate max-w-[200px]">{pickupAddress.split(",")[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-medium truncate max-w-[200px]">{dropoffAddress.split(",")[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-medium">{parcelTypes.find(t => t.value === parcelType)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Speed</span>
                  <span className="font-medium">{deliverySpeeds.find(s => s.value === deliverySpeed)?.label}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("details")}
              className="flex-1 h-12"
              data-testid="button-back-to-details"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !paymentMethod}
              className="flex-1 h-12"
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
                  Confirm Delivery • ${fare?.formatted}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
