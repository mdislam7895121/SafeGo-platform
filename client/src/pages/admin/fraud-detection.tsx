import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShieldAlert, 
  LogIn, 
  Fingerprint, 
  Users, 
  AlertTriangle,
  Shield,
  Ban,
  Eye,
  MapPin,
  Smartphone
} from "lucide-react";
import { format } from "date-fns";

interface SecurityEvent {
  id: string;
  type: string;
  userId?: string;
  sourceIp: string;
  severity: string;
  blocked: boolean;
  metadata?: any;
  createdAt: string;
}

interface SuspiciousLoginResponse {
  events: SecurityEvent[];
  summary: {
    total: number;
    critical: number;
    blocked: number;
  };
}

const severityColors: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function FraudDetection() {
  const [activeTab, setActiveTab] = useState("logins");

  const { data: suspiciousLogins, isLoading: loginsLoading } = useQuery<SuspiciousLoginResponse>({
    queryKey: ["/api/admin/phase3a/fraud/suspicious-logins"],
  });

  const { data: deviceFingerprints, isLoading: fingerprintsLoading } = useQuery<{ fingerprints: any[] }>({
    queryKey: ["/api/admin/phase3a/fraud/device-fingerprints"],
  });

  const { data: multiAccountFlags, isLoading: multiAccountLoading } = useQuery<{ flags: any[] }>({
    queryKey: ["/api/admin/phase3a/fraud/multi-account"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Fraud Detection Module</h1>
          <p className="text-muted-foreground">Monitor suspicious activities and protect the platform</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{suspiciousLogins?.summary.total || 0}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-critical">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{suspiciousLogins?.summary.critical || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-blocked">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-green-600">{suspiciousLogins?.summary.blocked || 0}</p>
              </div>
              <Ban className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-devices">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Device Mismatches</p>
                <p className="text-2xl font-bold">{deviceFingerprints?.fingerprints.length || 0}</p>
              </div>
              <Fingerprint className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logins" data-testid="tab-logins">
            <LogIn className="h-4 w-4 mr-2" />
            Suspicious Logins
          </TabsTrigger>
          <TabsTrigger value="fingerprints" data-testid="tab-fingerprints">
            <Fingerprint className="h-4 w-4 mr-2" />
            Device Fingerprints
          </TabsTrigger>
          <TabsTrigger value="multi-account" data-testid="tab-multi-account">
            <Users className="h-4 w-4 mr-2" />
            Multi-Account Flags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logins">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious Login Attempts</CardTitle>
              <CardDescription>Monitor unusual login patterns and geographic anomalies</CardDescription>
            </CardHeader>
            <CardContent>
              {loginsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suspiciousLogins?.events.map((event) => (
                        <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(event.createdAt), "MMM dd, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{event.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{event.sourceIp}</TableCell>
                          <TableCell className="font-mono text-sm">{event.userId || "-"}</TableCell>
                          <TableCell>
                            <Badge className={severityColors[event.severity] || severityColors.MEDIUM}>
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={event.blocked ? "default" : "secondary"}>
                              {event.blocked ? "Blocked" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" data-testid={`button-view-${event.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!event.blocked && (
                                <Button size="sm" variant="destructive" data-testid={`button-block-${event.id}`}>
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fingerprints">
          <Card>
            <CardHeader>
              <CardTitle>Device Fingerprint Mismatches</CardTitle>
              <CardDescription>Detected when users access from new or unusual devices</CardDescription>
            </CardHeader>
            <CardContent>
              {fingerprintsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {deviceFingerprints?.fingerprints.map((fp) => (
                      <Card key={fp.id} className="hover-elevate" data-testid={`fingerprint-${fp.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                                <Smartphone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div>
                                <div className="font-medium">User: {fp.userId}</div>
                                <div className="text-sm text-muted-foreground">
                                  Detected: {format(new Date(fp.detectedAt), "MMM dd, yyyy HH:mm")}
                                </div>
                              </div>
                            </div>
                            <Badge className={severityColors[fp.riskLevel] || severityColors.MEDIUM}>
                              {fp.riskLevel}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {deviceFingerprints?.fingerprints.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No device fingerprint mismatches detected
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multi-account">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Account Detection</CardTitle>
              <CardDescription>Users with suspected multiple accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {multiAccountLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {multiAccountFlags?.flags.map((flag) => (
                      <Card key={flag.id} className="hover-elevate" data-testid={`multi-account-${flag.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <div className="font-medium">Multi-Account Detection</div>
                                <div className="text-sm text-muted-foreground">
                                  Detected: {format(new Date(flag.detectedAt), "MMM dd, yyyy HH:mm")}
                                </div>
                              </div>
                            </div>
                            <Badge variant={flag.status === "blocked" ? "destructive" : "secondary"}>
                              {flag.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {multiAccountFlags?.flags.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No multi-account flags detected
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
