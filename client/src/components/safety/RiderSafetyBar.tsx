import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  AlertOctagon, 
  Phone, 
  Share2, 
  MapPin,
  X,
  CheckCircle,
  Loader2,
  Users,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RiderSafetyBarProps {
  tripId: string;
  tripType: "ride" | "food" | "parcel";
  driverName?: string;
  driverPhone?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

interface TrustedContact {
  id: string;
  name: string;
  phone: string;
}

const EMERGENCY_NUMBER = "911";

export function RiderSafetyBar({
  tripId,
  tripType,
  driverName,
  driverPhone,
  isExpanded = false,
  onToggle
}: RiderSafetyBarProps) {
  const { toast } = useToast();
  const [showSOSDialog, setShowSOSDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sosDescription, setSOSDescription] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Failed to get location:", error);
        }
      );
    }
  }, []);

  const triggerSOSMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/phase5/safety/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripType,
          tripId,
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng,
          description: sosDescription
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "SOS Alert Sent",
        description: "Emergency services and SafeGo support have been notified",
      });
      setShowSOSDialog(false);
      setSOSDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send SOS",
        description: error.message || "Please call emergency services directly",
        variant: "destructive"
      });
    }
  });

  const shareTripMutation = useMutation({
    mutationFn: async (contacts: string[]) => {
      return apiRequest(`/api/phase5/safety/share-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripType,
          tripId,
          recipientIds: contacts,
          latitude: currentLocation?.lat,
          longitude: currentLocation?.lng
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Trip Shared",
        description: "Your trusted contacts can now track your trip",
      });
      setShowShareDialog(false);
      setIsSharing(true);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to share trip",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleEmergencyCall = () => {
    window.location.href = `tel:${EMERGENCY_NUMBER}`;
  };

  const handleCallDriver = () => {
    if (driverPhone) {
      window.location.href = `tel:${driverPhone}`;
    }
  };

  const handleShareLocation = async () => {
    if (navigator.share && currentLocation) {
      try {
        await navigator.share({
          title: "My SafeGo Trip",
          text: `I'm on a ${tripType} trip with SafeGo. Track my location here.`,
          url: `https://safego.app/track/${tripId}`
        });
      } catch (error) {
        setShowShareDialog(true);
      }
    } else {
      setShowShareDialog(true);
    }
  };

  const handleCopyLink = async () => {
    const link = `https://safego.app/track/${tripId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Link Copied",
        description: "Share this link with your trusted contacts"
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden" data-testid="rider-safety-bar">
        <CardContent className="p-0">
          <div 
            className="flex items-center justify-between p-3 bg-primary/5 cursor-pointer hover-elevate"
            onClick={onToggle}
            data-testid="safety-bar-header"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-medium">Safety Center</span>
              {isSharing && (
                <Badge variant="secondary" className="text-xs">
                  Sharing Live
                </Badge>
              )}
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowSOSDialog(true);
              }}
              data-testid="button-sos"
            >
              <AlertOctagon className="h-4 w-4 mr-1" />
              SOS
            </Button>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="p-4 space-y-3 border-t">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      onClick={handleEmergencyCall}
                      data-testid="button-emergency-call"
                    >
                      <Phone className="h-5 w-5 text-red-500" />
                      <span className="text-xs">Emergency</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      onClick={handleShareLocation}
                      data-testid="button-share-trip"
                    >
                      <Share2 className="h-5 w-5 text-blue-500" />
                      <span className="text-xs">Share Trip</span>
                    </Button>

                    {driverPhone && (
                      <Button
                        variant="outline"
                        className="flex flex-col items-center gap-1 h-auto py-3"
                        onClick={handleCallDriver}
                        data-testid="button-call-driver"
                      >
                        <MessageCircle className="h-5 w-5 text-green-500" />
                        <span className="text-xs">Contact Driver</span>
                      </Button>
                    )}
                  </div>

                  {currentLocation && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
                      <MapPin className="h-4 w-4" />
                      <span>Location tracking active</span>
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    </div>
                  )}

                  {isSharing && (
                    <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg p-2">
                      <Users className="h-4 w-4" />
                      <span>Trusted contacts are watching your trip</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <Dialog open={showSOSDialog} onOpenChange={setShowSOSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" />
              Emergency SOS
            </DialogTitle>
            <DialogDescription>
              This will alert SafeGo support and share your location. For immediate danger, call emergency services directly.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleEmergencyCall}
              data-testid="button-call-911"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Emergency Services ({EMERGENCY_NUMBER})
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                What's happening? (optional)
              </label>
              <Textarea
                placeholder="Describe the situation..."
                value={sosDescription}
                onChange={(e) => setSOSDescription(e.target.value)}
                data-testid="input-sos-description"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowSOSDialog(false)}
              data-testid="button-cancel-sos"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => triggerSOSMutation.mutate()}
              disabled={triggerSOSMutation.isPending}
              data-testid="button-confirm-sos"
            >
              {triggerSOSMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Alert...
                </>
              ) : (
                <>
                  <AlertOctagon className="h-4 w-4 mr-2" />
                  Send SOS Alert
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Your Trip
            </DialogTitle>
            <DialogDescription>
              Let trusted contacts track your trip in real-time
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopyLink}
              data-testid="button-copy-link"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Copy Tracking Link
            </Button>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Your contacts will be able to see:
              </p>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Your real-time location
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Driver information
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Trip destination and ETA
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShareDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CompactSafetyButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="flex items-center gap-1"
      data-testid="button-safety-compact"
    >
      <Shield className="h-4 w-4" />
      Safety
    </Button>
  );
}
