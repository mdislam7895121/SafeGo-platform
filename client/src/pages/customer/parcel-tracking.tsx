import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, MapPin, Phone, Package, Truck, CheckCircle2, Clock, User, Navigation, AlertCircle, Loader2, Copy, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatCurrency";

interface ParcelDetails {
  id: string;
  status: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  senderName: string;
  senderPhone?: string;
  receiverName: string;
  receiverPhone?: string;
  parcelType: string;
  parcelDescription?: string;
  actualWeightKg: number | null;
  chargeableWeightKg: number | null;
  isFragile: boolean;
  isInternational: boolean;
  destinationCountry?: string;
  domesticZoneType?: string;
  deliverySpeed?: string;
  codEnabled: boolean;
  codAmount: number | null;
  codCollected: boolean;
  totalCharge: number;
  pricingBreakdown: Array<{ label: string; amount: number }>;
  paymentMethod: string;
  driverInfo: {
    name: string;
    phone: string;
    photo?: string;
  } | null;
  proofPhotos: Array<{ id: string; photoUrl: string; capturedAt: string }>;
  statusHistory: Array<{ status: string; timestamp: string; actor: string }>;
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

const STATUS_STEPS = [
  { key: "requested", label: "Requested", icon: Package },
  { key: "searching_driver", label: "Searching Driver", icon: Clock },
  { key: "accepted", label: "Driver Assigned", icon: User },
  { key: "picked_up", label: "Picked Up", icon: Navigation },
  { key: "on_the_way", label: "On The Way", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-500",
  searching_driver: "bg-blue-500",
  accepted: "bg-purple-500",
  picked_up: "bg-indigo-500",
  on_the_way: "bg-cyan-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  cancelled_by_customer: "bg-red-500",
  cancelled_by_driver: "bg-red-500",
  cancelled_no_driver: "bg-red-500",
};

function getStatusIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

function getStatusProgress(status: string): number {
  const idx = getStatusIndex(status);
  if (idx < 0) return 0;
  return ((idx + 1) / STATUS_STEPS.length) * 100;
}

export default function ParcelTracking() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<{ parcel: ParcelDetails }>({
    queryKey: [`/api/parcel/bd/${id}`],
    enabled: !!id,
    refetchInterval: 10000,
  });

  const parcel = data?.parcel;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading parcel details...</p>
        </div>
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Parcel Not Found</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't find details for this parcel.
          </p>
          <Link href="/customer">
            <Button data-testid="button-go-home">Go to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getStatusIndex(parcel.status);
  const isCancelled = parcel.status.startsWith("cancelled");
  const isDelivered = parcel.status === "delivered";

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover-elevate" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Track Parcel</h1>
              <p className="text-sm opacity-90 font-mono">{parcel.id}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-primary-foreground hover-elevate"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Card className={isCancelled ? "border-destructive" : isDelivered ? "border-green-500" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Status</CardTitle>
              <Badge className={`${STATUS_COLORS[parcel.status] || "bg-gray-500"}`}>
                {parcel.status.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!isCancelled && (
              <>
                <Progress value={getStatusProgress(parcel.status)} className="h-2 mb-4" />
                <div className="grid grid-cols-6 gap-1 text-center">
                  {STATUS_STEPS.map((step, idx) => {
                    const isComplete = idx <= currentStatusIndex;
                    const isCurrent = idx === currentStatusIndex;
                    const StepIcon = step.icon;
                    return (
                      <div key={step.key} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                          isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <span className={`text-xs ${isComplete ? "font-medium" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {isCancelled && (
              <div className="text-center py-4">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
                <p className="text-destructive font-medium">This parcel has been cancelled</p>
              </div>
            )}

            {isDelivered && parcel.deliveredAt && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Delivered on {new Date(parcel.deliveredAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {parcel.driverInfo && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Driver Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={parcel.driverInfo.photo} />
                  <AvatarFallback>{parcel.driverInfo.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{parcel.driverInfo.name}</p>
                  <p className="text-sm text-muted-foreground">{parcel.driverInfo.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(parcel.driverInfo!.phone, "Phone number")}
                    data-testid="button-copy-phone"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a href={`tel:${parcel.driverInfo.phone}`}>
                    <Button variant="outline" size="icon" data-testid="button-call-driver">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Route Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="w-0.5 h-12 bg-border" />
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">PICKUP</p>
                  <p className="text-sm font-medium">{parcel.pickupAddress}</p>
                  <p className="text-xs text-muted-foreground">{parcel.senderName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">DROPOFF</p>
                  <p className="text-sm font-medium">{parcel.dropoffAddress}</p>
                  <p className="text-xs text-muted-foreground">{parcel.receiverName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Package Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{parcel.parcelType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-medium">{parcel.chargeableWeightKg || parcel.actualWeightKg} kg</p>
              </div>
              {parcel.deliverySpeed && (
                <div>
                  <p className="text-muted-foreground">Speed</p>
                  <p className="font-medium capitalize">{parcel.deliverySpeed.replace(/_/g, " ")}</p>
                </div>
              )}
              {parcel.isFragile && (
                <div>
                  <p className="text-muted-foreground">Handling</p>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">Fragile</Badge>
                </div>
              )}
            </div>
            {parcel.parcelDescription && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{parcel.parcelDescription}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {parcel.codEnabled && (
          <Card className="border-green-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-green-600">BDT</span>
                Cash on Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(parcel.codAmount || 0, "BDT")}</p>
                  <p className="text-sm text-muted-foreground">
                    {parcel.codCollected ? "Collected" : "To be collected"}
                  </p>
                </div>
                <Badge variant={parcel.codCollected ? "default" : "secondary"}>
                  {parcel.codCollected ? "Paid" : "Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {parcel.pricingBreakdown?.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span>{formatCurrency(item.amount, "BDT")}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(parcel.totalCharge, "BDT")}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payment Method</span>
              <span className="capitalize">{parcel.paymentMethod}</span>
            </div>
          </CardContent>
        </Card>

        {parcel.proofPhotos && parcel.proofPhotos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Proof of Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {parcel.proofPhotos.map((photo) => (
                  <div key={photo.id} className="relative aspect-video rounded-lg overflow-hidden">
                    <img src={photo.photoUrl} alt="Proof of delivery" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
                      {new Date(photo.capturedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {parcel.statusHistory && parcel.statusHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {parcel.statusHistory.slice().reverse().map((event, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-primary" : "bg-muted-foreground"}`} />
                      {idx < parcel.statusHistory.length - 1 && (
                        <div className="w-0.5 h-8 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-sm font-medium capitalize">
                        {event.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                        {event.actor && ` • by ${event.actor}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Link href="/customer/my-support-tickets">
            <Button variant="outline" className="w-full gap-2" data-testid="button-support">
              <MessageCircle className="h-4 w-4" />
              Need Help? Contact Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
