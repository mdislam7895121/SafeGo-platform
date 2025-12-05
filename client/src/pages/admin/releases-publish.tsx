import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Plus, 
  Server, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ArrowRight,
  RotateCcw,
  FileText,
  History,
  Shield,
  ChevronRight,
  Loader2,
  ExternalLink,
  User,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

type ReleaseEnvironment = "DEV" | "STAGING" | "PROD";
type DeploymentStatus = "NOT_DEPLOYED" | "DEPLOYED" | "VERIFIED" | "ROLLED_BACK";
type ChecklistStatus = "PENDING" | "PASSED" | "FAILED";
type ApprovalStatus = "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface EnvironmentStatus {
  id: string;
  releaseId: string;
  environment: ReleaseEnvironment;
  deploymentStatus: DeploymentStatus;
  checklistStatus: ChecklistStatus;
  approvalStatus: ApprovalStatus;
  proposedByAdminId?: string;
  proposedByAdminName?: string;
  proposedAt?: string;
  approvedByAdminId?: string;
  approvedByAdminName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  deployedAt?: string;
  verifiedAt?: string;
  rolledBackAt?: string;
  hasBlockingIssues: boolean;
  blockingIssues: string[];
}

interface ChecklistItem {
  id: string;
  releaseId: string;
  environment: ReleaseEnvironment;
  itemKey: string;
  itemLabel: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  isCompleted: boolean;
  completedAt?: string;
  completedByAdminId?: string;
  completedByAdminName?: string;
  notes?: string;
  evidenceUrl?: string;
}

interface AuditLog {
  id: string;
  releaseId: string;
  environment?: ReleaseEnvironment;
  action: string;
  oldValue?: string;
  newValue?: string;
  adminId: string;
  adminName?: string;
  comment?: string;
  createdAt: string;
}

interface Release {
  id: string;
  versionTag: string;
  description?: string;
  releaseNotes?: string;
  includedPhases: string[];
  createdByAdminId: string;
  createdByAdminName?: string;
  createdAt: string;
  updatedAt: string;
  environmentStatuses: EnvironmentStatus[];
  checklistItems: ChecklistItem[];
  auditLogs?: AuditLog[];
}

function getStatusBadge(status: DeploymentStatus) {
  switch (status) {
    case "VERIFIED":
      return <Badge variant="default" className="bg-green-600" data-testid="badge-verified"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
    case "DEPLOYED":
      return <Badge variant="secondary" data-testid="badge-deployed"><Server className="w-3 h-3 mr-1" />Deployed</Badge>;
    case "ROLLED_BACK":
      return <Badge variant="destructive" data-testid="badge-rolled-back"><RotateCcw className="w-3 h-3 mr-1" />Rolled Back</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-not-deployed"><Clock className="w-3 h-3 mr-1" />Not Deployed</Badge>;
  }
}

function getChecklistBadge(status: ChecklistStatus) {
  switch (status) {
    case "PASSED":
      return <Badge variant="default" className="bg-green-600" data-testid="badge-checklist-passed"><CheckCircle2 className="w-3 h-3 mr-1" />Passed</Badge>;
    case "FAILED":
      return <Badge variant="destructive" data-testid="badge-checklist-failed"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-checklist-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  }
}

function getApprovalBadge(status: ApprovalStatus) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="default" className="bg-green-600" data-testid="badge-approved"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive" data-testid="badge-rejected"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    case "PENDING_APPROVAL":
      return <Badge variant="secondary" className="bg-yellow-500 text-black" data-testid="badge-pending-approval"><Clock className="w-3 h-3 mr-1" />Pending Approval</Badge>;
    default:
      return null;
  }
}

function getEnvColor(env: ReleaseEnvironment) {
  switch (env) {
    case "DEV": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "STAGING": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "PROD": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  }
}

export default function ReleasesPublishPage() {
  const { toast } = useToast();
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<ReleaseEnvironment>("DEV");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReleaseNotes, setNewReleaseNotes] = useState("");

  const { data: releasesData, isLoading } = useQuery<{ releases: Release[]; total: number }>({
    queryKey: ["/api/admin/releases"],
  });

  const { data: releaseDetail } = useQuery<Release>({
    queryKey: ["/api/admin/releases", selectedRelease?.id],
    enabled: !!selectedRelease?.id,
  });

  const createReleaseMutation = useMutation({
    mutationFn: async (data: { versionTag: string; description?: string; releaseNotes?: string }) => {
      return apiRequest("/api/admin/releases", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/releases"] });
      setCreateDialogOpen(false);
      setNewVersion("");
      setNewDescription("");
      setNewReleaseNotes("");
      toast({ title: "Release created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating release", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { releaseId: string; environment: ReleaseEnvironment; deploymentStatus: DeploymentStatus }) => {
      return apiRequest(`/api/admin/releases/${data.releaseId}/status`, {
        method: "POST",
        body: JSON.stringify({ environment: data.environment, deploymentStatus: data.deploymentStatus }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/releases"] });
      if (selectedRelease) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/releases", selectedRelease.id] });
      }
      toast({ title: "Status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const proposePromotionMutation = useMutation({
    mutationFn: async (data: { releaseId: string; environment: ReleaseEnvironment }) => {
      return apiRequest(`/api/admin/releases/${data.releaseId}/propose-promotion`, {
        method: "POST",
        body: JSON.stringify({ environment: data.environment }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/releases"] });
      if (selectedRelease) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/releases", selectedRelease.id] });
      }
      toast({ title: "Promotion proposed successfully", description: "Waiting for another admin to approve" });
    },
    onError: (error: any) => {
      toast({ title: "Error proposing promotion", description: error.message, variant: "destructive" });
    },
  });

  const approvePromotionMutation = useMutation({
    mutationFn: async (data: { releaseId: string; environment: ReleaseEnvironment; approved: boolean; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/releases/${data.releaseId}/approve-promotion`, {
        method: "POST",
        body: JSON.stringify({ environment: data.environment, approved: data.approved, rejectionReason: data.rejectionReason }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/releases"] });
      if (selectedRelease) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/releases", selectedRelease.id] });
      }
      toast({ title: variables.approved ? "Promotion approved" : "Promotion rejected" });
    },
    onError: (error: any) => {
      toast({ title: "Error processing approval", description: error.message, variant: "destructive" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async (data: { releaseId: string; environment: ReleaseEnvironment; itemKey: string; isCompleted: boolean; notes?: string }) => {
      return apiRequest(`/api/admin/releases/${data.releaseId}/checklist`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/releases"] });
      if (selectedRelease) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/releases", selectedRelease.id] });
      }
      toast({ title: "Checklist updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating checklist", description: error.message, variant: "destructive" });
    },
  });

  const releases = releasesData?.releases || [];
  const currentRelease = releaseDetail || selectedRelease;
  const currentEnvStatus = currentRelease?.environmentStatuses?.find(s => s.environment === selectedEnv);
  const currentChecklistItems = currentRelease?.checklistItems?.filter(i => i.environment === selectedEnv) || [];

  return (
    <div className="flex flex-col h-full" data-testid="releases-publish-page">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Package className="w-6 h-6" />
            Releases & Publish
          </h1>
          <p className="text-muted-foreground mt-1">Manage release versions and environment promotions</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-release"><Plus className="w-4 h-4 mr-2" />New Release</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Release</DialogTitle>
              <DialogDescription>Create a new release version to track through environments</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version Tag</Label>
                <Input
                  id="version"
                  placeholder="v1.0.0 or 1.0.0-beta"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  data-testid="input-version"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this release"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  data-testid="input-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="releaseNotes">Release Notes</Label>
                <Textarea
                  id="releaseNotes"
                  placeholder="Detailed release notes..."
                  value={newReleaseNotes}
                  onChange={(e) => setNewReleaseNotes(e.target.value)}
                  rows={4}
                  data-testid="input-release-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">Cancel</Button>
              <Button 
                onClick={() => createReleaseMutation.mutate({ 
                  versionTag: newVersion, 
                  description: newDescription || undefined, 
                  releaseNotes: newReleaseNotes || undefined 
                })}
                disabled={!newVersion || createReleaseMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createReleaseMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Release
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r overflow-auto p-4">
          <h2 className="font-semibold mb-4">All Releases</h2>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : releases.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No releases yet</p>
              <p className="text-sm">Create your first release to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {releases.map((release) => (
                <Card 
                  key={release.id} 
                  className={`cursor-pointer transition-colors hover-elevate ${selectedRelease?.id === release.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedRelease(release)}
                  data-testid={`card-release-${release.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-semibold" data-testid={`text-version-${release.id}`}>{release.versionTag}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {release.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{release.description}</p>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {release.environmentStatuses.map((status) => (
                        <Badge 
                          key={status.environment} 
                          variant="outline" 
                          className={`text-xs ${getEnvColor(status.environment)}`}
                          data-testid={`badge-env-status-${release.id}-${status.environment}`}
                        >
                          {status.environment}: {status.deploymentStatus === 'VERIFIED' ? '✓' : status.deploymentStatus === 'DEPLOYED' ? '●' : '○'}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!currentRelease ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a release to view details</p>
                <p className="text-sm">Or create a new release to get started</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-release-title">
                    <Package className="w-5 h-5" />
                    {currentRelease.versionTag}
                  </h2>
                  {currentRelease.description && (
                    <p className="text-muted-foreground mt-1">{currentRelease.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {currentRelease.createdByAdminName || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(currentRelease.createdAt), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                </div>
              </div>

              <Tabs value={selectedEnv} onValueChange={(v) => setSelectedEnv(v as ReleaseEnvironment)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="DEV" className="flex items-center gap-2" data-testid="tab-dev">
                    <Server className="w-4 h-4" />
                    Development
                  </TabsTrigger>
                  <TabsTrigger value="STAGING" className="flex items-center gap-2" data-testid="tab-staging">
                    <Server className="w-4 h-4" />
                    Staging
                  </TabsTrigger>
                  <TabsTrigger value="PROD" className="flex items-center gap-2" data-testid="tab-prod">
                    <Shield className="w-4 h-4" />
                    Production
                  </TabsTrigger>
                </TabsList>

                {['DEV', 'STAGING', 'PROD'].map((env) => (
                  <TabsContent key={env} value={env} className="space-y-4">
                    {currentEnvStatus && selectedEnv === env && (
                      <>
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  Environment Status
                                  <Badge className={getEnvColor(env as ReleaseEnvironment)}>{env}</Badge>
                                </CardTitle>
                                <CardDescription>Current deployment and checklist status</CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(currentEnvStatus.deploymentStatus)}
                                {getChecklistBadge(currentEnvStatus.checklistStatus)}
                                {getApprovalBadge(currentEnvStatus.approvalStatus)}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {currentEnvStatus.hasBlockingIssues && (
                              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Blocking Issues
                                </div>
                                <ul className="list-disc list-inside text-sm text-destructive">
                                  {currentEnvStatus.blockingIssues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {currentEnvStatus.approvalStatus === 'PENDING_APPROVAL' && (
                              <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
                                <div className="flex items-center gap-2 font-medium mb-2">
                                  <Clock className="w-4 h-4" />
                                  Pending Approval
                                </div>
                                <p className="text-sm mb-3">
                                  Proposed by <strong>{currentEnvStatus.proposedByAdminName}</strong> on{' '}
                                  {currentEnvStatus.proposedAt && format(new Date(currentEnvStatus.proposedAt), 'MMM d, yyyy HH:mm')}
                                </p>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => approvePromotionMutation.mutate({ 
                                      releaseId: currentRelease.id, 
                                      environment: env as ReleaseEnvironment, 
                                      approved: true 
                                    })}
                                    disabled={approvePromotionMutation.isPending}
                                    data-testid="button-approve-promotion"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    onClick={() => approvePromotionMutation.mutate({ 
                                      releaseId: currentRelease.id, 
                                      environment: env as ReleaseEnvironment, 
                                      approved: false,
                                      rejectionReason: 'Rejected by admin'
                                    })}
                                    disabled={approvePromotionMutation.isPending}
                                    data-testid="button-reject-promotion"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {currentEnvStatus.deploymentStatus === 'NOT_DEPLOYED' && (
                                <Button
                                  size="sm"
                                  onClick={() => updateStatusMutation.mutate({
                                    releaseId: currentRelease.id,
                                    environment: env as ReleaseEnvironment,
                                    deploymentStatus: 'DEPLOYED'
                                  })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid="button-mark-deployed"
                                >
                                  <ArrowRight className="w-4 h-4 mr-1" />
                                  Mark Deployed to {env}
                                </Button>
                              )}
                              {currentEnvStatus.deploymentStatus === 'DEPLOYED' && (
                                <Button
                                  size="sm"
                                  onClick={() => updateStatusMutation.mutate({
                                    releaseId: currentRelease.id,
                                    environment: env as ReleaseEnvironment,
                                    deploymentStatus: 'VERIFIED'
                                  })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid="button-mark-verified"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Mark Verified in {env}
                                </Button>
                              )}
                              {(currentEnvStatus.deploymentStatus === 'DEPLOYED' || currentEnvStatus.deploymentStatus === 'VERIFIED') && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateStatusMutation.mutate({
                                    releaseId: currentRelease.id,
                                    environment: env as ReleaseEnvironment,
                                    deploymentStatus: 'ROLLED_BACK'
                                  })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid="button-rollback"
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Mark Rolled Back
                                </Button>
                              )}
                              {env === 'PROD' && currentEnvStatus.approvalStatus === 'NOT_REQUIRED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => proposePromotionMutation.mutate({
                                    releaseId: currentRelease.id,
                                    environment: 'PROD'
                                  })}
                                  disabled={proposePromotionMutation.isPending}
                                  data-testid="button-propose-production"
                                >
                                  <Shield className="w-4 h-4 mr-1" />
                                  Propose Production Promotion
                                </Button>
                              )}
                            </div>

                            {currentEnvStatus.deployedAt && (
                              <p className="text-sm text-muted-foreground mt-4">
                                Deployed: {format(new Date(currentEnvStatus.deployedAt), 'MMM d, yyyy HH:mm')}
                              </p>
                            )}
                            {currentEnvStatus.verifiedAt && (
                              <p className="text-sm text-muted-foreground">
                                Verified: {format(new Date(currentEnvStatus.verifiedAt), 'MMM d, yyyy HH:mm')}
                              </p>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="w-5 h-5" />
                              Readiness Checklist
                            </CardTitle>
                            <CardDescription>
                              Complete all required items before marking as verified
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {currentChecklistItems.map((item) => (
                                <div 
                                  key={item.id} 
                                  className="flex items-start gap-3 p-3 rounded-md border"
                                  data-testid={`checklist-item-${item.itemKey}`}
                                >
                                  <Checkbox
                                    id={item.id}
                                    checked={item.isCompleted}
                                    onCheckedChange={(checked) => {
                                      updateChecklistMutation.mutate({
                                        releaseId: currentRelease.id,
                                        environment: env as ReleaseEnvironment,
                                        itemKey: item.itemKey,
                                        isCompleted: !!checked
                                      });
                                    }}
                                    data-testid={`checkbox-${item.itemKey}`}
                                  />
                                  <div className="flex-1">
                                    <label htmlFor={item.id} className="font-medium cursor-pointer flex items-center gap-2">
                                      {item.itemLabel}
                                      {item.isRequired && <Badge variant="outline" className="text-xs">Required</Badge>}
                                    </label>
                                    {item.description && (
                                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                    )}
                                    {item.isCompleted && item.completedByAdminName && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Completed by {item.completedByAdminName} on{' '}
                                        {item.completedAt && format(new Date(item.completedAt), 'MMM d, yyyy HH:mm')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </TabsContent>
                ))}
              </Tabs>

              {currentRelease.auditLogs && currentRelease.auditLogs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Audit History
                    </CardTitle>
                    <CardDescription>Track all changes made to this release</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {currentRelease.auditLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 text-sm" data-testid={`audit-log-${log.id}`}>
                            <div className="w-2 h-2 rounded-full bg-muted-foreground mt-2 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                                {log.environment && (
                                  <Badge variant="outline" className={`text-xs ${getEnvColor(log.environment)}`}>
                                    {log.environment}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground">
                                by {log.adminName || 'Unknown'} on {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                              </p>
                              {log.comment && <p className="text-muted-foreground italic">"{log.comment}"</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {currentRelease.releaseNotes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Release Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm">{currentRelease.releaseNotes}</p>
                  </CardContent>
                </Card>
              )}

              {currentRelease.includedPhases.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="w-5 h-5" />
                      Included Phase Reports
                    </CardTitle>
                    <CardDescription>Documentation for features included in this release</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {currentRelease.includedPhases.map((phase) => (
                        <Badge key={phase} variant="secondary">{phase}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
