import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, AlertCircle, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  messageBody: string;
  messageType: "public" | "internal";
  actorRole: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketCode: string;
  serviceType: string;
  issueCategory: string;
  issueDescription: string;
  customerVisibleStatus: string;
  internalStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    maskedName: string;
  };
  messages: Message[];
}

const statusColors: Record<string, string> = {
  open: "bg-blue-500",
  in_review: "bg-yellow-500",
  awaiting_customer: "bg-orange-500",
  resolved: "bg-green-500",
  closed: "bg-gray-500",
};

const roleLabels: Record<string, string> = {
  customer: "Customer",
  restaurant_owner: "Restaurant Owner",
  restaurant_staff: "Restaurant Staff",
  admin: "Admin",
};

export default function RestaurantSupportTicketDetail() {
  const params = useParams();
  const ticketId = params.id;
  const { toast } = useToast();
  const { user } = useAuth();
  const [replyMessage, setReplyMessage] = useState("");
  const [messageType, setMessageType] = useState<"public" | "internal">("public");
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [showProposedResolution, setShowProposedResolution] = useState(false);
  const [proposedResolution, setProposedResolution] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");
  const [proposedNote, setProposedNote] = useState("");

  // Fetch restaurant profile to check OWNER role
  const { data: profileData } = useQuery<{ profile: { ownerRole?: string } }>({
    queryKey: ["/api/restaurant/home"],
  });

  const isOwner = profileData?.profile?.ownerRole === "OWNER" || !profileData?.profile?.ownerRole;

  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: ["/api/restaurant/support/tickets", ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/restaurant/support/tickets/${ticketId}`);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return data.ticket;
    },
    enabled: !!ticketId,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/restaurant/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messageBody: replyMessage,
          messageType,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Reply sent",
        description: "Your message has been sent successfully",
      });
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/support/tickets", ticketId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send reply",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/restaurant/support/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          customerVisibleStatus: newStatus,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Ticket status has been updated successfully",
      });
      setShowStatusUpdate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/support/tickets", ticketId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const proposedResolutionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/restaurant/support/tickets/${ticketId}/proposed-resolution`, {
        method: "POST",
        body: JSON.stringify({
          proposedResolution,
          proposedAmount: proposedAmount ? parseFloat(proposedAmount) : null,
          proposedNote,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Resolution proposed",
        description: "Your proposed resolution has been submitted for admin approval",
      });
      setShowProposedResolution(false);
      setProposedResolution("");
      setProposedAmount("");
      setProposedNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/support/tickets", ticketId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to propose resolution",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReply = () => {
    if (!replyMessage.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message before sending",
        variant: "destructive",
      });
      return;
    }
    replyMutation.mutate();
  };

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Link href="/restaurant/support-tickets">
          <Button variant="ghost" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Support Tickets
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Error Loading Ticket</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error ? error.message : "Failed to load ticket details"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !ticket) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-10 w-40 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Link href="/restaurant/support-tickets">
        <Button variant="ghost" className="mb-4" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Support Tickets
        </Button>
      </Link>

      <div className="grid gap-6">
        {/* Ticket Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <span data-testid="text-ticket-code">{ticket.ticketCode}</span>
                  <Badge className={statusColors[ticket.customerVisibleStatus]} data-testid="badge-status">
                    {ticket.customerVisibleStatus.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Customer: {ticket.customer.maskedName}
                </p>
              </div>
              {isOwner && ticket.customerVisibleStatus !== "closed" && (
                <Button
                  variant="outline"
                  onClick={() => setShowStatusUpdate(!showStatusUpdate)}
                  data-testid="button-update-status"
                >
                  Update Status
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Issue Category</p>
              <p className="text-sm text-muted-foreground">
                {ticket.issueCategory.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground" data-testid="text-issue-description">
                {ticket.issueDescription}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Created {new Date(ticket.createdAt).toLocaleString()}
            </div>

            {/* Status Update Form (OWNER only) */}
            {showStatusUpdate && isOwner && (
              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label htmlFor="status">New Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger id="status" data-testid="select-new-status">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => statusMutation.mutate()}
                    disabled={!newStatus || statusMutation.isPending}
                    data-testid="button-confirm-status"
                  >
                    {statusMutation.isPending ? "Updating..." : "Confirm Status Change"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowStatusUpdate(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Thread */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ticket.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet
              </p>
            ) : (
              ticket.messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.messageType === "internal"
                      ? "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800"
                      : "bg-muted"
                  }`}
                  data-testid={`message-${message.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium">
                      {roleLabels[message.actorRole] || message.actorRole}
                    </p>
                    {message.messageType === "internal" && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Internal Note
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-body-${message.id}`}>
                    {message.messageBody}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Reply Form */}
        {ticket.customerVisibleStatus !== "closed" && (
          <Card>
            <CardHeader>
              <CardTitle>Send Reply</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="messageType">Message Type</Label>
                <Select
                  value={messageType}
                  onValueChange={(value) => setMessageType(value as "public" | "internal")}
                >
                  <SelectTrigger id="messageType" data-testid="select-message-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Customer will see this)</SelectItem>
                    <SelectItem value="internal">Internal Note (Staff and admin only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={5}
                  data-testid="textarea-reply-message"
                />
              </div>

              <Button
                onClick={handleReply}
                disabled={!replyMessage.trim() || replyMutation.isPending}
                data-testid="button-send-reply"
              >
                <Send className="h-4 w-4 mr-2" />
                {replyMutation.isPending ? "Sending..." : "Send Reply"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Propose Resolution (OWNER only) */}
        {isOwner && ticket.customerVisibleStatus !== "closed" && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Propose Resolution</CardTitle>
                {!showProposedResolution && (
                  <Button
                    variant="outline"
                    onClick={() => setShowProposedResolution(true)}
                    data-testid="button-show-propose-resolution"
                  >
                    Propose Resolution
                  </Button>
                )}
              </div>
            </CardHeader>
            {showProposedResolution && (
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="resolutionType">Resolution Type</Label>
                  <Select value={proposedResolution} onValueChange={setProposedResolution}>
                    <SelectTrigger id="resolutionType" data-testid="select-resolution-type">
                      <SelectValue placeholder="Select resolution type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_refund">Full Refund</SelectItem>
                      <SelectItem value="partial_refund">Partial Refund</SelectItem>
                      <SelectItem value="replacement">Replacement Order</SelectItem>
                      <SelectItem value="discount_coupon">Discount Coupon</SelectItem>
                      <SelectItem value="no_action">No Action Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(proposedResolution === "full_refund" || proposedResolution === "partial_refund") && (
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={proposedAmount}
                      onChange={(e) => setProposedAmount(e.target.value)}
                      data-testid="input-proposed-amount"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="note">Resolution Note (Required)</Label>
                  <Textarea
                    id="note"
                    placeholder="Explain your proposed resolution..."
                    value={proposedNote}
                    onChange={(e) => setProposedNote(e.target.value)}
                    rows={4}
                    data-testid="textarea-proposed-note"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => proposedResolutionMutation.mutate()}
                    disabled={!proposedResolution || !proposedNote.trim() || proposedResolutionMutation.isPending}
                    data-testid="button-submit-resolution"
                  >
                    {proposedResolutionMutation.isPending ? "Submitting..." : "Submit for Admin Approval"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowProposedResolution(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* STAFF Access Notice */}
        {!isOwner && (
          <Card className="border-yellow-500">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Staff Access</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    As a staff member, you can view and reply to tickets, but only the restaurant owner can update ticket status or propose resolutions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
