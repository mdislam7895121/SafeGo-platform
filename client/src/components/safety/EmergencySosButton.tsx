import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, AlertTriangle, Shield, MapPin, Users, Mic, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmergencySosButtonProps {
  rideId?: string;
  variant?: "floating" | "inline" | "compact";
  className?: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

export function EmergencySosButton({ rideId, variant = "floating", className = "" }: EmergencySosButtonProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: contacts } = useQuery<{ success: boolean; contacts: EmergencyContact[] }>({
    queryKey: ["/api/policy-safety/emergency-contacts/my"],
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("[SOS] Location access denied:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      triggerSosMutation.mutate();
    }
  }, [countdown]);

  const triggerSosMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/policy-safety/sos/trigger", {
        method: "POST",
        body: JSON.stringify({
          rideId,
          latitude: location?.lat,
          longitude: location?.lng,
          address,
        }),
      });
    },
    onSuccess: () => {
      setSosTriggered(true);
      setCountdown(null);
      toast({
        title: "Emergency SOS Triggered",
        description: "Help is on the way. Stay calm and stay safe.",
        variant: "default",
      });
    },
    onError: () => {
      setCountdown(null);
      toast({
        title: "Error",
        description: "Failed to trigger SOS. Please call emergency services directly.",
        variant: "destructive",
      });
    },
  });

  const handleSosClick = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmSos = () => {
    setCountdown(5);
    setConfirmDialogOpen(false);
  };

  const handleCancelSos = () => {
    setCountdown(null);
    setConfirmDialogOpen(false);
  };

  if (sosTriggered) {
    return (
      <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">Emergency SOS Active</p>
              <p className="text-sm text-muted-foreground">Help has been notified. Stay on the line.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = "tel:911"}
              data-testid="button-call-911"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call 911 Directly
            </Button>
            {contacts?.contacts && contacts.contacts.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const primary = contacts.contacts.find((c) => c.isPrimary) || contacts.contacts[0];
                  window.location.href = `tel:${primary.phone}`;
                }}
                data-testid="button-call-emergency-contact"
              >
                <Users className="h-4 w-4 mr-2" />
                Call Emergency Contact
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (countdown !== null) {
    return (
      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="p-6 text-center">
          <div className="h-20 w-20 rounded-full bg-yellow-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl font-bold text-white">{countdown}</span>
          </div>
          <p className="font-semibold text-lg mb-2">Sending SOS in {countdown} seconds...</p>
          <p className="text-sm text-muted-foreground mb-4">Tap cancel to abort</p>
          <Button variant="outline" onClick={handleCancelSos} className="w-full" data-testid="button-cancel-sos">
            Cancel SOS
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (variant === "floating") {
    return (
      <>
        <Button
          size="lg"
          className={`fixed bottom-20 right-4 z-50 rounded-full h-16 w-16 bg-red-600 hover:bg-red-700 shadow-lg ${className}`}
          onClick={handleSosClick}
          data-testid="button-sos-floating"
        >
          <Shield className="h-8 w-8" />
        </Button>

        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Emergency SOS
              </DialogTitle>
              <DialogDescription>
                This will alert SafeGo Safety Team and share your location.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Are you in danger?</AlertTitle>
                <AlertDescription>
                  If this is a life-threatening emergency, call 911 directly.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Location (optional)</label>
                <Input
                  placeholder="Describe your location..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="input-location"
                />
                {location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    GPS location detected
                  </p>
                )}
              </div>

              {contacts?.contacts && contacts.contacts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Emergency Contacts</label>
                  <div className="space-y-1">
                    {contacts.contacts.slice(0, 3).map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                        <span>{contact.name}</span>
                        <Badge variant="secondary">{contact.relationship}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleCancelSos} className="w-full sm:w-auto" data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={() => window.location.href = "tel:911"}
                variant="destructive"
                className="w-full sm:w-auto"
                data-testid="button-call-911-dialog"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call 911
              </Button>
              <Button
                onClick={handleConfirmSos}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                data-testid="button-send-sos"
              >
                <Shield className="h-4 w-4 mr-2" />
                Send SOS
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (variant === "compact") {
    return (
      <Button
        size="sm"
        variant="destructive"
        className={className}
        onClick={handleSosClick}
        data-testid="button-sos-compact"
      >
        <Shield className="h-4 w-4 mr-1" />
        SOS
      </Button>
    );
  }

  return (
    <Card className={`border-red-200 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-red-600">
          <Shield className="h-5 w-5" />
          Emergency SOS
        </CardTitle>
        <CardDescription>Tap if you need immediate help</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full bg-red-600 hover:bg-red-700"
          onClick={handleSosClick}
          data-testid="button-sos-inline"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Trigger Emergency SOS
        </Button>
      </CardContent>
    </Card>
  );
}

export function SafetyCenterWidget() {
  const { data: safetyCenterData, isLoading } = useQuery<{
    success: boolean;
    safetyPolicy: any;
    emergencyContacts: EmergencyContact[];
    recentAlerts: any[];
  }>({
    queryKey: ["/api/policy-safety/safety-center"],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Safety Center
        </CardTitle>
        <CardDescription>Your safety tools and emergency contacts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmergencySosButton variant="inline" />

        <div className="grid gap-3">
          <Button variant="outline" className="justify-start" data-testid="button-trip-sharing">
            <Users className="h-4 w-4 mr-2" />
            Share Trip Status
          </Button>
          <Button variant="outline" className="justify-start" data-testid="button-audio-recording">
            <Mic className="h-4 w-4 mr-2" />
            Record Audio
          </Button>
          <Button variant="outline" className="justify-start" data-testid="button-call-911">
            <Phone className="h-4 w-4 mr-2" />
            Call 911
          </Button>
        </div>

        {safetyCenterData?.emergencyContacts && safetyCenterData.emergencyContacts.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Emergency Contacts</p>
            <div className="space-y-2">
              {safetyCenterData.emergencyContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.name}</span>
                    {contact.isPrimary && (
                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => window.location.href = `tel:${contact.phone}`}>
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EmergencySosButton;
