import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  UserCog, 
  Eye, 
  LogOut, 
  Clock,
  User,
  Shield,
  AlertTriangle,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonationSession {
  id: string;
  targetUserId: string;
  reason: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  impersonator: {
    user: {
      email: string;
    };
  };
}

export default function CustomerSupportPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery<{ sessions: ImpersonationSession[] }>({
    queryKey: ["/api/admin/phase3a/support/impersonation/sessions"],
  });

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/support/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId, reason }),
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Impersonation Started", 
        description: `Viewing as ${data.targetUser.email} (View-Only Mode)` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/support/impersonation/sessions"] });
      setImpersonateDialogOpen(false);
      setTargetUserId("");
      setReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start impersonation.", variant: "destructive" });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/admin/phase3a/support/impersonate/${sessionId}/end`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Session Ended", description: "Impersonation session has been terminated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/support/impersonation/sessions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to end session.", variant: "destructive" });
    },
  });

  const activeSessions = sessions?.sessions.filter(s => s.status === "ACTIVE") || [];
  const recentSessions = sessions?.sessions.filter(s => s.status === "ENDED").slice(0, 10) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Internal Customer Support Panel</h1>
          <p className="text-muted-foreground">Safe admin impersonation with full audit logging</p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>View-Only Impersonation</AlertTitle>
        <AlertDescription>
          Impersonation sessions are view-only and fully audited. You can see what the user sees but cannot perform actions on their behalf.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Start Impersonation
            </CardTitle>
            <CardDescription>View a user's account to assist with support</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search user by email or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-user"
                />
              </div>
              <Button variant="outline" data-testid="button-search-user">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            <Dialog open={impersonateDialogOpen} onOpenChange={setImpersonateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" data-testid="button-start-impersonation">
                  <Eye className="h-4 w-4 mr-2" />
                  Start Impersonation Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Start Impersonation
                  </DialogTitle>
                  <DialogDescription>
                    You will view the platform as this user. All actions are logged.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">User ID or Email</label>
                    <Input
                      placeholder="Enter user ID or email"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      data-testid="input-target-user"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason for Impersonation</label>
                    <Textarea
                      placeholder="Enter reason (required for audit)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      data-testid="input-reason"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImpersonateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => impersonateMutation.mutate()}
                    disabled={impersonateMutation.isPending || !targetUserId || !reason}
                    data-testid="button-confirm-impersonation"
                  >
                    {impersonateMutation.isPending ? "Starting..." : "Start Session"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Currently active impersonation sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No active sessions
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div key={session.id} className="p-3 border rounded-lg space-y-2" data-testid={`active-session-${session.id}`}>
                    <div className="flex items-center justify-between">
                      <Badge variant="default">Active</Badge>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => endSessionMutation.mutate(session.id)}
                        disabled={endSessionMutation.isPending}
                        data-testid={`button-end-${session.id}`}
                      >
                        <LogOut className="h-3 w-3 mr-1" />
                        End
                      </Button>
                    </div>
                    <div className="text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        {session.targetUserId}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.startedAt), "MMM dd, HH:mm")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>Recent impersonation sessions with full audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Target User</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSessions.map((session) => (
                    <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                      <TableCell className="font-mono text-sm">{session.id.slice(0, 8)}...</TableCell>
                      <TableCell className="font-mono text-sm">{session.targetUserId.slice(0, 8)}...</TableCell>
                      <TableCell>{session.impersonator?.user?.email || "Unknown"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{session.reason}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(session.startedAt), "MMM dd, HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {session.endedAt ? format(new Date(session.endedAt), "MMM dd, HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.status === "ACTIVE" ? "default" : "secondary"}>
                          {session.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
