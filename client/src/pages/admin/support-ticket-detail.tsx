import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  DollarSign,
  FileText,
  Send
} from "lucide-react";
import { format } from "date-fns";

type Message = {
  id: string;
  content: string;
  createdAt: string;
  actorRole: string;
  isInternal: boolean;
};

type AuditLog = {
  id: string;
  action: string;
  details: any;
  createdAt: string;
  adminEmail?: string;
};

type Ticket = {
  id: string;
  ticketCode: string;
  serviceType: string;
  serviceId: string;
  issueCategory: string;
  issueDescription: string;
  customerVisibleStatus: string;
  internalStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customerIdentifier: string;
  restaurantName?: string;
  driverName?: string;
  country: string;
  proposedResolution?: {
    resolutionType: string;
    refundAmount?: number;
    note?: string;
  };
  messages: Message[];
  auditLogs: AuditLog[];
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  assigned: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  awaiting_restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  awaiting_customer: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  refund_proposed: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
};

export default function AdminSupportTicketDetail() {
  const [, params] = useRoute("/admin/support/:ticketId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const ticketId = params?.ticketId;

  const [messageContent, setMessageContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [showRefundForm, setShowRefundForm] = useState(false);

  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: ["/api/admin/support/tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to fetch ticket");
      return res.json();
    },
    enabled: !!ticketId
  });

  const replyMutation = useMutation({
    mutationFn: async (data: { content: string; isInternal: boolean }) => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reply sent successfully" });
      setMessageContent("");
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets", ticketId] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to send reply", description: error.message });
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalStatus: status })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated successfully" });
      setNewStatus("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets", ticketId] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to update status", description: error.message });
    }
  });

  const refundMutation = useMutation({
    mutationFn: async (data: { approved: boolean; refundAmount?: number; note?: string }) => {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Refund decision processed" });
      setShowRefundForm(false);
      setRefundAmount("");
      setRefundNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets", ticketId] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to process refund", description: error.message });
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ticket not found</h3>
            <Button onClick={() => navigate("/admin/support")} data-testid="button-back">
              Return to Support Center
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleReply = () => {
    if (!messageContent.trim()) {
      toast({ variant: "destructive", title: "Message cannot be empty" });
      return;
    }
    replyMutation.mutate({ content: messageContent.trim(), isInternal });
  };

  const handleStatusChange = () => {
    if (!newStatus) return;
    statusMutation.mutate(newStatus);
  };

  const handleRefundApprove = () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      toast({ variant: "destructive", title: "Please enter a valid refund amount" });
      return;
    }
    refundMutation.mutate({
      approved: true,
      refundAmount: parseFloat(refundAmount),
      note: refundNote.trim() || undefined
    });
  };

  const handleRefundDeny = () => {
    refundMutation.mutate({
      approved: false,
      note: refundNote.trim() || undefined
    });
  };

  const getServiceLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      food_order: "Food Order",
      ride: "Ride",
      delivery: "Parcel Delivery"
    };
    return labels[serviceType] || serviceType;
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin/support")}
        className="mb-4"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Support Center
      </Button>

      {/* Ticket Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold" data-testid="text-ticket-code">
                {ticket.ticketCode}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" data-testid="badge-service-type">
                  {getServiceLabel(ticket.serviceType)}
                </Badge>
                <Badge className={statusColors[ticket.internalStatus]} data-testid="badge-status">
                  {getStatusLabel(ticket.internalStatus)}
                </Badge>
                <Badge variant="outline" data-testid="badge-priority">
                  {ticket.priority.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground ml-2" data-testid="text-country">
                  {ticket.country}
                </span>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div data-testid="text-created">Created {format(new Date(ticket.createdAt), "PPp")}</div>
              <div>Updated {format(new Date(ticket.updatedAt), "PPp")}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Customer</Label>
              <div className="font-mono" data-testid="text-customer">
                {ticket.customerIdentifier}
              </div>
            </div>
            {ticket.restaurantName && (
              <div>
                <Label className="text-muted-foreground">Restaurant</Label>
                <div data-testid="text-restaurant">{ticket.restaurantName}</div>
              </div>
            )}
            {ticket.driverName && (
              <div>
                <Label className="text-muted-foreground">Driver</Label>
                <div data-testid="text-driver">{ticket.driverName}</div>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Issue Category</Label>
              <div data-testid="text-category">{ticket.issueCategory.replace(/_/g, " ")}</div>
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <Label className="text-muted-foreground">Issue Description</Label>
            <p className="mt-1" data-testid="text-description">{ticket.issueDescription}</p>
          </div>

          {ticket.proposedResolution && (
            <>
              <Separator className="my-4" />
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Proposed Resolution (Pending Admin Approval)
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span data-testid="text-proposed-type">{ticket.proposedResolution.resolutionType}</span>
                  </div>
                  {ticket.proposedResolution.refundAmount && (
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      <span data-testid="text-proposed-amount">${ticket.proposedResolution.refundAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {ticket.proposedResolution.note && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Note:</span>{" "}
                      <span data-testid="text-proposed-note">{ticket.proposedResolution.note}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation Thread */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Conversation ({ticket.messages.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-md ${
                    message.isInternal
                      ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                      : "bg-card border"
                  }`}
                  data-testid={`message-${message.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={message.actorRole === "ADMIN" ? "default" : "outline"}
                        data-testid={`badge-role-${message.id}`}
                      >
                        {message.actorRole}
                      </Badge>
                      {message.isInternal && (
                        <Badge variant="secondary" data-testid={`badge-internal-${message.id}`}>
                          Internal Note
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" data-testid={`text-content-${message.id}`}>
                    {message.content}
                  </p>
                </div>
              ))}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Reply as Admin</Label>
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded"
                    data-testid="checkbox-internal"
                  />
                  <Label className="text-sm text-muted-foreground">Internal note (not visible to customer/restaurant)</Label>
                </div>
                <Textarea
                  placeholder="Type your message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  data-testid="textarea-message"
                />
                <Button
                  onClick={handleReply}
                  disabled={replyMutation.isPending}
                  data-testid="button-send-reply"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions & Audit */}
        <div className="space-y-6">
          {/* Status Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-new-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="awaiting_restaurant">Awaiting Restaurant</SelectItem>
                  <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusChange}
                disabled={!newStatus || statusMutation.isPending}
                className="w-full"
                data-testid="button-update-status"
              >
                Update Status
              </Button>
            </CardContent>
          </Card>

          {/* Refund Management */}
          {ticket.proposedResolution && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Refund Decision
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!showRefundForm ? (
                  <Button
                    onClick={() => setShowRefundForm(true)}
                    variant="outline"
                    className="w-full"
                    data-testid="button-show-refund-form"
                  >
                    Process Refund Request
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label>Refund Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="0.00"
                        data-testid="input-refund-amount"
                      />
                    </div>
                    <div>
                      <Label>Admin Note</Label>
                      <Textarea
                        value={refundNote}
                        onChange={(e) => setRefundNote(e.target.value)}
                        placeholder="Optional note..."
                        rows={2}
                        data-testid="textarea-refund-note"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleRefundApprove}
                        disabled={refundMutation.isPending}
                        className="flex-1"
                        data-testid="button-approve-refund"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        onClick={handleRefundDeny}
                        variant="destructive"
                        disabled={refundMutation.isPending}
                        className="flex-1"
                        data-testid="button-deny-refund"
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {ticket.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="text-xs border-l-2 border-muted pl-3 py-1"
                    data-testid={`audit-log-${log.id}`}
                  >
                    <div className="font-semibold text-foreground">{log.action}</div>
                    <div className="text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM d, h:mm a")}
                    </div>
                    {log.adminEmail && (
                      <div className="text-muted-foreground">by {log.adminEmail}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
