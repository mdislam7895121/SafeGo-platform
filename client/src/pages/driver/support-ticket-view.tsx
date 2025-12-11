import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  User,
  Headphones,
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TicketMessage {
  id: string;
  senderRole: string;
  senderName: string;
  messageBody: string;
  attachmentUrls?: string[];
  createdAt: string;
}

interface StatusHistory {
  id: string;
  previousStatus?: string;
  newStatus: string;
  changedByRole: string;
  note?: string;
  createdAt: string;
  changedBy?: { email: string };
}

interface TicketDetail {
  id: string;
  ticketCode: string;
  subject: string;
  category: string;
  subcategory?: string;
  tripId?: string;
  status: string;
  priority: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  messages: TicketMessage[];
  statusHistory: StatusHistory[];
  driver: {
    firstName: string;
    lastName: string;
  };
}

const categoryIcons: Record<string, typeof FileText> = {
  account_documents: FileText,
  trip_issues: Car,
  payment_earnings: DollarSign,
  incentives_promotions: Gift,
  safety_emergency: Shield,
  app_technical: Smartphone,
};

const categoryLabels: Record<string, string> = {
  account_documents: "Account & Documents",
  trip_issues: "Trip Issues",
  payment_earnings: "Payment & Earnings",
  incentives_promotions: "Incentives & Promotions",
  safety_emergency: "Safety & Emergency",
  app_technical: "App & Technical",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function DriverSupportTicketView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/driver/support-ticket/:id");
  const ticketId = params?.id;
  const [replyText, setReplyText] = useState("");

  const { data, isLoading, error } = useQuery<{ ticket: TicketDetail }>({
    queryKey: ["/api/driver/support-center/tickets", ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/driver/support-center/tickets/${ticketId}`);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    enabled: !!ticketId,
  });

  const replyMutation = useMutation({
    mutationFn: async (messageBody: string) => {
      return apiRequest(`/api/driver/support-center/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ messageBody }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/support-center/tickets", ticketId] });
      setReplyText("");
      toast({
        title: "Reply Sent",
        description: "Your message has been added to the ticket.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    replyMutation.mutate(replyText.trim());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data?.ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Ticket Not Found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  This ticket may have been deleted or you don't have access.
                </p>
              </div>
              <Button onClick={() => setLocation("/driver/support-tickets")}>
                Back to Tickets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ticket = data.ticket;
  const CategoryIcon = categoryIcons[ticket.category] || FileText;
  const statusInfo = statusConfig[ticket.status] || statusConfig.open;
  const priorityInfo = priorityConfig[ticket.priority] || priorityConfig.normal;
  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  const timelineItems = [
    ...ticket.statusHistory.map(h => ({
      type: "status" as const,
      date: h.createdAt,
      data: h,
    })),
    ...ticket.messages.map(m => ({
      type: "message" as const,
      date: m.createdAt,
      data: m,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/driver/support-tickets")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold tracking-tight truncate" data-testid="text-ticket-subject">
                {ticket.subject}
              </h1>
              <Badge variant="outline" className={`${statusInfo.color} flex-shrink-0`}>
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{ticket.ticketCode}</span>
              <span className="text-muted-foreground/50">|</span>
              <CategoryIcon className="h-3.5 w-3.5" />
              <span>{categoryLabels[ticket.category] || ticket.category}</span>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={priorityInfo.color}>
                Priority: {priorityInfo.label}
              </Badge>
              {ticket.tripId && (
                <Badge variant="outline">
                  Trip: {ticket.tripId}
                </Badge>
              )}
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Created {format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
              {ticket.resolvedAt && (
                <span>Resolved {format(new Date(ticket.resolvedAt), "MMM d, yyyy")}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {timelineItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No activity yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {timelineItems.map((item, index) => (
                  <div key={`${item.type}-${index}`} className="relative pl-6">
                    <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-muted border-2 border-background" />
                    {index < timelineItems.length - 1 && (
                      <div className="absolute left-[5px] top-5 bottom-0 w-0.5 bg-muted" />
                    )}
                    
                    {item.type === "status" && (
                      <div className="pb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium capitalize">
                            Status changed to {(item.data as StatusHistory).newStatus.replace("_", " ")}
                          </span>
                        </div>
                        {(item.data as StatusHistory).note && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {(item.data as StatusHistory).note}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                        </p>
                      </div>
                    )}

                    {item.type === "message" && (
                      <div className="pb-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={
                              (item.data as TicketMessage).senderRole === "support" 
                                ? "bg-primary/10 text-primary" 
                                : "bg-muted"
                            }>
                              {(item.data as TicketMessage).senderRole === "support" ? (
                                <Headphones className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {(item.data as TicketMessage).senderRole === "support" 
                                  ? "SafeGo Support" 
                                  : "You"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">
                              {(item.data as TicketMessage).messageBody}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!isClosed && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add Reply</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <Textarea
                  placeholder="Type your message here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  data-testid="textarea-reply"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    data-testid="button-send-reply"
                  >
                    {replyMutation.isPending ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isClosed && (
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>This ticket has been {ticket.status}. Need more help?</span>
                <Button 
                  variant="link" 
                  className="p-0 h-auto"
                  onClick={() => setLocation("/driver/support-help-center")}
                >
                  Create a new ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
