import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Car,
  Users,
  Clock,
  Sparkles,
  Leaf,
  Crown,
  Check,
  Tag,
  CreditCard,
  Wallet,
  Banknote,
} from "lucide-react";
import { useRideBooking, type RideOption, type PaymentMethod } from "@/contexts/RideBookingContext";
import { SafeGoMap } from "@/components/maps/SafeGoMap";

const mockRideOptions: RideOption[] = [
  {
    id: "safego-x",
    code: "SAFEGO_X",
    name: "SafeGo X",
    description: "Affordable everyday rides",
    baseFare: 50,
    estimatedFare: 180,
    currency: "BDT",
    etaMinutes: 5,
    capacity: 4,
    iconType: "economy",
    isPopular: true,
  },
  {
    id: "safego-comfort",
    code: "SAFEGO_COMFORT",
    name: "SafeGo Comfort",
    description: "Newer cars with extra legroom",
    baseFare: 80,
    estimatedFare: 280,
    currency: "BDT",
    etaMinutes: 8,
    capacity: 4,
    iconType: "comfort",
  },
  {
    id: "safego-xl",
    code: "SAFEGO_XL",
    name: "SafeGo XL",
    description: "SUVs for groups up to 6",
    baseFare: 100,
    estimatedFare: 350,
    currency: "BDT",
    etaMinutes: 10,
    capacity: 6,
    iconType: "xl",
  },
  {
    id: "safego-green",
    code: "SAFEGO_GREEN",
    name: "SafeGo Green",
    description: "Electric and hybrid vehicles",
    baseFare: 60,
    estimatedFare: 200,
    currency: "BDT",
    etaMinutes: 12,
    capacity: 4,
    iconType: "economy",
    isEco: true,
  },
];

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

export default function RideOptionsPage() {
  const [, setLocation] = useLocation();
  const { 
    state, 
    setSelectedOption, 
    setPaymentMethod, 
    setPromoCode,
    setStep,
    canProceedToOptions,
    canProceedToConfirm,
  } = useRideBooking();
  
  const [selectedId, setSelectedId] = useState(state.selectedOption?.id || mockRideOptions[0].id);
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    state.paymentMethod?.id || mockPaymentMethods.find(p => p.isDefault)?.id || mockPaymentMethods[0].id
  );
  const [promoInput, setPromoInput] = useState(state.promoCode || "");
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);

  useEffect(() => {
    if (!canProceedToOptions) {
      setLocation("/rider/ride/dropoff");
      return;
    }
    setStep("options");
    const defaultOption = mockRideOptions.find(o => o.id === selectedId) || mockRideOptions[0];
    setSelectedOption(defaultOption);
    const defaultPayment = mockPaymentMethods.find(p => p.id === selectedPaymentId) || mockPaymentMethods[0];
    setPaymentMethod(defaultPayment);
  }, [setStep, setSelectedOption, setPaymentMethod, selectedId, selectedPaymentId, canProceedToOptions, setLocation]);

  const handleSelectOption = (option: RideOption) => {
    setSelectedId(option.id);
    setSelectedOption(option);
  };

  const handleSelectPayment = (payment: PaymentMethod) => {
    setSelectedPaymentId(payment.id);
    setPaymentMethod(payment);
    setShowPaymentSelector(false);
  };

  const handleApplyPromo = () => {
    if (promoInput.trim()) {
      setPromoCode(promoInput.trim(), false);
    }
  };

  const handleConfirm = () => {
    setLocation("/rider/ride/confirm");
  };

  const handleBack = () => {
    setLocation("/rider/ride/dropoff");
  };

  const selectedOption = mockRideOptions.find(o => o.id === selectedId);
  const selectedPayment = mockPaymentMethods.find(p => p.id === selectedPaymentId);
  const PaymentIcon = selectedPayment ? getPaymentIcon(selectedPayment.type) : Banknote;

  return (
    <div className="flex flex-col h-full" data-testid="ride-options-page">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-3">
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

      <div className="h-32 relative">
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
          activeLeg="to_dropoff"
          showControls={false}
          className="h-full w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          {mockRideOptions.map((option) => {
            const Icon = getRideIcon(option.iconType);
            const isSelected = option.id === selectedId;
            return (
              <Card
                key={option.id}
                className={`cursor-pointer transition-all ${
                  isSelected 
                    ? "ring-2 ring-primary border-primary" 
                    : "hover-elevate"
                }`}
                onClick={() => handleSelectOption(option)}
                data-testid={`ride-option-${option.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{option.name}</h3>
                        {option.isPopular && (
                          <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                        )}
                        {option.isEco && (
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Leaf className="h-3 w-3 mr-0.5" />
                            Eco
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {option.etaMinutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {option.capacity}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold" data-testid={`fare-${option.id}`}>
                        ৳{option.estimatedFare}
                      </p>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary ml-auto mt-1" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

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

      <div className="p-4 border-t bg-background">
        <Button
          className="w-full"
          size="lg"
          onClick={handleConfirm}
          data-testid="button-confirm-ride-option"
        >
          Confirm {selectedOption?.name} - ৳{selectedOption?.estimatedFare}
        </Button>
      </div>
    </div>
  );
}
