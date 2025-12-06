import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Building2,
  Store,
  RefreshCw,
  Loader2,
  DollarSign,
  Calendar,
  Filter,
  Send,
} from "lucide-react";

interface PayoutRequest {
  id: string;
  requesterId: string;
  requesterType: string;
  requesterRole: string;
  requesterName: string;
  countryCode: string;
  requestedAmount: number;
  currency: string;
  payoutMethod: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  status: string;
  statusNote: string;
  approvedBy: string;
  approvedAt: string;
  rejectedBy: string;
  rejectedAt: string;
  rejectionReason: string;
  processedBy: string;
  processedAt: string;
  completedAt: string;
  externalRefId: string;
  feeAmount: number;
  netAmount: number;
  createdAt: string;
}

export default function PayoutCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [externalRefId, setExternalRefId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null);

  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    if (activeTab !== "all") params.status = activeTab;
    if (typeFilter !== "all") params.requesterType = typeFilter;
    if (countryFilter !== "all") params.countryCode = countryFilter;
    if (methodFilter !== "all") params.payoutMethod = methodFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  };

  const { data: requestsData, isLoading, refetch } = useQuery<{ requests: PayoutRequest[]; total: number }>({
    queryKey: ["/api/settlement-finance/payout-requests", buildQueryParams()],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      return apiRequest("POST", `/api/settlement-finance/payout-requests/${id}/approve`, { note });
    },
    onSuccess: () => {
      toast({ title: "Payout approved successfully" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-finance/dashboard"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/settlement-finance/payout-requests/${id}/reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Payout rejected" });
      refetch();
      setRejectReason("");
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async ({ id, externalRefId }: { id: string; externalRefId: string }) => {
      return apiRequest("POST", `/api/settlement-finance/payout-requests/${id}/process`, { externalRefId });
    },
    onSuccess: () => {
      toast({ title: "Payout processed successfully" });
      refetch();
      setExternalRefId("");
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const exportCSV = () => {
    const params = new URLSearchParams(buildQueryParams());
    window.open(`/api/settlement-finance/payout-requests/export?${params.toString()}`, "_blank");
  };

  const formatCurrency = (amount: number, currency = "BDT") => {
    return new Intl.NumberFormat("en-BD", { style: "currency", currency }).format(amount);
  };

  const formatDate = (date: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "outline",
      processing: "outline",
      completed: "default",
      rejected: "destructive",
      cancelled: "destructive",
    };
    const icons: Record<string, any> = {
      pending: Clock,
      approved: CheckCircle,
      processing: Loader2,
      completed: CheckCircle,
      rejected: XCircle,
      cancelled: XCircle,
    };
    const Icon = icons[status] || Clock;
    return (
      <Badge variant={variants[status] || "secondary"} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      driver: Users,
      restaurant: Building2,
      shop: Store,
    };
    const Icon = icons[type] || Users;
    return <Icon className="h-4 w-4" />;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      bkash: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      nagad: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      bank_transfer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      stripe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${colors[method] || "bg-gray-100 text-gray-800"}`}>
        {method.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Payout Center</h1>
          <p className="text-muted-foreground">Universal Payout Management (Task 27)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} data-testid="button-export">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Payout Requests</CardTitle>
              <CardDescription>Manage payout requests from drivers, restaurants, and shops</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="driver">Drivers</SelectItem>
                  <SelectItem value="restaurant">Restaurants</SelectItem>
                  <SelectItem value="shop">Shops</SelectItem>
                </SelectContent>
              </Select>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-32" data-testid="select-country-filter">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-32" data-testid="select-method-filter">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
                data-testid="input-start-date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" data-testid="tab-pending">
                <Clock className="mr-2 h-4 w-4" />
                Pending
              </TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                <Send className="mr-2 h-4 w-4" />
                Completed
              </TabsTrigger>
              <TabsTrigger value="rejected" data-testid="tab-rejected">
                <XCircle className="mr-2 h-4 w-4" />
                Rejected
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">
                All
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requester</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsData?.requests?.map((request) => (
                      <TableRow key={request.id} data-testid={`row-payout-${request.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(request.requesterType)}
                            <div>
                              <div className="font-medium">{request.requesterName || request.requesterId.slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">{request.countryCode}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{request.requesterType}</Badge>
                        </TableCell>
                        <TableCell>{getMethodBadge(request.payoutMethod)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{formatCurrency(Number(request.requestedAmount), request.currency)}</div>
                            {Number(request.feeAmount) > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Fee: {formatCurrency(Number(request.feeAmount), request.currency)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{request.accountNumber || "-"}</div>
                            <div className="text-xs text-muted-foreground">{request.accountName || request.bankName || ""}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(request.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveMutation.mutate({ id: request.id })}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-${request.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedRequest(request)}
                                      data-testid={`button-reject-${request.id}`}
                                    >
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Reject Payout Request</DialogTitle>
                                      <DialogDescription>
                                        Rejecting payout of {formatCurrency(Number(request.requestedAmount))} for {request.requesterType}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Rejection Reason</Label>
                                        <Textarea
                                          value={rejectReason}
                                          onChange={(e) => setRejectReason(e.target.value)}
                                          placeholder="Enter reason for rejection"
                                          data-testid="input-reject-reason"
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        variant="destructive"
                                        onClick={() => rejectMutation.mutate({ id: request.id, reason: rejectReason })}
                                        disabled={!rejectReason || rejectMutation.isPending}
                                        data-testid="button-confirm-reject"
                                      >
                                        {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject Payout"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                            {request.status === "approved" && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedRequest(request)}
                                    data-testid={`button-process-${request.id}`}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Process
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Process Payout</DialogTitle>
                                    <DialogDescription>
                                      Processing payout of {formatCurrency(Number(request.netAmount))} via {request.payoutMethod}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>External Reference ID</Label>
                                      <Input
                                        value={externalRefId}
                                        onChange={(e) => setExternalRefId(e.target.value)}
                                        placeholder="Enter transaction reference from payment gateway"
                                        data-testid="input-external-ref"
                                      />
                                    </div>
                                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span>Account:</span>
                                        <span className="font-mono">{request.accountNumber}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Name:</span>
                                        <span>{request.accountName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Method:</span>
                                        <span>{request.payoutMethod}</span>
                                      </div>
                                      <div className="flex justify-between font-semibold">
                                        <span>Net Amount:</span>
                                        <span>{formatCurrency(Number(request.netAmount))}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      onClick={() => processMutation.mutate({ id: request.id, externalRefId })}
                                      disabled={processMutation.isPending}
                                      data-testid="button-confirm-process"
                                    >
                                      {processMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                      Complete Payout
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                            {request.status === "completed" && request.externalRefId && (
                              <span className="text-xs font-mono text-muted-foreground">
                                Ref: {request.externalRefId}
                              </span>
                            )}
                            {request.status === "rejected" && request.rejectionReason && (
                              <span className="text-xs text-destructive max-w-32 truncate" title={request.rejectionReason}>
                                {request.rejectionReason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!requestsData?.requests || requestsData.requests.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No payout requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
