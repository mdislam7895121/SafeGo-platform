import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Mail, Plus, Search, Edit, Trash2, Eye, Copy, Send, CheckCircle, Clock, Code } from "lucide-react";
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

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  status: string;
  isDefault: boolean;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  sendCount: number;
  openRate: number;
  clickRate: number;
}

interface TemplatesResponse {
  templates: EmailTemplate[];
  categories: { name: string; count: number }[];
  stats: {
    total: number;
    active: number;
    draft: number;
    totalSent: number;
    avgOpenRate: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function EmailTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showEditorDialog, setShowEditorDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    category: "transactional",
    htmlContent: "",
    textContent: "",
    variables: [] as string[],
  });

  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ["/api/admin/phase4/email-templates", categoryFilter, statusFilter, searchQuery, currentPage],
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const method = data.id ? "PUT" : "POST";
      const url = data.id
        ? `/api/admin/phase4/email-templates/${data.id}`
        : "/api/admin/phase4/email-templates";
      return apiRequest(url, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Template saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/email-templates"] });
      setShowEditorDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to save template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/phase4/email-templates/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "Template deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/email-templates"] });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (data: { templateId: string; email: string }) => {
      return apiRequest(`/api/admin/phase4/email-templates/${data.templateId}/test`, {
        method: "POST",
        body: JSON.stringify({ email: data.email }),
      });
    },
    onSuccess: () => {
      toast({ title: "Test email sent successfully" });
      setShowTestDialog(false);
      setTestEmail("");
    },
    onError: () => {
      toast({ title: "Failed to send test email", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      category: "transactional",
      htmlContent: "",
      textContent: "",
      variables: [],
    });
    setSelectedTemplate(null);
  };

  const openEditor = (template?: EmailTemplate) => {
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        name: template.name,
        subject: template.subject,
        category: template.category,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        variables: template.variables,
      });
    } else {
      resetForm();
    }
    setShowEditorDialog(true);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "transactional":
        return <Badge className="bg-blue-500">Transactional</Badge>;
      case "marketing":
        return <Badge className="bg-green-500">Marketing</Badge>;
      case "notification":
        return <Badge className="bg-purple-500">Notification</Badge>;
      case "support":
        return <Badge className="bg-orange-500">Support</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "draft":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
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
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Email Template Editor</h1>
              <p className="text-[11px] text-muted-foreground">Create and manage email templates</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Templates</p>
                  <p className="text-2xl font-bold">{data?.stats?.total || 0}</p>
                </div>
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-500">{data?.stats?.active || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                  <p className="text-2xl font-bold">{data?.stats?.draft || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">{data?.stats?.totalSent?.toLocaleString() || 0}</p>
                </div>
                <Send className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Open Rate</p>
                  <p className="text-2xl font-bold">{data?.stats?.avgOpenRate?.toFixed(1) || 0}%</p>
                </div>
                <Eye className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
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
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => openEditor()} data-testid="button-new-template">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !data?.templates?.length ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                            <span className="font-medium text-lg">{template.name}</span>
                            {getCategoryBadge(template.category)}
                            {getStatusBadge(template.status)}
                            {template.isDefault && <Badge variant="outline">Default</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Subject: {template.subject}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Sent: {template.sendCount?.toLocaleString() || 0}</span>
                            <span>Open: {template.openRate?.toFixed(1) || 0}%</span>
                            <span>Click: {template.clickRate?.toFixed(1) || 0}%</span>
                            <span>Updated: {format(new Date(template.updatedAt), "MMM dd, yyyy")}</span>
                          </div>
                          {template.variables?.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <Code className="h-3 w-3 text-muted-foreground" />
                              <div className="flex gap-1 flex-wrap">
                                {template.variables.slice(0, 5).map((v) => (
                                  <Badge key={v} variant="outline" className="text-xs font-mono">
                                    {`{{${v}}}`}
                                  </Badge>
                                ))}
                                {template.variables.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{template.variables.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setShowPreviewDialog(true);
                            }}
                            data-testid={`button-preview-${template.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditor(template)}
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
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
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
      </div>

      <Dialog open={showEditorDialog} onOpenChange={setShowEditorDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Design your email template with HTML content and dynamic variables.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    placeholder="Welcome Email"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="select-category-form">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  placeholder="Welcome to SafeGo, {{name}}!"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  data-testid="input-subject"
                />
              </div>
              <div className="space-y-2">
                <Label>HTML Content</Label>
                <Textarea
                  placeholder="<html><body><h1>Hello {{name}}</h1>...</body></html>"
                  value={formData.htmlContent}
                  onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="textarea-html"
                />
              </div>
              <div className="space-y-2">
                <Label>Plain Text Content</Label>
                <Textarea
                  placeholder="Hello {{name}},\n\nWelcome to SafeGo..."
                  value={formData.textContent}
                  onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                  className="min-h-[100px]"
                  data-testid="textarea-text"
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Available Variables</p>
                <div className="flex gap-2 flex-wrap text-xs">
                  <Badge variant="outline" className="font-mono">{`{{name}}`}</Badge>
                  <Badge variant="outline" className="font-mono">{`{{email}}`}</Badge>
                  <Badge variant="outline" className="font-mono">{`{{phone}}`}</Badge>
                  <Badge variant="outline" className="font-mono">{`{{orderId}}`}</Badge>
                  <Badge variant="outline" className="font-mono">{`{{amount}}`}</Badge>
                  <Badge variant="outline" className="font-mono">{`{{date}}`}</Badge>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditorDialog(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => setShowPreviewDialog(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={() => saveTemplateMutation.mutate({
                ...formData,
                id: selectedTemplate?.id,
              })}
              disabled={saveTemplateMutation.isPending || !formData.name || !formData.subject}
              data-testid="button-save-template"
            >
              {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{selectedTemplate.subject}</p>
              </div>
              <Tabs defaultValue="html">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                </TabsList>
                <TabsContent value="html">
                  <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                    <div dangerouslySetInnerHTML={{ __html: selectedTemplate.htmlContent }} />
                  </div>
                </TabsContent>
                <TabsContent value="text">
                  <pre className="border rounded-lg p-4 min-h-[300px] text-sm whitespace-pre-wrap bg-muted">
                    {selectedTemplate.textContent}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email to verify the template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                data-testid="input-test-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedTemplate) {
                  sendTestMutation.mutate({ templateId: selectedTemplate.id, email: testEmail });
                }
              }}
              disabled={sendTestMutation.isPending || !testEmail}
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
