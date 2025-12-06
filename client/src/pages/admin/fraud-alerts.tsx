import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  AlertTriangle, Shield, CheckCircle, XCircle,
  RefreshCw, Filter, Clock, User, Car, CreditCard, MapPin,
  ChevronRight, AlertOctagon, AlertCircle, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/admin/PageHeader";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FraudAlert {
  id: string;
  entityType: string;
  entityId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  detectedReason: string;
  detectedMetrics: Record<string, any>;
  detectedAt: string;
  resolvedByAdminId?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

interface FraudAlertsResponse {
  success: boolean;
  alerts: FraudAlert[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    byStatus: Record<string, number>;
    openBySeverity: Record<string, number>;
  };
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical': return AlertOctagon;
    case 'high': return AlertTriangle;
    case 'medium': return AlertCircle;
    default: return Info;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300';
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-300';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300';
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'driver': return Car;
    case 'customer': return User;
    case 'wallet': return CreditCard;
    case 'ride': return MapPin;
    default: return Shield;
  }
}

function getAlertTypeLabel(alertType: string) {
  switch (alertType) {
    case 'cancellation_abuse': return 'Cancellation Abuse';
    case 'gps_spoofing': return 'GPS Spoofing';
    case 'wallet_manipulation': return 'Wallet Manipulation';
    case 'payment_anomaly': return 'Payment Anomaly';
    case 'multi_account': return 'Multi-Account Abuse';
    case 'impossible_travel': return 'Impossible Travel';
    default: return alertType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

function AlertCard({ alert, onResolve }: { alert: FraudAlert; onResolve: (alert: FraudAlert) => void }) {
  const SeverityIcon = getSeverityIcon(alert.severity);
  const EntityIcon = getEntityIcon(alert.entityType);

  return (
    <Card data-testid={`card-alert-${alert.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
              <SeverityIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{getAlertTypeLabel(alert.alertType)}</p>
                <Badge variant="outline" className="text-xs">
                  <EntityIcon className="h-3 w-3 mr-1" />
                  {alert.entityType}
                </Badge>
                <Badge variant={
                  alert.status === 'open' ? 'destructive' :
                  alert.status === 'escalated' ? 'secondary' :
                  'default'
                }>
                  {alert.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{alert.detectedReason}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(alert.detectedAt).toLocaleString()}
                </span>
                <span>ID: {alert.entityId.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
          {alert.status === 'open' && (
            <Button 
              size="sm" 
              onClick={() => onResolve(alert)}
              data-testid={`button-resolve-${alert.id}`}
            >
              Resolve
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
        
        {alert.detectedMetrics && Object.keys(alert.detectedMetrics).length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Detection Metrics</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(alert.detectedMetrics).slice(0, 5).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key.replace(/_/g, ' ')}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {alert.resolvedAt && (
          <div className="mt-3 pt-3 border-t bg-green-50 dark:bg-green-950/20 -m-4 mt-3 p-4 rounded-b-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Resolved</span>
            </div>
            {alert.resolutionNotes && (
              <p className="text-sm text-muted-foreground mt-1">{alert.resolutionNotes}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(alert.resolvedAt).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FraudAlerts() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [resolution, setResolution] = useState<'resolved_confirmed' | 'resolved_false_positive' | 'escalated'>('resolved_confirmed');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: '20',
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(severityFilter !== 'all' && { severity: severityFilter }),
    ...(entityTypeFilter !== 'all' && { entityType: entityTypeFilter }),
  }).toString();

  const { data, isLoading, refetch } = useQuery<FraudAlertsResponse>({
    queryKey: ['/api/admin/fraud/alerts', statusFilter, severityFilter, entityTypeFilter, page],
    refetchInterval: 60000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, resolution, notes }: { alertId: string; resolution: string; notes: string }) => {
      return apiRequest(`/api/admin/fraud/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution, notes }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Alert Resolved",
        description: "The fraud alert has been resolved successfully.",
      });
      setResolveDialogOpen(false);
      setSelectedAlert(null);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fraud/alerts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve alert",
        variant: "destructive",
      });
    },
  });

  const handleResolve = (alert: FraudAlert) => {
    setSelectedAlert(alert);
    setResolveDialogOpen(true);
  };

  const handleSubmitResolution = () => {
    if (!selectedAlert || !notes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide resolution notes.",
        variant: "destructive",
      });
      return;
    }
    resolveMutation.mutate({
      alertId: selectedAlert.id,
      resolution,
      notes: notes.trim(),
    });
  };

  const summary = data?.summary || { byStatus: {}, openBySeverity: {} };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Fraud Alerts"
        description="Monitor and resolve fraud detection alerts"
        icon={AlertTriangle}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-xs"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4 text-center">
              <AlertOctagon className="h-6 w-6 mx-auto text-red-600 mb-1" />
              <p className="text-2xl font-bold text-red-600">{summary.openBySeverity?.critical || 0}</p>
              <p className="text-xs text-red-700 dark:text-red-400">Critical</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-orange-600 mb-1" />
              <p className="text-2xl font-bold text-orange-600">{summary.openBySeverity?.high || 0}</p>
              <p className="text-xs text-orange-700 dark:text-orange-400">High</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-6 w-6 mx-auto text-yellow-600 mb-1" />
              <p className="text-2xl font-bold text-yellow-600">{summary.openBySeverity?.medium || 0}</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">Medium</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-600">
                {(summary.byStatus?.resolved_confirmed || 0) + (summary.byStatus?.resolved_false_positive || 0)}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">Resolved</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved_confirmed">Confirmed</SelectItem>
              <SelectItem value="resolved_false_positive">False Positive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36" data-testid="select-severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-36" data-testid="select-entity">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="wallet">Wallet</SelectItem>
              <SelectItem value="ride">Ride</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {!data?.alerts || data.alerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Fraud Alerts</p>
                <p className="text-sm text-muted-foreground">No alerts match your current filters</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {data.alerts.map((alert) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  onResolve={handleResolve}
                />
              ))}
              
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Fraud Alert</DialogTitle>
            <DialogDescription>
              Review and resolve this fraud alert. Your decision will be logged.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${getSeverityColor(selectedAlert.severity)}`}>
                <p className="font-medium">{getAlertTypeLabel(selectedAlert.alertType)}</p>
                <p className="text-sm mt-1">{selectedAlert.detectedReason}</p>
              </div>

              <div className="space-y-3">
                <Label>Resolution Type</Label>
                <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="resolved_confirmed" id="confirmed" />
                    <Label htmlFor="confirmed" className="font-normal">
                      Confirmed Fraud - Take action
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="resolved_false_positive" id="false_positive" />
                    <Label htmlFor="false_positive" className="font-normal">
                      False Positive - No action needed
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="escalated" id="escalated" />
                    <Label htmlFor="escalated" className="font-normal">
                      Escalate - Needs further review
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Resolution Notes (Required)</Label>
                <Textarea
                  id="notes"
                  placeholder="Describe your findings and any actions taken..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  data-testid="input-resolution-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitResolution}
              disabled={resolveMutation.isPending || !notes.trim()}
              data-testid="button-submit-resolution"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Submit Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
