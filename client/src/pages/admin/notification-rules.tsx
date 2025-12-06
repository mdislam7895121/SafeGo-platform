import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Bell,
  Plus,
  Settings,
  Mail,
  Smartphone,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Condition {
  field: string;
  operator: string;
  value: any;
}

interface Action {
  type: "email" | "push" | "sms";
  recipients: string[];
  template: string;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: { type: string; severity?: string; amountThreshold?: number; schedule?: string };
  conditions: Condition[];
  actions: Action[];
  escalation?: { enabled: boolean; timeout?: number; escalateTo?: string[] };
  createdAt: string;
  updatedAt: string;
}

interface RulesResponse {
  rules: Rule[];
  templates: { email: string[]; push: string[]; sms: string[] };
  summary: { total: number; active: number; withEscalation: number };
}

export default function NotificationRules() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    triggerType: "incident",
    triggerSeverity: "high",
    conditionField: "severity",
    conditionOperator: "equals",
    conditionValue: "",
    actionType: "email" as "email" | "push" | "sms",
    actionRecipients: "",
    actionTemplate: "",
    escalationEnabled: false,
    escalationTimeout: 15,
    escalateTo: "",
  });

  const { data, isLoading } = useQuery<RulesResponse>({
    queryKey: ["/api/admin/phase4/notification-rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      return apiRequest("/api/admin/phase4/notification-rules", {
        method: "POST",
        body: JSON.stringify(ruleData),
      });
    },
    onSuccess: () => {
      toast({ title: "Rule created successfully" });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/notification-rules"),
      });
      closeCreateDialog();
    },
    onError: () => {
      toast({ title: "Failed to create rule", variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/admin/phase4/notification-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      toast({ title: "Rule updated successfully" });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/notification-rules"),
      });
    },
    onError: () => {
      toast({ title: "Failed to update rule", variant: "destructive" });
    },
  });

  const closeCreateDialog = () => {
    setShowCreateDialog(false);
    setNewRule({
      name: "",
      description: "",
      triggerType: "incident",
      triggerSeverity: "high",
      conditionField: "severity",
      conditionOperator: "equals",
      conditionValue: "",
      actionType: "email",
      actionRecipients: "",
      actionTemplate: "",
      escalationEnabled: false,
      escalationTimeout: 15,
      escalateTo: "",
    });
  };

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.description) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const ruleData = {
      name: newRule.name,
      description: newRule.description,
      trigger: {
        type: newRule.triggerType,
        severity: newRule.triggerSeverity || undefined,
      },
      conditions: [
        {
          field: newRule.conditionField,
          operator: newRule.conditionOperator,
          value: newRule.conditionValue,
        },
      ],
      actions: [
        {
          type: newRule.actionType,
          recipients: newRule.actionRecipients.split(",").map((r) => r.trim()),
          template: newRule.actionTemplate,
        },
      ],
      escalation: newRule.escalationEnabled
        ? {
            enabled: true,
            timeout: newRule.escalationTimeout,
            escalateTo: newRule.escalateTo.split(",").map((r) => r.trim()),
          }
        : { enabled: false },
    };

    createRuleMutation.mutate(ruleData);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "push":
        return <Smartphone className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-rule"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Rule
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Notification Rules Engine</h1>
              <p className="text-[11px] text-muted-foreground">Configure automated notification triggers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card data-testid="metric-total-rules">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Bell className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold" data-testid="value-total-rules">{data?.summary?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-active-rules">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500" data-testid="value-active-rules">{data?.summary?.active || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="metric-escalation-rules">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <ArrowUpRight className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500" data-testid="value-escalation-rules">{data?.summary?.withEscalation || 0}</p>
                <p className="text-xs text-muted-foreground">With Escalation</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notification Rules</CardTitle>
            <CardDescription>Manage automated notification triggers and escalations</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {data?.rules?.map((rule) => (
                  <Card key={rule.id} className="hover-elevate" data-testid={`card-rule-${rule.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</h3>
                            <Badge variant={rule.isActive ? "default" : "secondary"} data-testid={`badge-rule-status-${rule.id}`}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {rule.escalation?.enabled && (
                              <Badge variant="outline" className="border-orange-500 text-orange-500" data-testid={`badge-escalation-${rule.id}`}>
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                Escalation
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>

                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="outline" className="text-xs" data-testid={`badge-trigger-${rule.id}`}>
                              <Zap className="h-3 w-3 mr-1" />
                              Trigger: {rule.trigger.type}
                            </Badge>
                            {rule.actions.map((action, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs" data-testid={`badge-action-${rule.id}-${idx}`}>
                                {getActionIcon(action.type)}
                                <span className="ml-1">{action.type}</span>
                              </Badge>
                            ))}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Updated {format(new Date(rule.updatedAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                            data-testid={`switch-rule-${rule.id}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Notification Rule</DialogTitle>
            <DialogDescription>Configure a new automated notification rule</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 p-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Rule Name *</Label>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Critical Incident Alert"
                    data-testid="input-rule-name"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Describe when this rule triggers..."
                    data-testid="input-rule-description"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Trigger</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Trigger Type</Label>
                    <Select value={newRule.triggerType} onValueChange={(v) => setNewRule({ ...newRule, triggerType: v })}>
                      <SelectTrigger data-testid="select-trigger-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incident">Incident</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="violation">Violation</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select value={newRule.triggerSeverity} onValueChange={(v) => setNewRule({ ...newRule, triggerSeverity: v })}>
                      <SelectTrigger data-testid="select-trigger-severity">
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
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Actions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Action Type</Label>
                    <Select value={newRule.actionType} onValueChange={(v: "email" | "push" | "sms") => setNewRule({ ...newRule, actionType: v })}>
                      <SelectTrigger data-testid="select-action-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="push">Push Notification</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template</Label>
                    <Select value={newRule.actionTemplate} onValueChange={(v) => setNewRule({ ...newRule, actionTemplate: v })}>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.templates?.[newRule.actionType]?.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Recipients (comma-separated)</Label>
                    <Input
                      value={newRule.actionRecipients}
                      onChange={(e) => setNewRule({ ...newRule, actionRecipients: e.target.value })}
                      placeholder="e.g., super_admin, country_admin"
                      data-testid="input-recipients"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Escalation</h4>
                  <Switch
                    checked={newRule.escalationEnabled}
                    onCheckedChange={(checked) => setNewRule({ ...newRule, escalationEnabled: checked })}
                    data-testid="switch-escalation"
                  />
                </div>
                {newRule.escalationEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Timeout (minutes)</Label>
                      <Input
                        type="number"
                        value={newRule.escalationTimeout}
                        onChange={(e) => setNewRule({ ...newRule, escalationTimeout: parseInt(e.target.value) })}
                        data-testid="input-timeout"
                      />
                    </div>
                    <div>
                      <Label>Escalate To (comma-separated)</Label>
                      <Input
                        value={newRule.escalateTo}
                        onChange={(e) => setNewRule({ ...newRule, escalateTo: e.target.value })}
                        placeholder="e.g., ceo, legal"
                        data-testid="input-escalate-to"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleCreateRule} disabled={createRuleMutation.isPending} data-testid="button-submit">
              {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
