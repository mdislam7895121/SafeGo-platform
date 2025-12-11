import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  Download, 
  Trash2, 
  Clock, 
  FileText, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Eye,
  Plus,
  Server,
  HardDrive,
  Activity,
  Users,
  Timer
} from 'lucide-react';
import { format } from 'date-fns';

export default function DataGovernanceCenter() {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  return (
    <div className="p-6 space-y-6" data-testid="page-data-governance">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Data Governance Center</h1>
          <p className="text-muted-foreground">GDPR compliance, data retention, and disaster recovery management</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Database className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="exports" data-testid="tab-exports">
            <Download className="w-4 h-4 mr-2" />
            Data Exports
          </TabsTrigger>
          <TabsTrigger value="deletions" data-testid="tab-deletions">
            <Trash2 className="w-4 h-4 mr-2" />
            Deletions
          </TabsTrigger>
          <TabsTrigger value="retention" data-testid="tab-retention">
            <Clock className="w-4 h-4 mr-2" />
            Retention
          </TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">
            <FileText className="w-4 h-4 mr-2" />
            Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="exports" className="mt-6">
          <ExportsTab />
        </TabsContent>

        <TabsContent value="deletions" className="mt-6">
          <DeletionsTab />
        </TabsContent>

        <TabsContent value="retention" className="mt-6">
          <RetentionTab />
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <PoliciesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  const { toast } = useToast();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['/api/admin/data-rights/dashboard']
  });

  const backupCheckMutation = useMutation({
    mutationFn: async (runSimulation: boolean) => {
      const response = await apiRequest('/api/admin/data-rights/backup/check', {
        method: 'POST',
        body: JSON.stringify({ 
          checkType: 'manual', 
          executedBy: 'admin',
          runSimulation
        })
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/backup/status'] });
      toast({ title: 'Health check completed' });
    },
    onError: () => {
      toast({ title: 'Health check failed', variant: 'destructive' });
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const backup = dashboard?.backup;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Download className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Exports</p>
                <p className="text-2xl font-semibold" data-testid="text-pending-exports">
                  {dashboard?.exports?.pending || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Deletions</p>
                <p className="text-2xl font-semibold" data-testid="text-pending-deletions">
                  {dashboard?.deletions?.pending || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileText className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Policies</p>
                <p className="text-2xl font-semibold" data-testid="text-active-policies">
                  {dashboard?.policies?.active || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                backup?.overallStatus === 'healthy' ? 'bg-green-500/10' :
                backup?.overallStatus === 'degraded' ? 'bg-yellow-500/10' :
                'bg-red-500/10'
              }`}>
                <Shield className={`w-5 h-5 ${
                  backup?.overallStatus === 'healthy' ? 'text-green-500' :
                  backup?.overallStatus === 'degraded' ? 'text-yellow-500' :
                  'text-red-500'
                }`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <p className="text-lg font-semibold capitalize" data-testid="text-system-status">
                  {backup?.overallStatus || 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              System Health
            </CardTitle>
            <CardDescription>Component status and backup readiness</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {backup ? (
              <>
                <div className="space-y-3">
                  <HealthItem label="Database" status={backup.databaseHealth} latency={backup.databaseLatencyMs} />
                  <HealthItem label="Policy Engine" status={backup.policyVersionHealth} />
                  <HealthItem label="Fraud Engine" status={backup.fraudEngineHealth} />
                  <HealthItem label="Rating Engine" status={backup.ratingEngineHealth} />
                  <HealthItem label="File Storage" status={backup.fileStorageHealth} />
                </div>
                <div className="pt-4 flex gap-2">
                  <Button 
                    onClick={() => backupCheckMutation.mutate(false)}
                    disabled={backupCheckMutation.isPending}
                    data-testid="button-health-check"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${backupCheckMutation.isPending ? 'animate-spin' : ''}`} />
                    Run Health Check
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => backupCheckMutation.mutate(true)}
                    disabled={backupCheckMutation.isPending}
                    data-testid="button-simulate-recovery"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Simulate Recovery
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No health check data available. Run a health check to see status.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Retention Runs
            </CardTitle>
            <CardDescription>Data cleanup history</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard?.retention?.recentRuns?.length > 0 ? (
              <div className="space-y-2">
                {dashboard.retention.recentRuns.map((run: any) => (
                  <div key={run.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{run.dataType}</p>
                      <p className="text-xs text-muted-foreground">
                        {run.recordsDeleted} deleted of {run.recordsScanned} scanned
                      </p>
                    </div>
                    <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No retention runs yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HealthItem({ label, status, latency }: { label: string; status: string; latency?: number }) {
  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {getStatusIcon(status)}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {latency !== undefined && (
          <span className="text-xs text-muted-foreground">{latency}ms</span>
        )}
        <Badge variant={status === 'healthy' ? 'default' : status === 'degraded' ? 'secondary' : 'destructive'}>
          {status}
        </Badge>
      </div>
    </div>
  );
}

function ExportsTab() {
  const { toast } = useToast();

  const { data: exportsData, isLoading } = useQuery({
    queryKey: ['/api/admin/data-rights/exports']
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const requests = exportsData?.requests || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Data Export Requests
        </CardTitle>
        <CardDescription>GDPR data portability requests from users</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Data Types</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req: any) => (
                <TableRow key={req.id} data-testid={`row-export-${req.id}`}>
                  <TableCell className="font-mono text-xs">{req.userId.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{req.userRole}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {req.dataTypes.slice(0, 3).map((type: string) => (
                        <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                      ))}
                      {req.dataTypes.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{req.dataTypes.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(req.createdAt), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-xs">
                    {req.completedAt ? format(new Date(req.completedAt), 'MMM d, yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    {req.status === 'completed' && req.fileUrl && (
                      <Button size="sm" variant="outline" data-testid={`button-download-${req.id}`}>
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No data export requests yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeletionsTab() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [denyReason, setDenyReason] = useState('');

  const { data: deletionsData, isLoading } = useQuery({
    queryKey: ['/api/admin/data-rights/deletions']
  });

  const denyMutation = useMutation({
    mutationFn: async ({ requestId, denialReason }: { requestId: string; denialReason: string }) => {
      return apiRequest(`/api/admin/data-rights/deletions/${requestId}/deny`, {
        method: 'POST',
        body: JSON.stringify({ adminId: 'admin', denialReason })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/deletions'] });
      toast({ title: 'Deletion request denied' });
      setSelectedRequest(null);
      setDenyReason('');
    },
    onError: () => {
      toast({ title: 'Failed to deny request', variant: 'destructive' });
    }
  });

  const processMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest(`/api/admin/data-rights/deletions/${requestId}/process`, {
        method: 'POST',
        body: JSON.stringify({ adminId: 'admin' })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/deletions'] });
      toast({ 
        title: 'Account deleted',
        description: `Anonymized: ${JSON.stringify(data.anonymizedRecords)}`
      });
    },
    onError: () => {
      toast({ title: 'Failed to process deletion', variant: 'destructive' });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'scheduled':
        return <Badge variant="outline"><Timer className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case 'processing':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'denied':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      case 'cancelled':
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const requests = deletionsData?.requests || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Account Deletion Requests
        </CardTitle>
        <CardDescription>GDPR right to erasure requests with 72-hour delay</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req: any) => (
                <TableRow key={req.id} data-testid={`row-deletion-${req.id}`}>
                  <TableCell className="font-mono text-xs">{req.userId.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{req.userRole}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {req.reason || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(req.requestedAt), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(req.scheduledFor), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    {['pending', 'scheduled'].includes(req.status) && (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => processMutation.mutate(req.id)}
                          disabled={processMutation.isPending}
                          data-testid={`button-process-${req.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Process
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedRequest(req)}
                              data-testid={`button-deny-${req.id}`}
                            >
                              Deny
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Deny Deletion Request</DialogTitle>
                              <DialogDescription>
                                Provide a reason for denying this account deletion request.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Denial Reason</Label>
                                <Textarea 
                                  value={denyReason}
                                  onChange={(e) => setDenyReason(e.target.value)}
                                  placeholder="Enter reason for denial..."
                                  data-testid="input-deny-reason"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                variant="destructive"
                                onClick={() => denyMutation.mutate({ 
                                  requestId: req.id, 
                                  denialReason: denyReason 
                                })}
                                disabled={denyMutation.isPending || !denyReason}
                                data-testid="button-confirm-deny"
                              >
                                Deny Request
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No deletion requests yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RetentionTab() {
  const { toast } = useToast();
  const [dryRun, setDryRun] = useState(true);

  const { data: policies } = useQuery({
    queryKey: ['/api/admin/data-rights/retention/policies']
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['/api/admin/data-rights/retention/logs']
  });

  const runRetentionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/data-rights/retention/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/retention/logs'] });
      toast({ 
        title: dryRun ? 'Dry run completed' : 'Retention cleanup completed',
        description: `Processed ${data.results.length} data types`
      });
    },
    onError: () => {
      toast({ title: 'Retention run failed', variant: 'destructive' });
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Retention Policies
          </CardTitle>
          <CardDescription>Configured data retention periods by data type</CardDescription>
        </CardHeader>
        <CardContent>
          {policies ? (
            <div className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Retention Period</TableHead>
                    <TableHead>Mandatory</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(policies).map(([key, policy]: [string, any]) => (
                    <TableRow key={key} data-testid={`row-policy-${key}`}>
                      <TableCell className="font-medium">{key.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-mono text-xs">{policy.table}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{policy.days} days</Badge>
                      </TableCell>
                      <TableCell>
                        {policy.mandatory ? (
                          <Badge variant="destructive">Mandatory</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={dryRun}
                      onCheckedChange={setDryRun}
                      data-testid="switch-dry-run"
                    />
                    <Label>Dry Run Mode</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dryRun ? 'Preview changes without deleting data' : 'Actually delete old data'}
                  </p>
                </div>
                <Button 
                  onClick={() => runRetentionMutation.mutate()}
                  disabled={runRetentionMutation.isPending}
                  variant={dryRun ? 'outline' : 'destructive'}
                  data-testid="button-run-retention"
                >
                  {runRetentionMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {dryRun ? 'Preview Cleanup' : 'Run Cleanup'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Loading policies...</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention History</CardTitle>
          <CardDescription>Past retention cleanup runs</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : logsData?.logs?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Type</TableHead>
                  <TableHead>Cutoff Date</TableHead>
                  <TableHead>Scanned</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead>Preserved</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsData.logs.map((log: any) => (
                  <TableRow key={log.id} data-testid={`row-retention-log-${log.id}`}>
                    <TableCell className="font-medium">{log.dataType}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(log.cutoffDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{log.recordsScanned}</TableCell>
                    <TableCell className="text-red-500">{log.recordsDeleted}</TableCell>
                    <TableCell>{log.recordsPreserved}</TableCell>
                    <TableCell>{log.durationMs}ms</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'completed' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No retention runs yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PoliciesTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    policyType: 'privacy',
    title: '',
    content: '',
    summary: '',
    country: '',
    language: 'en'
  });

  const { data: policies, isLoading } = useQuery({
    queryKey: ['/api/admin/data-rights/policies']
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/data-rights/policies', {
        method: 'POST',
        body: JSON.stringify({
          ...newPolicy,
          country: newPolicy.country || null,
          createdBy: 'admin'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/policies'] });
      toast({ title: 'Policy created' });
      setShowCreateDialog(false);
      setNewPolicy({ policyType: 'privacy', title: '', content: '', summary: '', country: '', language: 'en' });
    },
    onError: () => {
      toast({ title: 'Failed to create policy', variant: 'destructive' });
    }
  });

  const publishMutation = useMutation({
    mutationFn: async (policyId: string) => {
      return apiRequest(`/api/admin/data-rights/policies/${policyId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ publishedBy: 'admin' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-rights/policies'] });
      toast({ title: 'Policy published' });
    },
    onError: () => {
      toast({ title: 'Failed to publish policy', variant: 'destructive' });
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Policy Versions
          </CardTitle>
          <CardDescription>Manage terms, privacy policies, and legal documents</CardDescription>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-policy">
              <Plus className="w-4 h-4 mr-2" />
              New Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Policy Version</DialogTitle>
              <DialogDescription>Create a new version of a policy document</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Policy Type</Label>
                  <Select 
                    value={newPolicy.policyType}
                    onValueChange={(v) => setNewPolicy({ ...newPolicy, policyType: v })}
                  >
                    <SelectTrigger data-testid="select-policy-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terms">Terms & Conditions</SelectItem>
                      <SelectItem value="privacy">Privacy Policy</SelectItem>
                      <SelectItem value="refund">Refund Policy</SelectItem>
                      <SelectItem value="safety">Safety Policy</SelectItem>
                      <SelectItem value="community_guidelines">Community Guidelines</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Language</Label>
                  <Select 
                    value={newPolicy.language}
                    onValueChange={(v) => setNewPolicy({ ...newPolicy, language: v })}
                  >
                    <SelectTrigger data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="bn">Bengali</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input 
                  value={newPolicy.title}
                  onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                  placeholder="e.g., SafeGo Privacy Policy"
                  data-testid="input-policy-title"
                />
              </div>
              <div>
                <Label>Country (optional)</Label>
                <Input 
                  value={newPolicy.country}
                  onChange={(e) => setNewPolicy({ ...newPolicy, country: e.target.value })}
                  placeholder="e.g., BD, US (leave empty for global)"
                  data-testid="input-policy-country"
                />
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea 
                  value={newPolicy.summary}
                  onChange={(e) => setNewPolicy({ ...newPolicy, summary: e.target.value })}
                  placeholder="Brief summary of what changed in this version..."
                  data-testid="input-policy-summary"
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea 
                  value={newPolicy.content}
                  onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                  placeholder="Full policy content..."
                  className="min-h-[200px]"
                  data-testid="input-policy-content"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newPolicy.title || !newPolicy.content}
                data-testid="button-save-policy"
              >
                Create Policy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {policies?.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acceptances</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy: any) => (
                <TableRow key={policy.id} data-testid={`row-policy-${policy.id}`}>
                  <TableCell>
                    <Badge variant="outline">{policy.policyType}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{policy.title}</TableCell>
                  <TableCell>{policy.version}</TableCell>
                  <TableCell>{policy.country || 'Global'}</TableCell>
                  <TableCell>{policy.language}</TableCell>
                  <TableCell>
                    {policy.isActive ? (
                      <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <Users className="w-3 h-3 mr-1" />
                      {policy.acceptanceCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" data-testid={`button-view-${policy.id}`}>
                        <Eye className="w-3 h-3" />
                      </Button>
                      {!policy.isActive && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => publishMutation.mutate(policy.id)}
                          disabled={publishMutation.isPending}
                          data-testid={`button-publish-${policy.id}`}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No policies created yet</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              Create your first policy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
