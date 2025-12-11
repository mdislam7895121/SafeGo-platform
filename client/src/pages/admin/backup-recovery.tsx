import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Database, 
  Plus, 
  Clock,
  CheckCircle,
  RefreshCw,
  Download,
  Shield,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Backup {
  id: string;
  type: string;
  size: string;
  createdAt: string;
  status: string;
  verified: boolean;
}

interface BackupSchedule {
  frequency: string;
  time: string;
  retention: string;
}

export default function BackupRecovery() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [newBackup, setNewBackup] = useState({ type: "full", description: "" });
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const { toast } = useToast();

  const { data: backups, isLoading } = useQuery<{ backups: Backup[]; schedule: BackupSchedule }>({
    queryKey: ["/api/admin/phase3a/backups"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/phase3a/backups/create", {
        method: "POST",
        body: JSON.stringify(newBackup),
      });
    },
    onSuccess: () => {
      toast({ title: "Backup Started", description: "Backup has been initiated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/backups"] });
      setCreateDialogOpen(false);
      setNewBackup({ type: "full", description: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create backup.", variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (backupId: string) => {
      return apiRequest(`/api/admin/phase3a/backups/${backupId}/verify`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Verification Complete", description: "Backup integrity verified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase3a/backups"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Verification failed.", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/phase3a/backups/${selectedBackup?.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ targetEnvironment: "development", confirm: true }),
      });
    },
    onSuccess: () => {
      toast({ title: "Restore Initiated", description: "Database restore has started." });
      setRestoreDialogOpen(false);
      setRestoreConfirm("");
      setSelectedBackup(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Restore failed.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Auto Backup & Recovery Panel</h1>
          <p className="text-muted-foreground">Database snapshots, rollbacks, and integrity validation</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-backup">
              <Plus className="h-4 w-4 mr-2" />
              Create Backup
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Backup</DialogTitle>
              <DialogDescription>Create a database snapshot</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Backup Type</label>
                <Select
                  value={newBackup.type}
                  onValueChange={(v) => setNewBackup({ ...newBackup, type: v })}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Backup</SelectItem>
                    <SelectItem value="incremental">Incremental</SelectItem>
                    <SelectItem value="differential">Differential</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  placeholder="Reason for backup..."
                  value={newBackup.description}
                  onChange={(e) => setNewBackup({ ...newBackup, description: e.target.value })}
                  data-testid="input-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                data-testid="button-start-backup"
              >
                {createMutation.isPending ? "Starting..." : "Start Backup"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertTitle>Backup Schedule</AlertTitle>
        <AlertDescription>
          Automatic backups run {backups?.schedule.frequency} at {backups?.schedule.time}. 
          Retention: {backups?.schedule.retention}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Backups</p>
                <p className="text-2xl font-bold">{backups?.backups.length || 0}</p>
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-verified">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold text-green-600">
                  {backups?.backups.filter(b => b.verified).length || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-size">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Latest Size</p>
                <p className="text-2xl font-bold">{backups?.backups[0]?.size || "N/A"}</p>
              </div>
              <Download className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-schedule">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Schedule</p>
                <p className="text-lg font-bold capitalize">{backups?.schedule.frequency}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>All database snapshots and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {backups?.backups.map((backup) => (
                  <Card key={backup.id} className="hover-elevate" data-testid={`backup-${backup.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            <span className="font-mono text-sm">{backup.id}</span>
                            <Badge variant="outline" className="capitalize">{backup.type}</Badge>
                            <Badge variant={backup.status === "completed" ? "default" : "secondary"}>
                              {backup.status}
                            </Badge>
                            {backup.verified && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <Shield className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(backup.createdAt), "MMM dd, yyyy HH:mm")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {backup.size}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!backup.verified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyMutation.mutate(backup.id)}
                              disabled={verifyMutation.isPending}
                              data-testid={`button-verify-${backup.id}`}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Verify
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedBackup(backup);
                              setRestoreDialogOpen(true);
                            }}
                            data-testid={`button-restore-${backup.id}`}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {backups?.backups.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No backups available
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Restore
            </DialogTitle>
            <DialogDescription>
              This will restore the database to backup {selectedBackup?.id}. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                All data created after this backup will be lost. Make sure you have a current backup before proceeding.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type "RESTORE" to confirm</label>
              <Input
                placeholder="RESTORE"
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                data-testid="input-restore-confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending || restoreConfirm !== "RESTORE"}
              data-testid="button-confirm-restore"
            >
              {restoreMutation.isPending ? "Restoring..." : "Restore Database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
