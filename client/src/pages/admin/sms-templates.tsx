import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, MessageSquare, Plus, Search, Edit, Trash2, Eye, Copy, Send, CheckCircle, Clock, Zap, Settings, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  trigger: string | null;
  variables: string[];
  status: string;
  isAutomated: boolean;
  sendCount: number;
  deliveryRate: number;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
}

interface Automation {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  trigger: string;
  conditions: Record<string, any>;
  status: string;
  lastTriggered: string | null;
  triggerCount: number;
}

interface TemplatesResponse {
  templates: SMSTemplate[];
  automations: Automation[];
  stats: {
    totalTemplates: number;
    activeTemplates: number;
    totalAutomations: number;
    activeAutomations: number;
    totalSent: number;
    avgDeliveryRate: number;
  };
}

const TRIGGERS = [
  { value: "ride_booked", label: "Ride Booked" },
  { value: "ride_started", label: "Ride Started" },
  { value: "ride_completed", label: "Ride Completed" },
  { value: "driver_assigned", label: "Driver Assigned" },
  { value: "driver_arrived", label: "Driver Arrived" },
  { value: "order_placed", label: "Food Order Placed" },
  { value: "order_delivered", label: "Order Delivered" },
  { value: "payment_received", label: "Payment Received" },
  { value: "refund_processed", label: "Refund Processed" },
  { value: "sos_triggered", label: "SOS Triggered" },
];

export default function SMSTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | null>(null);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  const [templateForm, setTemplateForm] = useState({
    name: "",
    content: "",
    category: "transactional",
    variables: [] as string[],
  });

  const [automationForm, setAutomationForm] = useState({
    name: "",
    templateId: "",
    trigger: "",
    conditions: {},
  });

  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ["/api/admin/phase4/sms-templates", categoryFilter, searchQuery],
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm & { id?: string }) => {
      const method = data.id ? "PUT" : "POST";
      const url = data.id
        ? `/api/admin/phase4/sms-templates/${data.id}`
        : "/api/admin/phase4/sms-templates";
      return apiRequest(url, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Template saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/sms-templates"] });
      setShowTemplateDialog(false);
      resetTemplateForm();
    },
    onError: () => {
      toast({ title: "Failed to save template", variant: "destructive" });
    },
  });

  const saveAutomationMutation = useMutation({
    mutationFn: async (data: typeof automationForm & { id?: string }) => {
      const method = data.id ? "PUT" : "POST";
      const url = data.id
        ? `/api/admin/phase4/sms-automations/${data.id}`
        : "/api/admin/phase4/sms-automations";
      return apiRequest(url, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Automation saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/sms-templates"] });
      setShowAutomationDialog(false);
      resetAutomationForm();
    },
    onError: () => {
      toast({ title: "Failed to save automation", variant: "destructive" });
    },
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      return apiRequest(`/api/admin/phase4/sms-automations/${data.id}/toggle`, {
        method: "POST",
        body: JSON.stringify({ status: data.status }),
      });
    },
    onSuccess: () => {
      toast({ title: "Automation status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/sms-templates"] });
    },
    onError: () => {
      toast({ title: "Failed to update automation", variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (data: { templateId: string; phone: string }) => {
      return apiRequest(`/api/admin/phase4/sms-templates/${data.templateId}/test`, {
        method: "POST",
        body: JSON.stringify({ phone: data.phone }),
      });
    },
    onSuccess: () => {
      toast({ title: "Test SMS sent successfully" });
      setShowTestDialog(false);
      setTestPhone("");
    },
    onError: () => {
      toast({ title: "Failed to send test SMS", variant: "destructive" });
    },
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      content: "",
      category: "transactional",
      variables: [],
    });
    setSelectedTemplate(null);
  };

  const resetAutomationForm = () => {
    setAutomationForm({
      name: "",
      templateId: "",
      trigger: "",
      conditions: {},
    });
    setSelectedAutomation(null);
  };

  const openTemplateEditor = (template?: SMSTemplate) => {
    if (template) {
      setSelectedTemplate(template);
      setTemplateForm({
        name: template.name,
        content: template.content,
        category: template.category,
        variables: template.variables,
      });
    } else {
      resetTemplateForm();
    }
    setShowTemplateDialog(true);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "transactional":
        return <Badge className="bg-blue-500">Transactional</Badge>;
      case "marketing":
        return <Badge className="bg-green-500">Marketing</Badge>;
      case "notification":
        return <Badge className="bg-purple-500">Notification</Badge>;
      case "verification":
        return <Badge className="bg-orange-500">Verification</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const charCount = templateForm.content.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

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
            <h1 className="text-2xl font-bold">SMS Template & Automation Engine</h1>
            <p className="text-sm opacity-90">Create SMS templates and automated workflows</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <MessageSquare className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{data?.stats?.totalTemplates || 0}</p>
                <p className="text-xs text-muted-foreground">Templates</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold">{data?.stats?.activeTemplates || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Zap className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
                <p className="text-xl font-bold">{data?.stats?.totalAutomations || 0}</p>
                <p className="text-xs text-muted-foreground">Automations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Play className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold">{data?.stats?.activeAutomations || 0}</p>
                <p className="text-xs text-muted-foreground">Running</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Send className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <p className="text-xl font-bold">{data?.stats?.totalSent?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold">{data?.stats?.avgDeliveryRate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">Delivery</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
            </TabsList>
            {activeTab === "templates" ? (
              <Button onClick={() => openTemplateEditor()} data-testid="button-new-template">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            ) : (
              <Button onClick={() => setShowAutomationDialog(true)} data-testid="button-new-automation">
                <Plus className="h-4 w-4 mr-2" />
                New Automation
              </Button>
            )}
          </div>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <div className="flex gap-4">
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-search"
                  />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="verification">Verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !data?.templates?.length ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No templates found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.templates.map((template) => (
                      <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{template.name}</span>
                                {getCategoryBadge(template.category)}
                                <Badge variant={template.status === "active" ? "default" : "secondary"}>
                                  {template.status}
                                </Badge>
                                {template.isAutomated && (
                                  <Badge variant="outline" className="bg-yellow-100">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Automated
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {template.content}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Sent: {template.sendCount?.toLocaleString() || 0}</span>
                                <span>Delivery: {template.deliveryRate?.toFixed(1) || 0}%</span>
                                <span>{template.content.length} chars ({Math.ceil(template.content.length / 160)} segments)</span>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-4">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openTemplateEditor(template)}
                                data-testid={`button-edit-${template.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setShowTestDialog(true);
                                }}
                                data-testid={`button-test-${template.id}`}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-copy-${template.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-delete-${template.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automations">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !data?.automations?.length ? (
                  <div className="text-center py-12">
                    <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No automations found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.automations.map((automation) => (
                      <Card key={automation.id} className="hover-elevate" data-testid={`card-automation-${automation.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <Zap className={`h-5 w-5 ${automation.status === "active" ? "text-yellow-500" : "text-gray-400"}`} />
                                <span className="font-medium">{automation.name}</span>
                                <Badge variant={automation.status === "active" ? "default" : "secondary"}>
                                  {automation.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Trigger: <span className="font-medium">{automation.trigger}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Template: {automation.templateName}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Triggered: {automation.triggerCount} times</span>
                                {automation.lastTriggered && (
                                  <span>Last: {format(new Date(automation.lastTriggered), "MMM dd, HH:mm")}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Switch
                                checked={automation.status === "active"}
                                onCheckedChange={(checked) =>
                                  toggleAutomationMutation.mutate({
                                    id: automation.id,
                                    status: checked ? "active" : "paused",
                                  })
                                }
                                data-testid={`switch-automation-${automation.id}`}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-edit-automation-${automation.id}`}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-delete-automation-${automation.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? "Edit SMS Template" : "Create SMS Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="Ride Confirmation"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={templateForm.category}
                onValueChange={(v) => setTemplateForm({ ...templateForm, category: v })}
              >
                <SelectTrigger data-testid="select-category-form">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                  <SelectItem value="verification">Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message Content</Label>
                <span className={`text-xs ${charCount > 160 ? "text-yellow-500" : "text-muted-foreground"}`}>
                  {charCount}/160 ({smsSegments} segment{smsSegments > 1 ? "s" : ""})
                </span>
              </div>
              <Textarea
                placeholder="Your SafeGo ride with {{driverName}} is confirmed. ETA: {{eta}} minutes."
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                className="min-h-[100px]"
                data-testid="textarea-content"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Available Variables</p>
              <div className="flex gap-2 flex-wrap text-xs">
                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => setTemplateForm({ ...templateForm, content: templateForm.content + "{{name}}" })}>{`{{name}}`}</Badge>
                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => setTemplateForm({ ...templateForm, content: templateForm.content + "{{driverName}}" })}>{`{{driverName}}`}</Badge>
                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => setTemplateForm({ ...templateForm, content: templateForm.content + "{{eta}}" })}>{`{{eta}}`}</Badge>
                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => setTemplateForm({ ...templateForm, content: templateForm.content + "{{orderId}}" })}>{`{{orderId}}`}</Badge>
                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => setTemplateForm({ ...templateForm, content: templateForm.content + "{{otp}}" })}>{`{{otp}}`}</Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => saveTemplateMutation.mutate({
                ...templateForm,
                id: selectedTemplate?.id,
              })}
              disabled={saveTemplateMutation.isPending || !templateForm.name || !templateForm.content}
              data-testid="button-save-template"
            >
              {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAutomationDialog} onOpenChange={setShowAutomationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SMS Automation</DialogTitle>
            <DialogDescription>
              Set up automatic SMS sending based on platform events.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Automation Name</Label>
              <Input
                placeholder="Ride Confirmation SMS"
                value={automationForm.name}
                onChange={(e) => setAutomationForm({ ...automationForm, name: e.target.value })}
                data-testid="input-automation-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger Event</Label>
              <Select
                value={automationForm.trigger}
                onValueChange={(v) => setAutomationForm({ ...automationForm, trigger: v })}
              >
                <SelectTrigger data-testid="select-trigger">
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SMS Template</Label>
              <Select
                value={automationForm.templateId}
                onValueChange={(v) => setAutomationForm({ ...automationForm, templateId: v })}
              >
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {data?.templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomationDialog(false)}>Cancel</Button>
            <Button
              onClick={() => saveAutomationMutation.mutate(automationForm)}
              disabled={saveAutomationMutation.isPending || !automationForm.name || !automationForm.trigger || !automationForm.templateId}
              data-testid="button-save-automation"
            >
              {saveAutomationMutation.isPending ? "Saving..." : "Create Automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1234567890"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                data-testid="input-test-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedTemplate) {
                  sendTestMutation.mutate({ templateId: selectedTemplate.id, phone: testPhone });
                }
              }}
              disabled={sendTestMutation.isPending || !testPhone}
              data-testid="button-send-test"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendTestMutation.isPending ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
