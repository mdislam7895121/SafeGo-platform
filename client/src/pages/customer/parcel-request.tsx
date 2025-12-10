import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Navigation, Package, User, Phone, Scale, Ruler, Tag, Loader2, Calendar, Clock, Globe2, Truck, Zap, AlertTriangle, Banknote, ChevronRight, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesInput } from "@/components/rider/GooglePlacesInput";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatCurrency";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface PricingBreakdown {
  label: string;
  amount: number;
}

interface PricingResult {
  chargeableWeightKg: number;
  volumetricWeightKg: number;
  baseDeliveryCharge: number;
  speedSurcharge: number;
  fragileSurcharge: number;
  remoteSurcharge: number;
  fuelSurchargePercent: number;
  fuelSurchargeAmount: number;
  securitySurcharge: number;
  codFee: number;
  totalDeliveryCharge: number;
  commissionAmount: number;
  driverPayoutAmount: number;
  currency: string;
  breakdown: PricingBreakdown[];
  zoneInfo: { zoneType: string; zoneName: string } | null;
  estimatedDays?: { min: number; max: number };
}

interface ZoneData {
  domestic: Array<{
    id: string;
    zoneType: string;
    zoneName: string;
    zoneCode: string;
    rates: Record<string, number>;
    remoteSurcharge: number | null;
  }>;
  international: Array<{
    id: string;
    zoneType: string;
    zoneName: string;
    destinationCountries: string[];
    rates: Record<string, number>;
    fuelSurchargePercent: number;
    securitySurcharge: number;
    estimatedDays: { min: number; max: number };
  }>;
}

const PARCEL_TYPES = [
  { value: "documents", label: "Documents", icon: "📄" },
  { value: "electronics", label: "Electronics", icon: "📱" },
  { value: "clothing", label: "Clothing & Textiles", icon: "👕" },
  { value: "food", label: "Food & Perishables", icon: "🍔" },
  { value: "fragile", label: "Fragile Items", icon: "🔮" },
  { value: "other", label: "Other", icon: "📦" },
];

const SPEED_OPTIONS = [
  { value: "regular", label: "Regular", description: "Standard delivery", surcharge: 0 },
  { value: "quick", label: "Quick", description: "+30৳ faster", surcharge: 30 },
  { value: "express", label: "Express", description: "+60৳ priority", surcharge: 60 },
  { value: "super_express", label: "Super Express", description: "+120৳ urgent", surcharge: 120 },
];

const INTERNATIONAL_COUNTRIES = [
  { code: "IN", name: "India", zone: "South Asia" },
  { code: "NP", name: "Nepal", zone: "South Asia" },
  { code: "LK", name: "Sri Lanka", zone: "South Asia" },
  { code: "AE", name: "UAE", zone: "Middle East" },
  { code: "SA", name: "Saudi Arabia", zone: "Middle East" },
  { code: "QA", name: "Qatar", zone: "Middle East" },
  { code: "GB", name: "United Kingdom", zone: "Europe" },
  { code: "DE", name: "Germany", zone: "Europe" },
  { code: "FR", name: "France", zone: "Europe" },
  { code: "US", name: "United States", zone: "North America" },
  { code: "CA", name: "Canada", zone: "North America" },
];

export default function ParcelRequest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [parcelType, setParcelType] = useState<"domestic" | "international">("domestic");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  
  const [parcelCategory, setParcelCategory] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [parcelDetails, setParcelDetails] = useState("");
  
  const [domesticZoneType, setDomesticZoneType] = useState<string>("same_city");
  const [deliverySpeed, setDeliverySpeed] = useState("regular");
  const [isFragile, setIsFragile] = useState(false);
  const [codEnabled, setCodEnabled] = useState(false);
  const [codAmount, setCodAmount] = useState("");
  
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("online");
  const [isScheduledPickup, setIsScheduledPickup] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  const { data: zones } = useQuery<ZoneData>({
    queryKey: ["/api/parcel/bd/zones"],
  });

  const { data: profileData } = useQuery<{ countryCode?: string }>({
    queryKey: ["/api/customer/profile"],
  });

  const isCashAllowed = profileData?.countryCode !== "US";

  const volumetricWeight = useMemo(() => {
    const l = parseFloat(lengthCm) || 0;
    const w = parseFloat(widthCm) || 0;
    const h = parseFloat(heightCm) || 0;
    if (l > 0 && w > 0 && h > 0) {
      return (l * w * h) / 5000;
    }
    return 0;
  }, [lengthCm, widthCm, heightCm]);

  const chargeableWeight = useMemo(() => {
    const actual = parseFloat(actualWeight) || 0;
    return Math.max(actual, volumetricWeight);
  }, [actualWeight, volumetricWeight]);

  const calculatePrice = useCallback(async () => {
    const weight = parseFloat(actualWeight);
    if (!weight || weight <= 0) return;

    setIsPricingLoading(true);
    try {
      const data = await apiRequest("/api/parcel/bd/calculate-price", {
        method: "POST",
        body: JSON.stringify({
          isInternational: parcelType === "international",
          actualWeightKg: weight,
          lengthCm: parseFloat(lengthCm) || undefined,
          widthCm: parseFloat(widthCm) || undefined,
          heightCm: parseFloat(heightCm) || undefined,
          domesticZoneType: parcelType === "domestic" ? domesticZoneType : undefined,
          destinationCountry: parcelType === "international" ? destinationCountry : undefined,
          deliverySpeed,
          isFragile,
          codEnabled: parcelType === "domestic" ? codEnabled : false,
          codAmount: codEnabled ? parseFloat(codAmount) || 0 : undefined,
        }),
      });

      if (data?.pricing) {
        setPricing(data.pricing);
      }
    } catch (error) {
      console.error("Pricing calculation error:", error);
    } finally {
      setIsPricingLoading(false);
    }
  }, [actualWeight, lengthCm, widthCm, heightCm, parcelType, domesticZoneType, destinationCountry, deliverySpeed, isFragile, codEnabled, codAmount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (parseFloat(actualWeight) > 0) {
        calculatePrice();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [calculatePrice]);

  const createParcelMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/parcel/bd/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: isScheduledPickup ? "Pickup scheduled!" : "Parcel request created!",
        description: isScheduledPickup 
          ? `Your pickup is scheduled for ${new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}`
          : "Searching for a nearby driver...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/parcel/bd/my-parcels"] });
      setLocation(`/customer/parcel-tracking/${data.delivery?.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Request failed",
        description: error?.message || "Could not submit your parcel request.",
        variant: "destructive",
      });
    },
  });

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
    
    if (!pickupLocation) {
      toast({
        title: "Pickup location required",
        description: "Please select a pickup location.",
        variant: "destructive",
      });
      return;
    }

    if (parcelType === "domestic" && !dropoffLocation) {
      toast({
        title: "Dropoff location required",
        description: "Please select a dropoff location.",
        variant: "destructive",
      });
      return;
    }

    if (parcelType === "international" && (!destinationCountry || !destinationCity)) {
      toast({
        title: "Destination required",
        description: "Please select destination country and city.",
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

    if (!parcelCategory || !actualWeight) {
      toast({
        title: "Package info required",
        description: "Please provide package type and weight.",
        variant: "destructive",
      });
      return;
    }

    const weight = parseFloat(actualWeight);
    if (isNaN(weight) || weight <= 0) {
      toast({
        title: "Invalid weight",
        description: "Please enter a valid package weight.",
        variant: "destructive",
      });
      return;
    }

    const scheduledPickupTime = isScheduledPickup && scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      : undefined;

    createParcelMutation.mutate({
      pickupAddress: pickupLocation.address,
      pickupLat: pickupLocation.lat,
      pickupLng: pickupLocation.lng,
      dropoffAddress: parcelType === "domestic" ? dropoffLocation!.address : `${destinationCity}, ${destinationCountry}`,
      dropoffLat: parcelType === "domestic" ? dropoffLocation!.lat : 0,
      dropoffLng: parcelType === "domestic" ? dropoffLocation!.lng : 0,
      senderName,
      senderPhone,
      receiverName,
      receiverPhone,
      parcelType: parcelCategory,
      parcelDescription: parcelDetails,
      actualWeightKg: weight,
      lengthCm: parseFloat(lengthCm) || undefined,
      widthCm: parseFloat(widthCm) || undefined,
      heightCm: parseFloat(heightCm) || undefined,
      isInternational: parcelType === "international",
      destinationCountry: parcelType === "international" ? destinationCountry : undefined,
      domesticZoneType: parcelType === "domestic" ? domesticZoneType : undefined,
      deliverySpeed,
      isFragile,
      codEnabled: parcelType === "domestic" ? codEnabled : false,
      codAmount: codEnabled ? parseFloat(codAmount) : undefined,
      paymentMethod,
      scheduledPickupTime,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <Link href="/customer">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover-elevate" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Send Parcel</h1>
            <p className="text-sm opacity-90">Bangladesh Delivery</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={parcelType} onValueChange={(v) => setParcelType(v as "domestic" | "international")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="domestic" className="text-sm gap-2" data-testid="tab-domestic">
                <Truck className="h-4 w-4" />
                Domestic
              </TabsTrigger>
              <TabsTrigger value="international" className="text-sm gap-2" data-testid="tab-international">
                <Globe2 className="h-4 w-4" />
                International
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-5 w-5 text-green-600" />
                Pickup Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pickupAddress">Pickup Address</Label>
                <GooglePlacesInput
                  value={pickupAddress}
                  onChange={setPickupAddress}
                  onSelect={handlePickupSelect}
                  placeholder="Enter pickup address"
                  data-testid="input-pickup-address"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="schedulePickup">Schedule Pickup</Label>
                </div>
                <Switch
                  id="schedulePickup"
                  checked={isScheduledPickup}
                  onCheckedChange={setIsScheduledPickup}
                  data-testid="switch-schedule-pickup"
                />
              </div>

              {isScheduledPickup && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Date</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      data-testid="input-scheduled-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledTime">Time</Label>
                    <Input
                      id="scheduledTime"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      data-testid="input-scheduled-time"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-600" />
                Dropoff Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parcelType === "domestic" ? (
                <>
                  <div className="space-y-2">
                    <Label>Delivery Zone</Label>
                    <Select value={domesticZoneType} onValueChange={setDomesticZoneType}>
                      <SelectTrigger data-testid="select-zone">
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same_city">Same City</SelectItem>
                        <SelectItem value="inside_division">Inside Division</SelectItem>
                        <SelectItem value="outside_division">Outside Division</SelectItem>
                        <SelectItem value="remote">Remote Area</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dropoffAddress">Dropoff Address</Label>
                    <GooglePlacesInput
                      value={dropoffAddress}
                      onChange={setDropoffAddress}
                      onSelect={handleDropoffSelect}
                      placeholder="Enter dropoff address"
                      data-testid="input-dropoff-address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Destination Country</Label>
                    <Select value={destinationCountry} onValueChange={setDestinationCountry}>
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERNATIONAL_COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name} ({country.zone})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destinationCity">Destination City</Label>
                    <Input
                      id="destinationCity"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      placeholder="Enter city name"
                      data-testid="input-destination-city"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="senderName">Sender Name</Label>
                  <Input
                    id="senderName"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your name"
                    data-testid="input-sender-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderPhone">Sender Phone</Label>
                  <Input
                    id="senderPhone"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="+880 1XXX-XXXXXX"
                    data-testid="input-sender-phone"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Receiver Name</Label>
                  <Input
                    id="receiverName"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Receiver name"
                    data-testid="input-receiver-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverPhone">Receiver Phone</Label>
                  <Input
                    id="receiverPhone"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="+880 1XXX-XXXXXX"
                    data-testid="input-receiver-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Package Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Package Type</Label>
                <Select value={parcelCategory} onValueChange={setParcelCategory}>
                  <SelectTrigger data-testid="select-parcel-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARCEL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actualWeight">Weight (kg)</Label>
                <div className="relative">
                  <Scale className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="actualWeight"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
                    placeholder="0.0"
                    className="pl-10"
                    data-testid="input-weight"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Dimensions (cm) - Optional
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    placeholder="Length"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    data-testid="input-length"
                  />
                  <Input
                    type="number"
                    placeholder="Width"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    data-testid="input-width"
                  />
                  <Input
                    type="number"
                    placeholder="Height"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    data-testid="input-height"
                  />
                </div>
                {volumetricWeight > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>
                      Volumetric: {volumetricWeight.toFixed(2)} kg
                      {volumetricWeight > parseFloat(actualWeight || "0") && (
                        <Badge variant="secondary" className="ml-2">Chargeable</Badge>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="parcelDetails">Description (Optional)</Label>
                <Textarea
                  id="parcelDetails"
                  value={parcelDetails}
                  onChange={(e) => setParcelDetails(e.target.value)}
                  placeholder="Brief description of contents..."
                  rows={2}
                  data-testid="input-description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Delivery Speed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={deliverySpeed} onValueChange={setDeliverySpeed} className="grid grid-cols-2 gap-2">
                {SPEED_OPTIONS.map((option) => (
                  <div key={option.value} className="relative">
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.value}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      data-testid={`radio-speed-${option.value}`}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-5 w-5 text-purple-600" />
                Additional Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <Label htmlFor="fragile">Fragile Item (+30৳)</Label>
                </div>
                <Switch
                  id="fragile"
                  checked={isFragile}
                  onCheckedChange={setIsFragile}
                  data-testid="switch-fragile"
                />
              </div>

              {parcelType === "domestic" && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <Label htmlFor="cod">Cash on Delivery</Label>
                    </div>
                    <Switch
                      id="cod"
                      checked={codEnabled}
                      onCheckedChange={setCodEnabled}
                      data-testid="switch-cod"
                    />
                  </div>

                  {codEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="codAmount">COD Amount (BDT)</Label>
                      <Input
                        id="codAmount"
                        type="number"
                        min="0"
                        value={codAmount}
                        onChange={(e) => setCodAmount(e.target.value)}
                        placeholder="Amount to collect"
                        data-testid="input-cod-amount"
                      />
                      <p className="text-xs text-muted-foreground">
                        COD Fee: 0.8% (min ৳10)
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cash" | "online")} className={isCashAllowed ? "grid grid-cols-2 gap-2" : ""}>
                <div className="relative">
                  <RadioGroupItem value="online" id="online" className="peer sr-only" />
                  <Label
                    htmlFor="online"
                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    data-testid="radio-payment-online"
                  >
                    Online Pay
                  </Label>
                </div>
                {isCashAllowed && (
                  <div className="relative">
                    <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                    <Label
                      htmlFor="cash"
                      className="flex items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      data-testid="radio-payment-cash"
                    >
                      Cash
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </CardContent>
          </Card>

          {pricing && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Price Breakdown</span>
                  {isPricingLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
                {pricing.zoneInfo && (
                  <CardDescription>{pricing.zoneInfo.zoneName}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {pricing.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span>{formatCurrency(item.amount, pricing.currency || "BDT")}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(pricing.totalDeliveryCharge, pricing.currency || "BDT")}</span>
                </div>
                {pricing.estimatedDays && (
                  <p className="text-xs text-muted-foreground text-center">
                    Estimated delivery: {pricing.estimatedDays.min}-{pricing.estimatedDays.max} days
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <div className="max-w-2xl mx-auto">
          <Button
            type="submit"
            className="w-full h-12"
            disabled={createParcelMutation.isPending || !pricing}
            onClick={handleSubmit}
            data-testid="button-confirm-parcel"
          >
            {createParcelMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Request...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Confirm Parcel Request
                {pricing && <span className="ml-2">({formatCurrency(pricing.totalDeliveryCharge, "BDT")})</span>}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
