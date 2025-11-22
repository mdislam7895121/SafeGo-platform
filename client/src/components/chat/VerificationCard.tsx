import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Check, Star, Car, MapPin, Phone, Mail, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DriverVerificationData {
  name: string;
  country: string;
  city: string;
  phone: string;
  email: string;
  rating: number;
  totalTrips: number;
  kycStatus: string;
  vehicle: string | null;
}

interface CustomerVerificationData {
  name: string;
  city: string;
  phone: string;
  email: string;
  totalTrips: number;
}

interface RestaurantVerificationData {
  restaurantName: string;
  city: string;
  ownerName: string;
  phone: string;
  email: string;
  restaurantId: string;
}

type VerificationData = DriverVerificationData | CustomerVerificationData | RestaurantVerificationData;

interface VerificationCardProps {
  onVerified: () => void;
}

const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 4) return phone;
  return `***-***-${phone.slice(-4)}`;
};

const maskEmail = (email: string): string => {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  return `${local.charAt(0)}***@${domain}`;
};

export function VerificationCard({ onVerified }: VerificationCardProps) {
  const { user } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/support/chat/verification"],
    enabled: !!user,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/chat/verify", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/chat/start"] });
      onVerified();
    },
  });

  if (isLoading) {
    return (
      <Card className="mx-4 mb-4" data-testid="card-verification-loading">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !user) return null;

  const verificationData = data as VerificationData;

  return (
    <Card className="mx-4 mb-4 border-primary/20" data-testid="card-verification">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base" data-testid="text-verification-title">
              Verify Your Details
            </h3>
            <p className="text-sm text-muted-foreground">
              Confirm your information to start chatting
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {user.role === "driver" && "rating" in verificationData && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium" data-testid="text-driver-name">
                  {verificationData.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </span>
                <span className="text-sm font-medium" data-testid="text-driver-location">
                  {verificationData.city}, {verificationData.country}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </span>
                <span className="text-sm font-medium" data-testid="text-driver-phone">
                  {maskPhone(verificationData.phone)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </span>
                <span className="text-sm font-medium" data-testid="text-driver-email">
                  {maskEmail(verificationData.email)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" /> Rating
                </span>
                <span className="text-sm font-medium" data-testid="text-driver-rating">
                  {verificationData.rating.toFixed(1)} ★ ({verificationData.totalTrips} trips)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">KYC Status</span>
                <Badge variant={verificationData.kycStatus === "Verified" ? "default" : "secondary"} data-testid="badge-driver-kyc">
                  {verificationData.kycStatus}
                </Badge>
              </div>
              {verificationData.vehicle && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Car className="h-3 w-3" /> Vehicle
                  </span>
                  <span className="text-sm font-medium" data-testid="text-driver-vehicle">
                    {verificationData.vehicle}
                  </span>
                </div>
              )}
            </>
          )}

          {user.role === "customer" && "totalTrips" in verificationData && !("rating" in verificationData) && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium" data-testid="text-customer-name">
                  {verificationData.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> City
                </span>
                <span className="text-sm font-medium" data-testid="text-customer-city">
                  {verificationData.city}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </span>
                <span className="text-sm font-medium" data-testid="text-customer-phone">
                  {maskPhone(verificationData.phone)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </span>
                <span className="text-sm font-medium" data-testid="text-customer-email">
                  {maskEmail(verificationData.email)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Trips</span>
                <span className="text-sm font-medium" data-testid="text-customer-trips">
                  {verificationData.totalTrips}
                </span>
              </div>
            </>
          )}

          {user.role === "restaurant" && "restaurantName" in verificationData && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Restaurant</span>
                <span className="text-sm font-medium" data-testid="text-restaurant-name">
                  {verificationData.restaurantName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> City
                </span>
                <span className="text-sm font-medium" data-testid="text-restaurant-city">
                  {verificationData.city}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Owner/Manager</span>
                <span className="text-sm font-medium" data-testid="text-restaurant-owner">
                  {verificationData.ownerName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </span>
                <span className="text-sm font-medium" data-testid="text-restaurant-phone">
                  {maskPhone(verificationData.phone)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Restaurant ID</span>
                <span className="text-sm font-mono text-xs" data-testid="text-restaurant-id">
                  {verificationData.restaurantId}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-4">
            We'll share this information with SafeGo Support to verify your account and help you faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setIsConfirming(true);
                confirmMutation.mutate();
              }}
              disabled={confirmMutation.isPending || isConfirming}
              data-testid="button-confirm-chat"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                "Confirm and Start Chat"
              )}
            </Button>
            <Button variant="outline" className="flex-1" data-testid="button-update-info">
              Update My Info
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
