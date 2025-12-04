import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Filter, ShieldAlert, Shield, AlertTriangle, AlertCircle, CheckCircle, Clock, XCircle, Eye, ChevronDown, ChevronUp, MessageSquare, Activity, User, Car, UtensilsCrossed, TrendingUp, Flame, AlertOctagon, FileWarning, CreditCard, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RiskCase {
  id: string;
  primaryUserId: string;
  role: string;
  countryCode: string;
  severity: string;
  status: string;
  description: string;
  resolutionNotes: string | null;
  actionsTaken: string[];
  createdAt: string;
  resolvedAt: string | null;
  riskEvents: RiskEvent[];
  _count: {
    riskEvents: number;
    caseNotes: number;
  };
}

interface RiskEvent {
  id: string;
  userId: string;
  role: string;
  eventType: string;
  severity: string;
  category: string;
  description: string;
  metadata: any;
  isAcknowledged: boolean;
  createdAt: string;
}

interface SafetyStats {
  openCases: number;
  criticalCases: number;
  todayEvents: number;
  unresolvedByCategory: Array<{ category: string; _count: number }>;
}

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const severityIcons: Record<string, any> = {
  low: Activity,
  medium: AlertCircle,
  high: AlertTriangle,
  critical: AlertOctagon,
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  escalated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusIcons: Record<string, any> = {
  open: Clock,
  in_review: Eye,
  resolved: CheckCircle,
  escalated: Flame,
};

const categoryIcons: Record<string, any> = {
  fraud: FileWarning,
  safety: ShieldAlert,
  abuse: AlertTriangle,
  technical: Activity,
  payment_risk: CreditCard,
  compliance: Scale,
};

const roleIcons: Record<string, any> = {
  customer: User,
  driver: Car,
  restaurant: UtensilsCrossed,
};

function CaseDetailPanel({ caseId, onClose, onUpdate }: { caseId: string; onClose: () => void; onUpdate: () => void }) {
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");

  const { data: caseData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/safety/cases", caseId],
    enabled: !!caseId,
  });

  const updateCaseMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest(`/api/admin/safety/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Case updated successfully" });
      refetch();
      onUpdate();
    },
    onError: () => {
      toast({ title: "Failed to update case", variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { content: string; isInternal: boolean }) => {
      const response = await apiRequest(`/api/admin/safety/cases/${caseId}/notes`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Note added successfully" });
      setNoteContent("");
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const handleUpdateCase = () => {
    const updates: any = {};
    if (selectedStatus) updates.status = selectedStatus;
    if (selectedSeverity) updates.severity = selectedSeverity;
    if (Object.keys(updates).length > 0) {
      updateCaseMutation.mutate(updates);
    }
  };

  const handleAddNote = () => {
    if (noteContent.trim()) {
      addNoteMutation.mutate({ content: noteContent.trim(), isInternal: true });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p>Failed to load case details</p>
      </div>
    );
  }

  const riskCase = caseData as RiskCase & { userProfile?: any; caseNotes?: any[] };
  const SeverityIcon = severityIcons[riskCase.severity] || Activity;
  const StatusIcon = statusIcons[riskCase.status] || Clock;
  const RoleIcon = roleIcons[riskCase.role] || User;

  return (
    <ScrollArea className="h-[70vh]">
      <div className="space-y-6 p-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={severityColors[riskCase.severity]}>
                <SeverityIcon className="h-3 w-3 mr-1" />
                {riskCase.severity.toUpperCase()}
              </Badge>
              <Badge className={statusColors[riskCase.status]}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {riskCase.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold">{riskCase.description}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Created {new Date(riskCase.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {riskCase.userProfile && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <RoleIcon className="h-4 w-4" /> Associated User
              </h4>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">
                  {riskCase.userProfile.firstName 
                    ? `${riskCase.userProfile.firstName} ${riskCase.userProfile.lastName || ""}`
                    : riskCase.userProfile.name || riskCase.userProfile.ownerName || "Unknown"}
                </p>
                <p className="text-muted-foreground">{riskCase.userProfile.email}</p>
                <p className="text-muted-foreground">{riskCase.userProfile.phone}</p>
              </div>
            </div>
          </>
        )}

        <Separator />
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Update Case</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={selectedStatus || riskCase.status} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-case-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
              <Select value={selectedSeverity || riskCase.severity} onValueChange={setSelectedSeverity}>
                <SelectTrigger data-testid="select-case-severity">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            className="w-full mt-3" 
            onClick={handleUpdateCase}
            disabled={updateCaseMutation.isPending || (!selectedStatus && !selectedSeverity)}
            data-testid="button-update-case"
          >
            {updateCaseMutation.isPending ? "Updating..." : "Update Case"}
          </Button>
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Related Events ({riskCase.riskEvents?.length || 0})
          </h4>
          <div className="space-y-2">
            {riskCase.riskEvents?.slice(0, 5).map((event) => (
              <div key={event.id} className="bg-muted/30 rounded p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    {event.category}
                  </Badge>
                  <Badge className={`${severityColors[event.severity]} text-[10px]`}>
                    {event.severity}
                  </Badge>
                </div>
                <p className="truncate">{event.description}</p>
                <p className="text-muted-foreground mt-1">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {riskCase.caseNotes && riskCase.caseNotes.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Case Notes ({riskCase.caseNotes.length})
              </h4>
              <div className="space-y-2">
                {riskCase.caseNotes.map((note: any) => (
                  <div key={note.id} className="bg-muted/30 rounded p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">{note.adminEmail}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p>{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Add Note</h4>
          <Textarea
            placeholder="Write a note about this case..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="min-h-20"
            data-testid="textarea-case-note"
          />
          <Button 
            className="w-full mt-2" 
            variant="outline"
            onClick={handleAddNote}
            disabled={addNoteMutation.isPending || !noteContent.trim()}
            data-testid="button-add-note"
          >
            {addNoteMutation.isPending ? "Adding..." : "Add Note"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

export default function SafetyCenter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("cases");
  const [filters, setFilters] = useState({
    role: "all",
    country: "all",
    severity: "all",
    category: "all",
    status: "all",
    page: 1,
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: stats, isLoading: isLoadingStats } = useQuery<SafetyStats>({
    queryKey: ["/api/admin/safety/stats"],
    refetchInterval: 30000,
  });

  const { data: casesData, isLoading: isLoadingCases, refetch: refetchCases } = useQuery({
    queryKey: ["/api/admin/safety/cases", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
      });
      return fetch(`/api/admin/safety/cases?${params.toString()}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then(res => res.json());
    },
    enabled: activeTab === "cases",
  });

  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["/api/admin/safety/events", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
      });
      return fetch(`/api/admin/safety/events?${params.toString()}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then(res => res.json());
    },
    enabled: activeTab === "events",
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      role: "all",
      country: "all",
      severity: "all",
      category: "all",
      status: "all",
      page: 1,
    });
  };

  const activeFilterCount = [
    filters.role !== "all",
    filters.country !== "all",
    filters.severity !== "all",
    filters.category !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-red-600 dark:bg-red-800 text-white px-4 sm:px-6 md:px-8 py-5 sm:py-6 rounded-b-2xl sm:rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            className="text-white hover:bg-white/10 h-10 w-10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" />
              Safety & Risk Center
            </h1>
            <p className="text-xs sm:text-sm opacity-90">Monitor and manage platform safety incidents</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-white/20">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.openCases || 0}</p>
                  <p className="text-xs text-white/80">Open Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-white/20">
                  <Flame className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.criticalCases || 0}</p>
                  <p className="text-xs text-white/80">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-white/20">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.todayEvents || 0}</p>
                  <p className="text-xs text-white/80">Today's Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 border-white/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-white/20">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats?.unresolvedByCategory?.reduce((sum, c) => sum + c._count, 0) || 0}
                  </p>
                  <p className="text-xs text-white/80">Unresolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList>
              <TabsTrigger value="cases" data-testid="tab-cases">Risk Cases</TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-events">Risk Events</TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <Badge className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {showFilters && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                    <Select value={filters.role} onValueChange={(v) => handleFilterChange("role", v)}>
                      <SelectTrigger data-testid="select-filter-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Severity</label>
                    <Select value={filters.severity} onValueChange={(v) => handleFilterChange("severity", v)}>
                      <SelectTrigger data-testid="select-filter-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                    <Select value={filters.category} onValueChange={(v) => handleFilterChange("category", v)}>
                      <SelectTrigger data-testid="select-filter-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="fraud">Fraud</SelectItem>
                        <SelectItem value="safety">Safety</SelectItem>
                        <SelectItem value="abuse">Abuse</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="payment_risk">Payment Risk</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                    <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
                      <SelectTrigger data-testid="select-filter-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Country</label>
                    <Select value={filters.country} onValueChange={(v) => handleFilterChange("country", v)}>
                      <SelectTrigger data-testid="select-filter-country">
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
                {activeFilterCount > 0 && (
                  <div className="flex justify-end mt-3">
                    <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                      Clear all filters
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <TabsContent value="cases" className="space-y-4">
            {isLoadingCases ? (
              <div className="grid gap-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : casesData?.cases?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No risk cases found</p>
                  <p className="text-sm">All clear - no active safety issues</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {casesData?.cases?.map((riskCase: RiskCase) => {
                  const SeverityIcon = severityIcons[riskCase.severity] || Activity;
                  const StatusIcon = statusIcons[riskCase.status] || Clock;
                  const RoleIcon = roleIcons[riskCase.role] || User;
                  
                  return (
                    <Card 
                      key={riskCase.id} 
                      className={`hover-elevate cursor-pointer ${riskCase.severity === "critical" ? "border-red-500 dark:border-red-700" : ""}`}
                      onClick={() => setSelectedCaseId(riskCase.id)}
                      data-testid={`card-case-${riskCase.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg ${severityColors[riskCase.severity]}`}>
                            <SeverityIcon className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate">{riskCase.description}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge className={severityColors[riskCase.severity]}>
                                    {riskCase.severity.toUpperCase()}
                                  </Badge>
                                  <Badge className={statusColors[riskCase.status]}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {riskCase.status.replace("_", " ")}
                                  </Badge>
                                  <Badge variant="outline">
                                    <RoleIcon className="h-3 w-3 mr-1" />
                                    {riskCase.role}
                                  </Badge>
                                  <Badge variant="outline">{riskCase.countryCode}</Badge>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-view-case-${riskCase.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{riskCase._count.riskEvents} events</span>
                              <span>{riskCase._count.caseNotes} notes</span>
                              <span>Created {new Date(riskCase.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {isLoadingEvents ? (
              <div className="grid gap-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : eventsData?.events?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No risk events found</p>
                  <p className="text-sm">No safety events matching your filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {eventsData?.events?.map((event: RiskEvent) => {
                  const SeverityIcon = severityIcons[event.severity] || Activity;
                  const CategoryIcon = categoryIcons[event.category] || Activity;
                  
                  return (
                    <Card key={event.id} className="hover-elevate" data-testid={`card-event-${event.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${severityColors[event.severity]}`}>
                            <CategoryIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{event.category}</Badge>
                              <Badge className={`${severityColors[event.severity]} text-xs`}>
                                {event.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{event.role}</Badge>
                              {event.isAcknowledged && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <CheckCircle className="h-3 w-3" /> Acknowledged
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{event.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedCaseId} onOpenChange={() => setSelectedCaseId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Risk Case Details</DialogTitle>
            <DialogDescription>Review and manage this safety case</DialogDescription>
          </DialogHeader>
          {selectedCaseId && (
            <CaseDetailPanel
              caseId={selectedCaseId}
              onClose={() => setSelectedCaseId(null)}
              onUpdate={() => refetchCases()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
