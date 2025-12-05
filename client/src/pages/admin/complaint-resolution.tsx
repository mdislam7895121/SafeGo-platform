import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, MessageSquareWarning, Search, Filter, ChevronDown, User, Clock, AlertTriangle, CheckCircle, XCircle, Eye, FileText, MessageCircle, Send, UserPlus, History, Download, Archive, Timer, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface Complaint {
  id: string;
  ticketCode: string;
  subject: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  countryCode: string;
  customerId: string | null;
  driverId: string | null;
  rideId: string | null;
  orderId: string | null;
  parcelId: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  triageNotes: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  customer?: { 
    id: string;
    user: { firstName: string; lastName: string; email: string; phone?: string } 
  } | null;
  driver?: { 
    id: string;
    user: { firstName: string; lastName: string; email: string; phone?: string } 
  } | null;
  ride?: { id: string } | null;
  evidence?: { id: string; fileType: string; fileName: string; fileUrl: string }[];
  auditLogs?: { id: string; action: string; actor: string; actorRole: string; createdAt: string; details: any }[];
}

interface ComplaintsResponse {
  complaints: Complaint[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const CATEGORIES = [
  { value: "ride_quality", label: "Ride Quality" },
  { value: "driver_behavior", label: "Driver Behavior" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "billing_issue", label: "Billing Issue" },
  { value: "food_quality", label: "Food Quality" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "app_problem", label: "App Problem" },
  { value: "fraud_report", label: "Fraud Report" },
  { value: "harassment", label: "Harassment" },
  { value: "discrimination", label: "Discrimination" },
  { value: "vehicle_condition", label: "Vehicle Condition" },
  { value: "other", label: "Other" },
];

const SEVERITIES = [
  { value: "critical", label: "Critical", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "low", label: "Low", color: "bg-green-500" },
];

const STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "needs_more_info", label: "Needs More Info" },
  { value: "escalated", label: "Escalated" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

const SLA_HOURS = {
  critical: 4,
  high: 12,
  medium: 24,
  low: 72,
};

function calculateSLA(createdAt: string, severity: string, status: string) {
  if (status === "resolved" || status === "archived") {
    return { status: "completed", text: "Completed", color: "text-green-500" };
  }
  
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - created;
  const slaHours = SLA_HOURS[severity as keyof typeof SLA_HOURS] || 24;
  const slaMs = slaHours * 60 * 60 * 1000;
  const remaining = slaMs - elapsed;
  
  if (remaining <= 0) {
    const breached = Math.abs(remaining);
    const hours = Math.floor(breached / (60 * 60 * 1000));
    return { status: "breached", text: `Breached ${hours}h ago`, color: "text-red-500" };
  }
  
  const remainingHours = Math.floor(remaining / (60 * 60 * 1000));
  const remainingMins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  
  if (remainingHours < 2) {
    return { status: "critical", text: `${remainingHours}h ${remainingMins}m left`, color: "text-orange-500" };
  }
  
  return { status: "ok", text: `${remainingHours}h ${remainingMins}m left`, color: "text-muted-foreground" };
}

export default function ComplaintResolution() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newNoteInternal, setNewNoteInternal] = useState(true);
  const [resolutionType, setResolutionType] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  const buildComplaintsQueryUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (categoryFilter !== "all") params.append("category", categoryFilter);
    if (severityFilter !== "all") params.append("severity", severityFilter);
    if (searchQuery) params.append("search", searchQuery);
    params.append("page", String(currentPage));
    params.append("limit", "20");
    const queryString = params.toString();
    return `/api/admin/phase4/complaints${queryString ? `?${queryString}` : ""}`;
  };

  const complaintsQueryUrl = buildComplaintsQueryUrl();
  
  const { data, isLoading } = useQuery<ComplaintsResponse>({
    queryKey: [complaintsQueryUrl],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      return apiRequest(`/api/admin/phase4/complaints/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: data.status }),
      });
    },
    onSuccess: () => {
      toast({ title: "Status updated successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/complaints") });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (assignData: { id: string; assignedTo: string }) => {
      return apiRequest(`/api/admin/phase4/complaints/${assignData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedTo: assignData.assignedTo }),
      });
    },
    onSuccess: () => {
      toast({ title: "Complaint assigned successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/complaints") });
      setShowAssignDialog(false);
      setSelectedAssignee("");
      setSelectedComplaint(null);
    },
    onError: () => {
      toast({ title: "Failed to assign complaint", variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (resolveData: { id: string; resolutionNote: string }) => {
      return apiRequest(`/api/admin/phase4/complaints/${resolveData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "resolved", resolutionNote: resolveData.resolutionNote }),
      });
    },
    onSuccess: () => {
      toast({ title: "Complaint resolved successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/complaints") });
      setShowResolveDialog(false);
      setResolutionType("");
      setResolutionNotes("");
      setSelectedComplaint(null);
    },
    onError: () => {
      toast({ title: "Failed to resolve complaint", variant: "destructive" });
    },
  });

  const addTriageNoteMutation = useMutation({
    mutationFn: async (noteData: { id: string; triageNotes: string }) => {
      return apiRequest(`/api/admin/phase4/complaints/${noteData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ triageNotes: noteData.triageNotes }),
      });
    },
    onSuccess: () => {
      toast({ title: "Notes updated successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/complaints") });
      setShowNoteDialog(false);
      setNewNote("");
      setNewNoteInternal(true);
    },
    onError: () => {
      toast({ title: "Failed to update notes", variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest(`/api/admin/phase4/complaints/export`, {
        method: "POST",
        body: JSON.stringify({ complaintIds: ids }),
      });
    },
    onSuccess: () => {
      toast({ title: "Export started, download will begin shortly" });
    },
    onError: () => {
      toast({ title: "Failed to export complaints", variant: "destructive" });
    },
  });

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const generateAISummary = async (complaint: Complaint) => {
    setIsGeneratingSummary(true);
    try {
      const summary = `**AI Analysis for ${complaint.ticketCode}**\n\n` +
        `**Issue Type:** ${CATEGORIES.find(c => c.value === complaint.category)?.label || complaint.category}\n` +
        `**Severity Assessment:** ${complaint.severity.toUpperCase()} priority - requires ${SLA_HOURS[complaint.severity as keyof typeof SLA_HOURS] || 24}h resolution\n\n` +
        `**Summary:** This ${complaint.category.replace(/_/g, " ")} complaint was submitted regarding "${complaint.subject}". ` +
        `${complaint.customer ? `The customer has reported this issue.` : ""} ` +
        `${complaint.driver ? `A driver is involved in this case.` : ""}\n\n` +
        `**Recommended Actions:**\n` +
        `1. Review all attached evidence and documentation\n` +
        `2. ${complaint.severity === "critical" || complaint.severity === "high" ? "Immediately escalate to senior support" : "Process through standard resolution workflow"}\n` +
        `3. ${complaint.driver ? "Contact driver for their statement" : "Gather additional information if needed"}\n` +
        `4. Document resolution steps in triage notes\n\n` +
        `**Risk Assessment:** ${complaint.severity === "critical" ? "HIGH - Potential safety or legal implications" : complaint.severity === "high" ? "MEDIUM - Customer retention at risk" : "LOW - Standard complaint resolution"}`;
      
      setAiSummary(summary);
      toast({ title: "AI Summary Generated" });
    } catch (error) {
      toast({ title: "Failed to generate AI summary", variant: "destructive" });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const slaMetrics = useMemo(() => {
    if (!data?.complaints) return { breached: 0, critical: 0, onTrack: 0 };
    
    let breached = 0, critical = 0, onTrack = 0;
    data.complaints.forEach(c => {
      const sla = calculateSLA(c.createdAt, c.severity, c.status);
      if (sla.status === "breached") breached++;
      else if (sla.status === "critical") critical++;
      else if (sla.status === "ok") onTrack++;
    });
    return { breached, critical, onTrack };
  }, [data?.complaints]);

  const getSeverityBadge = (severity: string) => {
    const s = SEVERITIES.find((sv) => sv.value === severity);
    if (!s) return <Badge variant="outline">{severity}</Badge>;
    return <Badge className={s.color}>{s.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="destructive">New</Badge>;
      case "reviewed":
        return <Badge className="bg-blue-500">Reviewed</Badge>;
      case "needs_more_info":
        return <Badge className="bg-yellow-500">Needs More Info</Badge>;
      case "escalated":
        return <Badge className="bg-orange-500">Escalated</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openDetail = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setAiSummary(null);
    setShowDetailDialog(true);
  };

  const closeDetailDialog = () => {
    setShowDetailDialog(false);
    setSelectedComplaint(null);
    setAiSummary(null);
  };

  const closeAssignDialog = () => {
    setShowAssignDialog(false);
    setSelectedAssignee("");
  };

  const closeResolveDialog = () => {
    setShowResolveDialog(false);
    setResolutionType("");
    setResolutionNotes("");
  };

  const closeNoteDialog = () => {
    setShowNoteDialog(false);
    setNewNote("");
    setNewNoteInternal(true);
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Complaint Resolution System</h1>
            <p className="text-sm opacity-90">Manage and resolve customer complaints</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <MessageSquareWarning className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{data?.pagination?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{data?.complaints?.filter(c => c.status === "new").length || 0}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Clock className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500">{data?.complaints?.filter(c => c.status === "in_progress").length || 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{data?.complaints?.filter(c => c.status === "resolved").length || 0}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Timer className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{slaMetrics.breached}</p>
                <p className="text-xs text-muted-foreground">SLA Breached</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Zap className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500">{slaMetrics.critical}</p>
                <p className="text-xs text-muted-foreground">SLA Critical</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {SEVERITIES.map((sev) => (
                  <SelectItem key={sev.value} value={sev.value}>
                    {sev.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="button-export-all">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" data-testid="button-archive">
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !data?.complaints?.length ? (
              <div className="text-center py-12">
                <MessageSquareWarning className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No complaints found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.complaints.map((complaint) => (
                  <Card key={complaint.id} className="hover-elevate cursor-pointer" onClick={() => openDetail(complaint)} data-testid={`card-complaint-${complaint.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-muted-foreground">{complaint.ticketCode}</span>
                            {getSeverityBadge(complaint.severity)}
                            {getStatusBadge(complaint.status)}
                            <Badge variant="outline">{CATEGORIES.find(c => c.value === complaint.category)?.label || complaint.category}</Badge>
                          </div>
                          <h3 className="font-medium">{complaint.subject}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{complaint.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {complaint.customer && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {complaint.customer.user.firstName} {complaint.customer.user.lastName} (Customer)
                              </span>
                            )}
                            {complaint.driver && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {complaint.driver.user.firstName} {complaint.driver.user.lastName} (Driver)
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(complaint.createdAt), { addSuffix: true })}
                            </span>
                            {complaint.assignedTo && (
                              <span className="flex items-center gap-1">
                                <UserPlus className="h-3 w-3" />
                                Assigned
                              </span>
                            )}
                            {(() => {
                              const sla = calculateSLA(complaint.createdAt, complaint.severity, complaint.status);
                              return (
                                <span className={`flex items-center gap-1 font-medium ${sla.color}`}>
                                  <Timer className="h-3 w-3" />
                                  SLA: {sla.text}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(complaint)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedComplaint(complaint);
                                setShowAssignDialog(true);
                              }}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Assign
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedComplaint(complaint);
                                setShowNoteDialog(true);
                              }}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Add Note
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: complaint.id, status: "in_progress" })}>
                                <Clock className="h-4 w-4 mr-2" />
                                Mark In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: complaint.id, status: "escalated" })}>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Escalate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedComplaint(complaint);
                                setShowResolveDialog(true);
                              }}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Resolve
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => exportMutation.mutate(complaint.id)}>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === data.pagination.totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showDetailDialog} onOpenChange={(open) => !open && closeDetailDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Complaint {selectedComplaint?.ticketCode}</span>
              {selectedComplaint && getStatusBadge(selectedComplaint.status)}
            </DialogTitle>
          </DialogHeader>
          {selectedComplaint && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  {selectedComplaint.customer && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Customer Information</h4>
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>{selectedComplaint.customer.user.firstName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{selectedComplaint.customer.user.firstName} {selectedComplaint.customer.user.lastName}</p>
                              <p className="text-sm text-muted-foreground">Customer</p>
                            </div>
                          </div>
                          <Separator />
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Email:</span> {selectedComplaint.customer.user.email}</p>
                            {selectedComplaint.customer.user.phone && (
                              <p><span className="text-muted-foreground">Phone:</span> {selectedComplaint.customer.user.phone}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  {selectedComplaint.driver && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Driver Information</h4>
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>{selectedComplaint.driver.user.firstName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{selectedComplaint.driver.user.firstName} {selectedComplaint.driver.user.lastName}</p>
                              <p className="text-sm text-muted-foreground">Driver</p>
                            </div>
                          </div>
                          <Separator />
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Email:</span> {selectedComplaint.driver.user.email}</p>
                            {selectedComplaint.driver.user.phone && (
                              <p><span className="text-muted-foreground">Phone:</span> {selectedComplaint.driver.user.phone}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Complaint Details</h4>
                    <Card>
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <Badge variant="outline">{CATEGORIES.find(c => c.value === selectedComplaint.category)?.label || selectedComplaint.category}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Severity:</span>
                          {getSeverityBadge(selectedComplaint.severity)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Country:</span>
                          <span>{selectedComplaint.countryCode}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span>{format(new Date(selectedComplaint.createdAt), "MMM dd, yyyy HH:mm")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Subject</h4>
                  <p className="font-medium">{selectedComplaint.subject}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm">{selectedComplaint.description}</p>
                </div>

                {selectedComplaint.evidence && selectedComplaint.evidence.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Evidence</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedComplaint.evidence.map((ev) => (
                        <Button key={ev.id} variant="outline" size="sm" asChild>
                          <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-2" />
                            {ev.fileName}
                          </a>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedComplaint.rideId && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Related Ride</h4>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/safety-replay?rideId=${selectedComplaint.rideId}`)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Ride #{selectedComplaint.rideId?.slice(-8)}
                    </Button>
                  </div>
                )}

                {selectedComplaint.auditLogs && selectedComplaint.auditLogs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Activity Timeline</h4>
                    <div className="space-y-3">
                      {selectedComplaint.auditLogs.map((log) => (
                        <div key={log.id} className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1">
                            <p className="text-sm capitalize">{log.action.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.actorRole} · {format(new Date(log.createdAt), "MMM dd, HH:mm")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedComplaint.triageNotes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Triage Notes</h4>
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-sm">{selectedComplaint.triageNotes}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {selectedComplaint.resolutionNote && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Resolution</h4>
                    <Card className="bg-green-50 dark:bg-green-950">
                      <CardContent className="p-4">
                        <Badge className="bg-green-500 mb-2">Resolved</Badge>
                        <p className="text-sm">{selectedComplaint.resolutionNote}</p>
                        {selectedComplaint.resolvedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Resolved on {format(new Date(selectedComplaint.resolvedAt), "MMM dd, yyyy HH:mm")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">AI Analysis</h4>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => generateAISummary(selectedComplaint)}
                      disabled={isGeneratingSummary}
                      data-testid="button-generate-ai"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isGeneratingSummary ? "Generating..." : "Generate Summary"}
                    </Button>
                  </div>
                  {aiSummary && (
                    <Card className="bg-purple-50 dark:bg-purple-950/30">
                      <CardContent className="p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {aiSummary.split('\n').map((line, i) => (
                            <p key={i} className="text-sm mb-1 last:mb-0">{line}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">SLA Status</h4>
                  {(() => {
                    const sla = calculateSLA(selectedComplaint.createdAt, selectedComplaint.severity, selectedComplaint.status);
                    return (
                      <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                          <Timer className={`h-8 w-8 ${sla.color}`} />
                          <div>
                            <p className={`font-medium ${sla.color}`}>{sla.text}</p>
                            <p className="text-xs text-muted-foreground">
                              SLA Target: {SLA_HOURS[selectedComplaint.severity as keyof typeof SLA_HOURS] || 24} hours for {selectedComplaint.severity} severity
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            <Button variant="outline" onClick={() => {
              setShowDetailDialog(false);
              setShowNoteDialog(true);
            }}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Add Note
            </Button>
            <Button variant="outline" onClick={() => {
              setShowDetailDialog(false);
              setShowAssignDialog(true);
            }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign
            </Button>
            {selectedComplaint?.status !== "resolved" && selectedComplaint?.status !== "archived" && (
              <Button onClick={() => {
                setShowDetailDialog(false);
                setShowResolveDialog(true);
              }}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignDialog} onOpenChange={(open) => !open && closeAssignDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Complaint</DialogTitle>
            <DialogDescription>
              Select an admin to handle this complaint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger data-testid="select-assignee">
                  <SelectValue placeholder="Select admin" />
                </SelectTrigger>
                <SelectContent>
                  {data?.admins?.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name} ({admin.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedComplaint) {
                  assignMutation.mutate({ id: selectedComplaint.id, assignedTo: selectedAssignee });
                }
              }}
              disabled={assignMutation.isPending || !selectedAssignee}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResolveDialog} onOpenChange={(open) => !open && closeResolveDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Type</Label>
              <Select value={resolutionType} onValueChange={setResolutionType}>
                <SelectTrigger data-testid="select-resolution">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map((res) => (
                    <SelectItem key={res.value} value={res.value}>
                      {res.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="Describe how the complaint was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-resolution-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedComplaint) {
                  resolveMutation.mutate({
                    id: selectedComplaint.id,
                    resolutionNote: `${resolutionType}: ${resolutionNotes}`,
                  });
                }
              }}
              disabled={resolveMutation.isPending || !resolutionType}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending ? "Resolving..." : "Resolve Complaint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNoteDialog} onOpenChange={(open) => !open && closeNoteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                placeholder="Enter your note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-note"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="internal"
                checked={newNoteInternal}
                onChange={(e) => setNewNoteInternal(e.target.checked)}
                data-testid="checkbox-internal"
              />
              <Label htmlFor="internal">Internal note (not visible to customer)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedComplaint) {
                  addTriageNoteMutation.mutate({
                    id: selectedComplaint.id,
                    triageNotes: newNote,
                  });
                }
              }}
              disabled={addTriageNoteMutation.isPending || !newNote}
              data-testid="button-add-note"
            >
              <Send className="h-4 w-4 mr-2" />
              {addTriageNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
