import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, Shield, User, Clock, FileWarning, Gavel, Ban, MessageSquare, TrendingUp, CheckCircle, XCircle, History, Search } from "lucide-react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface Violation {
  id: string;
  violationCode: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  type: string;
  severity: string;
  status: string;
  incidentDate: string;
  description: string;
  points: number;
  penalty: string;
  appealStatus: string | null;
  createdAt: string;
}

interface ViolationsResponse {
  violations: Violation[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const VIOLATION_TYPES = [
  { value: "speed_violation", label: "Speed Violation" },
  { value: "harassment_complaint", label: "Harassment Complaint" },
  { value: "safety_violation", label: "Safety Violation" },
  { value: "fraud", label: "Fraud" },
  { value: "no_show", label: "No Show" },
  { value: "route_deviation", label: "Route Deviation" },
  { value: "vehicle_condition", label: "Vehicle Condition" },
  { value: "documentation", label: "Documentation Issue" },
];

const PENALTIES = [
  { value: "warning", label: "Warning", color: "bg-yellow-500" },
  { value: "fine", label: "Fine", color: "bg-orange-500" },
  { value: "suspension", label: "Temporary Suspension", color: "bg-red-500" },
  { value: "ban", label: "Permanent Ban", color: "bg-red-700" },
];

export default function DriverViolations() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"review" | "appeal">("review");
  const [actionNotes, setActionNotes] = useState("");
  const [selectedPenalty, setSelectedPenalty] = useState("");
  const [appealDecision, setAppealDecision] = useState("");

  const buildViolationsQueryUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (severityFilter !== "all") params.append("severity", severityFilter);
    const queryString = params.toString();
    return `/api/admin/phase4/violations${queryString ? `?${queryString}` : ""}`;
  };

  const violationsQueryUrl = buildViolationsQueryUrl();
  const { data, isLoading } = useQuery<ViolationsResponse>({
    queryKey: [violationsQueryUrl],
  });

  const updateViolationMutation = useMutation({
    mutationFn: async (updateData: { id: string; status?: string; penalty?: string; notes?: string; appealDecision?: string }) => {
      return apiRequest(`/api/admin/phase4/violations/${updateData.id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: () => {
      toast({ title: "Violation updated successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/violations") });
      setShowActionDialog(false);
      setShowDetailDialog(false);
      setSelectedViolation(null);
      setActionNotes("");
      setSelectedPenalty("");
      setAppealDecision("");
    },
    onError: () => {
      toast({ title: "Failed to update violation", variant: "destructive" });
    },
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge className="bg-red-600">Critical</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low": return <Badge className="bg-green-500">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review": return <Badge variant="destructive">Pending Review</Badge>;
      case "reviewed": return <Badge className="bg-blue-500">Reviewed</Badge>;
      case "escalated": return <Badge className="bg-orange-500">Escalated</Badge>;
      case "action_taken": return <Badge className="bg-green-500">Action Taken</Badge>;
      case "appeal_pending": return <Badge className="bg-purple-500">Appeal Pending</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPenaltyBadge = (penalty: string) => {
    const p = PENALTIES.find(pen => pen.value === penalty);
    if (!p) return <Badge variant="outline">{penalty}</Badge>;
    return <Badge className={p.color}>{p.label}</Badge>;
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
            <h1 className="text-2xl font-bold">Driver Violation Management</h1>
            <p className="text-sm opacity-90">Track violations, penalties, and appeals</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <FileWarning className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{data?.violations?.filter(v => v.status === "pending_review").length || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500">{data?.violations?.filter(v => v.severity === "critical" || v.severity === "high").length || 0}</p>
                <p className="text-xs text-muted-foreground">High Severity</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Gavel className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <p className="text-xl font-bold text-purple-500">{data?.violations?.filter(v => v.appealStatus === "pending").length || 0}</p>
                <p className="text-xs text-muted-foreground">Appeals Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Ban className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl font-bold">{data?.violations?.filter(v => v.penalty === "suspension" || v.penalty === "ban").length || 0}</p>
                <p className="text-xs text-muted-foreground">Active Suspensions</p>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="action_taken">Action Taken</SelectItem>
                <SelectItem value="appeal_pending">Appeal Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
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
                    <Card key={violation.id} className="hover-elevate cursor-pointer" onClick={() => {
                      setSelectedViolation(violation);
                      setShowDetailDialog(true);
                    }} data-testid={`card-violation-${violation.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm text-muted-foreground">{violation.violationCode}</span>
                              {getSeverityBadge(violation.severity)}
                              {getStatusBadge(violation.status)}
                              {violation.appealStatus && (
                                <Badge variant="outline" className="border-purple-500 text-purple-500">
                                  Appeal: {violation.appealStatus}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-medium">{VIOLATION_TYPES.find(t => t.value === violation.type)?.label || violation.type}</h3>
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
                                {formatDistanceToNow(new Date(violation.incidentDate), { addSuffix: true })}
                              </span>
                              {getPenaltyBadge(violation.penalty)}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedViolation(violation);
                              setActionType("review");
                              setShowActionDialog(true);
                            }} data-testid={`button-review-${violation.id}`}>
                              <Gavel className="h-4 w-4 mr-1" />
                              Review
                            </Button>
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
              Violation {selectedViolation?.violationCode}
              {selectedViolation && getSeverityBadge(selectedViolation.severity)}
            </DialogTitle>
          </DialogHeader>
          {selectedViolation && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Driver Information</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Name:</span> {selectedViolation.driverName}</p>
                        <p><span className="text-muted-foreground">Phone:</span> {selectedViolation.driverPhone}</p>
                        <p><span className="text-muted-foreground">ID:</span> {selectedViolation.driverId}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Violation Details</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Type:</span> {VIOLATION_TYPES.find(t => t.value === selectedViolation.type)?.label}</p>
                        <p><span className="text-muted-foreground">Points:</span> {selectedViolation.points}</p>
                        <p><span className="text-muted-foreground">Penalty:</span> {getPenaltyBadge(selectedViolation.penalty)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm">{selectedViolation.description}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Incident Date</h4>
                  <p className="text-sm">{format(new Date(selectedViolation.incidentDate), "MMMM dd, yyyy 'at' HH:mm")}</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            <Button onClick={() => {
              setShowDetailDialog(false);
              setActionType("review");
              setShowActionDialog(true);
            }}>
              <Gavel className="h-4 w-4 mr-2" />
              Take Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "review" ? "Review Violation" : "Process Appeal"}</DialogTitle>
            <DialogDescription>
              {actionType === "review" 
                ? "Review this violation and assign appropriate penalty"
                : "Review and decide on the driver's appeal"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {actionType === "review" ? (
              <>
                <div className="space-y-2">
                  <Label>Assign Penalty</Label>
                  <Select value={selectedPenalty} onValueChange={setSelectedPenalty}>
                    <SelectTrigger data-testid="select-penalty">
                      <SelectValue placeholder="Select penalty" />
                    </SelectTrigger>
                    <SelectContent>
                      {PENALTIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Review Notes</Label>
                  <Textarea
                    placeholder="Enter your review notes..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="textarea-notes"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Appeal Decision</Label>
                  <Select value={appealDecision} onValueChange={setAppealDecision}>
                    <SelectTrigger data-testid="select-appeal-decision">
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upheld">Uphold Original Decision</SelectItem>
                      <SelectItem value="reduced">Reduce Penalty</SelectItem>
                      <SelectItem value="dismissed">Dismiss Violation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Decision Reasoning</Label>
                  <Textarea
                    placeholder="Explain the reasoning for your decision..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="textarea-reasoning"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedViolation) {
                  updateViolationMutation.mutate({
                    id: selectedViolation.id,
                    status: actionType === "review" ? "action_taken" : "closed",
                    penalty: selectedPenalty || undefined,
                    notes: actionNotes,
                    appealDecision: appealDecision || undefined,
                  });
                }
              }}
              disabled={updateViolationMutation.isPending || (actionType === "review" && !selectedPenalty)}
              data-testid="button-submit-action"
            >
              {updateViolationMutation.isPending ? "Processing..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
