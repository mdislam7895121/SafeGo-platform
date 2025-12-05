import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, AlertTriangle, FileText, Users, Clock, CheckCircle, XCircle, Scale, MessageSquare, Eye, FileWarning, Gavel, Flag, Ban, Award } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface SafetyCase {
  id: string;
  caseCode: string;
  type: string;
  priority: string;
  status: string;
  summary: string;
  customerName: string;
  driverName: string;
  incidentDate: string;
  evidenceCount: number;
  createdAt: string;
  committeeDecision: string | null;
  decisionDate: string | null;
}

interface SafetyCasesResponse {
  cases: SafetyCase[];
}

const CASE_TYPES = [
  { value: "safety_incident", label: "Safety Incident", icon: Shield },
  { value: "fraud_investigation", label: "Fraud Investigation", icon: AlertTriangle },
  { value: "harassment", label: "Harassment Case", icon: Ban },
  { value: "accident", label: "Accident Review", icon: FileWarning },
  { value: "dispute", label: "Dispute Resolution", icon: Scale },
];

const ACTIONS = [
  { id: "warning_customer", label: "Issue Warning to Customer" },
  { id: "warning_driver", label: "Issue Warning to Driver" },
  { id: "suspend_driver", label: "Suspend Driver" },
  { id: "ban_driver", label: "Permanently Ban Driver" },
  { id: "suspend_customer", label: "Suspend Customer" },
  { id: "ban_customer", label: "Permanently Ban Customer" },
  { id: "refund", label: "Issue Full Refund" },
  { id: "partial_refund", label: "Issue Partial Refund" },
  { id: "compensation", label: "Provide Compensation Credits" },
  { id: "escalate_legal", label: "Escalate to Legal Team" },
  { id: "law_enforcement", label: "Refer to Law Enforcement" },
  { id: "no_action", label: "No Action Required" },
];

export default function TrustSafety() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedCase, setSelectedCase] = useState<SafetyCase | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [decision, setDecision] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [language, setLanguage] = useState("en");

  const { data, isLoading } = useQuery<SafetyCasesResponse>({
    queryKey: ["/api/admin/phase4/trust-safety/cases"],
  });

  const decisionMutation = useMutation({
    mutationFn: async (decisionData: { caseId: string; decision: string; reasoning: string; actionsTaken: string[]; language: string }) => {
      return apiRequest(`/api/admin/phase4/trust-safety/cases/${decisionData.caseId}/decision`, {
        method: "POST",
        body: JSON.stringify(decisionData),
      });
    },
    onSuccess: () => {
      toast({ title: "Decision recorded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/trust-safety/cases"] });
      setShowDecisionDialog(false);
      setSelectedCase(null);
      setDecision("");
      setReasoning("");
      setSelectedActions([]);
    },
    onError: () => {
      toast({ title: "Failed to record decision", variant: "destructive" });
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical": return <Badge className="bg-red-600">Critical</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low": return <Badge className="bg-green-500">Low</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_committee": return <Badge variant="destructive">Pending Committee</Badge>;
      case "under_review": return <Badge className="bg-blue-500">Under Review</Badge>;
      case "decision_made": return <Badge className="bg-green-500">Decision Made</Badge>;
      case "actions_pending": return <Badge className="bg-purple-500">Actions Pending</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    const t = CASE_TYPES.find(ct => ct.value === type);
    return t ? t.icon : Shield;
  };

  const pendingCases = data?.cases?.filter(c => c.status === "pending_committee" || c.status === "under_review") || [];
  const decidedCases = data?.cases?.filter(c => c.status === "decision_made" || c.status === "closed") || [];

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
            <h1 className="text-2xl font-bold">Trust & Safety Review Board</h1>
            <p className="text-sm opacity-90">Committee-based safety case review and decisions</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Flag className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{pendingCases.length}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500">{data?.cases?.filter(c => c.priority === "critical").length || 0}</p>
                <p className="text-xs text-muted-foreground">Critical Cases</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Scale className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500">{data?.cases?.filter(c => c.status === "under_review").length || 0}</p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{decidedCases.length}</p>
                <p className="text-xs text-muted-foreground">Decisions Made</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({pendingCases.length})
            </TabsTrigger>
            <TabsTrigger value="decided" data-testid="tab-decided">
              Decided ({decidedCases.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : pendingCases.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending cases for review</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {pendingCases.map((safetyCase) => {
                        const TypeIcon = getTypeIcon(safetyCase.type);
                        return (
                          <Card key={safetyCase.id} className="hover-elevate cursor-pointer" onClick={() => {
                            setSelectedCase(safetyCase);
                            setShowDetailDialog(true);
                          }} data-testid={`card-case-${safetyCase.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                  <div className="p-3 rounded-full bg-muted">
                                    <TypeIcon className="h-6 w-6 text-primary" />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-sm text-muted-foreground">{safetyCase.caseCode}</span>
                                      {getPriorityBadge(safetyCase.priority)}
                                      {getStatusBadge(safetyCase.status)}
                                    </div>
                                    <h3 className="font-medium">{safetyCase.summary}</h3>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {safetyCase.customerName} vs {safetyCase.driverName}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        {safetyCase.evidenceCount} evidence items
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDistanceToNow(new Date(safetyCase.incidentDate), { addSuffix: true })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button size="sm" onClick={() => {
                                    setSelectedCase(safetyCase);
                                    setShowDecisionDialog(true);
                                  }} data-testid={`button-decide-${safetyCase.id}`}>
                                    <Gavel className="h-4 w-4 mr-1" />
                                    Make Decision
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="decided" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {decidedCases.length === 0 ? (
                  <div className="text-center py-12">
                    <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No decided cases yet</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {decidedCases.map((safetyCase) => {
                        const TypeIcon = getTypeIcon(safetyCase.type);
                        return (
                          <Card key={safetyCase.id} className="hover-elevate cursor-pointer" onClick={() => {
                            setSelectedCase(safetyCase);
                            setShowDetailDialog(true);
                          }} data-testid={`card-decided-${safetyCase.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-950">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-sm text-muted-foreground">{safetyCase.caseCode}</span>
                                      <Badge className="bg-green-500">Decision Made</Badge>
                                    </div>
                                    <h3 className="font-medium">{safetyCase.summary}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      Decision: <span className="font-medium capitalize">{safetyCase.committeeDecision || "N/A"}</span>
                                    </p>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCase(safetyCase);
                                  setShowDetailDialog(true);
                                }}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Case {selectedCase?.caseCode}
              {selectedCase && getPriorityBadge(selectedCase.priority)}
            </DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Customer</h4>
                      <p className="text-sm">{selectedCase.customerName}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Driver</h4>
                      <p className="text-sm">{selectedCase.driverName}</p>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Case Summary</h4>
                  <p className="text-sm">{selectedCase.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Case Type</h4>
                    <Badge variant="outline">
                      {CASE_TYPES.find(t => t.value === selectedCase.type)?.label || selectedCase.type}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Evidence Items</h4>
                    <p className="text-sm">{selectedCase.evidenceCount} documents/files</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Incident Date</h4>
                  <p className="text-sm">{format(new Date(selectedCase.incidentDate), "MMMM dd, yyyy 'at' HH:mm")}</p>
                </div>
                {selectedCase.committeeDecision && (
                  <Card className="bg-green-50 dark:bg-green-950">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Committee Decision</h4>
                      <p className="text-sm capitalize">{selectedCase.committeeDecision}</p>
                      {selectedCase.decisionDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Decided on {format(new Date(selectedCase.decisionDate), "MMM dd, yyyy")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            {selectedCase && !selectedCase.committeeDecision && (
              <Button onClick={() => {
                setShowDetailDialog(false);
                setShowDecisionDialog(true);
              }}>
                <Gavel className="h-4 w-4 mr-2" />
                Make Decision
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Committee Decision</DialogTitle>
            <DialogDescription>
              Record the committee's decision for case {selectedCase?.caseCode}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={decision} onValueChange={setDecision}>
                  <SelectTrigger data-testid="select-decision">
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_favor_customer">In Favor of Customer</SelectItem>
                    <SelectItem value="in_favor_driver">In Favor of Driver</SelectItem>
                    <SelectItem value="split_decision">Split Decision</SelectItem>
                    <SelectItem value="insufficient_evidence">Insufficient Evidence</SelectItem>
                    <SelectItem value="both_at_fault">Both Parties at Fault</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Decision Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="bn">Bangla</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reasoning</Label>
                <Textarea
                  placeholder="Explain the reasoning behind this decision..."
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="textarea-reasoning"
                />
              </div>

              <div className="space-y-2">
                <Label>Actions to Take</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {ACTIONS.map((action) => (
                    <div key={action.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={action.id}
                        checked={selectedActions.includes(action.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedActions([...selectedActions, action.id]);
                          } else {
                            setSelectedActions(selectedActions.filter(a => a !== action.id));
                          }
                        }}
                        data-testid={`checkbox-action-${action.id}`}
                      />
                      <label htmlFor={action.id} className="text-sm">{action.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedCase) {
                  decisionMutation.mutate({
                    caseId: selectedCase.id,
                    decision,
                    reasoning,
                    actionsTaken: selectedActions,
                    language,
                  });
                }
              }}
              disabled={decisionMutation.isPending || !decision || !reasoning}
              data-testid="button-submit-decision"
            >
              {decisionMutation.isPending ? "Recording..." : "Record Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
