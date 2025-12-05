import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  User,
  Clock,
  FileWarning,
  Gavel,
  Ban,
  TrendingUp,
  Search,
  Plus,
  MapPin,
  UserPlus,
  History,
  FileText,
  Car,
  CreditCard,
  Smartphone,
  ShieldAlert,
  Image,
  Video,
  Download,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface TimelineEvent {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

interface Evidence {
  type: string;
  url?: string;
  description: string;
}

interface Violation {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  category: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  points: number;
  location?: { lat: number; lng: number; address: string } | null;
  rideId?: string | null;
  evidence: Evidence[];
  timeline: TimelineEvent[];
  investigatorId?: string | null;
  investigatorName?: string | null;
  resolution?: {
    type: string;
    notes: string;
    refundAmount?: number;
    suspensionDays?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface ViolationsResponse {
  violations: Violation[];
  summary: {
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    critical: number;
    byCategory: {
      safety: number;
      behavior: number;
      payment_abuse: number;
      system_misuse: number;
    };
  };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const CATEGORIES = [
  { value: "safety", label: "Safety", icon: ShieldAlert, color: "bg-red-500" },
  { value: "behavior", label: "Behavior", icon: User, color: "bg-orange-500" },
  { value: "payment_abuse", label: "Payment Abuse", icon: CreditCard, color: "bg-purple-500" },
  { value: "system_misuse", label: "System Misuse", icon: Smartphone, color: "bg-blue-500" },
];

const VIOLATION_TYPES = {
  safety: ["speed_violation", "reckless_driving", "accident", "vehicle_unsafe"],
  behavior: ["harassment_complaint", "rudeness", "inappropriate_behavior", "refusal_of_service"],
  payment_abuse: ["fare_manipulation", "cash_fraud", "payment_fraud", "tip_baiting"],
  system_misuse: ["fake_location", "gps_spoofing", "app_manipulation", "account_sharing"],
};

const PENALTIES = [
  { value: "warning", label: "Warning", color: "bg-yellow-500" },
  { value: "fine", label: "Fine", color: "bg-orange-500" },
  { value: "temporary_suspension", label: "Temp Suspension", color: "bg-red-500" },
  { value: "permanent_ban", label: "Permanent Ban", color: "bg-red-700" },
];

const ADMINS = [
  { id: "adm-001", name: "John Admin" },
  { id: "adm-002", name: "Jane Admin" },
  { id: "adm-003", name: "Bob Supervisor" },
];

export default function DriverViolations() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"assign" | "resolve" | "add_evidence">("assign");
  
  const [newViolation, setNewViolation] = useState({
    driverId: "",
    category: "",
    type: "",
    severity: "medium",
    description: "",
    points: 0,
    rideId: "",
  });
  
  const [selectedInvestigator, setSelectedInvestigator] = useState("");
  const [resolutionType, setResolutionType] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [suspensionDays, setSuspensionDays] = useState("");

  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    if (categoryFilter !== "all") params.append("category", categoryFilter);
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (severityFilter !== "all") params.append("severity", severityFilter);
    const queryString = params.toString();
    return `/api/admin/phase4/violations-center${queryString ? `?${queryString}` : ""}`;
  };

  const queryUrl = buildQueryUrl();
  const { data, isLoading, refetch } = useQuery<ViolationsResponse>({
    queryKey: [queryUrl],
    refetchInterval: 30000,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/admin/notifications/ws`;

    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          setIsConnected(true);
          console.log("[Violations] WebSocket connected");
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "violation_update" || message.type === "violation_created") {
              setLastUpdate(new Date());
              refetch();
              toast({
                title: message.type === "violation_created" ? "New Violation" : "Violation Updated",
                description: message.data?.description || "A violation has been updated",
              });
            }
          } catch (err) {
            console.error("[Violations] Error parsing WebSocket message:", err);
          }
        };

        wsRef.current.onclose = () => {
          setIsConnected(false);
          console.log("[Violations] WebSocket disconnected");
          setTimeout(connectWebSocket, 5000);
        };

        wsRef.current.onerror = (error) => {
          console.error("[Violations] WebSocket error:", error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error("[Violations] Failed to connect WebSocket:", error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [refetch, toast]);

  const createViolationMutation = useMutation({
    mutationFn: async (violationData: typeof newViolation) => {
      return apiRequest("/api/admin/phase4/violations-center", {
        method: "POST",
        body: JSON.stringify(violationData),
      });
    },
    onSuccess: () => {
      toast({ title: "Violation created successfully" });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/violations"),
      });
      closeCreateDialog();
    },
    onError: () => {
      toast({ title: "Failed to create violation", variant: "destructive" });
    },
  });

  const updateViolationMutation = useMutation({
    mutationFn: async ({ id, action, data }: { id: string; action: string; data: any }) => {
      return apiRequest(`/api/admin/phase4/violations-center/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...data }),
      });
    },
    onSuccess: () => {
      toast({ title: "Violation updated successfully" });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/violations"),
      });
      closeActionDialog();
      setShowDetailSheet(false);
      setSelectedViolation(null);
    },
    onError: () => {
      toast({ title: "Failed to update violation", variant: "destructive" });
    },
  });

  const openDetailSheet = (violation: Violation) => {
    setSelectedViolation(violation);
    setShowDetailSheet(true);
  };

  const closeDetailSheet = () => {
    setShowDetailSheet(false);
    setSelectedViolation(null);
  };

  const closeCreateDialog = () => {
    setShowCreateDialog(false);
    setNewViolation({
      driverId: "",
      category: "",
      type: "",
      severity: "medium",
      description: "",
      points: 0,
      rideId: "",
    });
  };

  const openActionDialog = (type: "assign" | "resolve" | "add_evidence") => {
    setActionType(type);
    setSelectedInvestigator("");
    setResolutionType("");
    setResolutionNotes("");
    setFineAmount("");
    setSuspensionDays("");
    setShowActionDialog(true);
  };

  const closeActionDialog = () => {
    setShowActionDialog(false);
    setActionType("assign");
    setSelectedInvestigator("");
    setResolutionType("");
    setResolutionNotes("");
    setFineAmount("");
    setSuspensionDays("");
  };

  const handleCreateViolation = () => {
    if (!newViolation.driverId || !newViolation.category || !newViolation.type || !newViolation.description) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createViolationMutation.mutate(newViolation);
  };

  const handleAction = () => {
    if (!selectedViolation) return;

    if (actionType === "assign") {
      if (!selectedInvestigator) {
        toast({ title: "Please select an investigator", variant: "destructive" });
        return;
      }
      updateViolationMutation.mutate({
        id: selectedViolation.id,
        action: "assign",
        data: { investigatorId: selectedInvestigator },
      });
    } else if (actionType === "resolve") {
      if (!resolutionType || !resolutionNotes) {
        toast({ title: "Please fill resolution details", variant: "destructive" });
        return;
      }
      updateViolationMutation.mutate({
        id: selectedViolation.id,
        action: "resolve",
        data: {
          resolution: {
            type: resolutionType,
            notes: resolutionNotes,
            fineAmount: fineAmount ? parseFloat(fineAmount) : undefined,
            suspensionDays: suspensionDays ? parseInt(suspensionDays) : undefined,
          },
        },
      });
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-600">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge className="bg-green-500">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "investigating":
        return <Badge className="bg-blue-500">Investigating</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "dismissed":
        return <Badge variant="secondary">Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    if (!cat) return <Badge variant="outline">{category}</Badge>;
    return <Badge className={cat.color}>{cat.label}</Badge>;
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    if (!cat) return <AlertTriangle className="h-5 w-5" />;
    const Icon = cat.icon;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
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
              <h1 className="text-2xl font-bold">Driver Violations Center</h1>
              <p className="text-sm opacity-90">Manage violations, investigations, and penalties</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <div className="flex items-center gap-1 text-green-300">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live
                </div>
              ) : (
                <div className="flex items-center gap-1 text-yellow-300">
                  <RefreshCw className="h-3 w-3" />
                  Auto-refresh
                </div>
              )}
              {lastUpdate && (
                <span className="text-xs opacity-70">
                  Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                </span>
              )}
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              data-testid="button-create-violation"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Violation
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <FileWarning className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{data?.summary?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{data?.summary?.open || 0}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Search className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500">{data?.summary?.investigating || 0}</p>
                <p className="text-xs text-muted-foreground">Investigating</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{data?.summary?.resolved || 0}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Ban className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500">{data?.summary?.critical || 0}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <ShieldAlert className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold">{data?.summary?.byCategory?.safety || 0}</p>
                <p className="text-xs text-muted-foreground">Safety</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search violations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
                data-testid="input-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-category">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
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
            ) : !data?.violations?.length ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No violations found</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {data.violations.map((violation) => (
                    <Card
                      key={violation.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => openDetailSheet(violation)}
                      data-testid={`card-violation-${violation.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-muted">{getCategoryIcon(violation.category)}</div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getCategoryBadge(violation.category)}
                                {getSeverityBadge(violation.severity)}
                                {getStatusBadge(violation.status)}
                              </div>
                              <h3 className="font-medium">{violation.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2">{violation.description}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {violation.driverName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {violation.points} points
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(violation.createdAt), { addSuffix: true })}
                                </span>
                                {violation.investigatorName && (
                                  <span className="flex items-center gap-1 text-blue-500">
                                    <UserPlus className="h-3 w-3" />
                                    {violation.investigatorName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {violation.status === "open" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedViolation(violation);
                                  openActionDialog("assign");
                                }}
                                data-testid={`button-assign-${violation.id}`}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Assign
                              </Button>
                            )}
                            {violation.status === "investigating" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedViolation(violation);
                                  openActionDialog("resolve");
                                }}
                                data-testid={`button-resolve-${violation.id}`}
                              >
                                <Gavel className="h-4 w-4 mr-1" />
                                Resolve
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

      <Sheet open={showDetailSheet} onOpenChange={(open) => !open && closeDetailSheet()}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedViolation && getCategoryIcon(selectedViolation.category)}
              Violation Details
            </SheetTitle>
            <SheetDescription>
              {selectedViolation?.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </SheetDescription>
          </SheetHeader>

          {selectedViolation && (
            <Tabs defaultValue="details" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
                <TabsTrigger value="evidence" className="flex-1">Evidence</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {getCategoryBadge(selectedViolation.category)}
                  {getSeverityBadge(selectedViolation.severity)}
                  {getStatusBadge(selectedViolation.status)}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver</h4>
                  <p className="font-medium">{selectedViolation.driverName}</p>
                  <p className="text-sm text-muted-foreground">{selectedViolation.driverEmail}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm">{selectedViolation.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Points</h4>
                    <p className="font-medium">{selectedViolation.points}</p>
                  </div>
                  {selectedViolation.rideId && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Related Ride</h4>
                      <p className="font-mono text-sm">{selectedViolation.rideId}</p>
                    </div>
                  )}
                </div>

                {selectedViolation.location && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">{selectedViolation.location.address}</p>
                    </div>
                  </div>
                )}

                {selectedViolation.investigatorName && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Investigator</h4>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      <p className="font-medium">{selectedViolation.investigatorName}</p>
                    </div>
                  </div>
                )}

                {selectedViolation.resolution && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Resolution</h4>
                    <Badge className={PENALTIES.find((p) => p.value === selectedViolation.resolution?.type)?.color || ""}>
                      {selectedViolation.resolution.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Badge>
                    <p className="text-sm mt-2">{selectedViolation.resolution.notes}</p>
                    {selectedViolation.resolution.suspensionDays && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Suspension: {selectedViolation.resolution.suspensionDays} days
                      </p>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  {selectedViolation.status === "open" && (
                    <Button className="flex-1" onClick={() => openActionDialog("assign")} data-testid="button-sheet-assign">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign Investigator
                    </Button>
                  )}
                  {selectedViolation.status === "investigating" && (
                    <Button className="flex-1" onClick={() => openActionDialog("resolve")} data-testid="button-sheet-resolve">
                      <Gavel className="h-4 w-4 mr-2" />
                      Resolve Violation
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {selectedViolation.timeline?.map((event, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          {index < selectedViolation.timeline.length - 1 && <div className="w-0.5 h-full bg-border" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">
                              {event.action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(event.timestamp), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.details}</p>
                          <p className="text-xs text-muted-foreground">by {event.actor}</p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-center text-muted-foreground py-8">No timeline events yet</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="evidence" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {selectedViolation.evidence?.length > 0 ? (
                      selectedViolation.evidence.map((item, index) => (
                        <Card key={index} className="overflow-hidden">
                          <CardContent className="p-0">
                            {item.type === "image" || item.type === "photo" || item.type === "screenshot" ? (
                              <div className="relative">
                                <div className="aspect-video bg-muted flex items-center justify-center">
                                  {item.url ? (
                                    <img
                                      src={item.url}
                                      alt={item.description}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                      }}
                                    />
                                  ) : null}
                                  <div className={`flex flex-col items-center ${item.url ? "hidden" : ""}`}>
                                    <Image className="h-12 w-12 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">Image Preview</p>
                                  </div>
                                </div>
                                <div className="p-3">
                                  <p className="font-medium text-sm">{item.description}</p>
                                  <div className="flex gap-2 mt-2">
                                    {item.url && (
                                      <>
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Open
                                          </a>
                                        </Button>
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={item.url} download>
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </a>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : item.type === "video" || item.type === "dashcam" ? (
                              <div className="relative">
                                <div className="aspect-video bg-muted flex items-center justify-center">
                                  {item.url ? (
                                    <video
                                      src={item.url}
                                      controls
                                      className="w-full h-full"
                                      onError={(e) => {
                                        (e.target as HTMLVideoElement).style.display = "none";
                                      }}
                                    >
                                      Your browser does not support video playback.
                                    </video>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <Video className="h-12 w-12 text-muted-foreground mb-2" />
                                      <p className="text-sm text-muted-foreground">Video Preview</p>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <p className="font-medium text-sm">{item.description}</p>
                                  {item.url && (
                                    <div className="flex gap-2 mt-2">
                                      <Button size="sm" variant="outline" asChild>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Open
                                        </a>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-4">
                                <div className="flex items-start gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {item.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                    {item.url && (
                                      <div className="flex gap-2 mt-2">
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            View
                                          </a>
                                        </Button>
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={item.url} download>
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </a>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No evidence attached</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => openActionDialog("add_evidence")}
                          data-testid="button-add-evidence"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Evidence
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Violation</DialogTitle>
            <DialogDescription>Record a new driver violation for investigation.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Driver ID *</Label>
              <Input
                value={newViolation.driverId}
                onChange={(e) => setNewViolation({ ...newViolation, driverId: e.target.value })}
                placeholder="Enter driver ID"
                data-testid="input-driver-id"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select
                  value={newViolation.category}
                  onValueChange={(val) => setNewViolation({ ...newViolation, category: val, type: "" })}
                >
                  <SelectTrigger data-testid="select-new-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type *</Label>
                <Select
                  value={newViolation.type}
                  onValueChange={(val) => setNewViolation({ ...newViolation, type: val })}
                  disabled={!newViolation.category}
                >
                  <SelectTrigger data-testid="select-new-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(VIOLATION_TYPES[newViolation.category as keyof typeof VIOLATION_TYPES] || []).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity *</Label>
                <Select
                  value={newViolation.severity}
                  onValueChange={(val) => setNewViolation({ ...newViolation, severity: val })}
                >
                  <SelectTrigger data-testid="select-new-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  value={newViolation.points}
                  onChange={(e) => setNewViolation({ ...newViolation, points: parseInt(e.target.value) || 0 })}
                  data-testid="input-points"
                />
              </div>
            </div>

            <div>
              <Label>Related Ride ID (optional)</Label>
              <Input
                value={newViolation.rideId}
                onChange={(e) => setNewViolation({ ...newViolation, rideId: e.target.value })}
                placeholder="Enter ride ID if applicable"
                data-testid="input-ride-id"
              />
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={newViolation.description}
                onChange={(e) => setNewViolation({ ...newViolation, description: e.target.value })}
                placeholder="Describe the violation..."
                className="min-h-[100px]"
                data-testid="input-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button onClick={handleCreateViolation} disabled={createViolationMutation.isPending} data-testid="button-submit-create">
              {createViolationMutation.isPending ? "Creating..." : "Create Violation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showActionDialog} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "assign" && "Assign Investigator"}
              {actionType === "resolve" && "Resolve Violation"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "assign" && "Assign an admin to investigate this violation."}
              {actionType === "resolve" && "Record the resolution and penalty for this violation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionType === "assign" && (
              <div>
                <Label>Select Investigator *</Label>
                <Select value={selectedInvestigator} onValueChange={setSelectedInvestigator}>
                  <SelectTrigger data-testid="select-investigator">
                    <SelectValue placeholder="Choose an admin" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMINS.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {actionType === "resolve" && (
              <>
                <div>
                  <Label>Penalty Type *</Label>
                  <Select value={resolutionType} onValueChange={setResolutionType}>
                    <SelectTrigger data-testid="select-penalty">
                      <SelectValue placeholder="Select penalty" />
                    </SelectTrigger>
                    <SelectContent>
                      {PENALTIES.map((pen) => (
                        <SelectItem key={pen.value} value={pen.value}>
                          {pen.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {resolutionType === "fine" && (
                  <div>
                    <Label>Fine Amount ($)</Label>
                    <Input
                      type="number"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-fine"
                    />
                  </div>
                )}

                {resolutionType === "temporary_suspension" && (
                  <div>
                    <Label>Suspension Days</Label>
                    <Input
                      type="number"
                      value={suspensionDays}
                      onChange={(e) => setSuspensionDays(e.target.value)}
                      placeholder="Number of days"
                      data-testid="input-suspension-days"
                    />
                  </div>
                )}

                <div>
                  <Label>Resolution Notes *</Label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe the resolution..."
                    className="min-h-[100px]"
                    data-testid="input-resolution-notes"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={updateViolationMutation.isPending} data-testid="button-confirm-action">
              {updateViolationMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
