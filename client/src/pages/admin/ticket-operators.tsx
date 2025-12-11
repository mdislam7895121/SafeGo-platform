import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, Ticket, Search, CheckCircle, XCircle, Clock, 
  Eye, MoreHorizontal, Ban, Bus, Ship, Train, Car, RefreshCw, Route, Truck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface TicketOperator {
  id: string;
  operatorName: string;
  operatorType: string;
  phoneNumber: string;
  verificationStatus: string;
  ticketCommissionRate: number;
  rentalCommissionRate: number;
  walletBalance: number;
  negativeBalance: number;
  logoUrl?: string;
  createdAt: string;
  user: { id: string; email: string; fullName?: string; isBlocked: boolean };
  _count: { routes: number; vehicles: number; ticketBookings: number; rentalBookings: number };
}

interface TicketOperatorsResponse {
  success: boolean;
  ticketOperators: TicketOperator[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock, label: "Pending" },
  approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "Rejected" },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Ban, label: "Suspended" },
};

const OPERATOR_TYPE_ICONS: Record<string, any> = {
  bus_company: Bus,
  ferry_company: Ship,
  train_operator: Train,
  rental_service: Car,
};

export default function TicketOperatorsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; operator: TicketOperator | null; action: string }>({
    open: false, operator: null, action: ""
  });
  const [rejectionReason, setRejectionReason] = useState("");

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (typeFilter !== "all") queryParams.set("operatorType", typeFilter);
  queryParams.set("page", page.toString());
  queryParams.set("limit", "20");

  const { data, isLoading, refetch } = useQuery<TicketOperatorsResponse>({
    queryKey: ["/api/admin/ticket-operators", queryParams.toString()],
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/ticket-operators/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ticket-operators"] });
      toast({ title: "Status updated", description: "Ticket operator status has been updated" });
      setActionDialog({ open: false, operator: null, action: "" });
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = (operator: TicketOperator, action: string) => {
    if (action === "reject") {
      setActionDialog({ open: true, operator, action });
    } else if (action === "approve") {
      statusMutation.mutate({ id: operator.id, status: "approved" });
    }
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Rejection reason required", variant: "destructive" });
      return;
    }
    if (actionDialog.operator) {
      statusMutation.mutate({ id: actionDialog.operator.id, status: "rejected", rejectionReason });
    }
  };

  const getOperatorTypeLabel = (type: string) => {
    switch (type) {
      case "bus_company": return "Bus Company";
      case "ferry_company": return "Ferry Company";
      case "train_operator": return "Train Operator";
      case "rental_service": return "Rental Service";
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Ticket & Rental Operators</h1>
              <p className="text-muted-foreground">Manage Bangladesh transportation operators</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by operator name or email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40" data-testid="select-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bus_company">Bus Company</SelectItem>
                  <SelectItem value="ferry_company">Ferry Company</SelectItem>
                  <SelectItem value="train_operator">Train Operator</SelectItem>
                  <SelectItem value="rental_service">Rental Service</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Ticket Operators ({data?.pagination?.total || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))
              ) : !data?.ticketOperators?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No ticket operators found</p>
                </div>
              ) : (
                data.ticketOperators.map((operator) => {
                  const statusConf = STATUS_CONFIG[operator.verificationStatus?.toLowerCase()] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  const TypeIcon = OPERATOR_TYPE_ICONS[operator.operatorType] || Ticket;
                  return (
                    <div 
                      key={operator.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`row-operator-${operator.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                          {operator.logoUrl ? (
                            <img src={operator.logoUrl} alt={operator.operatorName} className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <TypeIcon className="h-6 w-6 text-teal-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{operator.operatorName}</span>
                            <Badge variant="outline" className="text-xs">
                              {getOperatorTypeLabel(operator.operatorType)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{operator.user.email}</span>
                            <span>•</span>
                            <span>{operator.phoneNumber}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Route className="h-3 w-3" />
                              {operator._count.routes} routes
                            </span>
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {operator._count.vehicles} vehicles
                            </span>
                            <span className="flex items-center gap-1">
                              <Ticket className="h-3 w-3" />
                              {operator._count.ticketBookings} tickets
                            </span>
                            <span>Joined {format(new Date(operator.createdAt), "MMM d, yyyy")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusConf.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                        {operator.user.isBlocked && (
                          <Badge variant="destructive">Blocked</Badge>
                        )}
                        <Link href={`/admin/ticket-operators/${operator.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${operator.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" data-testid={`button-actions-${operator.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {operator.verificationStatus?.toLowerCase() === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAction(operator, "approve")}>
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction(operator, "reject")}>
                                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/ticket-operators/${operator.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {data?.pagination && data.pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.pagination.pages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, operator: null, action: "" })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Ticket Operator</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {actionDialog.operator?.operatorName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Enter the reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog({ open: false, operator: null, action: "" })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={statusMutation.isPending}>
                {statusMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
