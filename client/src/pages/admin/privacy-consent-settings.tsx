/**
 * Privacy & Consent Settings Admin Page
 * 
 * Manage privacy policies, consent logs, and data requests.
 * 
 * Features:
 * - View and manage policy versions
 * - Activate/deactivate policies
 * - View consent logs
 * - Manage data deletion/export requests
 * - Configure data retention settings
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Shield,
  FileText,
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
  RefreshCw,
  Settings,
  Download,
  Trash2,
  Eye,
  History,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

interface PolicyVersion {
  id: string;
  version: string;
  title: string;
  contentUrl: string;
  summary: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface ConsentLog {
  id: string;
  userId: string;
  userRole: string;
  consentType: string;
  value: boolean;
  policyVersion: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  source: string | null;
  createdAt: string;
}

interface DataRequest {
  id: string;
  userId: string;
  userRole: string;
  requestType: string;
  status: string;
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  notes: string | null;
}

interface RetentionConfig {
  id: string;
  configKey: string;
  configValue: string;
  description: string | null;
  updatedAt: string;
  updatedByAdminId: string | null;
}

interface PrivacyStats {
  totalPolicies: number;
  activePolicyVersion: string | null;
  dataRequests: {
    pending: number;
    processing: number;
    completed: number;
  };
  recentConsentChanges: number;
}

export default function PrivacyConsentSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("policies");
  const [createPolicyDialogOpen, setCreatePolicyDialogOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ version: "", title: "", contentUrl: "", summary: "" });
  const [updateRequestDialogOpen, setUpdateRequestDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);
  const [requestStatus, setRequestStatus] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [requestFilter, setRequestFilter] = useState<string>("all");

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: PrivacyStats }>({
    queryKey: ["/api/privacy/stats"],
    queryFn: async () => {
      const response = await fetch("/api/privacy/stats", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: policiesData, isLoading: policiesLoading, refetch: refetchPolicies } = useQuery<{ success: boolean; policies: PolicyVersion[] }>({
    queryKey: ["/api/privacy/policies"],
    queryFn: async () => {
      const response = await fetch("/api/privacy/policies", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch policies");
      return response.json();
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{ success: boolean; logs: ConsentLog[]; pagination: any }>({
    queryKey: ["/api/privacy/consent-logs"],
    queryFn: async () => {
      const response = await fetch("/api/privacy/consent-logs?limit=50", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch consent logs");
      return response.json();
    },
  });

  const { data: requestsData, isLoading: requestsLoading, refetch: refetchRequests } = useQuery<{ success: boolean; requests: DataRequest[]; pagination: any }>({
    queryKey: ["/api/privacy/data-requests", requestFilter],
    queryFn: async () => {
      const url = requestFilter === "all" 
        ? "/api/privacy/data-requests?limit=50" 
        : `/api/privacy/data-requests?status=${requestFilter}&limit=50`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch data requests");
      return response.json();
    },
  });

  const { data: retentionData, isLoading: retentionLoading } = useQuery<{ success: boolean; configs: RetentionConfig[] }>({
    queryKey: ["/api/privacy/retention-config"],
    queryFn: async () => {
      const response = await fetch("/api/privacy/retention-config", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch retention config");
      return response.json();
    },
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (data: typeof newPolicy) => {
      return apiRequest("/api/privacy/policies", { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => {
      toast({ title: "Policy Created", description: "New policy version has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/stats"] });
      setCreatePolicyDialogOpen(false);
      setNewPolicy({ version: "", title: "", contentUrl: "", summary: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create policy", variant: "destructive" });
    },
  });

  const activatePolicyMutation = useMutation({
    mutationFn: async (policyId: string) => {
      return apiRequest(`/api/privacy/policies/${policyId}/activate`, { method: "PATCH" });
    },
    onSuccess: () => {
      toast({ title: "Policy Activated", description: "Policy is now active. All users must accept the new policy." });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to activate policy", variant: "destructive" });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      return apiRequest(`/api/privacy/data-requests/${id}`, { 
        method: "PATCH", 
        body: JSON.stringify({ status, rejectionReason }), 
        headers: { "Content-Type": "application/json" } 
      });
    },
    onSuccess: () => {
      toast({ title: "Request Updated", description: "Data request status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/data-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/stats"] });
      setUpdateRequestDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update request", variant: "destructive" });
    },
  });

  const seedRetentionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/privacy/retention-config/seed", { method: "POST" });
    },
    onSuccess: () => {
      toast({ title: "Retention Config Seeded", description: "Default retention configuration has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/retention-config"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to seed retention config", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConsentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      terms: "bg-blue-500/10 text-blue-600",
      privacy: "bg-purple-500/10 text-purple-600",
      marketing: "bg-orange-500/10 text-orange-600",
      tracking: "bg-cyan-500/10 text-cyan-600",
      data_sharing: "bg-green-500/10 text-green-600",
      location: "bg-pink-500/10 text-pink-600",
    };
    return <Badge variant="outline" className={colors[type] || "bg-gray-500/10 text-gray-600"}>{type.replace("_", " ")}</Badge>;
  };

  const stats = statsData?.stats;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Privacy & Consent Settings
          </h1>
          <p className="text-muted-foreground">Manage privacy policies, consent logs, and data requests</p>
        </div>
        <Link href="/admin/privacy-policy-preview">
          <Button variant="outline" className="gap-2" data-testid="button-preview-policy">
            <Eye className="h-4 w-4" />
            Preview as User
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-active-policy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Policy</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-active-policy">{stats?.activePolicyVersion || "None"}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-pending-requests">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-requests">{stats?.dataRequests.pending || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-processing-requests">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-blue-600" data-testid="text-processing-requests">{stats?.dataRequests.processing || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-consent-changes">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Consent Changes</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-consent-changes">{stats?.recentConsentChanges || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="policies" data-testid="tab-policies">
            <FileText className="h-4 w-4 mr-2" /> Policies
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">
            <Download className="h-4 w-4 mr-2" /> Data Requests
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <History className="h-4 w-4 mr-2" /> Consent Logs
          </TabsTrigger>
          <TabsTrigger value="retention" data-testid="tab-retention">
            <Settings className="h-4 w-4 mr-2" /> Retention
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Policy Versions</CardTitle>
                <CardDescription>Manage privacy policy versions. Only one can be active at a time.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchPolicies()} data-testid="button-refresh-policies">
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
                <Button size="sm" onClick={() => setCreatePolicyDialogOpen(true)} data-testid="button-create-policy">
                  <Plus className="h-4 w-4 mr-2" /> New Version
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {policiesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !policiesData?.policies?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No policy versions found. Create one to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policiesData.policies.map((policy) => (
                      <TableRow key={policy.id} data-testid={`row-policy-${policy.id}`}>
                        <TableCell className="font-mono font-medium">{policy.version}</TableCell>
                        <TableCell>{policy.title}</TableCell>
                        <TableCell className="max-w-xs truncate">{policy.summary || "-"}</TableCell>
                        <TableCell>
                          {policy.isActive ? (
                            <Badge className="bg-green-500/10 text-green-600"><Check className="h-3 w-3 mr-1" /> Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>{new Date(policy.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" asChild data-testid={`button-view-policy-${policy.id}`}>
                              <a href={policy.contentUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            {!policy.isActive && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => activatePolicyMutation.mutate(policy.id)}
                                disabled={activatePolicyMutation.isPending}
                                data-testid={`button-activate-${policy.id}`}
                              >
                                Activate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Data Requests</CardTitle>
                <CardDescription>Manage user data deletion and export requests</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={requestFilter} onValueChange={setRequestFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-request-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => refetchRequests()} data-testid="button-refresh-requests">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !requestsData?.requests?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No data requests found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsData.requests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell className="font-mono text-xs">{request.userId.slice(0, 8)}...</TableCell>
                        <TableCell><Badge variant="outline">{request.userRole}</Badge></TableCell>
                        <TableCell>
                          {request.requestType === "delete" ? (
                            <Badge className="bg-red-500/10 text-red-600"><Trash2 className="h-3 w-3 mr-1" /> Delete</Badge>
                          ) : (
                            <Badge className="bg-blue-500/10 text-blue-600"><Download className="h-3 w-3 mr-1" /> Export</Badge>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{new Date(request.requestedAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {(request.status === "pending" || request.status === "processing") && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setRequestStatus(request.status);
                                setRejectionReason("");
                                setUpdateRequestDialogOpen(true);
                              }}
                              data-testid={`button-update-${request.id}`}
                            >
                              Update
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consent Logs</CardTitle>
              <CardDescription>Audit trail of all consent changes by users</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !logsData?.logs?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No consent logs found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Consent Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Policy Version</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData.logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="font-mono text-xs">{log.userId.slice(0, 8)}...</TableCell>
                        <TableCell><Badge variant="outline">{log.userRole}</Badge></TableCell>
                        <TableCell>{getConsentTypeBadge(log.consentType)}</TableCell>
                        <TableCell>
                          {log.value ? (
                            <Badge className="bg-green-500/10 text-green-600"><Check className="h-3 w-3" /></Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-600"><X className="h-3 w-3" /></Badge>
                          )}
                        </TableCell>
                        <TableCell>{log.policyVersion || "-"}</TableCell>
                        <TableCell>{log.source || "-"}</TableCell>
                        <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Data Retention Settings</CardTitle>
                <CardDescription>Configure how long different types of data are retained</CardDescription>
              </div>
              {(!retentionData?.configs?.length) && (
                <Button 
                  size="sm" 
                  onClick={() => seedRetentionMutation.mutate()}
                  disabled={seedRetentionMutation.isPending}
                  data-testid="button-seed-retention"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {seedRetentionMutation.isPending ? "Seeding..." : "Seed Defaults"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {retentionLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !retentionData?.configs?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No retention configuration found. Click "Seed Defaults" to create default settings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setting</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retentionData.configs.map((config) => (
                      <TableRow key={config.id} data-testid={`row-config-${config.id}`}>
                        <TableCell className="font-mono text-sm">{config.configKey}</TableCell>
                        <TableCell className="font-bold">{config.configValue}</TableCell>
                        <TableCell className="text-muted-foreground">{config.description || "-"}</TableCell>
                        <TableCell>{new Date(config.updatedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createPolicyDialogOpen} onOpenChange={setCreatePolicyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Policy Version</DialogTitle>
            <DialogDescription>Create a new privacy policy version. Users will need to accept it when activated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input 
                id="version" 
                placeholder="v1.0.0" 
                value={newPolicy.version} 
                onChange={(e) => setNewPolicy({ ...newPolicy, version: e.target.value })}
                data-testid="input-policy-version"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input 
                id="title" 
                placeholder="Privacy Policy" 
                value={newPolicy.title} 
                onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                data-testid="input-policy-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentUrl">Content URL</Label>
              <Input 
                id="contentUrl" 
                placeholder="https://..." 
                value={newPolicy.contentUrl} 
                onChange={(e) => setNewPolicy({ ...newPolicy, contentUrl: e.target.value })}
                data-testid="input-policy-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Summary (optional)</Label>
              <Textarea 
                id="summary" 
                placeholder="Brief summary of changes..." 
                value={newPolicy.summary} 
                onChange={(e) => setNewPolicy({ ...newPolicy, summary: e.target.value })}
                data-testid="input-policy-summary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePolicyDialogOpen(false)} data-testid="button-cancel-policy">Cancel</Button>
            <Button 
              onClick={() => createPolicyMutation.mutate(newPolicy)}
              disabled={createPolicyMutation.isPending || !newPolicy.version || !newPolicy.title || !newPolicy.contentUrl}
              data-testid="button-submit-policy"
            >
              {createPolicyMutation.isPending ? "Creating..." : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={updateRequestDialogOpen} onOpenChange={setUpdateRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Data Request</DialogTitle>
            <DialogDescription>Update the status of this data {selectedRequest?.requestType} request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={requestStatus} onValueChange={setRequestStatus}>
                <SelectTrigger data-testid="select-request-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {requestStatus === "rejected" && (
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                <Textarea 
                  id="rejectionReason" 
                  placeholder="Reason for rejection..." 
                  value={rejectionReason} 
                  onChange={(e) => setRejectionReason(e.target.value)}
                  data-testid="input-rejection-reason"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateRequestDialogOpen(false)} data-testid="button-cancel-request-update">Cancel</Button>
            <Button 
              onClick={() => {
                if (selectedRequest) {
                  updateRequestMutation.mutate({ 
                    id: selectedRequest.id, 
                    status: requestStatus,
                    rejectionReason: requestStatus === "rejected" ? rejectionReason : undefined,
                  });
                }
              }}
              disabled={updateRequestMutation.isPending || !requestStatus}
              data-testid="button-submit-request-update"
            >
              {updateRequestMutation.isPending ? "Updating..." : "Update Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
