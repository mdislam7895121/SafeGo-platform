import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Car,
  Users,
  Clock,
  Sparkles,
  Crown,
  Check,
  Tag,
  CreditCard,
  Wallet,
  Banknote,
  Route,
  Zap,
  Ruler,
  AlertTriangle,
  Loader2,
  Navigation,
  DollarSign,
  MapPin,
  Timer,
  CircleDollarSign,
  FileText,
  Building2,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { useRideBooking, type RideOption, type PaymentMethod, type RouteAlternative } from "@/contexts/RideBookingContext";
import { SafeGoMap } from "@/components/maps/SafeGoMap";
import { clientGetRouteAlternatives } from "@/hooks/useGoogleMaps";
import { decodePolyline } from "@/lib/locationService";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import type { RideTypeCode, RouteFareBreakdown, RouteInfoRequest } from "@/lib/fareTypes";

import { PromoFareCard, type PromoType } from "@/components/ride/PromoFareCard";
import { FareBreakdown, type FareBreakdownData } from "@/components/ride/FareBreakdown";
import { RouteOptionsBar, type RouteOption as RouteOptionType } from "@/components/ride/RouteOptionCard";
import { PromoCodeInput } from "@/components/ride/PromoCodeInput";

const RIDE_TYPE_CONFIG: Record<RideTypeCode, {
  name: string;
  description: string;
  iconType: RideOption["iconType"];
  capacity: number;
  etaMinutes: number;
  isPopular?: boolean;
  isEco?: boolean;
}> = {
  SAVER: {
    name: "SafeGo Saver",
    description: "Budget-friendly option",
    iconType: "economy",
    capacity: 4,
    etaMinutes: 10,
  },
  STANDARD: {
    name: "SafeGo X",
    description: "Affordable everyday rides",
    iconType: "economy",
    capacity: 4,
    etaMinutes: 5,
    isPopular: true,
  },
  COMFORT: {
    name: "SafeGo Comfort",
    description: "Newer cars with extra legroom",
    iconType: "comfort",
    capacity: 4,
    etaMinutes: 7,
  },
  XL: {
    name: "SafeGo XL",
    description: "SUVs for groups up to 6",
    iconType: "xl",
    capacity: 6,
    etaMinutes: 10,
  },
  PREMIUM: {
    name: "SafeGo Premium",
    description: "High-end vehicles",
    iconType: "premium",
    capacity: 4,
    etaMinutes: 12,
  },
};

const RIDE_TYPE_ORDER: RideTypeCode[] = ["SAVER", "STANDARD", "COMFORT", "XL", "PREMIUM"];

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function FareBreakdownDialog({
  isOpen,
  onClose,
  fareBreakdown,
  rideTypeName,
  currency,
}: {
  isOpen: boolean;
  onClose: () => void;
  fareBreakdown: RouteFareBreakdown | null;
  rideTypeName: string;
  currency: string;
}) {
  if (!fareBreakdown) return null;

  const hasRegulatoryFees = fareBreakdown.regulatoryFeesTotal > 0;
  const hasTolls = fareBreakdown.tollsTotal > 0;
  const hasAdditionalFees = fareBreakdown.additionalFeesTotal > 0;
  const hasTrafficAdjustment = fareBreakdown.trafficAdjustment > 0;
  const hasSurge = fareBreakdown.surgeAmount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Fare Breakdown - {rideTypeName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Base Fare</h4>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Base fare
              </span>
              <span>{formatCurrency(fareBreakdown.baseFare, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Distance ({fareBreakdown.distanceMiles.toFixed(1)} mi)
              </span>
              <span>{formatCurrency(fareBreakdown.distanceFare, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                Time ({fareBreakdown.durationMinutes} min)
              </span>
              <span>{formatCurrency(fareBreakdown.timeFare, currency)}</span>
            </div>
          </div>

          {hasTrafficAdjustment && (
            <div className="border-t pt-2">
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Traffic adjustment
                </span>
                <span>+{formatCurrency(fareBreakdown.trafficAdjustment, currency)}</span>
              </div>
            </div>
          )}

          {hasSurge && (
            <div className="border-t pt-2">
              <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Surge pricing ({fareBreakdown.surgeMultiplier}x)
                </span>
                <span>+{formatCurrency(fareBreakdown.surgeAmount, currency)}</span>
              </div>
            </div>
          )}

          {hasTolls && (
            <div className="border-t pt-2 space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Tolls
              </h4>
              {fareBreakdown.tollsBreakdown.map((toll) => (
                <div key={toll.id} className="flex justify-between text-sm pl-6">
                  <span>{toll.name}</span>
                  <span>{formatCurrency(toll.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          {hasRegulatoryFees && (
            <div className="border-t pt-2 space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Regulatory Fees
              </h4>
              {fareBreakdown.regulatoryFeesBreakdown.map((fee) => (
                <div key={fee.id} className="flex justify-between text-sm pl-6">
                  <span title={fee.description}>{fee.name}</span>
                  <span>{formatCurrency(fee.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          {hasAdditionalFees && (
            <div className="border-t pt-2 space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground">Additional Fees</h4>
              {fareBreakdown.additionalFeesBreakdown.map((fee) => (
                <div key={fee.id} className="flex justify-between text-sm pl-6">
                  <span title={fee.description}>{fee.name}</span>
                  <span>{formatCurrency(fee.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          {fareBreakdown.serviceFee > 0 && (
            <div className="border-t pt-2">
              <div className="flex justify-between text-sm">
                <span>Service fee</span>
                <span>{formatCurrency(fareBreakdown.serviceFee, currency)}</span>
              </div>
            </div>
          )}

          {fareBreakdown.discountAmount > 0 && (
            <div className="border-t pt-2">
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Discount applied</span>
                <span>-{formatCurrency(fareBreakdown.discountAmount, currency)}</span>
              </div>
            </div>
          )}

          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(fareBreakdown.totalFare, currency)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const mockPaymentMethods: PaymentMethod[] = [
  { id: "cash", type: "cash", label: "Cash", isDefault: true },
  { id: "wallet", type: "wallet", label: "SafeGo Wallet ($50.00)", isDefault: false },
  { id: "card-1234", type: "card", label: "Visa", lastFour: "1234", isDefault: false },
];

function getRideIcon(iconType: RideOption["iconType"]) {
  switch (iconType) {
    case "comfort":
      return Sparkles;
    case "xl":
      return Users;
    case "premium":
      return Crown;
    default:
      return Car;
  }
}

function getPaymentIcon(type: PaymentMethod["type"]) {
  switch (type) {
    case "card":
      return CreditCard;
    case "wallet":
      return Wallet;
    default:
      return Banknote;
  }
}

function getRouteLabel(route: RouteAlternative): string {
  if (route.isFastest) return "Fastest";
  if (route.isShortest) return "Shortest";
  if (route.avoidsHighways) return "Local Roads";
  if (route.avoidsTolls) return "No Tolls";
  return route.name || "Route";
}

export default function RideOptionsPage() {
  const [, setLocation] = useLocation();
  const { 
    state, 
    setSelectedOption, 
    setPaymentMethod, 
    setStep,
    setRouteAlternatives,
    setSelectedRoute,
    getSelectedRoute,
    setFareEstimate,
    canProceedToOptions,
  } = useRideBooking();
  
  const [selectedRideType, setSelectedRideType] = useState<RideTypeCode>(
    (state.selectedOption?.code as RideTypeCode) || "STANDARD"
  );
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    state.paymentMethod?.id || mockPaymentMethods.find(p => p.isDefault)?.id || mockPaymentMethods[0].id
  );
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [fareBreakdownRideType, setFareBreakdownRideType] = useState<RideTypeCode | null>(null);

  const fareRoutes: RouteInfoRequest[] = useMemo(() => {
    return state.routeAlternatives.map((route) => ({
      routeId: route.id,
      distanceMiles: route.distanceMiles,
      durationMinutes: route.durationMinutes,
      trafficDurationMinutes: route.trafficDurationSeconds 
        ? Math.ceil(route.trafficDurationSeconds / 60)
        : undefined,
      polyline: route.polyline,
      summary: route.summary,
      avoidsHighways: route.avoidsHighways,
      avoidsTolls: route.avoidsTolls,
    }));
  }, [state.routeAlternatives]);

  const { 
    isLoading: isLoadingFares, 
    getFare, 
    currency 
  } = useFareCalculation({
    pickupLat: state.pickup?.lat ?? null,
    pickupLng: state.pickup?.lng ?? null,
    dropoffLat: state.dropoff?.lat ?? null,
    dropoffLng: state.dropoff?.lng ?? null,
    routes: fareRoutes,
    countryCode: "US",
    surgeMultiplier: 1,
    enabled: fareRoutes.length > 0,
  });

  useEffect(() => {
    if (!canProceedToOptions) {
      setLocation("/rider/ride/dropoff");
      return;
    }
    setStep("options");
    const defaultPayment = mockPaymentMethods.find(p => p.id === selectedPaymentId) || mockPaymentMethods[0];
    setPaymentMethod(defaultPayment);
  }, [setStep, setPaymentMethod, selectedPaymentId, canProceedToOptions, setLocation]);

  useEffect(() => {
    const config = RIDE_TYPE_CONFIG[selectedRideType];
    const selectedRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
    const fare = selectedRouteId ? getFare(selectedRideType, selectedRouteId) : null;
    
    const promo = state.promoValidation;
    const promoDiscountAmount = promo?.valid ? promo.discountAmount : 0;
    const adjustedFare = fare ? fare.totalFare - promoDiscountAmount : 0;
    
    const option: RideOption = {
      id: selectedRideType,
      code: selectedRideType,
      name: config.name,
      description: config.description,
      baseFare: fare?.baseFare || 0,
      estimatedFare: adjustedFare,
      currency: currency,
      etaMinutes: config.etaMinutes,
      capacity: config.capacity,
      iconType: config.iconType,
      isPopular: config.isPopular,
      isEco: config.isEco,
    };
    setSelectedOption(option);
  }, [selectedRideType, state.selectedRouteId, state.promoValidation, fareRoutes, getFare, currency, setSelectedOption]);

  const locationKey = useMemo(() => {
    if (!state.pickup || !state.dropoff) return null;
    return `${state.pickup.lat.toFixed(7)},${state.pickup.lng.toFixed(7)}-${state.dropoff.lat.toFixed(7)},${state.dropoff.lng.toFixed(7)}`;
  }, [state.pickup, state.dropoff]);

  const [lastFetchedLocationKey, setLastFetchedLocationKey] = useState<string | null>(null);

  useEffect(() => {
    if (state.pickup && state.dropoff && locationKey && locationKey !== lastFetchedLocationKey) {
      setIsLoadingRoutes(true);
      setLastFetchedLocationKey(locationKey);
      
      clientGetRouteAlternatives(
        { lat: state.pickup.lat, lng: state.pickup.lng },
        { lat: state.dropoff.lat, lng: state.dropoff.lng }
      )
        .then((routes) => {
          if (routes.length > 0) {
            setRouteAlternatives(routes);
          }
        })
        .catch((err) => {
          console.error("[RouteOptions] Failed to fetch routes:", err);
        })
        .finally(() => {
          setIsLoadingRoutes(false);
        });
    }
  }, [locationKey, lastFetchedLocationKey, state.pickup, state.dropoff, setRouteAlternatives]);

  const handleSelectRideType = (rideType: RideTypeCode) => {
    setSelectedRideType(rideType);
  };

  const handleSelectPayment = (payment: PaymentMethod) => {
    setSelectedPaymentId(payment.id);
    setPaymentMethod(payment);
    setShowPaymentSelector(false);
  };

  const handleSelectRouteOption = (routeOption: RouteOptionType) => {
    setSelectedRoute(routeOption.id);
  };

  const handleConfirm = () => {
    const currentRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
    const fare = currentRouteId ? getFare(selectedRideType, currentRouteId) : null;
    
    if (!fare || isLoadingFares) {
      return;
    }
    
    const promo = state.promoValidation;
    const promoDiscountAmount = promo?.valid ? Math.min(promo.discountAmount, fare.totalFare) : 0;
    const adjustedTotalFare = Math.max(0, fare.totalFare - promoDiscountAmount);
    
    const selectedRoute = getSelectedRoute();
    const estimate = {
      baseFare: fare.baseFare,
      distanceFare: fare.distanceFare,
      timeFare: fare.timeFare,
      surgeFare: fare.surgeAmount,
      promoDiscount: promoDiscountAmount,
      totalFare: adjustedTotalFare,
      currency: currency,
      distanceKm: (selectedRoute?.distanceMiles || 0) * 1.60934,
      durationMinutes: selectedRoute?.durationMinutes || 0,
    };
    setFareEstimate(estimate);
    
    setLocation("/rider/ride/confirm");
  };

  const handleBack = () => {
    setLocation("/rider/ride/dropoff");
  };

  const selectedPayment = mockPaymentMethods.find(p => p.id === selectedPaymentId);
  const selectedRoute = getSelectedRoute();
  const PaymentIcon = selectedPayment ? getPaymentIcon(selectedPayment.type) : Banknote;
  
  const fareBreakdownFare = fareBreakdownRideType && state.selectedRouteId
    ? getFare(fareBreakdownRideType, state.selectedRouteId)
    : null;

  const routePolyline = useMemo(() => {
    if (selectedRoute?.polyline) {
      try {
        return decodePolyline(selectedRoute.polyline);
      } catch {
        return [];
      }
    }
    return [];
  }, [selectedRoute?.polyline]);

  const currentRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
  const selectedFare = currentRouteId ? getFare(selectedRideType, currentRouteId) : null;
  
  const promoValidation = state.promoValidation;
  const promoDiscount = promoValidation?.valid && selectedFare 
    ? Math.min(promoValidation.discountAmount, selectedFare.totalFare) 
    : 0;
  const anchorFare = selectedFare ? selectedFare.totalFare : 0;
  const savedAmount = promoDiscount;
  const finalFare = selectedFare ? Math.max(0, selectedFare.totalFare - promoDiscount) : 0;
  const config = RIDE_TYPE_CONFIG[selectedRideType];

  const promoType: PromoType = promoDiscount > 0 ? "PROMO_APPLIED" : "NONE";

  const fareBreakdownData: FareBreakdownData | null = selectedFare ? {
    tripFare: selectedFare.baseFare + selectedFare.distanceFare + selectedFare.timeFare,
    trafficAdjustment: selectedFare.trafficAdjustment,
    tolls: selectedFare.tollsTotal,
    cityFees: selectedFare.regulatoryFeesTotal,
    serviceFee: selectedFare.serviceFee,
    promoDiscount: promoDiscount,
    totalFare: finalFare,
  } : null;

  const routeOptions: RouteOptionType[] = useMemo(() => {
    return state.routeAlternatives.map((route) => {
      const routeFare = getFare(selectedRideType, route.id);
      return {
        id: route.id,
        label: getRouteLabel(route),
        etaMinutes: route.durationMinutes,
        distanceMiles: route.distanceMiles,
        finalFare: routeFare?.totalFare || 0,
        promoType: (routeFare ? "PROMO_APPLIED" : "NONE") as PromoType,
        isSelected: route.id === state.selectedRouteId,
      };
    });
  }, [state.routeAlternatives, state.selectedRouteId, selectedRideType, getFare]);

  return (
    <div className="flex flex-col h-full" data-testid="ride-options-page">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back-options">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold" data-testid="text-options-title">Choose a Ride</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {state.pickup?.address?.split(",")[0]} → {state.dropoff?.address?.split(",")[0]}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,450px] lg:gap-6 lg:h-full lg:p-6">
          
          {/* Left Column: Map & Route Options */}
          <div className="lg:flex lg:flex-col lg:h-full">
            {/* Map */}
            <div className="h-36 sm:h-44 lg:flex-1 lg:min-h-[280px] relative lg:rounded-xl lg:overflow-hidden lg:border">
              <SafeGoMap
                pickupLocation={state.pickup ? {
                  lat: state.pickup.lat,
                  lng: state.pickup.lng,
                  label: "Pickup",
                } : null}
                dropoffLocation={state.dropoff ? {
                  lat: state.dropoff.lat,
                  lng: state.dropoff.lng,
                  label: "Dropoff",
                } : null}
                routeCoordinates={routePolyline}
                activeLeg="to_dropoff"
                showControls={false}
                className="h-full w-full"
              />
              {selectedRoute && (
                <div 
                  className="absolute top-2 right-2 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-lg border"
                  data-testid="route-info-badge"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{selectedRoute.durationMinutes} min</span>
                    <span className="text-muted-foreground">•</span>
                    <Ruler className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{selectedRoute.distanceMiles} mi</span>
                  </div>
                </div>
              )}
            </div>

            {/* Route Options - Using shared RouteOptionsBar component */}
            {routeOptions.length > 0 && (
              <div className="px-3 sm:px-4 py-3 lg:px-0 lg:mt-4">
                {isLoadingRoutes && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading routes...
                  </div>
                )}
                <RouteOptionsBar
                  routes={routeOptions}
                  onSelectRoute={handleSelectRouteOption}
                  currency={currency}
                />
              </div>
            )}

            {isLoadingRoutes && routeOptions.length === 0 && (
              <div className="px-3 sm:px-4 py-3 lg:px-0 lg:mt-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right Column: Ride Types, Promo Card, Breakdown, Payment, CTA */}
          <div className="lg:flex lg:flex-col lg:h-full lg:overflow-y-auto">
            <div className="p-3 sm:p-4 lg:p-0 space-y-3 sm:space-y-4 lg:flex-1">
              
              {/* Ride Type Selector */}
              <div>
                <p className="text-xs sm:text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" />
                  Select Ride Type
                </p>
                
                {/* Mobile: Horizontal Scroll Pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide lg:hidden -mx-3 sm:-mx-4 px-3 sm:px-4">
                  {RIDE_TYPE_ORDER.map((rideTypeCode) => {
                    const rideConfig = RIDE_TYPE_CONFIG[rideTypeCode];
                    const Icon = getRideIcon(rideConfig.iconType);
                    const isSelected = rideTypeCode === selectedRideType;
                    const fare = currentRouteId ? getFare(rideTypeCode, currentRouteId) : null;
                    const pillPromoDiscount = promoValidation?.valid ? promoValidation.discountAmount : 0;
                    const pillFinalFare = fare ? fare.totalFare - pillPromoDiscount : 0;
                    
                    return (
                      <Button
                        key={rideTypeCode}
                        variant={isSelected ? "default" : "outline"}
                        className={`flex-shrink-0 snap-start h-auto py-2 px-3 ${
                          isSelected ? "" : "hover-elevate"
                        }`}
                        onClick={() => handleSelectRideType(rideTypeCode)}
                        data-testid={`ride-pill-${rideTypeCode}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <Icon className="h-5 w-5" />
                            {isSelected && promoValidation?.valid && (
                              <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                            )}
                          </div>
                          <span className="text-[10px] sm:text-xs font-medium">{rideConfig.name.replace("SafeGo ", "")}</span>
                          <span className={`text-[10px] font-bold ${pillPromoDiscount > 0 ? "text-green-600 dark:text-green-400" : ""}`}>
                            {fare ? formatCurrency(pillFinalFare, currency) : "--"}
                          </span>
                        </div>
                      </Button>
                    );
                  })}
                </div>

                {/* Desktop: Vertical List */}
                <div className="hidden lg:block space-y-2">
                  {RIDE_TYPE_ORDER.map((rideTypeCode) => {
                    const rideConfig = RIDE_TYPE_CONFIG[rideTypeCode];
                    const Icon = getRideIcon(rideConfig.iconType);
                    const isSelected = rideTypeCode === selectedRideType;
                    const fare = currentRouteId ? getFare(rideTypeCode, currentRouteId) : null;
                    const ridePromoDiscount = promoValidation?.valid ? promoValidation.discountAmount : 0;
                    const rideFinalFare = fare ? fare.totalFare - ridePromoDiscount : 0;
                    const rideAnchorFare = fare && ridePromoDiscount > 0 ? fare.totalFare : 0;
                    
                    return (
                      <Card
                        key={rideTypeCode}
                        className={`cursor-pointer transition-all ${
                          isSelected 
                            ? "ring-2 ring-primary border-primary" 
                            : "hover-elevate"
                        }`}
                        onClick={() => handleSelectRideType(rideTypeCode)}
                        data-testid={`ride-option-${rideTypeCode}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-sm">{rideConfig.name}</h3>
                                {rideConfig.isPopular && (
                                  <Badge variant="secondary" className="text-[9px]">Popular</Badge>
                                )}
                                {isSelected && promoValidation?.valid && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-[9px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                                    data-testid={`promo-badge-${rideTypeCode}`}
                                  >
                                    <Tag className="h-2.5 w-2.5 mr-1" />
                                    {promoValidation.code}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {rideConfig.etaMinutes} min
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {rideConfig.capacity}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              {fare ? (
                                <>
                                  {ridePromoDiscount > 0 && (
                                    <span className="text-[10px] text-muted-foreground line-through block">
                                      {formatCurrency(rideAnchorFare, currency)}
                                    </span>
                                  )}
                                  <p className={`font-bold ${ridePromoDiscount > 0 ? "text-green-600 dark:text-green-400" : ""}`}>
                                    {formatCurrency(rideFinalFare, currency)}
                                  </p>
                                </>
                              ) : (
                                <Skeleton className="h-5 w-14" />
                              )}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Promo Fare Card - Using shared component */}
              {selectedFare && (
                <PromoFareCard
                  rideType={config.name}
                  etaMinutes={config.etaMinutes}
                  finalFare={finalFare}
                  anchorFare={promoDiscount > 0 ? anchorFare : undefined}
                  savedAmount={savedAmount}
                  promoType={promoType}
                  currency={currency}
                />
              )}

              {isLoadingFares && !selectedFare && (
                <Card>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-4 w-16 ml-auto" />
                        <Skeleton className="h-8 w-20 ml-auto" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fare Breakdown - Using shared component */}
              {fareBreakdownData && (
                <>
                  {/* Mobile: Accordion */}
                  <div className="lg:hidden">
                    <FareBreakdown 
                      breakdown={fareBreakdownData} 
                      currency={currency} 
                      alwaysExpanded={false} 
                    />
                  </div>
                  {/* Desktop: Always visible */}
                  <div className="hidden lg:block">
                    <FareBreakdown 
                      breakdown={fareBreakdownData} 
                      currency={currency} 
                      alwaysExpanded={true} 
                    />
                  </div>
                </>
              )}

              {/* Payment & Promo Code */}
              <Card>
                <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-2">Payment Method</p>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-10 sm:h-11"
                      onClick={() => setShowPaymentSelector(!showPaymentSelector)}
                      data-testid="button-select-payment"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <PaymentIcon className="h-4 w-4" />
                        {selectedPayment?.label}
                        {selectedPayment?.lastFour && ` ••••${selectedPayment.lastFour}`}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showPaymentSelector ? "rotate-180" : ""}`} />
                    </Button>
                    
                    {showPaymentSelector && (
                      <div className="mt-2 space-y-1">
                        {mockPaymentMethods.map((payment) => {
                          const PIcon = getPaymentIcon(payment.type);
                          return (
                            <Button
                              key={payment.id}
                              variant={payment.id === selectedPaymentId ? "secondary" : "ghost"}
                              className="w-full justify-start h-10"
                              onClick={() => handleSelectPayment(payment)}
                              data-testid={`payment-method-${payment.id}`}
                            >
                              <PIcon className="h-4 w-4 mr-2" />
                              {payment.label}
                              {payment.lastFour && ` ••••${payment.lastFour}`}
                              {payment.id === selectedPaymentId && (
                                <Check className="h-4 w-4 ml-auto" />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-2">Promo Code</p>
                    <PromoCodeInput
                      originalFare={selectedFare?.totalFare || 0}
                      rideTypeCode={selectedRideType}
                      countryCode="US"
                      isWalletPayment={selectedPayment?.type === "wallet"}
                      onPromoApplied={(validation) => {
                        if (selectedFare && selectedRoute) {
                          const discountAmount = Math.min(validation.discountAmount, selectedFare.totalFare);
                          const adjustedTotal = Math.max(0, selectedFare.totalFare - discountAmount);
                          setFareEstimate({
                            baseFare: selectedFare.baseFare,
                            distanceFare: selectedFare.distanceFare,
                            timeFare: selectedFare.timeFare,
                            surgeFare: selectedFare.surgeAmount,
                            promoDiscount: discountAmount,
                            totalFare: adjustedTotal,
                            currency: currency,
                            distanceKm: selectedRoute.distanceMiles * 1.60934,
                            durationMinutes: selectedRoute.durationMinutes,
                          });
                        }
                      }}
                      onPromoCleared={() => {
                        if (selectedFare && selectedRoute) {
                          setFareEstimate({
                            baseFare: selectedFare.baseFare,
                            distanceFare: selectedFare.distanceFare,
                            timeFare: selectedFare.timeFare,
                            surgeFare: selectedFare.surgeAmount,
                            promoDiscount: 0,
                            totalFare: selectedFare.totalFare,
                            currency: currency,
                            distanceKm: selectedRoute.distanceMiles * 1.60934,
                            durationMinutes: selectedRoute.durationMinutes,
                          });
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:block lg:mt-4 lg:pt-4 lg:border-t">
              {savedAmount > 0 && promoValidation?.valid && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 py-2 rounded-lg mb-3">
                  <Tag className="h-4 w-4" />
                  <span className="font-medium">
                    {promoValidation.code} applied - You save {formatCurrency(savedAmount, currency)}!
                  </span>
                </div>
              )}
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirm}
                disabled={!selectedFare || isLoadingFares}
                data-testid="button-confirm-ride-option-desktop"
              >
                {isLoadingFares ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating fare...
                  </>
                ) : selectedFare ? (
                  <>Confirm {config.name} - {formatCurrency(finalFare, currency)}</>
                ) : (
                  <>Select a route to see fare</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile CTA - Fixed at bottom */}
      <div className="lg:hidden p-3 sm:p-4 border-t bg-background">
        {savedAmount > 0 && promoValidation?.valid && (
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-green-600 dark:text-green-400 mb-2">
            <Tag className="h-3.5 w-3.5" />
            <span className="font-medium">
              {promoValidation.code} applied - You save {formatCurrency(savedAmount, currency)}!
            </span>
          </div>
        )}
        <Button
          className="w-full"
          size="lg"
          onClick={handleConfirm}
          disabled={!selectedFare || isLoadingFares}
          data-testid="button-confirm-ride-option"
        >
          {isLoadingFares ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : selectedFare ? (
            <>Confirm {config.name} - {formatCurrency(finalFare, currency)}</>
          ) : (
            <>Select a route to see fare</>
          )}
        </Button>
      </div>

      <FareBreakdownDialog
        isOpen={showFareBreakdown}
        onClose={() => setShowFareBreakdown(false)}
        fareBreakdown={fareBreakdownFare}
        rideTypeName={fareBreakdownRideType ? RIDE_TYPE_CONFIG[fareBreakdownRideType].name : ""}
        currency={currency}
      />
    </div>
  );
}
