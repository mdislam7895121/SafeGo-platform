import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Monitor, 
  LogOut, 
  Ban, 
  Shield,
  Clock,
  User,
  Globe,
  Smartphone,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Session {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
}

interface SuspiciousIP {
  ip: string;
  incidents: number;
  lastSeen: string;
  blocked: boolean;
}

export default function SessionSecurity() {
  const [activeTab, setActiveTab] = useState("sessions");
  const [blockIpDialogOpen, setBlockIpDialogOpen] = useState(false);
  const [selectedIp, setSelectedIp] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const { toast } = useToast();

  const { data: sessions, isLoading: sessionsLoading } = useQuery<{ sessions: Session[]; total: number }>({
    queryKey: ["/api/admin/phase3a/sessions/active"],
  });

  const { data: suspiciousIps, isLoading: ipsLoading } = useQuery<{ suspiciousIps: SuspiciousIP[] }>({
    queryKey: ["/api/admin/phase3a/sessions/suspicious-ips"],
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/admin/phase3a/sessions/${sessionId}/terminate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Session Terminated", description: "The session has been terminated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/sessions/active"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to terminate session.", variant: "destructive" });
    },
  });

  const blockIpMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/sessions/block-ip", {
        method: "POST",
        body: JSON.stringify({ ip: selectedIp, reason: blockReason }),
      });
    },
    onSuccess: () => {
      toast({ title: "IP Blocked", description: `IP ${selectedIp} has been blocked.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/sessions/suspicious-ips"] });
      setBlockIpDialogOpen(false);
      setSelectedIp("");
      setBlockReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to block IP.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Admin Session Security</h1>
          <p className="text-muted-foreground">Manage active sessions and block suspicious IPs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-stat-sessions">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{sessions?.total || 0}</p>
              </div>
              <Monitor className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-suspicious">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspicious IPs</p>
                <p className="text-2xl font-bold text-orange-600">{suspiciousIps?.suspiciousIps.length || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-blocked">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked IPs</p>
                <p className="text-2xl font-bold text-green-600">
                  {suspiciousIps?.suspiciousIps.filter(ip => ip.blocked).length || 0}
                </p>
              </div>
              <Ban className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sessions" data-testid="tab-sessions">
            <Monitor className="h-4 w-4 mr-2" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="ips" data-testid="tab-ips">
            <Globe className="h-4 w-4 mr-2" />
            Suspicious IPs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Browser Sessions</CardTitle>
              <CardDescription>All currently active admin and user sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
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
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions?.sessions.map((session) => (
                        <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{session.userEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.userRole}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{session.ipAddress}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(session.createdAt), "MMM dd, HH:mm")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(session.expiresAt), "MMM dd, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => terminateSessionMutation.mutate(session.id)}
                              disabled={terminateSessionMutation.isPending}
                              data-testid={`button-terminate-${session.id}`}
                            >
                              <LogOut className="h-4 w-4 mr-1" />
                              Terminate
                            </Button>
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

        <TabsContent value="ips">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious IP Addresses</CardTitle>
              <CardDescription>IPs with multiple security incidents</CardDescription>
            </CardHeader>
            <CardContent>
              {ipsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {suspiciousIps?.suspiciousIps.map((ip) => (
                      <Card key={ip.ip} className="hover-elevate" data-testid={`ip-${ip.ip}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${ip.blocked ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <Globe className={`h-5 w-5 ${ip.blocked ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                              </div>
                              <div>
                                <div className="font-mono font-medium">{ip.ip}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3" />
                                  {ip.incidents} incidents
                                  <Clock className="h-3 w-3 ml-2" />
                                  Last: {format(new Date(ip.lastSeen), "MMM dd, HH:mm")}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={ip.blocked ? "default" : "destructive"}>
                                {ip.blocked ? "Blocked" : "Active"}
                              </Badge>
                              {!ip.blocked && (
                                <Dialog open={blockIpDialogOpen && selectedIp === ip.ip} onOpenChange={(open) => {
                                  setBlockIpDialogOpen(open);
                                  if (open) setSelectedIp(ip.ip);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="destructive" data-testid={`button-block-${ip.ip}`}>
                                      <Ban className="h-4 w-4 mr-1" />
                                      Block
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Block IP Address</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to block {ip.ip}? This will prevent any connections from this IP.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Reason for blocking</label>
                                        <Textarea
                                          placeholder="Enter reason..."
                                          value={blockReason}
                                          onChange={(e) => setBlockReason(e.target.value)}
                                          data-testid="input-block-reason"
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setBlockIpDialogOpen(false)}>
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => blockIpMutation.mutate()}
                                        disabled={blockIpMutation.isPending || !blockReason}
                                        data-testid="button-confirm-block"
                                      >
                                        {blockIpMutation.isPending ? "Blocking..." : "Block IP"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {suspiciousIps?.suspiciousIps.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No suspicious IPs detected
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
