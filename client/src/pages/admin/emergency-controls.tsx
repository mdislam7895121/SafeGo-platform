import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Power, 
  CreditCard, 
  Flag, 
  AlertTriangle,
  Play,
  Pause,
  Shield,
  Clock,
  CheckCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EmergencyStatus {
  platformPaused: boolean;
  paymentsFrozen: boolean;
  featureFlagsOverridden: boolean;
  lastUpdated: string;
  activeLockdowns: any[];
}

export default function EmergencyControls() {
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("1h");
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<EmergencyStatus>({
    queryKey: ["/api/admin/phase3a/emergency/status"],
    refetchInterval: 10000,
  });

  const pausePlatformMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/emergency/pause-platform", {
        method: "POST",
        body: JSON.stringify({ reason, duration }),
      });
    },
    onSuccess: () => {
      toast({ title: "Platform Paused", description: "All services have been paused." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/emergency/status"] });
      setPauseDialogOpen(false);
      setReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to pause platform.", variant: "destructive" });
    },
  });

  const freezePaymentsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/emergency/freeze-payments", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "Payments Frozen", description: "All payment processing has been frozen." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/emergency/status"] });
      setFreezeDialogOpen(false);
      setReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to freeze payments.", variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (target: string) => {
      return apiRequest("/api/admin/phase3a/emergency/resume", {
        method: "POST",
        body: JSON.stringify({ target }),
      });
    },
    onSuccess: (_, target) => {
      toast({ title: "Resumed", description: `${target} has been resumed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/emergency/status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resume.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Emergency Kill-Switch</h1>
          <p className="text-muted-foreground">Platform-wide emergency controls</p>
        </div>
        <Badge variant={status?.platformPaused || status?.paymentsFrozen ? "destructive" : "default"}>
          {status?.platformPaused || status?.paymentsFrozen ? "EMERGENCY ACTIVE" : "NORMAL OPERATIONS"}
        </Badge>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          These controls affect the entire platform. Use only in genuine emergencies. All actions are logged and audited.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={status?.platformPaused ? "border-red-500 border-2" : ""} data-testid="card-platform">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Power className="h-5 w-5" />
                Platform Services
              </CardTitle>
              <Badge variant={status?.platformPaused ? "destructive" : "default"}>
                {status?.platformPaused ? "PAUSED" : "RUNNING"}
              </Badge>
            </div>
            <CardDescription>
              Pause all platform services including rides, deliveries, and orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.platformPaused ? (
              <Button
                variant="default"
                className="w-full"
                onClick={() => resumeMutation.mutate("platform")}
                disabled={resumeMutation.isPending}
                data-testid="button-resume-platform"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume Platform
              </Button>
            ) : (
              <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full" data-testid="button-pause-platform">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause Platform
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Confirm Platform Pause
                    </DialogTitle>
                    <DialogDescription>
                      This will immediately pause all platform services. Users will not be able to request rides, place orders, or send deliveries.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason for emergency pause</label>
                      <Textarea
                        placeholder="Enter reason (required)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        data-testid="input-pause-reason"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Duration</label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger data-testid="select-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15m">15 minutes</SelectItem>
                          <SelectItem value="30m">30 minutes</SelectItem>
                          <SelectItem value="1h">1 hour</SelectItem>
                          <SelectItem value="2h">2 hours</SelectItem>
                          <SelectItem value="indefinite">Indefinite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPauseDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => pausePlatformMutation.mutate()}
                      disabled={pausePlatformMutation.isPending || !reason}
                      data-testid="button-confirm-pause"
                    >
                      {pausePlatformMutation.isPending ? "Pausing..." : "Confirm Pause"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card className={status?.paymentsFrozen ? "border-red-500 border-2" : ""} data-testid="card-payments">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Processing
              </CardTitle>
              <Badge variant={status?.paymentsFrozen ? "destructive" : "default"}>
                {status?.paymentsFrozen ? "FROZEN" : "ACTIVE"}
              </Badge>
            </div>
            <CardDescription>
              Freeze all payment processing including charges and payouts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.paymentsFrozen ? (
              <Button
                variant="default"
                className="w-full"
                onClick={() => resumeMutation.mutate("payments")}
                disabled={resumeMutation.isPending}
                data-testid="button-resume-payments"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume Payments
              </Button>
            ) : (
              <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full" data-testid="button-freeze-payments">
                    <Pause className="h-4 w-4 mr-2" />
                    Freeze Payments
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Confirm Payment Freeze
                    </DialogTitle>
                    <DialogDescription>
                      This will immediately stop all payment processing. No charges will be made and no payouts will be processed.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason for payment freeze</label>
                      <Textarea
                        placeholder="Enter reason (required)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        data-testid="input-freeze-reason"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setFreezeDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => freezePaymentsMutation.mutate()}
                      disabled={freezePaymentsMutation.isPending || !reason}
                      data-testid="button-confirm-freeze"
                    >
                      {freezePaymentsMutation.isPending ? "Freezing..." : "Confirm Freeze"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-feature-flags">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Feature Flags
              </CardTitle>
              <Badge variant={status?.featureFlagsOverridden ? "secondary" : "default"}>
                {status?.featureFlagsOverridden ? "OVERRIDDEN" : "NORMAL"}
              </Badge>
            </div>
            <CardDescription>
              Override all feature flags to their safe defaults
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled data-testid="button-override-flags">
              <Flag className="h-4 w-4 mr-2" />
              Override Feature Flags
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Use Feature Flags page for granular control
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Emergency Status
          </CardTitle>
          <CardDescription>Current system status and active lockdowns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className={`h-5 w-5 ${!status?.platformPaused && !status?.paymentsFrozen ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div>
                  <div className="font-medium">System Status</div>
                  <div className="text-sm text-muted-foreground">
                    Last updated: {status?.lastUpdated ? format(new Date(status.lastUpdated), "MMM dd, HH:mm:ss") : "N/A"}
                  </div>
                </div>
              </div>
              <Badge variant={!status?.platformPaused && !status?.paymentsFrozen ? "default" : "destructive"}>
                {!status?.platformPaused && !status?.paymentsFrozen ? "All Systems Operational" : "Emergency Mode"}
              </Badge>
            </div>
            
            {status?.activeLockdowns && status.activeLockdowns.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Active Lockdowns</h4>
                {status.activeLockdowns.map((lockdown: any, i: number) => (
                  <div key={i} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="font-medium text-destructive">{lockdown.type}</div>
                    <div className="text-sm text-muted-foreground">{lockdown.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
