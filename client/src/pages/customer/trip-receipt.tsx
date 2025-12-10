import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Navigation,
  Clock,
  Route,
  Car,
  Receipt,
  Tag,
  DollarSign,
  Download,
  Share2,
  Star,
  Percent,
  Building2,
  Copy,
  Headphones,
} from "lucide-react";
import { VEHICLE_CATEGORIES, type VehicleCategoryId } from "@shared/vehicleCategories";
import { formatDurationMinutes } from "@/lib/formatters";
import { formatCurrency } from "@/lib/formatCurrency";

interface TripReceiptData {
  tripId: string;
  status: "completed";
  pickupAddress: string;
  dropoffAddress: string;
  tripStartTime: string;
  tripEndTime: string;
  distanceMiles: string;
  etaWithTrafficMinutes: number;
  vehicleCategory: VehicleCategoryId;
  driver: {
    name: string;
    rating: number;
    carModel: string;
    carColor: string;
    plateNumber: string;
    avatarInitials: string;
  };
  fareBreakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    perMileRate: number;
    perMinuteRate: number;
    bookingFee: number;
    taxesAndSurcharges: number;
    minimumFareAdjustment: number;
    subtotal: number;
    originalFare: number;
    discountAmount: number;
    finalFare: number;
    promoCode: string | null;
    promoLabel: string | null;
  };
  userRating?: number;
  userFeedback?: string;
  tipAmount?: number;
  paymentMethod?: string;
}

export default function TripReceipt() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/customer/trip-receipt/:id");
  const tripId = params?.id;
  const { toast } = useToast();
  
  const [receiptData, setReceiptData] = useState<TripReceiptData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`trip_receipt_${tripId}`);
    if (stored) {
      try {
        setReceiptData(JSON.parse(stored));
      } catch {
        setLocation("/customer/book");
      }
    } else {
      setLocation("/customer/book");
    }
  }, [tripId, setLocation]);

  if (!receiptData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading receipt...</p>
        </div>
      </div>
    );
  }

  const { fareBreakdown, driver } = receiptData;
  const vehicleCategory = VEHICLE_CATEGORIES[receiptData.vehicleCategory];
  const tripDate = new Date(receiptData.tripEndTime);

  const handleDownloadReceipt = () => {
    const receiptText = `
SafeGo Trip Receipt
===================

Trip ID: ${receiptData.tripId}
Date: ${tripDate.toLocaleDateString()} at ${tripDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

FROM: ${receiptData.pickupAddress}
TO: ${receiptData.dropoffAddress}

Distance: ${receiptData.distanceMiles} mi
Duration: ${formatDurationMinutes(receiptData.etaWithTrafficMinutes)}
Vehicle: ${vehicleCategory.displayName}

FARE BREAKDOWN
--------------
Base Fare: ${formatCurrency(fareBreakdown.baseFare, "USD")}
Distance (${receiptData.distanceMiles} mi × ${formatCurrency(fareBreakdown.perMileRate, "USD")}): ${formatCurrency(fareBreakdown.distanceFare, "USD")}
Time (${receiptData.etaWithTrafficMinutes} min × ${formatCurrency(fareBreakdown.perMinuteRate, "USD")}): ${formatCurrency(fareBreakdown.timeFare, "USD")}
Booking Fee: ${formatCurrency(fareBreakdown.bookingFee, "USD")}
Taxes & Surcharges: ${formatCurrency(fareBreakdown.taxesAndSurcharges, "USD")}
${fareBreakdown.minimumFareAdjustment > 0 ? `Minimum Fare Adjustment: ${formatCurrency(fareBreakdown.minimumFareAdjustment, "USD")}\n` : ''}
Subtotal: ${formatCurrency(fareBreakdown.subtotal, "USD")}
${fareBreakdown.discountAmount > 0 ? `Promo (${fareBreakdown.promoCode}): -${formatCurrency(fareBreakdown.discountAmount, "USD")}\n` : ''}
--------------
TOTAL: ${formatCurrency(fareBreakdown.finalFare, "USD")}
${receiptData.tipAmount ? `Tip: ${formatCurrency(receiptData.tipAmount, "USD")}` : ''}

Driver: ${driver.name}
Vehicle: ${driver.carModel} (${driver.carColor}) - ${driver.plateNumber}

Thank you for riding with SafeGo!
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safego-receipt-${receiptData.tripId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const shareText = `My SafeGo trip from ${receiptData.pickupAddress} to ${receiptData.dropoffAddress} - ${formatCurrency(fareBreakdown.finalFare, "USD")}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SafeGo Trip Receipt',
          text: shareText,
        });
      } catch {
        // User cancelled share
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Copied to clipboard",
          description: "Trip receipt details have been copied.",
        });
      } catch {
        toast({
          title: "Unable to share",
          description: "Could not copy receipt details.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-green-500 text-white p-6 pb-12 relative">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/customer/book")}
            className="text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Trip Receipt</h1>
        </div>
        
        {/* Success indicator */}
        <div className="text-center">
          <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Trip Completed</h2>
          <p className="text-white/80">{tripDate.toLocaleDateString()} at {tripDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        {/* Main receipt card */}
        <Card className="shadow-lg" data-testid="receipt-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Fare Details
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                #{receiptData.tripId.slice(0, 8).toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Route summary */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="mt-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm font-medium" data-testid="text-pickup">{receiptData.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="text-sm font-medium" data-testid="text-dropoff">{receiptData.dropoffAddress}</p>
                </div>
              </div>
            </div>

            {/* Trip stats */}
            <div className="flex gap-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Route className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-distance">{receiptData.distanceMiles} mi</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-duration">{formatDurationMinutes(receiptData.etaWithTrafficMinutes)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-vehicle">{vehicleCategory.displayName}</span>
              </div>
            </div>

            <Separator />

            {/* Detailed fare breakdown */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fare Breakdown
              </h4>
              
              {/* Base fare */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base fare</span>
                <span data-testid="text-base-fare">{formatCurrency(fareBreakdown.baseFare, "USD")}</span>
              </div>
              
              {/* Distance fare */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Distance ({receiptData.distanceMiles} mi × {formatCurrency(fareBreakdown.perMileRate, "USD")}/mi)
                </span>
                <span data-testid="text-distance-fare">{formatCurrency(fareBreakdown.distanceFare, "USD")}</span>
              </div>
              
              {/* Time fare */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Time ({receiptData.etaWithTrafficMinutes} min × {formatCurrency(fareBreakdown.perMinuteRate, "USD")}/min)
                </span>
                <span data-testid="text-time-fare">{formatCurrency(fareBreakdown.timeFare, "USD")}</span>
              </div>
              
              {/* Booking fee */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Booking fee</span>
                <span data-testid="text-booking-fee">{formatCurrency(fareBreakdown.bookingFee, "USD")}</span>
              </div>
              
              {/* Taxes */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Taxes & surcharges
                </span>
                <span data-testid="text-taxes">{formatCurrency(fareBreakdown.taxesAndSurcharges, "USD")}</span>
              </div>
              
              {/* Minimum fare adjustment */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Minimum fare adjustment</span>
                <span data-testid="text-min-fare" className={fareBreakdown.minimumFareAdjustment === 0 ? "text-muted-foreground" : ""}>
                  {fareBreakdown.minimumFareAdjustment > 0 
                    ? formatCurrency(fareBreakdown.minimumFareAdjustment, "USD")
                    : "Not applicable"
                  }
                </span>
              </div>

              <Separator className="my-2" />
              
              {/* Subtotal */}
              <div className="flex justify-between text-sm font-medium">
                <span>Subtotal</span>
                <span data-testid="text-subtotal">{formatCurrency(fareBreakdown.subtotal, "USD")}</span>
              </div>
              
              {/* Promo discount (if applicable) */}
              {fareBreakdown.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Promo ({fareBreakdown.promoCode})
                  </span>
                  <span data-testid="text-discount">-{formatCurrency(fareBreakdown.discountAmount, "USD")}</span>
                </div>
              )}

              <Separator className="my-2" />
              
              {/* Final total */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl" data-testid="text-total">{formatCurrency(fareBreakdown.finalFare, "USD")}</span>
              </div>

              {/* Tip (if any) */}
              {receiptData.tipAmount && receiptData.tipAmount > 0 && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Tip for driver</span>
                  <span data-testid="text-tip">{formatCurrency(receiptData.tipAmount, "USD")}</span>
                </div>
              )}

              {/* You saved message */}
              {fareBreakdown.discountAmount > 0 && (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 mt-3">
                  <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    <span>
                      You saved <strong>{formatCurrency(fareBreakdown.discountAmount, "USD")}</strong> with {fareBreakdown.promoLabel || fareBreakdown.promoCode}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Driver card */}
        <Card data-testid="driver-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                  {driver.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg" data-testid="text-driver-name">{driver.name}</p>
                <p className="text-sm text-muted-foreground">{driver.carModel} · {driver.carColor}</p>
                <p className="text-xs text-muted-foreground font-mono">{driver.plateNumber}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold" data-testid="text-driver-rating">{driver.rating.toFixed(1)}</span>
                </div>
                {receiptData.userRating && receiptData.userRating > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You rated: {receiptData.userRating} star{receiptData.userRating !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment method */}
        {receiptData.paymentMethod && (
          <Card data-testid="payment-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Payment Method</p>
                    <p className="text-sm text-muted-foreground">{receiptData.paymentMethod}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">Paid</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownloadReceipt}
            data-testid="button-download"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleShare}
            data-testid="button-share"
          >
            {'share' in navigator ? (
              <Share2 className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {'share' in navigator ? 'Share' : 'Copy'}
          </Button>
        </div>
        
        {/* Contact Support */}
        <Link href="/customer/support">
          <Button
            variant="outline"
            className="w-full"
            data-testid="button-contact-support-receipt"
          >
            <Headphones className="h-4 w-4 mr-2" />
            Need help? Contact Support
          </Button>
        </Link>
      </div>

      {/* Fixed bottom button */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <Button
          onClick={() => setLocation("/customer/book")}
          size="lg"
          className="w-full text-base font-semibold"
          data-testid="button-done"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
