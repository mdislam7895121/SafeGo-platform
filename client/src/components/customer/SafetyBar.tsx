import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  Shield,
  Phone,
  MapPin,
  Users,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Share2,
  MessageCircle,
  X,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

interface SafetyBarProps {
  tripId: string;
  tripType: "ride" | "food" | "parcel";
  driverName?: string;
  driverPhone?: string;
  vehicleInfo?: string;
  currentLocation?: { lat: number; lng: number };
  onShareTrip?: () => void;
  className?: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export function SafetyBar({
  tripId,
  tripType,
  driverName,
  driverPhone,
  vehicleInfo,
  currentLocation,
  onShareTrip,
  className,
}: SafetyBarProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSosDialog, setShowSosDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const triggerSosMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/phase5/safety/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          tripType,
          location: currentLocation,
          timestamp: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      setSosTriggered(true);
      toast({
        title: "Emergency Alert Sent",
        description: "Our safety team has been notified and will contact you shortly.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Send Alert",
        description: "Please try again or call 911 directly.",
      });
    },
  });

  const reportIssueMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("/api/phase5/safety/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          tripType,
          issueType: "safety_concern",
          message,
          location: currentLocation,
        }),
      });
    },
    onSuccess: () => {
      setShowReportDialog(false);
      setReportMessage("");
      toast({
        title: "Report Submitted",
        description: "We'll review your concern and follow up within 24 hours.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Submit Report",
        description: "Please try again.",
      });
    },
  });

  const shareLocationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/phase5/safety/share-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          tripType,
          location: currentLocation,
        }),
      });
    },
    onSuccess: (data: { shareUrl?: string }) => {
      if (data.shareUrl && navigator.share) {
        navigator.share({
          title: "My SafeGo Trip",
          text: `I'm on a ${tripType} trip with SafeGo`,
          url: data.shareUrl,
        });
      } else {
        onShareTrip?.();
        toast({
          title: "Trip Shared",
          description: "Your emergency contacts have been notified.",
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Share",
        description: "Please try again.",
      });
    },
  });

  const handleSosPress = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    setShowSosDialog(true);
  }, []);

  const handleConfirmSos = useCallback(() => {
    triggerSosMutation.mutate();
    setShowSosDialog(false);
  }, [triggerSosMutation]);

  const handleReportSubmit = useCallback(() => {
    if (reportMessage.trim()) {
      reportIssueMutation.mutate(reportMessage);
    }
  }, [reportMessage, reportIssueMutation]);

  return (
    <>
      <motion.div
        layout
        className={cn(
          "bg-background border rounded-xl shadow-lg overflow-hidden",
          className
        )}
        data-testid="safety-bar"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover-elevate"
          data-testid="button-expand-safety"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/20">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="font-medium text-sm">Safety Tools</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t"
            >
              <div className="p-3 space-y-3">
                <Button
                  variant="destructive"
                  className="w-full h-14 text-lg gap-2"
                  onClick={handleSosPress}
                  disabled={sosTriggered}
                  data-testid="button-sos"
                >
                  {sosTriggered ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Alert Sent - Help Coming
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5" />
                      Emergency SOS
                    </>
                  )}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => shareLocationMutation.mutate()}
                    disabled={shareLocationMutation.isPending}
                    data-testid="button-share-trip"
                  >
                    {shareLocationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                    Share Trip
                  </Button>

                  <a href="tel:911">
                    <Button variant="outline" className="w-full gap-2" data-testid="button-call-911">
                      <Phone className="h-4 w-4" />
                      Call 911
                    </Button>
                  </a>
                </div>

                {driverPhone && (
                  <a href={`tel:${driverPhone}`} className="block">
                    <Button variant="outline" className="w-full gap-2" data-testid="button-call-driver">
                      <Phone className="h-4 w-4" />
                      Call {driverName || "Driver"}
                    </Button>
                  </a>
                )}

                <Button
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => setShowReportDialog(true)}
                  data-testid="button-report-issue"
                >
                  <MessageCircle className="h-4 w-4" />
                  Report a Safety Concern
                </Button>

                {vehicleInfo && (
                  <div className="p-2 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Vehicle Info</p>
                    <p className="text-sm font-medium" data-testid="text-vehicle-info">
                      {vehicleInfo}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <Dialog open={showSosDialog} onOpenChange={setShowSosDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Emergency Alert
            </DialogTitle>
            <DialogDescription>
              This will immediately alert our 24/7 safety team and share your location. Use this only for real emergencies.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30">
            <p className="text-sm text-red-800 dark:text-red-200">
              For life-threatening emergencies, please call 911 directly. Our safety team will assist with non-life-threatening situations.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowSosDialog(false)}
              className="w-full sm:w-auto"
              data-testid="button-cancel-sos"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmSos}
              disabled={triggerSosMutation.isPending}
              className="w-full sm:w-auto gap-2"
              data-testid="button-confirm-sos"
            >
              {triggerSosMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Send Emergency Alert
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a Safety Concern</DialogTitle>
            <DialogDescription>
              Describe your concern and we'll review it promptly. For emergencies, use the SOS button instead.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe what happened..."
            value={reportMessage}
            onChange={(e) => setReportMessage(e.target.value)}
            className="min-h-[120px] resize-none"
            data-testid="textarea-report"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowReportDialog(false)}
              className="w-full sm:w-auto"
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReportSubmit}
              disabled={!reportMessage.trim() || reportIssueMutation.isPending}
              className="w-full sm:w-auto gap-2"
              data-testid="button-submit-report"
            >
              {reportIssueMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SafetyFloatingButton({
  onClick,
  hasActiveAlert = false,
}: {
  onClick: () => void;
  hasActiveAlert?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 z-50 p-3 rounded-full shadow-lg",
        hasActiveAlert
          ? "bg-green-500 text-white"
          : "bg-background border"
      )}
      data-testid="button-safety-floating"
    >
      <Shield className={cn(
        "h-6 w-6",
        hasActiveAlert ? "text-white" : "text-green-600 dark:text-green-400"
      )} />
      {hasActiveAlert && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
      )}
    </motion.button>
  );
}

export default SafetyBar;
