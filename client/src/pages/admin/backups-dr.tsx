import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Database, 
  HardDrive, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Download, 
  Upload,
  Server,
  Globe,
  Timer,
  Trash2,
  Eye,
  Play,
  Ban,
  Loader2,
  FileArchive,
  Settings,
  Activity,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface BackupSnapshot {
  id: string;
  createdAt: string;
  environment: string;
  type: string;
  storageLocationLabel: string;
  sizeMb: number | null;
  status: string;
  retentionDays: number;
  expiresAt: string | null;
  initiatedBy: string | null;
  initiatedByName: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  errorMessage: string | null;
  metadata: any;
  isDeleted: boolean;
}

interface RestoreOperation {
  id: string;
  snapshotId: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  initiatedBy: string;
  initiatedByName: string | null;
  confirmationToken: string | null;
  confirmedAt: string | null;
  errorMessage: string | null;
  rollbackAvailable: boolean;
  createdAt: string;
}

interface DRStatus {
  environment: string;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  lastBackupAt: string | null;
  lastVerifiedBackupAt: string | null;
  crossRegionEnabled: boolean;
  crossRegionLocation: string | null;
  backupCount: number;
  verifiedBackupCount: number;
  failedBackupCount: number;
  oldestBackup: string | null;
  newestBackup: string | null;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return <Badge variant="default" className="bg-green-500" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
    case 'CREATED':
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Created</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>;
    case 'FAILED':
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    case 'COMPLETED':
      return <Badge variant="default" className="bg-green-500" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
    case 'PENDING':
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case 'CANCELLED':
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><Ban className="w-3 h-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
};

const getEnvironmentBadge = (env: string) => {
  switch (env) {
    case 'prod':
      return <Badge variant="destructive" data-testid={`badge-env-${env}`}>Production</Badge>;
    case 'staging':
      return <Badge variant="default" className="bg-yellow-500" data-testid={`badge-env-${env}`}>Staging</Badge>;
    case 'dev':
      return <Badge variant="secondary" data-testid={`badge-env-${env}`}>Development</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-env-${env}`}>{env}</Badge>;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'FULL_DB':
      return <Badge variant="outline" data-testid={`badge-type-${type}`}><Database className="w-3 h-3 mr-1" />Full DB</Badge>;
    case 'PARTIAL_ANALYTICS':
      return <Badge variant="outline" data-testid={`badge-type-${type}`}><Activity className="w-3 h-3 mr-1" />Analytics</Badge>;
    case 'FILES_ONLY':
      return <Badge variant="outline" data-testid={`badge-type-${type}`}><FileArchive className="w-3 h-3 mr-1" />Files</Badge>;
    case 'CONFIG_ONLY':
      return <Badge variant="outline" data-testid={`badge-type-${type}`}><Settings className="w-3 h-3 mr-1" />Config</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-type-${type}`}>{type}</Badge>;
  }
};

export default function BackupsDRPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('snapshots');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggerEnv, setTriggerEnv] = useState<string>('dev');
  const [triggerType, setTriggerType] = useState<string>('FULL_DB');
  
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<BackupSnapshot | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmEnv, setDeleteConfirmEnv] = useState('');
  
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetEnv, setRestoreTargetEnv] = useState<string>('dev');
  const [pendingRestore, setPendingRestore] = useState<{ operationId: string; token: string } | null>(null);
  const [confirmToken, setConfirmToken] = useState('');

  const { data: snapshotsData, isLoading: snapshotsLoading, refetch: refetchSnapshots } = useQuery<{ snapshots: BackupSnapshot[]; total: number }>({
    queryKey: ['/api/backup-dr/snapshots', envFilter, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (envFilter !== 'all') params.append('environment', envFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/backup-dr/snapshots?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      return res.json();
    },
  });

  const { data: drStatusData, isLoading: drStatusLoading } = useQuery<{ environments: DRStatus[]; summary: any }>({
    queryKey: ['/api/backup-dr/dr-status'],
  });

  const { data: restoreOps, isLoading: restoreOpsLoading, refetch: refetchRestoreOps } = useQuery<RestoreOperation[]>({
    queryKey: ['/api/backup-dr/restore-operations'],
  });

  const { data: statsData } = useQuery<{
    totalBackups: number;
    verifiedBackups: number;
    failedBackups: number;
    totalSizeMb: number;
    byEnvironment: Record<string, number>;
    byType: Record<string, number>;
  }>({
    queryKey: ['/api/backup-dr/stats'],
  });

  const triggerBackupMutation = useMutation({
    mutationFn: async (data: { environment: string; type: string }) => {
      return apiRequest('/api/backup-dr/snapshots/trigger', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Backup initiated', description: 'The backup process has started.' });
      setTriggerDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/stats'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to trigger backup', description: error.message, variant: 'destructive' });
    },
  });

  const verifyBackupMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      return apiRequest('/api/backup-dr/snapshots/verify', {
        method: 'POST',
        body: JSON.stringify({ snapshotId }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Backup verified', description: 'The backup has been marked as verified.' });
      setVerifyDialogOpen(false);
      setSelectedSnapshot(null);
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/dr-status'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to verify backup', description: error.message, variant: 'destructive' });
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (data: { snapshotId: string; confirmEnvironment: string }) => {
      return apiRequest('/api/backup-dr/snapshots/delete', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Backup deleted', description: 'The backup snapshot has been deleted.' });
      setDeleteDialogOpen(false);
      setSelectedSnapshot(null);
      setDeleteConfirmEnv('');
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/stats'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete backup', description: error.message, variant: 'destructive' });
    },
  });

  const initiateRestoreMutation = useMutation({
    mutationFn: async (data: { snapshotId: string; targetEnvironment: string }) => {
      return apiRequest('/api/backup-dr/restore/initiate', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data: any) => {
      setPendingRestore({ operationId: data.operation.id, token: data.confirmationToken });
      toast({ 
        title: 'Restore initiated', 
        description: `Confirmation token: ${data.confirmationToken}. Enter this token to confirm.` 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to initiate restore', description: error.message, variant: 'destructive' });
    },
  });

  const confirmRestoreMutation = useMutation({
    mutationFn: async (data: { operationId: string; confirmationToken: string }) => {
      return apiRequest('/api/backup-dr/restore/confirm', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Restore confirmed', description: 'The restore process has started.' });
      setRestoreDialogOpen(false);
      setSelectedSnapshot(null);
      setPendingRestore(null);
      setConfirmToken('');
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/restore-operations'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to confirm restore', description: error.message, variant: 'destructive' });
    },
  });

  const cancelRestoreMutation = useMutation({
    mutationFn: async (operationId: string) => {
      return apiRequest('/api/backup-dr/restore/cancel', {
        method: 'POST',
        body: JSON.stringify({ operationId }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Restore cancelled', description: 'The restore operation has been cancelled.' });
      queryClient.invalidateQueries({ queryKey: ['/api/backup-dr/restore-operations'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to cancel restore', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Backups & Disaster Recovery</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Manage backup snapshots, restore operations, and disaster recovery configuration
          </p>
        </div>
        <Button onClick={() => refetchSnapshots()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-backups">{statsData?.totalBackups || 0}</div>
            <p className="text-xs text-muted-foreground">
              {statsData?.totalSizeMb ? `${(statsData.totalSizeMb / 1024).toFixed(1)} GB total` : 'No data'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verified Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-verified-backups">{statsData?.verifiedBackups || 0}</div>
            <p className="text-xs text-muted-foreground">Ready for restore</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-failed-backups">{statsData?.failedBackups || 0}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Restores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-restores">
              {restoreOps?.filter(op => ['PENDING', 'IN_PROGRESS'].includes(op.status)).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="snapshots" data-testid="tab-snapshots">
            <HardDrive className="w-4 h-4 mr-2" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="restore" data-testid="tab-restore">
            <Upload className="w-4 h-4 mr-2" />
            Restore
          </TabsTrigger>
          <TabsTrigger value="dr-status" data-testid="tab-dr-status">
            <Shield className="w-4 h-4 mr-2" />
            DR Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Backup Snapshots</CardTitle>
                  <CardDescription>View and manage backup snapshots across environments</CardDescription>
                </div>
                <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-trigger-backup">
                      <Play className="w-4 h-4 mr-2" />
                      Trigger Backup
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Trigger New Backup</DialogTitle>
                      <DialogDescription>
                        Create a new backup snapshot. Production backups can only be triggered by automated systems.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Environment</Label>
                        <Select value={triggerEnv} onValueChange={setTriggerEnv}>
                          <SelectTrigger data-testid="select-trigger-env">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dev">Development</SelectItem>
                            <SelectItem value="staging">Staging</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Backup Type</Label>
                        <Select value={triggerType} onValueChange={setTriggerType}>
                          <SelectTrigger data-testid="select-trigger-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FULL_DB">Full Database</SelectItem>
                            <SelectItem value="PARTIAL_ANALYTICS">Analytics Data</SelectItem>
                            <SelectItem value="FILES_ONLY">Files Only</SelectItem>
                            <SelectItem value="CONFIG_ONLY">Configuration Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTriggerDialogOpen(false)}>Cancel</Button>
                      <Button 
                        onClick={() => triggerBackupMutation.mutate({ environment: triggerEnv, type: triggerType })}
                        disabled={triggerBackupMutation.isPending}
                        data-testid="button-confirm-trigger"
                      >
                        {triggerBackupMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Trigger Backup
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4 flex-wrap">
                <Select value={envFilter} onValueChange={setEnvFilter}>
                  <SelectTrigger className="w-40" data-testid="select-filter-env">
                    <SelectValue placeholder="Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40" data-testid="select-filter-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="FULL_DB">Full Database</SelectItem>
                    <SelectItem value="PARTIAL_ANALYTICS">Analytics</SelectItem>
                    <SelectItem value="FILES_ONLY">Files Only</SelectItem>
                    <SelectItem value="CONFIG_ONLY">Config Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="CREATED">Created</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {snapshotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshotsData?.snapshots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No backup snapshots found
                    </div>
                  ) : (
                    snapshotsData?.snapshots.map((snapshot) => (
                      <Card key={snapshot.id} className="p-4" data-testid={`card-snapshot-${snapshot.id}`}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getEnvironmentBadge(snapshot.environment)}
                              {getTypeBadge(snapshot.type)}
                              {getStatusBadge(snapshot.status)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-mono">{snapshot.id.slice(0, 8)}...</span>
                              <span className="mx-2">|</span>
                              <span>{format(new Date(snapshot.createdAt), 'MMM d, yyyy HH:mm')}</span>
                              {snapshot.sizeMb && (
                                <>
                                  <span className="mx-2">|</span>
                                  <span>{snapshot.sizeMb.toFixed(1)} MB</span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {snapshot.storageLocationLabel}
                            </div>
                            {snapshot.initiatedByName && (
                              <div className="text-xs text-muted-foreground">
                                Initiated by: {snapshot.initiatedByName}
                              </div>
                            )}
                            {snapshot.verifiedByName && (
                              <div className="text-xs text-green-600">
                                Verified by: {snapshot.verifiedByName} on {format(new Date(snapshot.verifiedAt!), 'MMM d, yyyy')}
                              </div>
                            )}
                            {snapshot.errorMessage && (
                              <div className="text-xs text-red-600">
                                Error: {snapshot.errorMessage}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {snapshot.status === 'CREATED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSnapshot(snapshot);
                                  setVerifyDialogOpen(true);
                                }}
                                data-testid={`button-verify-${snapshot.id}`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Verify
                              </Button>
                            )}
                            {['CREATED', 'VERIFIED'].includes(snapshot.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSnapshot(snapshot);
                                  setRestoreDialogOpen(true);
                                }}
                                data-testid={`button-restore-${snapshot.id}`}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Restore
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSnapshot(snapshot);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-${snapshot.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restore" className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: Restore Operations</AlertTitle>
            <AlertDescription>
              Restoring a backup will overwrite data in the target environment. Direct restores to production 
              are disabled through this interface. For production restores, contact the infrastructure team.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Restore Operations</CardTitle>
              <CardDescription>View and manage restore operations</CardDescription>
            </CardHeader>
            <CardContent>
              {restoreOpsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {restoreOps?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No restore operations found
                    </div>
                  ) : (
                    restoreOps?.map((op) => (
                      <Card key={op.id} className="p-4" data-testid={`card-restore-${op.id}`}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getStatusBadge(op.status)}
                              <span className="text-sm">
                                {op.sourceEnvironment} → {op.targetEnvironment}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-mono">{op.snapshotId.slice(0, 8)}...</span>
                              <span className="mx-2">|</span>
                              <span>{format(new Date(op.createdAt), 'MMM d, yyyy HH:mm')}</span>
                            </div>
                            {op.initiatedByName && (
                              <div className="text-xs text-muted-foreground">
                                Initiated by: {op.initiatedByName}
                              </div>
                            )}
                            {op.errorMessage && (
                              <div className="text-xs text-red-600">
                                Error: {op.errorMessage}
                              </div>
                            )}
                            {op.completedAt && (
                              <div className="text-xs text-muted-foreground">
                                Completed: {format(new Date(op.completedAt), 'MMM d, yyyy HH:mm')}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {op.status === 'PENDING' && op.confirmationToken && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelRestoreMutation.mutate(op.id)}
                                disabled={cancelRestoreMutation.isPending}
                                data-testid={`button-cancel-restore-${op.id}`}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                            {op.status === 'IN_PROGRESS' && (
                              <Badge variant="outline">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Running...
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dr-status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Disaster Recovery Status</CardTitle>
              <CardDescription>
                Overview of backup and recovery status across all environments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drStatusLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {drStatusData?.environments.map((status) => (
                    <div key={status.environment} className="space-y-4" data-testid={`dr-status-${status.environment}`}>
                      <div className="flex items-center gap-2">
                        {getEnvironmentBadge(status.environment)}
                        <h3 className="font-semibold capitalize">{status.environment} Environment</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Timer className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">RPO / RTO Targets</span>
                          </div>
                          <div className="text-lg font-bold">
                            {status.rpoTargetMinutes}m / {status.rtoTargetMinutes}m
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Recovery Point / Recovery Time Objectives
                          </p>
                        </Card>

                        <Card className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Last Backup</span>
                          </div>
                          <div className="text-lg font-bold">
                            {status.lastBackupAt 
                              ? formatDistanceToNow(new Date(status.lastBackupAt), { addSuffix: true })
                              : 'Never'
                            }
                          </div>
                          {status.lastBackupAt && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(status.lastBackupAt), 'MMM d, yyyy HH:mm')}
                            </p>
                          )}
                        </Card>

                        <Card className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Last Verified</span>
                          </div>
                          <div className="text-lg font-bold">
                            {status.lastVerifiedBackupAt 
                              ? formatDistanceToNow(new Date(status.lastVerifiedBackupAt), { addSuffix: true })
                              : 'Never'
                            }
                          </div>
                          {status.lastVerifiedBackupAt && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(status.lastVerifiedBackupAt), 'MMM d, yyyy HH:mm')}
                            </p>
                          )}
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Total: {status.backupCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Verified: {status.verifiedBackupCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm">Failed: {status.failedBackupCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {status.crossRegionEnabled ? (
                            <>
                              <Globe className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-600">Cross-region: {status.crossRegionLocation}</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Cross-region: Disabled</span>
                            </>
                          )}
                        </div>
                      </div>

                      <Separator />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Backup</DialogTitle>
            <DialogDescription>
              Confirm that you have tested this backup and it can be successfully restored.
            </DialogDescription>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getEnvironmentBadge(selectedSnapshot.environment)}
                {getTypeBadge(selectedSnapshot.type)}
              </div>
              <p className="text-sm text-muted-foreground">
                Created: {format(new Date(selectedSnapshot.createdAt), 'MMM d, yyyy HH:mm')}
              </p>
              {selectedSnapshot.sizeMb && (
                <p className="text-sm text-muted-foreground">
                  Size: {selectedSnapshot.sizeMb.toFixed(1)} MB
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedSnapshot && verifyBackupMutation.mutate(selectedSnapshot.id)}
              disabled={verifyBackupMutation.isPending}
              data-testid="button-confirm-verify"
            >
              {verifyBackupMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark as Verified
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Backup</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type the environment name to confirm deletion.
            </DialogDescription>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getEnvironmentBadge(selectedSnapshot.environment)}
                {getTypeBadge(selectedSnapshot.type)}
              </div>
              <div className="space-y-2">
                <Label>Type "{selectedSnapshot.environment}" to confirm</Label>
                <Input 
                  value={deleteConfirmEnv}
                  onChange={(e) => setDeleteConfirmEnv(e.target.value)}
                  placeholder={selectedSnapshot.environment}
                  data-testid="input-delete-confirm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmEnv(''); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedSnapshot && deleteBackupMutation.mutate({ 
                snapshotId: selectedSnapshot.id, 
                confirmEnvironment: deleteConfirmEnv 
              })}
              disabled={deleteBackupMutation.isPending || deleteConfirmEnv !== selectedSnapshot?.environment}
              data-testid="button-confirm-delete"
            >
              {deleteBackupMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={(open) => {
        setRestoreDialogOpen(open);
        if (!open) {
          setPendingRestore(null);
          setConfirmToken('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              Restore this backup to a non-production environment. Production restores must be done by the infrastructure team.
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This will overwrite all data in the target environment with this backup.
            </AlertDescription>
          </Alert>

          {selectedSnapshot && !pendingRestore && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getEnvironmentBadge(selectedSnapshot.environment)}
                {getTypeBadge(selectedSnapshot.type)}
                {getStatusBadge(selectedSnapshot.status)}
              </div>
              <div className="space-y-2">
                <Label>Target Environment</Label>
                <Select value={restoreTargetEnv} onValueChange={setRestoreTargetEnv}>
                  <SelectTrigger data-testid="select-restore-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {pendingRestore && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Confirmation Required</AlertTitle>
                <AlertDescription>
                  Enter the confirmation token to proceed with the restore.
                </AlertDescription>
              </Alert>
              <div className="p-4 bg-muted rounded-md text-center">
                <p className="text-sm text-muted-foreground mb-2">Confirmation Token:</p>
                <p className="text-2xl font-mono font-bold">{pendingRestore.token}</p>
              </div>
              <div className="space-y-2">
                <Label>Enter Token</Label>
                <Input 
                  value={confirmToken}
                  onChange={(e) => setConfirmToken(e.target.value.toUpperCase())}
                  placeholder="Enter token"
                  data-testid="input-confirm-token"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { 
              setRestoreDialogOpen(false); 
              setPendingRestore(null);
              setConfirmToken('');
            }}>
              Cancel
            </Button>
            {!pendingRestore ? (
              <Button 
                variant="destructive"
                onClick={() => selectedSnapshot && initiateRestoreMutation.mutate({ 
                  snapshotId: selectedSnapshot.id, 
                  targetEnvironment: restoreTargetEnv 
                })}
                disabled={initiateRestoreMutation.isPending}
                data-testid="button-initiate-restore"
              >
                {initiateRestoreMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Initiate Restore
              </Button>
            ) : (
              <Button 
                variant="destructive"
                onClick={() => confirmRestoreMutation.mutate({ 
                  operationId: pendingRestore.operationId, 
                  confirmationToken: confirmToken 
                })}
                disabled={confirmRestoreMutation.isPending || confirmToken !== pendingRestore.token}
                data-testid="button-confirm-restore"
              >
                {confirmRestoreMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Restore
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
