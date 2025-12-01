import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, Shield, RefreshCw, Calendar, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";

interface BackgroundCheckStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cleared: number;
  needsReview: number;
  failed: number;
}

interface ExpiringCheck {
  id: string;
  driverId: string;
  provider: string;
  countryCode: string;
  status: string;
  result: string;
  expiresAt: string;
  driver: {
    id: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
  };
}

const RESULT_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  clear: { variant: "default", label: "Clear" },
  consider: { variant: "secondary", label: "Consider" },
  review: { variant: "outline", label: "Review" },
  suspended: { variant: "destructive", label: "Suspended" },
};

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  not_started: { variant: "outline", label: "Not Started" },
  pending: { variant: "secondary", label: "Pending" },
  in_progress: { variant: "secondary", label: "In Progress" },
  completed: { variant: "default", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
};

export default function BackgroundChecksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; checkId: string | null }>({
    open: false,
    checkId: null,
  });
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveResult, setResolveResult] = useState<string>("clear");

  const countryParam = selectedCountry !== "all" ? `?countryCode=${selectedCountry}` : "";

  const { data: stats, isLoading: statsLoading } = useQuery<{ stats: BackgroundCheckStats }>({
    queryKey: ["/api/admin/background-checks/stats", countryParam],
  });

  const { data: expiring, isLoading: expiringLoading } = useQuery<{ expiring: ExpiringCheck[] }>({
    queryKey: ["/api/admin/background-checks/expiring?days=30"],
    enabled: activeTab === "expiring",
  });

  const resolveMutation = useMutation({
    mutationFn: async (data: { checkId: string; result: string; notes: string }) => {
      return apiRequest(`/api/admin/background-checks/${data.checkId}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: data.result,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-checks/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/background-checks/expiring"] });
      toast({
        title: "Check resolved",
        description: "Background check has been manually resolved.",
      });
      setResolveDialog({ open: false, checkId: null });
      setResolveNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Resolution failed",
        description: error.message || "Failed to resolve background check",
        variant: "destructive",
      });
    },
  });

  const handleResolve = () => {
    if (!resolveDialog.checkId || !resolveNotes.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide resolution notes",
        variant: "destructive",
      });
      return;
    }
    resolveMutation.mutate({
      checkId: resolveDialog.checkId,
      result: resolveResult,
      notes: resolveNotes,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Background Check Management</h1>
              <p className="text-sm opacity-80">Driver verification and compliance tracking</p>
            </div>
          </div>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-40 bg-primary-foreground/10 border-primary-foreground/20" data-testid="select-country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="BD">Bangladesh</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-total">{stats?.stats.total || 0}</div>
                      <p className="text-sm text-muted-foreground">Total Checks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600" data-testid="text-cleared">{stats?.stats.cleared || 0}</div>
                      <p className="text-sm text-muted-foreground">Cleared</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600" data-testid="text-in-progress">{stats?.stats.inProgress || 0}</div>
                      <p className="text-sm text-muted-foreground">In Progress</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600" data-testid="text-review">{stats?.stats.needsReview || 0}</div>
                      <p className="text-sm text-muted-foreground">Needs Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="expiring" data-testid="tab-expiring">Expiring Soon</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Background Check Statistics</CardTitle>
                <CardDescription>Overview of all driver background checks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Pending</div>
                    <div className="text-xl font-bold">{stats?.stats.pending || 0}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Completed</div>
                    <div className="text-xl font-bold">{stats?.stats.completed || 0}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Failed</div>
                    <div className="text-xl font-bold text-red-600">{stats?.stats.failed || 0}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Pass Rate</div>
                    <div className="text-xl font-bold text-green-600">
                      {stats?.stats.completed
                        ? Math.round((stats.stats.cleared / stats.stats.completed) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expiring" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Expiring Background Checks
                    </CardTitle>
                    <CardDescription>Checks expiring within 30 days</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/background-checks/expiring"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {expiringLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !expiring?.expiring || expiring.expiring.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No checks expiring soon</p>
                    <p className="text-sm">All background checks are up to date</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiring.expiring.map((check) => {
                      const resultConfig = RESULT_BADGES[check.result] || RESULT_BADGES.review;
                      const daysUntilExpiry = Math.ceil(
                        (new Date(check.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysUntilExpiry <= 7;
                      
                      return (
                        <div
                          key={check.id}
                          className={`flex items-center justify-between p-4 border rounded-lg ${isUrgent ? "border-red-200 bg-red-50" : ""}`}
                          data-testid={`check-${check.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {check.driver?.fullName || 
                                   (check.driver?.firstName && check.driver?.lastName 
                                     ? `${check.driver.firstName} ${check.driver.lastName}` 
                                     : "Unknown Driver")}
                                </span>
                                <Badge variant="outline">{check.countryCode}</Badge>
                                <Badge variant={resultConfig.variant}>{resultConfig.label}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Provider: {check.provider} | Expires: {format(new Date(check.expiresAt), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className={`text-right ${isUrgent ? "text-red-600" : "text-muted-foreground"}`}>
                              <div className="text-sm font-medium">
                                {daysUntilExpiry} days
                              </div>
                              <div className="text-xs">until expiry</div>
                            </div>
                            <Link href={`/admin/drivers/${check.driverId}`}>
                              <Button variant="outline" size="sm" data-testid={`button-view-${check.id}`}>
                                View Driver
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={resolveDialog.open} onOpenChange={(open) => {
        setResolveDialog({ open, checkId: open ? resolveDialog.checkId : null });
        if (!open) setResolveNotes("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually Resolve Background Check</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Result</Label>
              <Select value={resolveResult} onValueChange={setResolveResult}>
                <SelectTrigger data-testid="select-result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear - Approved</SelectItem>
                  <SelectItem value="consider">Consider - Needs Review</SelectItem>
                  <SelectItem value="review">Review - Additional Investigation</SelectItem>
                  <SelectItem value="suspended">Suspended - Driver Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Enter resolution notes..."
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, checkId: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolveMutation.isPending}
              data-testid="button-submit-resolve"
            >
              {resolveMutation.isPending ? "Resolving..." : "Resolve Check"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
