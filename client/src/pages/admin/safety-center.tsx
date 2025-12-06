import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Filter,
  ShieldAlert,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Activity,
  User,
  Car,
  UtensilsCrossed,
  TrendingUp,
  Flame,
  AlertOctagon,
  FileWarning,
  CreditCard,
  Scale,
  RefreshCw,
  Download,
  MoreHorizontal,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchWithAuth, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PageHeader,
  PageHeaderTabs,
  StatusBadge,
  SeverityBadge,
  DetailDrawer,
  DetailSection,
  DetailItem,
  Timeline,
  EmptyState,
  MetricCard,
  MetricGrid,
  QuickFilterBar,
} from "@/components/admin";

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

const roleIcons: Record<string, any> = {
  customer: User,
  driver: Car,
  restaurant: UtensilsCrossed,
};

const roleLabels: Record<string, string> = {
  customer: "Customer",
  driver: "Driver",
  restaurant: "Restaurant",
};

const categoryIcons: Record<string, any> = {
  fraud: FileWarning,
  safety: ShieldAlert,
  abuse: AlertTriangle,
  technical: Activity,
  payment_risk: CreditCard,
  compliance: Scale,
};

const categoryLabels: Record<string, string> = {
  fraud: "Fraud",
  safety: "Safety",
  abuse: "Abuse",
  technical: "Technical",
  payment_risk: "Payment Risk",
  compliance: "Compliance",
};

function CaseDetailPanel({
  caseId,
  onClose,
  onUpdate,
}: {
  caseId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");

  const {
    data: caseData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/admin/risk-cases", caseId],
    enabled: !!caseId,
  });

  const updateCaseMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest(`/api/admin/risk-cases/${caseId}`, {
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
      const response = await apiRequest(`/api/admin/risk-cases/${caseId}/notes`, {
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
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Failed to load case"
        description="Unable to retrieve case details. Please try again."
        action={
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      />
    );
  }

  const riskCase = caseData as RiskCase & { userProfile?: any; caseNotes?: any[] };
  const RoleIcon = roleIcons[riskCase.role] || User;

  const timelineEvents =
    riskCase.riskEvents?.slice(0, 5).map((event) => ({
      id: event.id,
      title: event.eventType || event.category,
      description: event.description,
      timestamp: new Date(event.createdAt).toLocaleString(),
      icon:
        event.severity === "critical"
          ? AlertOctagon
          : event.severity === "high"
          ? AlertTriangle
          : Activity,
      iconColor:
        event.severity === "critical"
          ? "text-red-500"
          : event.severity === "high"
          ? "text-orange-500"
          : "text-amber-500",
    })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <SeverityBadge severity={riskCase.severity as any} showIcon />
        <StatusBadge status={riskCase.status} showIcon />
        <Badge variant="outline">
          <RoleIcon className="h-3 w-3 mr-1" />
          {roleLabels[riskCase.role] || riskCase.role}
        </Badge>
        <Badge variant="outline">{riskCase.countryCode}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Created {new Date(riskCase.createdAt).toLocaleString()}
      </p>

      {riskCase.userProfile && (
        <DetailSection title="Associated User" icon={RoleIcon} iconColor="text-blue-500">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">
              {riskCase.userProfile.firstName
                ? `${riskCase.userProfile.firstName} ${riskCase.userProfile.lastName || ""}`
                : riskCase.userProfile.name ||
                  riskCase.userProfile.ownerName ||
                  "Unknown"}
            </p>
            {riskCase.userProfile.email && (
              <p className="text-muted-foreground">{riskCase.userProfile.email}</p>
            )}
            {riskCase.userProfile.phone && (
              <p className="text-muted-foreground">{riskCase.userProfile.phone}</p>
            )}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Update Case" icon={Shield} iconColor="text-blue-500">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select
              value={selectedStatus || riskCase.status}
              onValueChange={setSelectedStatus}
            >
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
            <Select
              value={selectedSeverity || riskCase.severity}
              onValueChange={setSelectedSeverity}
            >
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
      </DetailSection>

      {timelineEvents.length > 0 && (
        <DetailSection
          title={`Related Events (${riskCase.riskEvents?.length || 0})`}
          icon={Activity}
          iconColor="text-amber-500"
        >
          <Timeline events={timelineEvents} />
        </DetailSection>
      )}

      {riskCase.caseNotes && riskCase.caseNotes.length > 0 && (
        <DetailSection
          title={`Case Notes (${riskCase.caseNotes.length})`}
          icon={MessageSquare}
          iconColor="text-green-500"
        >
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
        </DetailSection>
      )}

      <DetailSection title="Add Note" icon={MessageSquare} iconColor="text-muted-foreground">
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
      </DetailSection>
    </div>
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
  const [selectedCase, setSelectedCase] = useState<RiskCase | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState("all");

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<SafetyStats>({
    queryKey: ["/api/admin/safety-stats"],
    refetchInterval: 30000,
  });

  const {
    data: casesData,
    isLoading: isLoadingCases,
    refetch: refetchCases,
  } = useQuery({
    queryKey: ["/api/admin/risk-cases", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.set(key, String(value));
      });
      const res = await fetchWithAuth(`/api/admin/risk-cases?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      await throwIfResNotOk(res);
      return res.json();
    },
    enabled: activeTab === "cases",
  });

  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["/api/admin/risk-events", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.set(key, String(value));
      });
      const res = await fetchWithAuth(`/api/admin/risk-events?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      await throwIfResNotOk(res);
      return res.json();
    },
    enabled: activeTab === "events",
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    if (filter === "all") {
      setFilters((prev) => ({ ...prev, severity: "all", status: "all", page: 1 }));
    } else if (filter === "critical") {
      setFilters((prev) => ({ ...prev, severity: "critical", status: "all", page: 1 }));
    } else if (filter === "open") {
      setFilters((prev) => ({ ...prev, status: "open", severity: "all", page: 1 }));
    } else if (filter === "escalated") {
      setFilters((prev) => ({ ...prev, status: "escalated", severity: "all", page: 1 }));
    }
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
    setQuickFilter("all");
  };

  const activeFilterCount = [
    filters.role !== "all",
    filters.country !== "all",
    filters.severity !== "all",
    filters.category !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  const tabs = [
    { id: "cases", label: "Risk Cases", icon: Shield, count: stats?.openCases },
    { id: "events", label: "Risk Events", icon: Activity, count: stats?.todayEvents },
  ];

  const quickFilters = [
    { id: "all", label: "All Cases" },
    { id: "critical", label: "Critical", count: stats?.criticalCases },
    { id: "open", label: "Open", count: stats?.openCases },
    { id: "escalated", label: "Escalated" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Safety & Risk Center"
        description="Monitor and manage platform safety incidents and risk cases"
        icon={ShieldAlert}
        iconColor="text-red-500"
        backButton={{ label: "Back to Security", href: "/admin" }}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                refetchStats();
                refetchCases();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-export">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <MetricGrid columns={4} className="mb-6">
          <MetricCard
            title="Open Cases"
            value={stats?.openCases || 0}
            icon={Clock}
            iconColor="text-blue-500"
            iconBgColor="bg-blue-500/10"
            isLoading={isLoadingStats}
            onClick={() => handleQuickFilter("open")}
          />
          <MetricCard
            title="Critical Cases"
            value={stats?.criticalCases || 0}
            icon={Flame}
            iconColor="text-red-500"
            iconBgColor="bg-red-500/10"
            isLoading={isLoadingStats}
            onClick={() => handleQuickFilter("critical")}
          />
          <MetricCard
            title="Today's Events"
            value={stats?.todayEvents || 0}
            icon={Activity}
            iconColor="text-amber-500"
            iconBgColor="bg-amber-500/10"
            isLoading={isLoadingStats}
          />
          <MetricCard
            title="Unresolved"
            value={stats?.unresolvedByCategory?.reduce((sum, c) => sum + c._count, 0) || 0}
            icon={TrendingUp}
            iconColor="text-orange-500"
            iconBgColor="bg-orange-500/10"
            isLoading={isLoadingStats}
          />
        </MetricGrid>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <PageHeaderTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {showFilters && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Select value={filters.role} onValueChange={(v) => handleFilterChange("role", v)}>
                  <SelectTrigger data-testid="select-filter-role">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.severity}
                  onValueChange={(v) => handleFilterChange("severity", v)}
                >
                  <SelectTrigger data-testid="select-filter-severity">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.category}
                  onValueChange={(v) => handleFilterChange("category", v)}
                >
                  <SelectTrigger data-testid="select-filter-category">
                    <SelectValue placeholder="Category" />
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
                <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
                  <SelectTrigger data-testid="select-filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.country}
                  onValueChange={(v) => handleFilterChange("country", v)}
                >
                  <SelectTrigger data-testid="select-filter-country">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    <SelectItem value="BD">Bangladesh</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeFilterCount > 0 && (
                <div className="flex justify-end mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground"
                    data-testid="button-clear-filters"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Clear all
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <QuickFilterBar
          filters={quickFilters}
          activeFilter={quickFilter}
          onFilterChange={handleQuickFilter}
          className="mb-4"
        />

        {activeTab === "cases" && (
          <>
            {isLoadingCases ? (
              <div className="grid gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : casesData?.cases?.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <EmptyState
                    icon={Shield}
                    title="No risk cases found"
                    description="All clear - no active safety issues matching your filters."
                    action={
                      activeFilterCount > 0 && (
                        <Button variant="outline" onClick={clearFilters}>
                          Clear Filters
                        </Button>
                      )
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {casesData?.cases?.map((riskCase: RiskCase) => {
                  const RoleIcon = roleIcons[riskCase.role] || User;
                  const CategoryIcon = categoryIcons[riskCase.riskEvents?.[0]?.category] || Shield;

                  return (
                    <Card
                      key={riskCase.id}
                      className={`hover-elevate cursor-pointer ${
                        riskCase.severity === "critical"
                          ? "border-red-500/50 dark:border-red-700/50"
                          : ""
                      }`}
                      onClick={() => setSelectedCase(riskCase)}
                      data-testid={`card-case-${riskCase.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`p-2.5 rounded-lg ${
                              riskCase.severity === "critical"
                                ? "bg-red-500/10"
                                : riskCase.severity === "high"
                                ? "bg-orange-500/10"
                                : riskCase.severity === "medium"
                                ? "bg-amber-500/10"
                                : "bg-blue-500/10"
                            }`}
                          >
                            <CategoryIcon
                              className={`h-5 w-5 ${
                                riskCase.severity === "critical"
                                  ? "text-red-500"
                                  : riskCase.severity === "high"
                                  ? "text-orange-500"
                                  : riskCase.severity === "medium"
                                  ? "text-amber-500"
                                  : "text-blue-500"
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate">{riskCase.description}</h3>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <SeverityBadge
                                    severity={riskCase.severity as any}
                                    size="sm"
                                    showIcon
                                  />
                                  <StatusBadge status={riskCase.status} size="sm" showIcon />
                                  <Badge variant="outline" className="text-xs">
                                    <RoleIcon className="h-3 w-3 mr-1" />
                                    {roleLabels[riskCase.role] || riskCase.role}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {riskCase.countryCode}
                                  </Badge>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCase(riskCase);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View User Profile
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
          </>
        )}

        {activeTab === "events" && (
          <>
            {isLoadingEvents ? (
              <div className="grid gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : eventsData?.events?.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <EmptyState
                    icon={Activity}
                    title="No risk events found"
                    description="No safety events matching your filters."
                    action={
                      activeFilterCount > 0 && (
                        <Button variant="outline" onClick={clearFilters}>
                          Clear Filters
                        </Button>
                      )
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {eventsData?.events?.map((event: RiskEvent) => {
                  const CategoryIcon = categoryIcons[event.category] || Activity;

                  return (
                    <Card key={event.id} className="hover-elevate" data-testid={`card-event-${event.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              event.severity === "critical"
                                ? "bg-red-500/10"
                                : event.severity === "high"
                                ? "bg-orange-500/10"
                                : event.severity === "medium"
                                ? "bg-amber-500/10"
                                : "bg-blue-500/10"
                            }`}
                          >
                            <CategoryIcon
                              className={`h-4 w-4 ${
                                event.severity === "critical"
                                  ? "text-red-500"
                                  : event.severity === "high"
                                  ? "text-orange-500"
                                  : event.severity === "medium"
                                  ? "text-amber-500"
                                  : "text-blue-500"
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {categoryLabels[event.category] || event.category}
                              </Badge>
                              <SeverityBadge severity={event.severity as any} size="sm" />
                              <Badge variant="outline" className="text-xs">
                                {roleLabels[event.role] || event.role}
                              </Badge>
                              {event.isAcknowledged && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs gap-1 bg-green-500/10 text-green-700 dark:text-green-400"
                                >
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
          </>
        )}
      </div>

      <DetailDrawer
        open={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        title={selectedCase?.description || "Risk Case Details"}
        subtitle="Review and manage this safety case"
        width="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedCase(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedCase && (
          <CaseDetailPanel
            caseId={selectedCase.id}
            onClose={() => setSelectedCase(null)}
            onUpdate={() => refetchCases()}
          />
        )}
      </DetailDrawer>
    </div>
  );
}
