import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, FileText, Settings, Plus, Edit, Trash2, Clock, CheckCircle, AlertTriangle, Car, Utensils, Package, Code, Eye, Play, Pause } from "lucide-react";
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
import { format } from "date-fns";

interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
}

interface Policy {
  id: string;
  policyCode: string;
  name: string;
  type: string;
  version: string;
  status: string;
  rules: PolicyRule[];
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  createdAt: string;
}

interface PoliciesResponse {
  policies: Policy[];
}

const POLICY_TYPES = [
  { value: "rides", label: "Rides", icon: Car },
  { value: "eats", label: "Eats", icon: Utensils },
  { value: "parcel", label: "Parcel", icon: Package },
  { value: "general", label: "General", icon: Shield },
];

export default function PolicyEngine() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    type: "rides",
    rules: [] as PolicyRule[],
    effectiveFrom: "",
  });
  const [newRule, setNewRule] = useState({ condition: "", action: "", priority: 1 });

  const { data, isLoading } = useQuery<PoliciesResponse>({
    queryKey: ["/api/admin/phase4/policies"],
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (policyData: { name: string; type: string; rules: PolicyRule[]; effectiveFrom: string }) => {
      return apiRequest(`/api/admin/phase4/policies`, {
        method: "POST",
        body: JSON.stringify(policyData),
      });
    },
    onSuccess: () => {
      toast({ title: "Policy created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/policies"] });
      setShowCreateDialog(false);
      setNewPolicy({ name: "", type: "rides", rules: [], effectiveFrom: "" });
      setNewRule({ condition: "", action: "", priority: 1 });
    },
    onError: () => {
      toast({ title: "Failed to create policy", variant: "destructive" });
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async (updateData: { id: string; status?: string }) => {
      return apiRequest(`/api/admin/phase4/policies/${updateData.id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: () => {
      toast({ title: "Policy updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/policies"] });
      setSelectedPolicy(null);
    },
    onError: () => {
      toast({ title: "Failed to update policy", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "paused": return <Badge className="bg-yellow-500">Paused</Badge>;
      case "deprecated": return <Badge variant="destructive">Deprecated</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    const t = POLICY_TYPES.find(pt => pt.value === type);
    return t ? t.icon : Shield;
  };

  const activePolicies = data?.policies?.filter(p => p.status === "active") || [];
  const draftPolicies = data?.policies?.filter(p => p.status === "draft") || [];

  const addRule = () => {
    if (newRule.condition && newRule.action) {
      setNewPolicy({
        ...newPolicy,
        rules: [...newPolicy.rules, { ...newRule, id: `rule-${Date.now()}` }],
      });
      setNewRule({ condition: "", action: "", priority: newPolicy.rules.length + 1 });
    }
  };

  const removeRule = (ruleId: string) => {
    setNewPolicy({
      ...newPolicy,
      rules: newPolicy.rules.filter(r => r.id !== ruleId),
    });
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Policy Enforcement Engine</h1>
            <p className="text-sm opacity-90">Configure and manage platform policies and rules</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-white text-primary hover:bg-white/90" data-testid="button-create-policy">
            <Plus className="h-4 w-4 mr-2" />
            Create Policy
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{activePolicies.length}</p>
                <p className="text-xs text-muted-foreground">Active Policies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <FileText className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500">{draftPolicies.length}</p>
                <p className="text-xs text-muted-foreground">Draft Policies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Code className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <p className="text-xl font-bold text-purple-500">
                  {data?.policies?.reduce((acc, p) => acc + p.rules.length, 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Settings className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl font-bold">{data?.policies?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Policies</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">Active ({activePolicies.length})</TabsTrigger>
            <TabsTrigger value="drafts" data-testid="tab-drafts">Drafts ({draftPolicies.length})</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All ({data?.policies?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <PolicyList policies={activePolicies} isLoading={isLoading} onSelect={(p) => { setSelectedPolicy(p); setShowDetailDialog(true); }} onUpdateStatus={updatePolicyMutation.mutate} />
          </TabsContent>

          <TabsContent value="drafts" className="mt-4">
            <PolicyList policies={draftPolicies} isLoading={isLoading} onSelect={(p) => { setSelectedPolicy(p); setShowDetailDialog(true); }} onUpdateStatus={updatePolicyMutation.mutate} />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <PolicyList policies={data?.policies || []} isLoading={isLoading} onSelect={(p) => { setSelectedPolicy(p); setShowDetailDialog(true); }} onUpdateStatus={updatePolicyMutation.mutate} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPolicy?.name}
              {selectedPolicy && getStatusBadge(selectedPolicy.status)}
            </DialogTitle>
            <DialogDescription>
              Policy Code: {selectedPolicy?.policyCode} | Version: {selectedPolicy?.version}
            </DialogDescription>
          </DialogHeader>
          {selectedPolicy && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium capitalize">{selectedPolicy.type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Effective From</Label>
                    <p className="font-medium">
                      {selectedPolicy.effectiveFrom 
                        ? format(new Date(selectedPolicy.effectiveFrom), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground mb-2 block">Policy Rules</Label>
                  <div className="space-y-2">
                    {selectedPolicy.rules.map((rule, idx) => (
                      <Card key={rule.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="shrink-0">Priority {rule.priority}</Badge>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{rule.condition}</p>
                              <p className="text-sm text-muted-foreground">
                                Action: <span className="font-medium text-foreground">{rule.action.replace(/_/g, " ")}</span>
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            {selectedPolicy?.status === "draft" && (
              <Button onClick={() => {
                updatePolicyMutation.mutate({ id: selectedPolicy.id, status: "active" });
                setShowDetailDialog(false);
              }}>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </Button>
            )}
            {selectedPolicy?.status === "active" && (
              <Button variant="secondary" onClick={() => {
                updatePolicyMutation.mutate({ id: selectedPolicy.id, status: "paused" });
                setShowDetailDialog(false);
              }}>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Policy</DialogTitle>
            <DialogDescription>Define a new policy with rules for the platform</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input
                  placeholder="e.g., Ride Cancellation Policy"
                  value={newPolicy.name}
                  onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                  data-testid="input-policy-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Policy Type</Label>
                <Select value={newPolicy.type} onValueChange={(v) => setNewPolicy({ ...newPolicy, type: v })}>
                  <SelectTrigger data-testid="select-policy-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={newPolicy.effectiveFrom}
                  onChange={(e) => setNewPolicy({ ...newPolicy, effectiveFrom: e.target.value })}
                  data-testid="input-effective-date"
                />
              </div>

              <div className="space-y-2">
                <Label>Rules ({newPolicy.rules.length})</Label>
                <div className="space-y-2">
                  {newPolicy.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="outline">P{rule.priority}</Badge>
                      <span className="text-sm font-mono flex-1 truncate">{rule.condition}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeRule(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Card>
                  <CardContent className="p-3 space-y-2">
                    <Input
                      placeholder="Condition (e.g., cancellation_time < 2min)"
                      value={newRule.condition}
                      onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                      data-testid="input-rule-condition"
                    />
                    <div className="flex gap-2">
                      <Select value={newRule.action} onValueChange={(v) => setNewRule({ ...newRule, action: v })}>
                        <SelectTrigger className="flex-1" data-testid="select-rule-action">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_fee">No Fee</SelectItem>
                          <SelectItem value="reduced_fee">Reduced Fee</SelectItem>
                          <SelectItem value="full_fee">Full Fee</SelectItem>
                          <SelectItem value="full_refund">Full Refund</SelectItem>
                          <SelectItem value="partial_refund">Partial Refund</SelectItem>
                          <SelectItem value="no_refund">No Refund</SelectItem>
                          <SelectItem value="warning">Issue Warning</SelectItem>
                          <SelectItem value="suspend">Suspend Account</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={addRule} disabled={!newRule.condition || !newRule.action}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createPolicyMutation.mutate(newPolicy)}
              disabled={createPolicyMutation.isPending || !newPolicy.name || newPolicy.rules.length === 0}
              data-testid="button-submit-policy"
            >
              {createPolicyMutation.isPending ? "Creating..." : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PolicyList({ policies, isLoading, onSelect, onUpdateStatus }: { 
  policies: Policy[]; 
  isLoading: boolean; 
  onSelect: (p: Policy) => void;
  onUpdateStatus: (data: { id: string; status?: string }) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No policies found</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "paused": return <Badge className="bg-yellow-500">Paused</Badge>;
      case "deprecated": return <Badge variant="destructive">Deprecated</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {policies.map((policy) => {
              const TypeIcon = POLICY_TYPES.find(pt => pt.value === policy.type)?.icon || Shield;
              return (
                <Card key={policy.id} className="hover-elevate cursor-pointer" onClick={() => onSelect(policy)} data-testid={`card-policy-${policy.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-full bg-muted">
                          <TypeIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{policy.policyCode}</span>
                            {getStatusBadge(policy.status)}
                            <Badge variant="outline">v{policy.version}</Badge>
                          </div>
                          <h3 className="font-medium">{policy.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {policy.rules.length} rules | Type: {policy.type}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSelect(policy); }}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
