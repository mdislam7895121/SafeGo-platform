import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Fingerprint, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface KycVerification {
  id: string;
  userType: string;
  userId: string;
  countryCode: string;
  provider: string;
  documentType: string;
  responseStatus: string;
  matchScore?: number;
  responseMessage?: string;
  autoTriggered: boolean;
  createdAt: string;
  completedAt?: string;
}

interface KycStats {
  total: number;
  pending: number;
  matched: number;
  mismatched: number;
  errors: number;
  manualReview: number;
}

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { variant: "secondary", icon: Clock },
  match: { variant: "default", icon: CheckCircle },
  mismatch: { variant: "destructive", icon: XCircle },
  manual_review: { variant: "outline", icon: AlertTriangle },
  error: { variant: "destructive", icon: XCircle },
};

export default function KycVerificationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; verification: KycVerification | null }>({
    open: false,
    verification: null,
  });
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"match" | "mismatch">("match");

  const { data: stats, isLoading: statsLoading } = useQuery<{ stats: KycStats }>({
    queryKey: ["/api/admin/kyc/stats", selectedCountry !== "all" ? `?countryCode=${selectedCountry}` : ""],
  });

  const { data: pending, isLoading: pendingLoading } = useQuery<{ verifications: KycVerification[] }>({
    queryKey: ["/api/admin/kyc/pending", selectedCountry !== "all" ? `?countryCode=${selectedCountry}` : ""],
    refetchInterval: 10000,
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { logId: string; action: string; decision?: string; notes: string }) => {
      return apiRequest(`/api/admin/kyc/${data.logId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: data.action,
          decision: data.decision,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/pending"] });
      toast({
        title: "Review completed",
        description: "KYC verification has been reviewed.",
      });
      setReviewDialog({ open: false, verification: null });
      setReviewNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Review failed",
        description: error.message || "Failed to complete review",
        variant: "destructive",
      });
    },
  });

  const handleReview = () => {
    if (!reviewDialog.verification || !reviewNotes.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide review notes",
        variant: "destructive",
      });
      return;
    }
    reviewMutation.mutate({
      logId: reviewDialog.verification.id,
      action: "resolve",
      decision: reviewDecision,
      notes: reviewNotes,
    });
  };

  const handleMarkForReview = (verification: KycVerification) => {
    const notes = prompt("Enter reason for manual review:");
    if (notes) {
      reviewMutation.mutate({
        logId: verification.id,
        action: "mark_review",
        notes,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">KYC Verification Management</h1>
              <p className="text-sm opacity-80">Real-time identity verification and manual review</p>
            </div>
          </div>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-40 bg-primary-foreground/10 border-primary-foreground/20" data-testid="select-country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="BD">Bangladesh</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {statsLoading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold" data-testid="text-total">{stats?.stats.total || 0}</div>
                  <p className="text-sm text-muted-foreground">Total Verifications</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending">{stats?.stats.pending || 0}</div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600" data-testid="text-matched">{stats?.stats.matched || 0}</div>
                  <p className="text-sm text-muted-foreground">Matched</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600" data-testid="text-mismatched">{stats?.stats.mismatched || 0}</div>
                  <p className="text-sm text-muted-foreground">Mismatched</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-review">{stats?.stats.manualReview || 0}</div>
                  <p className="text-sm text-muted-foreground">Manual Review</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-gray-600" data-testid="text-errors">{stats?.stats.errors || 0}</div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5" />
                  Pending Verifications
                </CardTitle>
                <CardDescription>Verifications requiring attention</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/pending"] })}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !pending?.verifications || pending.verifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No pending verifications</p>
                <p className="text-sm">All verifications have been processed</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.verifications.map((v) => {
                  const statusConfig = STATUS_BADGES[v.responseStatus] || STATUS_BADGES.pending;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`verification-${v.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Fingerprint className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{v.userType.charAt(0).toUpperCase() + v.userType.slice(1)}</span>
                            <Badge variant="outline">{v.documentType}</Badge>
                            <Badge variant="outline">{v.countryCode}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Provider: {v.provider} | {new Date(v.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {v.matchScore !== undefined && (
                          <div className="text-right">
                            <div className="text-sm font-medium">{v.matchScore}%</div>
                            <Progress value={v.matchScore} className="w-20 h-2" />
                          </div>
                        )}
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {v.responseStatus.replace("_", " ")}
                        </Badge>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReviewDialog({ open: true, verification: v })}
                            data-testid={`button-review-${v.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                          {v.responseStatus !== "manual_review" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkForReview(v)}
                              data-testid={`button-flag-${v.id}`}
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={reviewDialog.open} onOpenChange={(open) => {
        setReviewDialog({ open, verification: open ? reviewDialog.verification : null });
        if (!open) setReviewNotes("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review KYC Verification</DialogTitle>
          </DialogHeader>
          {reviewDialog.verification && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">User Type</Label>
                  <p className="font-medium">{reviewDialog.verification.userType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Document Type</Label>
                  <p className="font-medium">{reviewDialog.verification.documentType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Country</Label>
                  <p className="font-medium">{reviewDialog.verification.countryCode}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Provider</Label>
                  <p className="font-medium">{reviewDialog.verification.provider}</p>
                </div>
                {reviewDialog.verification.matchScore !== undefined && (
                  <div>
                    <Label className="text-muted-foreground">Match Score</Label>
                    <p className="font-medium">{reviewDialog.verification.matchScore}%</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-medium">{reviewDialog.verification.responseStatus}</p>
                </div>
              </div>

              {reviewDialog.verification.responseMessage && (
                <div>
                  <Label className="text-muted-foreground">Provider Message</Label>
                  <p className="text-sm">{reviewDialog.verification.responseMessage}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={reviewDecision} onValueChange={(v: "match" | "mismatch") => setReviewDecision(v)}>
                  <SelectTrigger data-testid="select-decision">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="match">Approve (Match)</SelectItem>
                    <SelectItem value="mismatch">Reject (Mismatch)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Review Notes</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter your review notes..."
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, verification: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
