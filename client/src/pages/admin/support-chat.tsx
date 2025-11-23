import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Send,
  MessageSquare,
  User,
  Phone,
  Mail,
  Star,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserInfo {
  name: string;
  email: string;
  phone?: string;
  rating?: number;
  totalTrips?: number;
}

interface ConversationListItem {
  id: string;
  userId: string;
  userType: string;
  status: string;
  topic?: string;
  assignedAdminId?: string;
  escalatedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  messageCount: number;
  unreadCount: number;
  userInfo: UserInfo;
}

interface Message {
  id: string;
  senderType: "user" | "agent" | "bot";
  messageType: "text" | "quick_topic" | "escalation" | "system";
  body: string;
  createdAt: string;
}

interface ConversationDetail {
  conversation: {
    id: string;
    userId: string;
    userType: string;
    status: string;
    topic?: string;
    assignedAdminId?: string;
    escalatedAt?: string;
    closedAt?: string;
    rating?: number;
    feedback?: string;
    createdAt: string;
    updatedAt: string;
    userInfo: UserInfo;
  };
  messages: Message[];
}

const statusColors = {
  open: "bg-blue-500",
  bot: "bg-blue-500",
  pending: "bg-amber-500",
  assigned: "bg-green-500",
  closed: "bg-gray-500",
};

const statusLabels = {
  open: "Bot Active",
  bot: "Bot Active",
  pending: "Waiting for Agent",
  assigned: "Assigned to Agent",
  closed: "Closed",
};

export default function AdminSupportConsole() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") {
    queryParams.append("status", statusFilter);
  }
  if (userTypeFilter !== "all") {
    queryParams.append("userType", userTypeFilter);
  }
  const queryString = queryParams.toString();
  const conversationsUrl = `/api/support/admin/conversations${queryString ? `?${queryString}` : ""}`;

  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{
    conversations: ConversationListItem[];
    hasMore: boolean;
    nextCursor: string | null;
  }>({
    queryKey: [conversationsUrl],
    refetchInterval: 5000,
  });

  const { data: conversationDetail, isLoading: loadingMessages } = useQuery<ConversationDetail>({
    queryKey: [`/api/support/admin/conversations/${selectedConversationId}`],
    enabled: !!selectedConversationId,
    refetchInterval: 4000,
  });

  const assignMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest(`/api/support/admin/conversations/${conversationId}/assign`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === conversationsUrl || 
          query.queryKey[0] === `/api/support/admin/conversations/${selectedConversationId}`
      });
      toast({
        title: "Conversation assigned",
        description: "You are now handling this conversation",
      });
    },
    onError: (error: any) => {
      const errorMsg = error?.error || "Failed to assign conversation";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const res = await apiRequest(`/api/support/admin/conversations/${conversationId}/reply`, "POST", { content });
      return res.json();
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === conversationsUrl || 
          query.queryKey[0] === `/api/support/admin/conversations/${selectedConversationId}`
      });
    },
    onError: (error: any) => {
      const errorMsg = error?.error || "Failed to send message";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const closeConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest(`/api/support/admin/conversations/${conversationId}/close`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      // Remove detail cache for closed conversation
      if (selectedConversationId) {
        queryClient.removeQueries({ 
          queryKey: [`/api/support/admin/conversations/${selectedConversationId}`] 
        });
      }
      // Invalidate conversation list (all variations with query params)
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === "string" && 
          query.queryKey[0].startsWith("/api/support/admin/conversations") &&
          !query.queryKey[0].match(/\/[a-f0-9-]{36}$/) // Exclude detail queries (ending with UUID)
      });
      setSelectedConversationId(null);
      toast({
        title: "Conversation closed",
        description: "The conversation has been marked as resolved",
      });
    },
    onError: (error: any) => {
      const errorMsg = error?.error || "Failed to close conversation";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationDetail?.messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate({ conversationId: selectedConversationId, content: messageInput });
  };

  const handleAssign = () => {
    if (!selectedConversationId) return;
    assignMutation.mutate(selectedConversationId);
  };

  const handleClose = () => {
    if (!selectedConversationId) return;
    closeConversationMutation.mutate(selectedConversationId);
  };

  const conversations = conversationsData?.conversations || [];
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background" data-testid="admin-support-console">
      <Card className="flex flex-col w-96 border-r rounded-none">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" data-testid="text-console-title">Live Support Console</h2>
            <Badge variant="outline" data-testid="badge-conversation-count">{conversations.length}</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter" className="flex-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-status-all">All Active</SelectItem>
                <SelectItem value="pending" data-testid="option-status-pending">Waiting</SelectItem>
                <SelectItem value="assigned" data-testid="option-status-assigned">Active</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger data-testid="select-role-filter" className="flex-1">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-role-all">All Roles</SelectItem>
                <SelectItem value="driver" data-testid="option-role-driver">Driver</SelectItem>
                <SelectItem value="customer" data-testid="option-role-customer">Customer</SelectItem>
                <SelectItem value="restaurant" data-testid="option-role-restaurant">Restaurant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-loading-conversations">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-conversations">
              No conversations found
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full p-4 text-left hover-elevate active-elevate-2 transition-colors ${
                    selectedConversationId === conv.id ? "bg-accent" : ""
                  }`}
                  data-testid={`conversation-item-${conv.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-usertype-${conv.id}`}>
                        {conv.userType}
                      </Badge>
                      <Badge
                        className={`text-xs text-white ${statusColors[conv.status as keyof typeof statusColors]}`}
                        data-testid={`badge-status-${conv.id}`}
                      >
                        {statusLabels[conv.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs" data-testid={`badge-unread-${conv.id}`}>
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="font-medium text-sm mb-1" data-testid={`text-username-${conv.id}`}>
                    {conv.userInfo.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" data-testid={`text-lastmsg-${conv.id}`}>
                    {conv.lastMessage || "No messages yet"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1" data-testid={`text-timestamp-${conv.id}`}>
                    {new Date(conv.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      <div className="flex-1 flex flex-col">
        {!selectedConversationId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="text-select-conversation">
            <div className="text-center space-y-3">
              <MessageSquare className="h-12 w-12 mx-auto opacity-50" />
              <p>Select a conversation to view messages</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-semibold" data-testid="text-selected-username">
                    {conversationDetail?.conversation.userInfo.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" data-testid="badge-selected-usertype">
                      {conversationDetail?.conversation.userType}
                    </Badge>
                    {conversationDetail?.conversation.topic && (
                      <Badge variant="outline" data-testid="badge-selected-topic">
                        {conversationDetail.conversation.topic}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {conversationDetail?.conversation.status === "pending" && (
                  <Button
                    onClick={handleAssign}
                    disabled={assignMutation.isPending}
                    data-testid="button-assign"
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Assign to Me
                  </Button>
                )}
                {conversationDetail?.conversation.status === "assigned" && (
                  <Button
                    onClick={handleClose}
                    disabled={closeConversationMutation.isPending}
                    variant="outline"
                    data-testid="button-close"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Close Conversation
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="text-center text-sm text-muted-foreground" data-testid="text-loading-messages">
                    Loading messages...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversationDetail?.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderType === "user" ? "justify-start" : "justify-end"}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.senderType === "user"
                              ? "bg-muted"
                              : msg.senderType === "agent"
                              ? "bg-primary text-primary-foreground"
                              : "bg-accent"
                          }`}
                        >
                          {msg.messageType === "system" && (
                            <div className="text-xs font-medium mb-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              System
                            </div>
                          )}
                          <div className="text-sm" data-testid={`message-body-${msg.id}`}>
                            {msg.body}
                          </div>
                          <div className="text-xs opacity-70 mt-1" data-testid={`message-time-${msg.id}`}>
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <Card className="w-80 border-l rounded-none p-4 space-y-4">
                <h4 className="font-semibold text-sm" data-testid="text-userinfo-title">User Information</h4>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium" data-testid="text-userinfo-name">
                      {conversationDetail?.conversation.userInfo.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium" data-testid="text-userinfo-email">
                      {conversationDetail?.conversation.userInfo.email}
                    </span>
                  </div>
                  {conversationDetail?.conversation.userInfo.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium" data-testid="text-userinfo-phone">
                        {conversationDetail.conversation.userInfo.phone}
                      </span>
                    </div>
                  )}
                  {conversationDetail?.conversation.userInfo.rating && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Rating:</span>
                      <span className="font-medium flex items-center gap-1" data-testid="text-userinfo-rating">
                        {conversationDetail.conversation.userInfo.rating.toFixed(2)}
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      </span>
                    </div>
                  )}
                  {conversationDetail?.conversation.userInfo.totalTrips !== undefined && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Trips:</span>
                      <span className="font-medium" data-testid="text-userinfo-trips">
                        {conversationDetail.conversation.userInfo.totalTrips}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm" data-testid="text-conversation-info">Conversation Info</h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant="outline"
                        className={statusColors[conversationDetail?.conversation.status as keyof typeof statusColors]}
                        data-testid="badge-info-status"
                      >
                        {statusLabels[conversationDetail?.conversation.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span data-testid="text-info-created">
                        {new Date(conversationDetail?.conversation.createdAt || "").toLocaleString()}
                      </span>
                    </div>
                    {conversationDetail?.conversation.escalatedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Escalated:</span>
                        <span data-testid="text-info-escalated">
                          {new Date(conversationDetail.conversation.escalatedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {conversationDetail?.conversation.status !== "closed" && (
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={
                      conversationDetail?.conversation.status !== "assigned" ||
                      sendMessageMutation.isPending
                    }
                    data-testid="input-message"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      !messageInput.trim() ||
                      conversationDetail?.conversation.status !== "assigned" ||
                      sendMessageMutation.isPending
                    }
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {conversationDetail?.conversation.status !== "assigned" && (
                  <p className="text-xs text-muted-foreground mt-2" data-testid="text-assign-instruction">
                    Assign this conversation to yourself before sending messages
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
