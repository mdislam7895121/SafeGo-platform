import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Activity, User, Clock, MapPin, AlertTriangle, Shield, Eye, Bell, Globe, Monitor, Fingerprint, TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface AdminActivity {
  id: string;
  adminId: string;
  adminName: string;
  adminRole: string;
  action: string;
  target: string;
  ipAddress: string;
  userAgent: string;
  geoLocation: {
    country: string;
    city: string;
    lat: number;
    lng: number;
  };
  timestamp: string;
  riskScore: number;
  anomalyFlags: string[];
}

interface ActivityMonitorResponse {
  activities: AdminActivity[];
  summary: {
    totalActions24h: number;
    uniqueAdmins: number;
    highRiskActions: number;
    anomaliesDetected: number;
  };
}

export default function ActivityMonitor() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedActivity, setSelectedActivity] = useState<AdminActivity | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertNotes, setAlertNotes] = useState("");
  const [alertType, setAlertType] = useState("suspicious");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, refetch } = useQuery<ActivityMonitorResponse>({
    queryKey: ["/api/admin/phase4/activity-monitor"],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const alertMutation = useMutation({
    mutationFn: async (alertData: { activityId: string; alertType: string; notes: string }) => {
      return apiRequest(`/api/admin/phase4/activity-monitor/alert`, {
        method: "POST",
        body: JSON.stringify(alertData),
      });
    },
    onSuccess: () => {
      toast({ title: "Alert sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/activity-monitor"] });
      setShowAlertDialog(false);
      setSelectedActivity(null);
      setAlertNotes("");
    },
    onError: () => {
      toast({ title: "Failed to send alert", variant: "destructive" });
    },
  });

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 0.7) return <Badge variant="destructive">High Risk</Badge>;
    if (riskScore >= 0.4) return <Badge className="bg-yellow-500">Medium Risk</Badge>;
    return <Badge className="bg-green-500">Low Risk</Badge>;
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 0.7) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    if (riskScore >= 0.4) return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30";
    return "";
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">Admin Activity Monitor</h1>
                <p className="text-[11px] text-muted-foreground">Real-time admin activity tracking with anomaly detection</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={autoRefresh ? "default" : "secondary"} className="cursor-pointer" onClick={() => setAutoRefresh(!autoRefresh)}>
                {autoRefresh ? "Live" : "Paused"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Activity className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500">{data?.summary?.totalActions24h || 0}</p>
                <p className="text-xs text-muted-foreground">Actions (24h)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <User className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{data?.summary?.uniqueAdmins || 0}</p>
                <p className="text-xs text-muted-foreground">Active Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{data?.summary?.highRiskActions || 0}</p>
                <p className="text-xs text-muted-foreground">High Risk Actions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500">{data?.summary?.anomaliesDetected || 0}</p>
                <p className="text-xs text-muted-foreground">Anomalies</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Live Activity Feed
                </CardTitle>
                <CardDescription>Real-time admin actions with risk scoring</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !data?.activities?.length ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activity recorded yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {data.activities.map((activity) => (
                    <Card 
                      key={activity.id} 
                      className={`hover-elevate cursor-pointer border-l-4 ${getRiskColor(activity.riskScore)}`}
                      onClick={() => {
                        setSelectedActivity(activity);
                        setShowDetailDialog(true);
                      }}
                      data-testid={`card-activity-${activity.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="p-2 rounded-full bg-muted">
                              <User className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{activity.adminName}</span>
                                <Badge variant="outline">{activity.adminRole.replace(/_/g, " ")}</Badge>
                                {getRiskBadge(activity.riskScore)}
                              </div>
                              <p className="text-sm">{formatAction(activity.action)}</p>
                              <p className="text-sm text-muted-foreground">Target: {activity.target}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {activity.geoLocation.city}, {activity.geoLocation.country}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {activity.ipAddress}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                              {activity.anomalyFlags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {activity.anomalyFlags.map((flag) => (
                                    <Badge key={flag} variant="destructive" className="text-xs">
                                      {flag.replace(/_/g, " ")}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {activity.riskScore >= 0.4 && (
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedActivity(activity);
                                setShowAlertDialog(true);
                              }} data-testid={`button-alert-${activity.id}`}>
                                <Bell className="h-4 w-4 mr-1" />
                                Alert
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Activity Details
              {selectedActivity && getRiskBadge(selectedActivity.riskScore)}
            </DialogTitle>
          </DialogHeader>
          {selectedActivity && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Admin Information
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Name:</span> {selectedActivity.adminName}</p>
                        <p><span className="text-muted-foreground">Role:</span> {selectedActivity.adminRole.replace(/_/g, " ")}</p>
                        <p><span className="text-muted-foreground">ID:</span> {selectedActivity.adminId}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Location & Device
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">IP:</span> {selectedActivity.ipAddress}</p>
                        <p><span className="text-muted-foreground">Location:</span> {selectedActivity.geoLocation.city}, {selectedActivity.geoLocation.country}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedActivity.userAgent}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Action Details</h4>
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-medium">{formatAction(selectedActivity.action)}</p>
                      <p className="text-sm text-muted-foreground mt-1">Target: {selectedActivity.target}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Risk Assessment</h4>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span>Risk Score</span>
                        <span className="font-bold">{(selectedActivity.riskScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${selectedActivity.riskScore >= 0.7 ? 'bg-red-500' : selectedActivity.riskScore >= 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${selectedActivity.riskScore * 100}%` }}
                        />
                      </div>
                      {selectedActivity.anomalyFlags.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">Anomaly Flags:</p>
                          <div className="flex gap-1 flex-wrap">
                            {selectedActivity.anomalyFlags.map((flag) => (
                              <Badge key={flag} variant="destructive" className="text-xs">
                                {flag.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            {selectedActivity && selectedActivity.riskScore >= 0.4 && (
              <Button variant="destructive" onClick={() => {
                setShowDetailDialog(false);
                setShowAlertDialog(true);
              }}>
                <Bell className="h-4 w-4 mr-2" />
                Create Alert
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Security Alert</DialogTitle>
            <DialogDescription>
              Send an alert about suspicious activity by {selectedActivity?.adminName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alert Type</Label>
              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger data-testid="select-alert-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suspicious">Suspicious Activity</SelectItem>
                  <SelectItem value="unauthorized">Unauthorized Access</SelectItem>
                  <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  <SelectItem value="security_breach">Security Breach</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Describe the concern or observation..."
                value={alertNotes}
                onChange={(e) => setAlertNotes(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-alert-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedActivity) {
                  alertMutation.mutate({
                    activityId: selectedActivity.id,
                    alertType,
                    notes: alertNotes,
                  });
                }
              }}
              disabled={alertMutation.isPending || !alertNotes}
              data-testid="button-submit-alert"
            >
              {alertMutation.isPending ? "Sending..." : "Send Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
