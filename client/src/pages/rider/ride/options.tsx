import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  Info,
  DollarSign,
  MapPin,
  Timer,
  CircleDollarSign,
  FileText,
  Building2,
  TrendingUp,
} from "lucide-react";
import { useRideBooking, type RideOption, type PaymentMethod, type RouteAlternative } from "@/contexts/RideBookingContext";
import { SafeGoMap } from "@/components/maps/SafeGoMap";
import { clientGetRouteAlternatives } from "@/hooks/useGoogleMaps";
import { decodePolyline } from "@/lib/locationService";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { usePromoCalculation, formatCurrencyWithStrikethrough } from "@/hooks/usePromoCalculation";
import type { RideTypeCode, RouteFareBreakdown, RouteInfoRequest } from "@/lib/fareTypes";
import type { PromoResult } from "@/lib/promoTypes";

// Define ride types with their visual properties (fares calculated dynamically)
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
  if (currency === "USD") {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
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
  { id: "wallet", type: "wallet", label: "SafeGo Wallet (৳500)", isDefault: false },
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

function getRouteIcon(route: RouteAlternative) {
  if (route.isFastest) return Zap;
  if (route.avoidsHighways) return Navigation;
  if (route.avoidsTolls) return Route;
  return Route;
}

function getRouteBadgeText(route: RouteAlternative): string | null {
  if (route.isFastest) return "Fastest";
  if (route.isShortest) return "Shortest";
  if (route.avoidsHighways) return "Local Roads";
  if (route.avoidsTolls) return "No Tolls";
  return null;
}

export default function RideOptionsPage() {
  const [, setLocation] = useLocation();
  const { 
    state, 
    setSelectedOption, 
    setPaymentMethod, 
    setPromoCode,
    setStep,
    setRouteAlternatives,
    setSelectedRoute,
    getSelectedRoute,
    canProceedToOptions,
  } = useRideBooking();
  
  const [selectedRideType, setSelectedRideType] = useState<RideTypeCode>(
    (state.selectedOption?.code as RideTypeCode) || "STANDARD"
  );
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    state.paymentMethod?.id || mockPaymentMethods.find(p => p.isDefault)?.id || mockPaymentMethods[0].id
  );
  const [promoInput, setPromoInput] = useState(state.promoCode || "");
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [fareBreakdownRideType, setFareBreakdownRideType] = useState<RideTypeCode | null>(null);

  // Convert route alternatives to fare calculation format
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

  // Use fare calculation hook
  const { 
    fareMatrix, 
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

  // Update selected option when ride type changes
  useEffect(() => {
    const config = RIDE_TYPE_CONFIG[selectedRideType];
    const selectedRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
    const fare = selectedRouteId ? getFare(selectedRideType, selectedRouteId) : null;
    
    const option: RideOption = {
      id: selectedRideType,
      code: selectedRideType,
      name: config.name,
      description: config.description,
      baseFare: fare?.baseFare || 0,
      estimatedFare: fare?.totalFare || 0,
      currency: currency,
      etaMinutes: config.etaMinutes,
      capacity: config.capacity,
      iconType: config.iconType,
      isPopular: config.isPopular,
      isEco: config.isEco,
    };
    setSelectedOption(option);
  }, [selectedRideType, state.selectedRouteId, fareRoutes, getFare, currency, setSelectedOption]);

  // Create a location key to track when locations change
  // Use higher precision (7 decimals ~= 1cm) to catch meaningful location changes
  const locationKey = useMemo(() => {
    if (!state.pickup || !state.dropoff) return null;
    return `${state.pickup.lat.toFixed(7)},${state.pickup.lng.toFixed(7)}-${state.dropoff.lat.toFixed(7)},${state.dropoff.lng.toFixed(7)}`;
  }, [state.pickup, state.dropoff]);

  // Track the last fetched location key to avoid unnecessary refetches
  const [lastFetchedLocationKey, setLastFetchedLocationKey] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch routes if we have locations and they've changed since last fetch
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

  const handleSelectRoute = (route: RouteAlternative) => {
    setSelectedRoute(route.id);
    setShowRouteSelector(false);
  };

  const handleApplyPromo = () => {
    if (promoInput.trim()) {
      setPromoCode(promoInput.trim(), false);
    }
  };

  const handleConfirm = () => {
    const currentRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
    const fare = currentRouteId ? getFare(selectedRideType, currentRouteId) : null;
    
    if (!fare || isLoadingFares) {
      return;
    }
    
    setLocation("/rider/ride/confirm");
  };

  const handleBack = () => {
    setLocation("/rider/ride/dropoff");
  };

  const handleShowFareBreakdown = (rideType: RideTypeCode) => {
    setFareBreakdownRideType(rideType);
    setShowFareBreakdown(true);
  };

  const selectedPayment = mockPaymentMethods.find(p => p.id === selectedPaymentId);
  const selectedRoute = getSelectedRoute();
  const PaymentIcon = selectedPayment ? getPaymentIcon(selectedPayment.type) : Banknote;
  
  // Get fare for fare breakdown dialog
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

  return (
    <div className="flex flex-col h-full" data-testid="ride-options-page">
      {/* Header - shared across all breakpoints */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back-options">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold" data-testid="text-options-title">Choose a Ride</h1>
            <p className="text-sm text-muted-foreground">
              {state.pickup?.address?.split(",")[0]} → {state.dropoff?.address?.split(",")[0]}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Grid */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-2 lg:gap-6 lg:h-full lg:p-6">
          
          {/* Left Column: Map & Route Selector */}
          <div className="lg:flex lg:flex-col lg:h-full">
            {/* Map - taller on desktop */}
            <div className="h-40 sm:h-48 lg:flex-1 lg:min-h-[300px] relative lg:rounded-xl lg:overflow-hidden lg:border">
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
                  className="absolute top-2 right-2 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border"
                  data-testid="route-info-badge"
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{selectedRoute.durationMinutes} min</span>
                    <span className="text-muted-foreground">•</span>
                    <Ruler className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{selectedRoute.distanceMiles} mi</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Route Selector - shown below map on desktop */}
            <div className="hidden lg:block lg:mt-4">
              {state.routeAlternatives.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Route className="h-4 w-4" />
                        Route Options
                      </p>
                      {isLoadingRoutes && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    
                    <div className="space-y-2">
                      {state.routeAlternatives.map((route) => {
                        const RouteIcon = getRouteIcon(route);
                        const badgeText = getRouteBadgeText(route);
                        const isSelected = route.id === state.selectedRouteId;
                        
                        return (
                          <div
                            key={route.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected 
                                ? "ring-2 ring-primary border-primary bg-primary/5" 
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => handleSelectRoute(route)}
                            data-testid={`route-option-desktop-${route.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}>
                                <RouteIcon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{route.name}</span>
                                  {badgeText && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {badgeText}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {route.summary || route.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">{route.durationMinutes} min</p>
                                <p className="text-xs text-muted-foreground">{route.distanceMiles} mi</p>
                              </div>
                              {isSelected && (
                                <Check className="h-5 w-5 text-primary flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column: Ride Options, Payment, Promo, CTA */}
          <div className="lg:flex lg:flex-col lg:h-full lg:overflow-y-auto">
            <div className="p-4 lg:p-0 space-y-4 lg:flex-1">
              {/* Mobile Route Selector - hidden on desktop */}
              <div className="lg:hidden">
                {state.routeAlternatives.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Route className="h-4 w-4" />
                          Route Options
                        </p>
                        {isLoadingRoutes && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      
                      {showRouteSelector ? (
                        <div className="space-y-2">
                          {state.routeAlternatives.map((route) => {
                            const RouteIcon = getRouteIcon(route);
                            const badgeText = getRouteBadgeText(route);
                            const isSelected = route.id === state.selectedRouteId;
                            
                            return (
                              <div
                                key={route.id}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected 
                                    ? "ring-2 ring-primary border-primary bg-primary/5" 
                                    : "hover:bg-muted/50"
                                }`}
                                onClick={() => handleSelectRoute(route)}
                                data-testid={`route-option-${route.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                                  }`}>
                                    <RouteIcon className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{route.name}</span>
                                      {badgeText && (
                                        <Badge variant="secondary" className="text-[10px]">
                                          {badgeText}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {route.summary || route.description}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium text-sm">{route.durationMinutes} min</p>
                                    <p className="text-xs text-muted-foreground">{route.distanceMiles} mi</p>
                                  </div>
                                  {isSelected && (
                                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                                  )}
                                </div>
                                {route.trafficDurationText && route.trafficDurationSeconds && 
                                 route.trafficDurationSeconds > route.rawDurationSeconds && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Traffic delay: {route.trafficDurationText}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setShowRouteSelector(false)}
                            data-testid="button-collapse-routes"
                          >
                            Collapse
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          onClick={() => setShowRouteSelector(true)}
                          data-testid="button-expand-routes"
                        >
                          <span className="flex items-center gap-2">
                            {selectedRoute ? (
                              <>
                                {(() => {
                                  const RouteIcon = getRouteIcon(selectedRoute);
                                  return <RouteIcon className="h-4 w-4" />;
                                })()}
                                <span>{selectedRoute.name}</span>
                                <span className="text-muted-foreground hidden sm:inline">
                                  • {selectedRoute.durationMinutes} min • {selectedRoute.distanceMiles} mi
                                </span>
                              </>
                            ) : (
                              <>
                                <Route className="h-4 w-4" />
                                <span>Select route</span>
                              </>
                            )}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {state.routeAlternatives.length} options
                          </Badge>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {isLoadingRoutes && state.routeAlternatives.length === 0 && (
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
                )}
              </div>

              {/* Ride Type Options */}
              <div className="space-y-2">
                {RIDE_TYPE_ORDER.map((rideTypeCode) => {
                  const config = RIDE_TYPE_CONFIG[rideTypeCode];
                  const Icon = getRideIcon(config.iconType);
                  const isSelected = rideTypeCode === selectedRideType;
                  const currentRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
                  const fare = currentRouteId ? getFare(rideTypeCode, currentRouteId) : null;
                  const isLoadingThisFare = isLoadingFares && !fare;
                  
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
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm sm:text-base">{config.name}</h3>
                              {config.isPopular && (
                                <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                              )}
                              {config.isEco && (
                                <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Eco
                                </Badge>
                              )}
                              {fare && (fare.tollsTotal > 0 || fare.regulatoryFeesTotal > 0) && (
                                <Badge variant="outline" className="text-[10px]">
                                  + fees
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{config.description}</p>
                            <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {config.etaMinutes} min
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {config.capacity}
                              </span>
                              {fare && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-5 px-1.5 text-xs hidden sm:flex"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowFareBreakdown(rideTypeCode);
                                  }}
                                  data-testid={`button-fare-breakdown-${rideTypeCode}`}
                                >
                                  <Info className="h-3 w-3 mr-1" />
                                  Details
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="text-right min-w-[80px] sm:min-w-[100px]">
                            {isLoadingThisFare ? (
                              <Skeleton className="h-6 w-14 sm:w-16 ml-auto" />
                            ) : fare ? (
                              <>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] sm:text-xs text-muted-foreground line-through" data-testid={`anchor-fare-${rideTypeCode}`}>
                                    {formatCurrency(fare.totalFare * 1.10, currency)}
                                  </span>
                                  <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400" data-testid={`fare-${rideTypeCode}`}>
                                    {formatCurrency(fare.totalFare, currency)}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="text-[8px] sm:text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mt-0.5">
                                  <Tag className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5" />
                                  Promo
                                </Badge>
                                {fare.surgeMultiplier > 1 && (
                                  <Badge variant="destructive" className="text-[8px] sm:text-[9px] ml-1">
                                    {fare.surgeMultiplier}x
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">--</p>
                            )}
                            {isSelected && (
                              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary ml-auto mt-1" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Payment & Promo Card */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Payment Method</p>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setShowPaymentSelector(!showPaymentSelector)}
                      data-testid="button-select-payment"
                    >
                      <span className="flex items-center gap-2">
                        <PaymentIcon className="h-4 w-4" />
                        {selectedPayment?.label}
                        {selectedPayment?.lastFour && ` ••••${selectedPayment.lastFour}`}
                      </span>
                    </Button>
                    
                    {showPaymentSelector && (
                      <div className="mt-2 space-y-1">
                        {mockPaymentMethods.map((payment) => {
                          const PIcon = getPaymentIcon(payment.type);
                          return (
                            <Button
                              key={payment.id}
                              variant={payment.id === selectedPaymentId ? "secondary" : "ghost"}
                              className="w-full justify-start"
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
                    <p className="text-sm font-medium mb-2">Promo Code</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter promo code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        className="flex-1"
                        data-testid="input-promo-code"
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyPromo}
                        disabled={!promoInput.trim()}
                        data-testid="button-apply-promo"
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        Apply
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Promo codes coming soon
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CTA Section - Desktop: inside right column */}
            <div className="hidden lg:block lg:mt-4 lg:pt-4 lg:border-t">
              {(() => {
                const config = RIDE_TYPE_CONFIG[selectedRideType];
                const currentRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
                const fare = currentRouteId ? getFare(selectedRideType, currentRouteId) : null;
                const anchorFare = fare ? fare.totalFare * 1.10 : 0;
                const savings = fare ? anchorFare - fare.totalFare : 0;
                
                return (
                  <div className="space-y-3">
                    {fare && savings > 0 && (
                      <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 py-2 rounded-lg">
                        <Tag className="h-4 w-4" />
                        <span className="font-medium">You save {formatCurrency(savings, currency)} with this promo!</span>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleConfirm}
                      disabled={!fare || isLoadingFares}
                      data-testid="button-confirm-ride-option-desktop"
                    >
                      {isLoadingFares ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Calculating fare...
                        </>
                      ) : fare ? (
                        <>Confirm {config.name} - {formatCurrency(fare.totalFare, currency)}</>
                      ) : (
                        <>Select a route to see fare</>
                      )}
                    </Button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile CTA - Fixed at bottom */}
      <div className="lg:hidden p-4 border-t bg-background">
        {(() => {
          const config = RIDE_TYPE_CONFIG[selectedRideType];
          const currentRouteId = state.selectedRouteId || (fareRoutes.length > 0 ? fareRoutes[0].routeId : null);
          const fare = currentRouteId ? getFare(selectedRideType, currentRouteId) : null;
          const anchorFare = fare ? fare.totalFare * 1.10 : 0;
          const savings = fare ? anchorFare - fare.totalFare : 0;
          
          return (
            <div className="space-y-2">
              {fare && savings > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Tag className="h-4 w-4" />
                  <span className="font-medium">You save {formatCurrency(savings, currency)} with this promo!</span>
                </div>
              )}
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirm}
                disabled={!fare || isLoadingFares}
                data-testid="button-confirm-ride-option"
              >
                {isLoadingFares ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating fare...
                  </>
                ) : fare ? (
                  <>Confirm {config.name} - {formatCurrency(fare.totalFare, currency)}</>
                ) : (
                  <>Select a route to see fare</>
                )}
              </Button>
            </div>
          );
        })()}
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
