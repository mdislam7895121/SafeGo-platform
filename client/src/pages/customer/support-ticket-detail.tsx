import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Send, User, Building, Shield } from "lucide-react";
import { format } from "date-fns";

type Message = {
  id: string;
  messageBody: string;
  actorRole: string;
  createdAt: string;
  attachmentUrls?: any[];
};

type Ticket = {
  id: string;
  ticketCode: string;
  serviceType: string;
  issueCategory: string;
  issueDescription: string;
  customerVisibleStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  photoUrls?: string[];
  messages: Message[];
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  awaiting_customer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
};

export default function SupportTicketDetail() {
  const [, params] = useRoute("/customer/support-tickets/:id");
  const [, navigate] = useLocation();
  const [replyMessage, setReplyMessage] = useState("");
  const { toast } = useToast();
  const ticketId = params?.id;

  const { data, isLoading } = useQuery<Ticket>({
    queryKey: [`/api/customer/support/tickets/${ticketId}`],
    enabled: !!ticketId
  });

  const replyMutation = useMutation({
    mutationFn: async (messageBody: string) => {
      return apiRequest(`/api/customer/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ messageBody })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customer/support/tickets/${ticketId}`] });
      setReplyMessage("");
      toast({
        title: "Reply sent",
        description: "Your message has been sent successfully"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send reply",
        description: error.message || "Please try again"
      });
    }
  });

  const handleSendReply = () => {
    if (!replyMessage.trim()) return;
    replyMutation.mutate(replyMessage);
  };

  const getActorIcon = (actorRole: string) => {
    switch (actorRole) {
      case "customer":
        return <User className="w-4 h-4" />;
      case "restaurant_owner":
      case "restaurant_staff":
        return <Building className="w-4 h-4" />;
      case "admin":
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getActorLabel = (actorRole: string) => {
    const labels: Record<string, string> = {
      customer: "You",
      restaurant_owner: "Restaurant",
      restaurant_staff: "Restaurant Staff",
      driver: "Driver",
      admin: "SafeGo Support"
    };
    return labels[actorRole] || actorRole;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-10 w-64 mb-6" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Ticket not found</p>
            <Button className="mt-4" onClick={() => navigate("/customer/my-support-tickets")}>
              Back to My Tickets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isClosedOrResolved = data.customerVisibleStatus === "closed" || data.customerVisibleStatus === "resolved";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/customer/my-support-tickets")}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to My Tickets
      </Button>

      {/* Ticket Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle data-testid="text-ticket-code">{data.ticketCode}</CardTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span data-testid="text-service-type">
                  {data.serviceType.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </span>
                <span>•</span>
                <span data-testid="text-category">
                  {data.issueCategory.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </span>
                <span>•</span>
                <span data-testid="text-created-date">{format(new Date(data.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
            </div>
            <Badge className={statusColors[data.customerVisibleStatus]} data-testid="badge-status">
              {data.customerVisibleStatus.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <p className="font-semibold mb-2">Issue Description:</p>
            <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
              {data.issueDescription}
            </p>
          </div>
          {data.photoUrls && data.photoUrls.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold mb-2">Attachments:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {data.photoUrls.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Attachment ${index + 1}`}
                    className="w-full h-32 object-cover rounded-md border"
                    data-testid={`img-attachment-${index}`}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-messages">
              No messages yet. Be the first to reply!
            </p>
          ) : (
            data.messages.map((message, index) => (
              <div key={message.id} data-testid={`message-${message.id}`}>
                <div className={`flex gap-3 ${message.actorRole === "customer" ? "" : ""}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getActorIcon(message.actorRole)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" data-testid={`text-actor-${message.id}`}>
                        {getActorLabel(message.actorRole)}
                      </span>
                      <span className="text-xs text-muted-foreground" data-testid={`text-time-${message.id}`}>
                        {format(new Date(message.createdAt), "MMM d 'at' h:mm a")}
                      </span>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="whitespace-pre-wrap" data-testid={`text-message-body-${message.id}`}>
                        {message.messageBody}
                      </p>
                    </div>
                  </div>
                </div>
                {index < data.messages.length - 1 && <Separator className="my-4" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Reply Form */}
      {!isClosedOrResolved ? (
        <Card>
          <CardHeader>
            <CardTitle>Send a Reply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Type your message here..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={4}
                data-testid="textarea-reply"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || replyMutation.isPending}
                  data-testid="button-send-reply"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {replyMutation.isPending ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground" data-testid="text-ticket-closed">
            This ticket is {data.customerVisibleStatus}. You can no longer add replies.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
