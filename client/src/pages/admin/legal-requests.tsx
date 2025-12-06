import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Scale, FileText, Search, Filter, AlertTriangle, Clock, CheckCircle, XCircle, Eye, Download, Upload, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface LegalRequest {
  id: string;
  requestCode: string;
  country: "USA" | "BD";
  requestType: string;
  subpoenaId: string | null;
  caseId: string | null;
  agencyName: string | null;
  gdNumber: string | null;
  policeStation: string | null;
  ioName: string | null;
  requestingOfficer: string;
  requestingAgency: string;
  contactEmail: string;
  contactPhone: string | null;
  description: string;
  targetUserId: string | null;
  targetDriverId: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  status: string;
  assignedTo: string | null;
  assignedAt: string | null;
  notes: string | null;
  evidencePackage: string | null;
  deliveryMethod: string | null;
  attachments: string[];
  requestExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  auditLogs?: { id: string; action: string; actor: string; actorRole: string; createdAt: string; details: any }[];
}

interface LegalRequestsResponse {
  requests: LegalRequest[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const STATUSES = [
  { value: "received", label: "Received" },
  { value: "verification", label: "Verification" },
  { value: "processing", label: "Processing" },
  { value: "delivered", label: "Delivered" },
  { value: "archived", label: "Archived" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
];

export default function LegalRequestsDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<LegalRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [responseNotes, setResponseNotes] = useState("");

  const buildLegalRequestsQueryUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (countryFilter !== "all") params.append("country", countryFilter);
    params.append("page", String(currentPage));
    params.append("limit", "20");
    return `/api/admin/phase4/legal-requests?${params.toString()}`;
  };

  const legalRequestsQueryUrl = buildLegalRequestsQueryUrl();
  const { data, isLoading, refetch } = useQuery<LegalRequestsResponse>({
    queryKey: [legalRequestsQueryUrl],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; notes?: string }) => {
      return apiRequest(`/api/admin/phase4/legal-requests/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: data.status, notes: data.notes }),
      });
    },
    onSuccess: () => {
      toast({ title: "Status updated successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/legal-requests") });
      setSelectedRequest(null);
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const submitResponseMutation = useMutation({
    mutationFn: async (responseData: { id: string; notes: string; evidencePackage?: string }) => {
      return apiRequest(`/api/admin/phase4/legal-requests/${responseData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: responseData.notes, evidencePackage: responseData.evidencePackage }),
      });
    },
    onSuccess: () => {
      toast({ title: "Notes updated successfully" });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/admin/phase4/legal-requests") });
      setShowResponseDialog(false);
      setResponseNotes("");
      setSelectedRequest(null);
    },
    onError: () => {
      toast({ title: "Failed to update notes", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Received</Badge>;
      case "verification":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Verification</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Processing</Badge>;
      case "delivered":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">Expired</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCountryBadge = (country: string) => {
    switch (country) {
      case "USA":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">USA</Badge>;
      case "BD":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Bangladesh</Badge>;
      default:
        return <Badge variant="outline">{country}</Badge>;
    }
  };

  const openDetail = (request: LegalRequest) => {
    setSelectedRequest(request);
    setShowDetailDialog(true);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Legal Requests Dashboard</h1>
              <p className="text-[11px] text-muted-foreground">Manage law enforcement and legal compliance requests</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{data?.pagination?.total || 0}</p>
                </div>
                <Scale className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="text-2xl font-bold">{data?.requests?.filter(r => r.status === "received").length || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Processing</p>
                  <p className="text-2xl font-bold">{data?.requests?.filter(r => r.status === "processing").length || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold">{data?.requests?.filter(r => r.status === "delivered").length || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-country">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Legal Requests
              </CardTitle>
              <Button variant="outline" size="sm" data-testid="button-new-request">
                <Upload className="h-4 w-4 mr-2" />
                Log New Request
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : !data?.requests?.length ? (
              <div className="text-center py-12">
                <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No legal requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.requests.map((request) => (
                  <Card
                    key={request.id}
                    className={`hover-elevate ${isExpired(request.requestExpiresAt) && !["delivered", "rejected", "archived"].includes(request.status) ? "border-red-500" : ""}`}
                    data-testid={`card-legal-${request.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold">{request.requestCode}</span>
                            <Badge variant="outline">{request.requestType}</Badge>
                            {getStatusBadge(request.status)}
                            {getCountryBadge(request.country)}
                            {isExpired(request.requestExpiresAt) && !["delivered", "rejected", "archived"].includes(request.status) && (
                              <Badge variant="destructive">EXPIRED</Badge>
                            )}
                          </div>
                          <p className="text-sm">
                            <span className="font-medium">Agency:</span> {request.requestingAgency}
                            <span className="mx-2">|</span>
                            <span className="font-medium">Officer:</span> {request.requestingOfficer}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{request.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Created: {format(new Date(request.createdAt), "MMM dd, yyyy")}</span>
                            {request.requestExpiresAt && (
                              <span className={isExpired(request.requestExpiresAt) ? "text-red-500 font-medium" : ""}>
                                Expires: {format(new Date(request.requestExpiresAt), "MMM dd, yyyy")}
                              </span>
                            )}
                            {request.assignedTo && (
                              <span>Assigned: Yes</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDetail(request)}
                            data-testid={`button-view-${request.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {!["delivered", "rejected", "archived"].includes(request.status) && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowResponseDialog(true);
                              }}
                              data-testid={`button-respond-${request.id}`}
                            >
                              Update
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Legal Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Request Code</Label>
                    <p className="font-mono font-bold">{selectedRequest.requestCode}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Request Type</Label>
                    <div className="mt-1"><Badge variant="outline">{selectedRequest.requestType}</Badge></div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Requesting Agency</Label>
                    <p>{selectedRequest.requestingAgency}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Country</Label>
                    <div className="mt-1">{getCountryBadge(selectedRequest.country)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Requesting Officer</Label>
                    <p>{selectedRequest.requestingOfficer}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contact Email</Label>
                    <p>{selectedRequest.contactEmail}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
                {selectedRequest.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm">{selectedRequest.notes}</p>
                  </div>
                )}
                {selectedRequest.attachments?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Attachments</Label>
                    <div className="space-y-2 mt-2">
                      {selectedRequest.attachments.map((attachment, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{attachment}</span>
                          <Button size="sm" variant="ghost" className="ml-auto">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedRequest.auditLogs && selectedRequest.auditLogs.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Audit Log</Label>
                    <div className="space-y-2 mt-2">
                      {selectedRequest.auditLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2 text-sm border-l-2 pl-4 py-1">
                          <span className="text-muted-foreground">{format(new Date(log.createdAt), "MMM dd, HH:mm")}</span>
                          <span>{log.action}</span>
                          <span className="text-muted-foreground">by {log.actorRole}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Legal Request</DialogTitle>
            <DialogDescription>
              Add notes or update status for this legal request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Enter notes about this request..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                className="min-h-[150px]"
                data-testid="textarea-response"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span>All updates are logged and encrypted for compliance.</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResponseDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedRequest) {
                  submitResponseMutation.mutate({ id: selectedRequest.id, notes: responseNotes });
                }
              }}
              disabled={submitResponseMutation.isPending || !responseNotes.trim()}
              data-testid="button-submit-response"
            >
              {submitResponseMutation.isPending ? "Updating..." : "Update Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
