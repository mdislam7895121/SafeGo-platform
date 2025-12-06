import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flag,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  MessageSquare,
  Filter,
  Search,
  Shield,
  User,
  Car,
  Store,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string;
  reporterId: string;
  reporterRole: string;
  targetId: string;
  targetRole: string;
  rideId?: string;
  orderId?: string;
  category: string;
  reason: string;
  description?: string;
  status: string;
  priority?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  actionTaken?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  under_review: "bg-blue-500",
  resolved: "bg-green-500",
  dismissed: "bg-gray-500",
  escalated: "bg-red-500",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-yellow-400",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

const roleIcons: Record<string, React.ElementType> = {
  customer: User,
  driver: Car,
  restaurant: Store,
  shop_partner: Package,
};

export default function ReportsManagement() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    targetRole: "",
  });
  const [reviewForm, setReviewForm] = useState({
    status: "",
    priority: "",
    reviewNote: "",
    actionTaken: "",
  });
  const { toast } = useToast();

  const { data: reportsData, isLoading } = useQuery<{
    success: boolean;
    reports: Report[];
    pagination: { total: number };
  }>({
    queryKey: ["/api/policy-safety/reports", filters],
  });

  const updateReportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/policy-safety/reports/${selectedReport?.id}`, {
        method: "PATCH",
        body: JSON.stringify(reviewForm),
      });
    },
    onSuccess: () => {
      toast({ title: "Report Updated", description: "The report has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-safety/reports"] });
      setReviewDialogOpen(false);
      setSelectedReport(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update report.", variant: "destructive" });
    },
  });

  const handleReview = (report: Report) => {
    setSelectedReport(report);
    setReviewForm({
      status: report.status,
      priority: report.priority || "medium",
      reviewNote: report.reviewNote || "",
      actionTaken: report.actionTaken || "",
    });
    setReviewDialogOpen(true);
  };

  const reports = reportsData?.reports || [];
  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const underReviewCount = reports.filter((r) => r.status === "under_review").length;
  const criticalCount = reports.filter((r) => r.priority === "critical").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Reports Management</h1>
          <p className="text-muted-foreground">Review and manage user reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{underReviewCount}</p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Flag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.length}</p>
                <p className="text-sm text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle>All Reports</CardTitle>
            <CardDescription>User-submitted reports requiring review</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="fraud">Fraud</SelectItem>
                <SelectItem value="inappropriate_behavior">Inappropriate</SelectItem>
                <SelectItem value="service_issue">Service Issue</SelectItem>
                <SelectItem value="vehicle_issue">Vehicle Issue</SelectItem>
                <SelectItem value="policy_violation">Policy Violation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const ReporterIcon = roleIcons[report.reporterRole] || User;
                  const TargetIcon = roleIcons[report.targetRole] || User;
                  return (
                    <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ReporterIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">{report.reporterRole}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TargetIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">{report.targetRole}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {report.category.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{report.reason}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[report.status] || "bg-gray-500"}>
                          {report.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.priority && (
                          <Badge variant="outline" className={`${priorityColors[report.priority]} text-white`}>
                            {report.priority}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(report.createdAt), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(report)}
                          data-testid={`button-review-${report.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
            <DialogDescription>Review and take action on this report</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Reporter</p>
                  <p className="font-medium capitalize">{selectedReport.reporterRole}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Target</p>
                  <p className="font-medium capitalize">{selectedReport.targetRole}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Category</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedReport.category.replace("_", " ")}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Reason</p>
                  <p className="font-medium">{selectedReport.reason}</p>
                </div>
              </div>

              {selectedReport.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedReport.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={reviewForm.status} onValueChange={(v) => setReviewForm({ ...reviewForm, status: v })}>
                    <SelectTrigger data-testid="select-review-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={reviewForm.priority} onValueChange={(v) => setReviewForm({ ...reviewForm, priority: v })}>
                    <SelectTrigger data-testid="select-review-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Review Notes</label>
                <Textarea
                  placeholder="Add your review notes..."
                  value={reviewForm.reviewNote}
                  onChange={(e) => setReviewForm({ ...reviewForm, reviewNote: e.target.value })}
                  rows={3}
                  data-testid="input-review-note"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Action Taken</label>
                <Textarea
                  placeholder="Describe any actions taken..."
                  value={reviewForm.actionTaken}
                  onChange={(e) => setReviewForm({ ...reviewForm, actionTaken: e.target.value })}
                  rows={2}
                  data-testid="input-action-taken"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => updateReportMutation.mutate()}
              disabled={updateReportMutation.isPending}
              data-testid="button-save-review"
            >
              {updateReportMutation.isPending ? "Saving..." : "Save Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
