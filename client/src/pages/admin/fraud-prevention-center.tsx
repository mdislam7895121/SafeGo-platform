import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  AlertTriangle,
  Smartphone,
  MapPin,
  Globe,
  CreditCard,
  Store,
  BarChart3,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Ban,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  summary: {
    totalFraudEvents: number;
    todayFraudEvents: number;
    pendingReview: number;
    restrictedUsers: number;
    highRiskUsers: number;
  };
  byCategory: {
    deviceMismatch: number;
    fakeGps: number;
    codFraud: number;
    ipAnomaly: number;
    partnerFraud: number;
  };
}

interface FraudEvent {
  id: string;
  userId: string;
  userRole: string;
  eventType: string;
  severity: string;
  status: string;
  description: string;
  createdAt: string;
  deviceId?: string;
  ipAddress?: string;
  scoreImpact: number;
}

interface FraudScore {
  id: string;
  userId: string;
  userRole: string;
  currentScore: number;
  isRestricted: boolean;
  requiresManualClearance: boolean;
  deviceMismatchScore: number;
  fakeGpsScore: number;
  ipAnomalyScore: number;
  codFraudScore: number;
}

interface FraudSetting {
  id: string;
  settingKey: string;
  settingValue: string;
  description: string;
  category: string;
  isActive: boolean;
}

interface DeviceFingerprint {
  id: string;
  userId: string;
  userRole: string;
  deviceId: string;
  os: string;
  model?: string;
  appVersion?: string;
  isWhitelisted: boolean;
  isBlocked: boolean;
  lastSeenAt: string;
  loginCount: number;
}

export default function FraudPreventionCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedEvent, setSelectedEvent] = useState<FraudEvent | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [eventStatus, setEventStatus] = useState("");
  const [whitelistUserId, setWhitelistUserId] = useState("");
  const [whitelistDeviceId, setWhitelistDeviceId] = useState("");
  const [whitelistReason, setWhitelistReason] = useState("");

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardStats>({
    queryKey: ["/api/fraud-prevention/dashboard"],
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ events: FraudEvent[] }>({
    queryKey: ["/api/fraud-prevention/events"],
  });

  const { data: scoresData, isLoading: scoresLoading } = useQuery<{ scores: FraudScore[] }>({
    queryKey: ["/api/fraud-prevention/scores"],
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery<{ settings: FraudSetting[] }>({
    queryKey: ["/api/fraud-prevention/settings"],
  });

  const { data: devicesData, isLoading: devicesLoading } = useQuery<{ devices: DeviceFingerprint[] }>({
    queryKey: ["/api/fraud-prevention/admin/devices"],
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/fraud-prevention/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Event updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud-prevention/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud-prevention/dashboard"] });
      setSelectedEvent(null);
      setReviewNote("");
      setResolution("");
      setEventStatus("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update event", description: error.message, variant: "destructive" });
    },
  });

  const clearScoreMutation = useMutation({
    mutationFn: async ({ userId, clearanceNote }: { userId: string; clearanceNote: string }) => {
      return apiRequest(`/api/fraud-prevention/score/clear/${userId}`, {
        method: "POST",
        body: JSON.stringify({ clearanceNote }),
      });
    },
    onSuccess: () => {
      toast({ title: "User score cleared successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud-prevention/scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud-prevention/dashboard"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to clear score", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest(`/api/fraud-prevention/settings/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ settingValue: value }),
      });
    },
    onSuccess: () => {
      toast({ title: "Setting updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud-prevention/settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update setting", description: error.message, variant: "destructive" });
    },
  });

  const whitelistDeviceMutation = useMutation({
    mutationFn: async (data: { userId: string; deviceId: string; reason: string }) => {
      return apiRequest("/api/fraud-prevention/admin/device/whitelist", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Device whitelisted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud-prevention/admin/devices"] });
      setWhitelistUserId("");
      setWhitelistDeviceId("");
      setWhitelistReason("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to whitelist device", description: error.message, variant: "destructive" });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "detected": return "bg-yellow-500";
      case "investigating": return "bg-blue-500";
      case "confirmed": return "bg-red-500";
      case "false_positive": return "bg-green-500";
      case "resolved": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600 dark:text-red-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    if (score >= 20) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const handleEventReview = () => {
    if (!selectedEvent || !eventStatus) return;
    updateEventMutation.mutate({
      id: selectedEvent.id,
      data: { status: eventStatus, reviewNote, resolution },
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="fraud-prevention-center">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8" />
            Fraud Prevention Center
          </h1>
          <p className="text-muted-foreground">Monitor and manage fraud detection across the platform</p>
        </div>
        <Button onClick={() => refetchDashboard()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="scores" data-testid="tab-scores">
            <Shield className="h-4 w-4 mr-2" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-devices">
            <Smartphone className="h-4 w-4 mr-2" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="whitelist" data-testid="tab-whitelist">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Whitelist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-events">{dashboard.summary.totalFraudEvents}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600" data-testid="text-today-events">{dashboard.summary.todayFraudEvents}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-review">{dashboard.summary.pendingReview}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Restricted Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600" data-testid="text-restricted-users">{dashboard.summary.restrictedUsers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">High Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600" data-testid="text-high-risk">{dashboard.summary.highRiskUsers}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Fraud Events by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <Smartphone className="h-6 w-6 text-blue-500" />
                      <div>
                        <div className="font-medium">Device</div>
                        <div className="text-2xl font-bold">{dashboard.byCategory.deviceMismatch}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <MapPin className="h-6 w-6 text-green-500" />
                      <div>
                        <div className="font-medium">Fake GPS</div>
                        <div className="text-2xl font-bold">{dashboard.byCategory.fakeGps}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <CreditCard className="h-6 w-6 text-yellow-500" />
                      <div>
                        <div className="font-medium">COD Fraud</div>
                        <div className="text-2xl font-bold">{dashboard.byCategory.codFraud}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <Globe className="h-6 w-6 text-purple-500" />
                      <div>
                        <div className="font-medium">IP Anomaly</div>
                        <div className="text-2xl font-bold">{dashboard.byCategory.ipAnomaly}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <Store className="h-6 w-6 text-red-500" />
                      <div>
                        <div className="font-medium">Partner</div>
                        <div className="text-2xl font-bold">{dashboard.byCategory.partnerFraud}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Fraud Events</CardTitle>
              <CardDescription>Review and manage detected fraud events</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Impact</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventsData?.events?.map((event) => (
                      <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                        <TableCell className="font-medium">{event.eventType.replace(/_/g, " ")}</TableCell>
                        <TableCell>{event.userId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(event.severity)}>{event.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(event.status)}>{event.status}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">+{event.scoreImpact}</TableCell>
                        <TableCell>{new Date(event.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedEvent(event)}
                                data-testid={`button-review-${event.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Review Fraud Event</DialogTitle>
                                <DialogDescription>{event.description}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Status</Label>
                                  <Select value={eventStatus} onValueChange={setEventStatus}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="investigating">Investigating</SelectItem>
                                      <SelectItem value="confirmed">Confirmed</SelectItem>
                                      <SelectItem value="false_positive">False Positive</SelectItem>
                                      <SelectItem value="resolved">Resolved</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Review Note</Label>
                                  <Textarea
                                    value={reviewNote}
                                    onChange={(e) => setReviewNote(e.target.value)}
                                    placeholder="Add your review notes..."
                                  />
                                </div>
                                <div>
                                  <Label>Resolution</Label>
                                  <Textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    placeholder="Describe the resolution..."
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={handleEventReview}
                                  disabled={updateEventMutation.isPending}
                                  data-testid="button-submit-review"
                                >
                                  {updateEventMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  Submit Review
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores">
          <Card>
            <CardHeader>
              <CardTitle>Fraud Scores</CardTitle>
              <CardDescription>User fraud risk scores and restrictions</CardDescription>
            </CardHeader>
            <CardContent>
              {scoresLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>GPS</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>COD</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoresData?.scores?.map((score) => (
                      <TableRow key={score.id} data-testid={`row-score-${score.id}`}>
                        <TableCell className="font-mono text-sm">{score.userId.slice(0, 8)}...</TableCell>
                        <TableCell>{score.userRole}</TableCell>
                        <TableCell className={`font-bold ${getScoreColor(score.currentScore)}`}>
                          {score.currentScore}/100
                        </TableCell>
                        <TableCell>{score.deviceMismatchScore}</TableCell>
                        <TableCell>{score.fakeGpsScore}</TableCell>
                        <TableCell>{score.ipAnomalyScore}</TableCell>
                        <TableCell>{score.codFraudScore}</TableCell>
                        <TableCell>
                          {score.isRestricted ? (
                            <Badge variant="destructive">Restricted</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {score.isRestricted && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => clearScoreMutation.mutate({ userId: score.userId, clearanceNote: "Manual admin clearance" })}
                              disabled={clearScoreMutation.isPending}
                              data-testid={`button-clear-${score.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Clear
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Device Fingerprints</CardTitle>
              <CardDescription>Registered devices and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>App Version</TableHead>
                      <TableHead>Logins</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicesData?.devices?.map((device) => (
                      <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                        <TableCell className="font-mono text-sm">{device.deviceId.slice(0, 12)}...</TableCell>
                        <TableCell>{device.userId.slice(0, 8)}...</TableCell>
                        <TableCell>{device.os}</TableCell>
                        <TableCell>{device.model || "-"}</TableCell>
                        <TableCell>{device.appVersion || "-"}</TableCell>
                        <TableCell>{device.loginCount}</TableCell>
                        <TableCell>{new Date(device.lastSeenAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {device.isBlocked ? (
                            <Badge variant="destructive">Blocked</Badge>
                          ) : device.isWhitelisted ? (
                            <Badge className="bg-green-500">Whitelisted</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Fraud Detection Settings</CardTitle>
              <CardDescription>Configure thresholds and detection parameters</CardDescription>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {settingsData?.settings?.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`setting-${setting.settingKey}`}>
                      <div>
                        <div className="font-medium">{setting.settingKey.replace(/_/g, " ").toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">{setting.description}</div>
                        <Badge variant="outline" className="mt-1">{setting.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={setting.settingValue}
                          className="w-24"
                          onChange={(e) => {
                            const newSettings = settingsData?.settings?.map((s) =>
                              s.id === setting.id ? { ...s, settingValue: e.target.value } : s
                            );
                            queryClient.setQueryData(["/api/fraud-prevention/settings"], { settings: newSettings });
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => updateSettingMutation.mutate({ key: setting.settingKey, value: setting.settingValue })}
                          disabled={updateSettingMutation.isPending}
                          data-testid={`button-save-${setting.settingKey}`}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whitelist">
          <Card>
            <CardHeader>
              <CardTitle>Device Whitelist</CardTitle>
              <CardDescription>Whitelist devices for special accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg space-y-4">
                <h3 className="font-medium">Add Device to Whitelist</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>User ID</Label>
                    <Input
                      value={whitelistUserId}
                      onChange={(e) => setWhitelistUserId(e.target.value)}
                      placeholder="Enter user ID"
                      data-testid="input-whitelist-user"
                    />
                  </div>
                  <div>
                    <Label>Device ID</Label>
                    <Input
                      value={whitelistDeviceId}
                      onChange={(e) => setWhitelistDeviceId(e.target.value)}
                      placeholder="Enter device ID"
                      data-testid="input-whitelist-device"
                    />
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input
                      value={whitelistReason}
                      onChange={(e) => setWhitelistReason(e.target.value)}
                      placeholder="Reason for whitelisting"
                      data-testid="input-whitelist-reason"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => whitelistDeviceMutation.mutate({
                    userId: whitelistUserId,
                    deviceId: whitelistDeviceId,
                    reason: whitelistReason,
                  })}
                  disabled={whitelistDeviceMutation.isPending || !whitelistUserId || !whitelistDeviceId}
                  data-testid="button-whitelist-submit"
                >
                  {whitelistDeviceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Add to Whitelist
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
