import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Car,
  CreditCard,
  Download,
  Share2,
  Star,
  Route,
  Banknote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReceiptData {
  receipt: {
    id: string;
    rideId: string;
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeFee: number;
    tipAmount: number;
    discount: number;
    total: number;
    currency: string;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
  };
  ride: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    createdAt: string;
    completedAt: string | null;
    distanceMiles: number | null;
    durationMinutes: number | null;
    driver: {
      name: string;
      rating: number | null;
      vehicle: string | null;
      licensePlate: string | null;
    } | null;
  };
}

export default function RiderTripReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ReceiptData>({
    queryKey: ["/api/rides", id, "receipt"],
    enabled: !!id,
  });

  const handleShare = () => {
    if (!data) return;
    const text = `SafeGo Ride Receipt\nTotal: $${data.receipt.total.toFixed(2)}\nFrom: ${data.ride.pickupAddress}\nTo: ${data.ride.dropoffAddress}`;
    if (navigator.share) {
      navigator.share({
        title: "SafeGo Ride Receipt",
        text,
      });
    } else {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard", description: "Receipt details copied" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Car className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Receipt Not Found</h2>
        <p className="text-muted-foreground text-center mb-4">
          Unable to load receipt details.
        </p>
        <Button onClick={() => setLocation("/rider/home")} data-testid="button-go-home">
          Go Home
        </Button>
      </div>
    );
  }

  const { receipt, ride } = data;
  const tripDate = new Date(ride.createdAt);
  const completedDate = ride.completedAt ? new Date(ride.completedAt) : null;

  return (
    <div className="min-h-screen bg-background pb-6" data-testid="rider-trip-receipt-page">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setLocation("/rider/home")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Trip Receipt</h1>
            <p className="text-sm opacity-90">
              {format(tripDate, "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <Badge variant="secondary" className="bg-primary-foreground/20">
            {receipt.paymentStatus === "completed" ? "Paid" : receipt.paymentStatus}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Route className="h-5 w-5" />
              Trip Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-white">A</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium" data-testid="text-pickup">
                  {ride.pickupAddress}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-white">B</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dropoff</p>
                <p className="text-sm font-medium" data-testid="text-dropoff">
                  {ride.dropoffAddress}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
              {ride.distanceMiles && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {ride.distanceMiles.toFixed(1)} mi
                </span>
              )}
              {ride.durationMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {ride.durationMinutes} min
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {ride.driver && (
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Car className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold" data-testid="text-driver-name">
                  {ride.driver.name}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {ride.driver.vehicle && <span>{ride.driver.vehicle}</span>}
                  {ride.driver.licensePlate && (
                    <Badge variant="outline" className="text-xs">
                      {ride.driver.licensePlate}
                    </Badge>
                  )}
                </div>
              </div>
              {ride.driver.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{ride.driver.rating.toFixed(1)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Fare Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Fare</span>
              <span data-testid="text-base-fare">${receipt.baseFare.toFixed(2)}</span>
            </div>
            {receipt.distanceFare > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Distance</span>
                <span>${receipt.distanceFare.toFixed(2)}</span>
              </div>
            )}
            {receipt.timeFare > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span>${receipt.timeFare.toFixed(2)}</span>
              </div>
            )}
            {receipt.surgeFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Surge Fee</span>
                <span className="text-amber-600">+${receipt.surgeFee.toFixed(2)}</span>
              </div>
            )}
            {receipt.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-green-600">-${receipt.discount.toFixed(2)}</span>
              </div>
            )}
            {receipt.tipAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tip</span>
                <span data-testid="text-tip">${receipt.tipAmount.toFixed(2)}</span>
              </div>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span data-testid="text-total">${receipt.total.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <CreditCard className="h-4 w-4" />
              <span className="capitalize">{receipt.paymentMethod}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleShare} data-testid="button-share-receipt">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" className="flex-1" data-testid="button-download-receipt">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
