import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  Shield, 
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  XCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

interface DataPrivacyProps {
  userId: string;
  userRole: 'customer' | 'driver' | 'partner' | 'restaurant';
  backUrl?: string;
}

export default function DataPrivacy({ userId = 'demo-user', userRole = 'customer', backUrl = '/customer/profile' }: Partial<DataPrivacyProps>) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([
    'profile', 'rides', 'orders', 'devices', 'logins'
  ]);

  const { data: exportRequests, isLoading: exportsLoading } = useQuery({
    queryKey: ['/api/data-rights/export/user', userId],
    enabled: !!userId
  });

  const { data: deleteRequest, isLoading: deleteLoading } = useQuery({
    queryKey: ['/api/data-rights/delete-account', userId],
    enabled: !!userId
  });

  const { data: policyAcceptances } = useQuery({
    queryKey: ['/api/data-rights/policies/acceptances', userId],
    enabled: !!userId
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/data-rights/export', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          userRole,
          dataTypes: selectedDataTypes
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-rights/export/user', userId] });
      toast({ title: 'Export request submitted', description: 'We will prepare your data and notify you when ready.' });
      setShowExportDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Export request failed', 
        description: error?.message || 'Please try again later',
        variant: 'destructive' 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/data-rights/delete-account', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          userRole,
          reason: deleteReason
        })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-rights/delete-account', userId] });
      toast({ 
        title: 'Deletion scheduled', 
        description: `Your account will be deleted on ${format(new Date(data.scheduledFor), 'MMMM d, yyyy')}. You can cancel before then.`
      });
      setShowDeleteDialog(false);
      setDeleteReason('');
      setDeleteConfirmed(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Request failed', 
        description: error?.message || 'Please try again later',
        variant: 'destructive' 
      });
    }
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest(`/api/data-rights/delete-account/${requestId}/cancel`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-rights/delete-account', userId] });
      toast({ title: 'Deletion cancelled', description: 'Your account will not be deleted.' });
    },
    onError: () => {
      toast({ title: 'Failed to cancel', variant: 'destructive' });
    }
  });

  const dataTypeOptions = [
    { id: 'profile', label: 'Profile Information', description: 'Your name, email, phone, and preferences' },
    { id: 'kyc', label: 'Identity Documents', description: 'ID verification and KYC data' },
    { id: 'rides', label: 'Ride History', description: 'All your past rides and trips' },
    { id: 'orders', label: 'Order History', description: 'Food and delivery orders' },
    { id: 'devices', label: 'Devices', description: 'Devices used to access your account' },
    { id: 'logins', label: 'Login History', description: 'Recent login activity' },
    { id: 'ratings', label: 'Ratings & Reviews', description: 'Ratings you have given and received' },
  ];

  const toggleDataType = (id: string) => {
    setSelectedDataTypes(prev => 
      prev.includes(id) 
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'scheduled':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const hasPendingDeletion = deleteRequest && ['pending', 'scheduled', 'processing'].includes(deleteRequest.status);

  return (
    <div className="min-h-screen bg-background" data-testid="page-data-privacy">
      <div className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation(backUrl)}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg" data-testid="text-page-title">Data & Privacy</h1>
            <p className="text-sm text-muted-foreground">Manage your data and privacy settings</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download Your Data
            </CardTitle>
            <CardDescription>
              Request a copy of all your SafeGo data. This includes your profile, ride history, orders, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                Your data will be prepared within 24-48 hours and available for download for 7 days.
              </AlertDescription>
            </Alert>

            {Array.isArray(exportRequests) && exportRequests.length > 0 && (
              <div className="space-y-2">
                <Label>Recent Export Requests</Label>
                {exportRequests.slice(0, 3).map((req: any) => (
                  <div 
                    key={req.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`export-request-${req.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {format(new Date(req.createdAt), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.dataTypes.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(req.status)}
                      {req.status === 'completed' && req.fileUrl && (
                        <Button size="sm" data-testid={`button-download-${req.id}`}>
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button 
              onClick={() => setShowExportDialog(true)}
              className="w-full"
              data-testid="button-request-export"
            >
              <Download className="w-4 h-4 mr-2" />
              Request Data Export
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy Policy
            </CardTitle>
            <CardDescription>
              Review how we collect, use, and protect your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/customer/privacy-policy">
              <Button variant="outline" className="w-full" data-testid="button-view-privacy">
                <FileText className="w-4 h-4 mr-2" />
                View Privacy Policy
              </Button>
            </Link>
            {Array.isArray(policyAcceptances) && policyAcceptances.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Last accepted: {format(new Date(policyAcceptances[0].acceptedAt), 'MMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </CardTitle>
            <CardDescription>
              Permanently delete your SafeGo account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Account deletion is permanent and cannot be undone. You will have 72 hours to cancel your request.
              </AlertDescription>
            </Alert>

            {hasPendingDeletion && deleteRequest && (
              <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Deletion Scheduled</p>
                    <p className="text-sm text-muted-foreground">
                      Your account will be deleted on {format(new Date(deleteRequest.scheduledFor), 'MMMM d, yyyy at h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(deleteRequest.status)}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  onClick={() => cancelDeletionMutation.mutate(deleteRequest.id)}
                  disabled={cancelDeletionMutation.isPending}
                  data-testid="button-cancel-deletion"
                >
                  Cancel Deletion Request
                </Button>
              </div>
            )}

            {!hasPendingDeletion && (
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full"
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Data Export</DialogTitle>
            <DialogDescription>
              Select which data you want to include in your export
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dataTypeOptions.map((option) => (
              <div 
                key={option.id}
                className="flex items-start space-x-3"
                data-testid={`checkbox-datatype-${option.id}`}
              >
                <Checkbox 
                  id={option.id}
                  checked={selectedDataTypes.includes(option.id)}
                  onCheckedChange={() => toggleDataType(option.id)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor={option.id} className="cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || selectedDataTypes.length === 0}
              data-testid="button-confirm-export"
            >
              {exportMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Request Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Your Account</DialogTitle>
            <DialogDescription>
              This action will permanently delete your account after a 72-hour waiting period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>All your personal data will be anonymized</li>
                  <li>Your ride and order history will be preserved for legal compliance</li>
                  <li>Any pending payouts will be processed before deletion</li>
                  <li>You will not be able to recover your account</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div>
              <Label>Reason for leaving (optional)</Label>
              <Textarea 
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Help us improve by sharing why you're leaving..."
                className="mt-2"
                data-testid="input-delete-reason"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="confirm-delete"
                checked={deleteConfirmed}
                onCheckedChange={(checked) => setDeleteConfirmed(checked as boolean)}
                data-testid="checkbox-confirm-delete"
              />
              <Label htmlFor="confirm-delete" className="cursor-pointer text-sm">
                I understand that my account will be permanently deleted and this cannot be undone
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || !deleteConfirmed}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Schedule Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
