import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Car,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  MessageSquare,
  Image,
  Video,
  Download,
  ExternalLink,
  History,
  Receipt,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface Evidence {
  type: string;
  url?: string;
  description: string;
}

interface Dispute {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  rideId: string;
  rideDate: string;
  claimedAmount: number;
  systemAmount: number;
  difference: number;
  disputeReason: string;
  status: string;
  evidence: Evidence[];
  adminDecision?: string | null;
  resolutionNotes?: string | null;
  adjustedAmount?: number;
  reviewerId?: string;
  reviewerName?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface DisputesResponse {
  disputes: Dispute[];
  summary: {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
    totalClaimedDifference: number;
    totalApprovedAdjustments: number;
  };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function EarningsDisputes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | "adjust" | "">("");
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage.toString());
    params.append("limit", "20");
    if (statusFilter !== "all") params.append("status", statusFilter);
    const queryString = params.toString();
    return `/api/admin/phase4/earnings-disputes${queryString ? `?${queryString}` : ""}`;
  };

  const queryUrl = buildQueryUrl();
  const { data, isLoading } = useQuery<DisputesResponse>({
    queryKey: [queryUrl],
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, decision, adjustedAmount, resolutionNotes }: {
      id: string;
      decision: string;
      adjustedAmount?: number;
      resolutionNotes: string;
    }) => {
      return apiRequest(`/api/admin/phase4/earnings-disputes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, adjustedAmount, resolutionNotes }),
      });
    },
    onSuccess: () => {
      toast({ title: "Dispute resolved successfully" });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/earnings-disputes"),
      });
      closeDetailSheet();
    },
    onError: () => {
      toast({ title: "Failed to resolve dispute", variant: "destructive" });
    },
  });

  const openDetailSheet = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDecision("");
    setAdjustedAmount(dispute.claimedAmount.toString());
    setResolutionNotes("");
    setShowDetailSheet(true);
  };

  const closeDetailSheet = () => {
    setShowDetailSheet(false);
    setSelectedDispute(null);
    setDecision("");
    setAdjustedAmount("");
    setResolutionNotes("");
  };

  const handleResolve = () => {
    if (!selectedDispute || !decision || !resolutionNotes) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    resolveDisputeMutation.mutate({
      id: selectedDispute.id,
      decision,
      adjustedAmount: decision === "adjust" ? parseFloat(adjustedAmount) : undefined,
      resolutionNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="destructive">Pending</Badge>;
      case "under_review":
        return <Badge className="bg-blue-500">Under Review</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="secondary">Rejected</Badge>;
      case "adjusted":
        return <Badge className="bg-purple-500">Adjusted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

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
            <h1 className="text-2xl font-bold">Earnings Dispute Resolution</h1>
            <p className="text-sm opacity-90">Review and resolve driver earnings disputes</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Scale className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{data?.summary?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Disputes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Clock className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold text-orange-500">{data?.summary?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Search className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-500">{data?.summary?.underReview || 0}</p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{data?.summary?.approved || 0}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <ArrowUpRight className="h-6 w-6 mx-auto text-amber-500 mb-1" />
                <p className="text-xl font-bold text-amber-500">
                  {formatCurrency(data?.summary?.totalClaimedDifference || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Claimed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <DollarSign className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">
                  {formatCurrency(data?.summary?.totalApprovedAdjustments || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Approved Adjustments</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search disputes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="adjusted">Adjusted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !data?.disputes?.length ? (
              <div className="text-center py-12">
                <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No disputes found</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {data.disputes.map((dispute) => (
                    <Card
                      key={dispute.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => openDetailSheet(dispute)}
                      data-testid={`card-dispute-${dispute.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <DollarSign className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm text-muted-foreground">{dispute.id}</span>
                                {getStatusBadge(dispute.status)}
                              </div>
                              <p className="text-sm line-clamp-2">{dispute.disputeReason}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {dispute.driverName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Car className="h-3 w-3" />
                                  {dispute.rideId}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(dispute.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end mb-1">
                              <span className="text-sm text-muted-foreground">Claimed:</span>
                              <span className="font-bold text-green-600">{formatCurrency(dispute.claimedAmount)}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-end mb-1">
                              <span className="text-sm text-muted-foreground">System:</span>
                              <span className="font-medium">{formatCurrency(dispute.systemAmount)}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-sm text-muted-foreground">Diff:</span>
                              <span className={`font-bold ${dispute.difference > 0 ? "text-red-500" : "text-green-500"}`}>
                                {dispute.difference > 0 ? "+" : ""}
                                {formatCurrency(dispute.difference)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {data?.pagination && data.pagination.total > 20 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm">
                  Page {currentPage} of {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= data.pagination.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={showDetailSheet} onOpenChange={(open) => !open && closeDetailSheet()}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Dispute Details
            </SheetTitle>
            <SheetDescription>
              Review and resolve this earnings dispute
            </SheetDescription>
          </SheetHeader>

          {selectedDispute && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-6">
              <div className="space-y-6 pr-4">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedDispute.status)}
                  <span className="font-mono text-sm text-muted-foreground">{selectedDispute.id}</span>
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Claimed</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(selectedDispute.claimedAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">System</p>
                        <p className="text-xl font-bold">{formatCurrency(selectedDispute.systemAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Difference</p>
                        <p className={`text-xl font-bold ${selectedDispute.difference > 0 ? "text-red-500" : "text-green-500"}`}>
                          {selectedDispute.difference > 0 ? "+" : ""}
                          {formatCurrency(selectedDispute.difference)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Driver</h4>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedDispute.driverName}</p>
                      <p className="text-sm text-muted-foreground">{selectedDispute.driverEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Ride ID</h4>
                    <p className="font-mono text-sm">{selectedDispute.rideId}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Ride Date</h4>
                    <p className="text-sm">{format(new Date(selectedDispute.rideDate), "MMM d, yyyy h:mm a")}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Dispute Reason</h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedDispute.disputeReason}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Evidence</h4>
                  {selectedDispute.evidence?.length ? (
                    <div className="space-y-3">
                      {selectedDispute.evidence.map((item, index) => (
                        <Card key={index} className="overflow-hidden">
                          <CardContent className="p-0">
                            {item.type === "image" || item.type === "screenshot" || item.type === "receipt" ? (
                              <div className="relative">
                                <div className="aspect-video bg-muted flex items-center justify-center">
                                  {item.url ? (
                                    <img
                                      src={item.url}
                                      alt={item.description}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <Image className="h-10 w-10 text-muted-foreground mb-2" />
                                      <p className="text-sm text-muted-foreground">Image Preview</p>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <p className="font-medium text-sm">{item.description}</p>
                                  {item.url && (
                                    <div className="flex gap-2 mt-2">
                                      <Button size="sm" variant="outline" asChild>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Open
                                        </a>
                                      </Button>
                                      <Button size="sm" variant="outline" asChild>
                                        <a href={item.url} download>
                                          <Download className="h-3 w-3 mr-1" />
                                          Download
                                        </a>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : item.type === "video" ? (
                              <div className="relative">
                                <div className="aspect-video bg-muted flex items-center justify-center">
                                  {item.url ? (
                                    <video
                                      src={item.url}
                                      controls
                                      className="w-full h-full"
                                    >
                                      Your browser does not support video playback.
                                    </video>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <Video className="h-10 w-10 text-muted-foreground mb-2" />
                                      <p className="text-sm text-muted-foreground">Video Preview</p>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <p className="font-medium text-sm">{item.description}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3">
                                <div className="flex items-start gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {item.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                    {item.url && (
                                      <div className="flex gap-2 mt-2">
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            View
                                          </a>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-muted/50 rounded-lg">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No evidence attached</p>
                    </div>
                  )}
                </div>

                {selectedDispute.resolutionNotes && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Resolution</h4>
                    <Badge className={
                      selectedDispute.adminDecision === "approved" ? "bg-green-500" :
                      selectedDispute.adminDecision === "rejected" ? "bg-red-500" : "bg-purple-500"
                    }>
                      {selectedDispute.adminDecision?.replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Badge>
                    <p className="text-sm mt-2">{selectedDispute.resolutionNotes}</p>
                    {selectedDispute.adjustedAmount && (
                      <p className="text-sm font-medium mt-2">
                        Adjusted Amount: {formatCurrency(selectedDispute.adjustedAmount)}
                      </p>
                    )}
                    {selectedDispute.reviewerName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Resolved by {selectedDispute.reviewerName} on{" "}
                        {selectedDispute.resolvedAt && format(new Date(selectedDispute.resolvedAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                )}

                {(selectedDispute.status === "pending" || selectedDispute.status === "under_review") && (
                  <>
                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-medium">Make Decision</h4>

                      <div className="flex gap-2">
                        <Button
                          variant={decision === "approve" ? "default" : "outline"}
                          className={decision === "approve" ? "bg-green-500 hover:bg-green-600" : ""}
                          onClick={() => setDecision("approve")}
                          data-testid="button-approve"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant={decision === "reject" ? "default" : "outline"}
                          className={decision === "reject" ? "bg-red-500 hover:bg-red-600" : ""}
                          onClick={() => setDecision("reject")}
                          data-testid="button-reject"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          variant={decision === "adjust" ? "default" : "outline"}
                          className={decision === "adjust" ? "bg-purple-500 hover:bg-purple-600" : ""}
                          onClick={() => setDecision("adjust")}
                          data-testid="button-adjust"
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          Adjust
                        </Button>
                      </div>

                      {decision === "adjust" && (
                        <div>
                          <Label>Adjusted Amount ($)</Label>
                          <Input
                            type="number"
                            value={adjustedAmount}
                            onChange={(e) => setAdjustedAmount(e.target.value)}
                            placeholder="Enter adjusted amount"
                            data-testid="input-adjusted-amount"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Driver claimed: {formatCurrency(selectedDispute.claimedAmount)}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label>Resolution Notes *</Label>
                        <Textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Explain your decision..."
                          className="min-h-[100px]"
                          data-testid="input-notes"
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleResolve}
                        disabled={!decision || !resolutionNotes || resolveDisputeMutation.isPending}
                        data-testid="button-submit"
                      >
                        {resolveDisputeMutation.isPending ? "Processing..." : "Submit Decision"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
