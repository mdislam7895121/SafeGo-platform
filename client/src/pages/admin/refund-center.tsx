import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, RefreshCw, Search, Filter, AlertTriangle, CheckCircle, Clock, XCircle, MoreVertical, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EligibleItem {
  id: string;
  type: "ride" | "food" | "parcel";
  fare?: number;
  total?: number;
  commission?: number;
  driverPayout?: number;
  taxes?: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  customer: {
    id: string;
    user: { firstName: string; lastName: string; email: string };
  };
  driver?: {
    id: string;
    user: { firstName: string; lastName: string };
  };
  restaurant?: {
    id: string;
    user: { firstName: string; lastName: string };
  };
}

interface EligibleResponse {
  rides: EligibleItem[];
  foodOrders: EligibleItem[];
  deliveries: EligibleItem[];
}

interface RefundDecision {
  id: string;
  orderType: string;
  orderId: string;
  issueType: string;
  issueDescription: string | null;
  originalAmount: number;
  recommendedRefund: number;
  actualRefund: number;
  decisionType: string;
  autoApproved: boolean;
  adminReviewedBy: string | null;
  adminReviewedAt: string | null;
  adminDecision: string | null;
  adminNotes: string | null;
  processingStatus: string;
  createdAt: string;
}

interface DecisionsResponse {
  decisions: RefundDecision[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function RefundCenter() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("eligible");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<EligibleItem | null>(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [refundType, setRefundType] = useState<"full" | "partial" | "credit">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNotes, setRefundNotes] = useState("");

  const { data: eligibleData, isLoading: eligibleLoading } = useQuery<EligibleResponse>({
    queryKey: ["/api/admin/phase4/refunds/eligible"],
  });

  const buildDecisionsQueryUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    params.append("page", String(currentPage));
    params.append("limit", "20");
    return `/api/admin/phase4/refunds/decisions?${params.toString()}`;
  };

  const decisionsQueryUrl = buildDecisionsQueryUrl();
  const { data: decisionsData, isLoading: decisionsLoading } = useQuery<DecisionsResponse>({
    queryKey: [decisionsQueryUrl],
  });

  const processRefundMutation = useMutation({
    mutationFn: async (data: { orderType: string; orderId: string; refundType: string; amount: number; reason: string; notes: string }) => {
      return apiRequest("/api/admin/phase4/refunds/process", {
        method: "POST",
        body: JSON.stringify({
          orderType: data.orderType,
          orderId: data.orderId,
          refundType: data.refundType,
          amount: data.amount,
          reason: data.reason,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Refund processed successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/refunds") });
      setShowProcessDialog(false);
      setSelectedItem(null);
      setRefundAmount("");
      setRefundReason("");
      setRefundNotes("");
      setRefundType("full");
    },
    onError: () => {
      toast({ title: "Failed to process refund", variant: "destructive" });
    },
  });

  const getAllEligibleItems = (): EligibleItem[] => {
    if (!eligibleData) return [];
    const items: EligibleItem[] = [
      ...eligibleData.rides,
      ...eligibleData.foodOrders,
      ...eligibleData.deliveries,
    ];
    if (typeFilter !== "all") {
      return items.filter(item => item.type === typeFilter);
    }
    return items;
  };

  const getItemAmount = (item: EligibleItem): number => {
    return item.fare || item.total || 0;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "ride":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Ride</Badge>;
      case "food":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">Food</Badge>;
      case "parcel":
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Parcel</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleOpenProcess = (item: EligibleItem) => {
    setSelectedItem(item);
    setRefundAmount(getItemAmount(item).toString());
    setShowProcessDialog(true);
  };

  const submitProcess = () => {
    if (!selectedItem) return;
    processRefundMutation.mutate({
      orderType: selectedItem.type,
      orderId: selectedItem.id,
      refundType: refundType,
      amount: parseFloat(refundAmount),
      reason: refundReason,
      notes: refundNotes,
    });
  };

  const eligibleItems = getAllEligibleItems();

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Refund & Adjustment Center</h1>
            <p className="text-sm opacity-90">Process refunds, adjustments, and compensation claims</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Eligible Rides</p>
                  <p className="text-2xl font-bold">{eligibleData?.rides?.length || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Eligible Food Orders</p>
                  <p className="text-2xl font-bold">{eligibleData?.foodOrders?.length || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Eligible Deliveries</p>
                  <p className="text-2xl font-bold">{eligibleData?.deliveries?.length || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Past Decisions</p>
                  <p className="text-2xl font-bold">{decisionsData?.pagination?.total || 0}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="eligible">Eligible for Refund</TabsTrigger>
            <TabsTrigger value="decisions">Past Decisions</TabsTrigger>
          </TabsList>

          <TabsContent value="eligible">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Orders Eligible for Refund</CardTitle>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-type">
                      <SelectValue placeholder="Order Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="ride">Rides</SelectItem>
                      <SelectItem value="food">Food Orders</SelectItem>
                      <SelectItem value="parcel">Parcels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription>Recent completed orders from the last 7 days that can be refunded</CardDescription>
              </CardHeader>
              <CardContent>
                {eligibleLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !eligibleItems.length ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No eligible orders found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {eligibleItems.map((item) => (
                      <Card key={item.id} className="hover-elevate cursor-pointer" data-testid={`card-eligible-${item.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {getTypeBadge(item.type)}
                                <span className="font-mono text-sm">#{item.id.slice(-8)}</span>
                              </div>
                              <p className="text-sm">
                                {item.customer?.user?.firstName} {item.customer?.user?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">{item.customer?.user?.email}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(item.createdAt), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">${getItemAmount(item).toFixed(2)}</p>
                              <Button 
                                size="sm" 
                                onClick={() => handleOpenProcess(item)}
                                data-testid={`button-process-${item.id}`}
                              >
                                Process Refund
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="decisions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Past Refund Decisions</CardTitle>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {decisionsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !decisionsData?.decisions?.length ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No past decisions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {decisionsData.decisions.map((decision) => (
                      <Card key={decision.id} data-testid={`card-decision-${decision.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {getTypeBadge(decision.orderType)}
                                {getStatusBadge(decision.processingStatus)}
                                <span className="font-mono text-sm">#{decision.orderId.slice(-8)}</span>
                              </div>
                              <p className="text-sm">{decision.issueType}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(decision.createdAt), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">${decision.actualRefund.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground capitalize">{decision.decisionType.replace(/_/g, " ")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Configure the refund details and add any notes.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium capitalize">{selectedItem.type} Order</p>
                <p className="text-sm text-muted-foreground">
                  #{selectedItem.id.slice(-8)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Customer: {selectedItem.customer?.user?.firstName} {selectedItem.customer?.user?.lastName}
                </p>
                <p className="text-sm font-medium mt-2">
                  Original Amount: ${getItemAmount(selectedItem).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Refund Type</Label>
                <Select value={refundType} onValueChange={(v: "full" | "partial" | "credit") => setRefundType(v)}>
                  <SelectTrigger data-testid="select-refund-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Refund</SelectItem>
                    <SelectItem value="partial">Partial Refund</SelectItem>
                    <SelectItem value="credit">Credit Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Refund Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  data-testid="input-refund-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={refundReason} onValueChange={setRefundReason}>
                  <SelectTrigger data-testid="select-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_complaint">Customer Complaint</SelectItem>
                    <SelectItem value="service_issue">Service Issue</SelectItem>
                    <SelectItem value="payment_error">Payment Error</SelectItem>
                    <SelectItem value="cancellation">Cancellation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add any notes..."
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitProcess}
              disabled={processRefundMutation.isPending || !refundReason}
              data-testid="button-confirm-process"
            >
              {processRefundMutation.isPending ? "Processing..." : "Process Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
