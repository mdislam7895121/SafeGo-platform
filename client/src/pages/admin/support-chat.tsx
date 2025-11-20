import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Send, Filter, Search, AlertCircle, ChevronLeft, User, Clock, Tag, MapPin, CheckCircle2, X, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportWebSocket } from "@/hooks/useSupportWebSocket";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface SupportConversation {
  id: string;
  userId: string;
  userType: "driver" | "customer" | "restaurant";
  userEmail?: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  countryCode: "BD" | "US";
  assignedToAdminId?: string | null;
  assignedToAdmin?: { email: string } | null;
  unreadCountAdmin: number;
  lastMessageAt: Date;
  createdAt: Date;
}

interface SupportMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderUserType: string;
  content: string;
  createdAt: Date;
}

export default function AdminSupportChat() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<SupportConversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations with filters
  const { data: conversations, isLoading: loadingConversations } = useQuery<SupportConversation[]>({
    queryKey: ["/api/admin/support/conversations", searchQuery, statusFilter, channelFilter, priorityFilter, countryFilter, assignedFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (channelFilter !== "all") params.append("channel", channelFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (countryFilter !== "all") params.append("countryCode", countryFilter);
      if (assignedFilter !== "all") params.append("assignedFilter", assignedFilter);
      
      const url = `/api/admin/support/conversations${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery<SupportMessage[]>({
    queryKey: ["/api/admin/support/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    queryFn: async () => {
      const response = await fetch(`/api/admin/support/conversations/${selectedConversation?.id}/messages`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  // WebSocket integration for real-time updates
  const { isConnected, joinConversation, sendMessage: wsSendMessage } = useSupportWebSocket({
    token,
    onMessage: (data) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations"] });
      if (data.conversationId === selectedConversation?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations", data.conversationId, "messages"] });
      }
    },
    onError: (error) => {
      toast({
        title: "WebSocket Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Join conversation when selected
  useEffect(() => {
    if (selectedConversation && isConnected) {
      joinConversation(selectedConversation.id);
    }
  }, [selectedConversation, isConnected, joinConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      // Send via WebSocket for real-time delivery
      wsSendMessage(conversationId, content);
      
      // Also send via REST API as backup
      return apiRequest(`/api/admin/support/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations", selectedConversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update conversation status/priority mutation
  const updateConversationMutation = useMutation({
    mutationFn: async (updates: { status?: string; priority?: string; assignedToAdminId?: string | null }) => {
      return apiRequest(`/api/admin/support/conversations/${selectedConversation?.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations"] });
      toast({
        title: "Conversation updated",
        description: "Changes saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: messageInput.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations by search query
  const filteredConversations = conversations?.filter((conv) =>
    conv.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.userEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "normal": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "resolved": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "closed": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel - Conversation List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? "Live" : "Offline"}
            </Badge>
          </div>
          
          <h1 className="text-xl font-bold mb-4">Support Chat</h1>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger data-testid="select-channel-filter">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger data-testid="select-priority-filter">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger data-testid="select-country-filter">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="BD">BD</SelectItem>
                  <SelectItem value="US">US</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No conversations found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 cursor-pointer hover-elevate transition-colors ${
                    selectedConversation?.id === conv.id ? "bg-accent" : ""
                  }`}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className={`font-semibold text-sm mb-1 ${conv.unreadCountAdmin > 0 ? "font-bold" : ""}`}>
                        {conv.subject}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {conv.userType}
                        </Badge>
                        <span>{conv.countryCode}</span>
                      </div>
                    </div>
                    {conv.unreadCountAdmin > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conv.unreadCountAdmin}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(conv.priority)} className="text-xs">
                      {conv.priority}
                    </Badge>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(conv.status)}`}>
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Messages */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Message Header */}
          <div className="p-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{selectedConversation.subject}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {selectedConversation.userEmail || `${selectedConversation.userType} user`}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedConversation.countryCode}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedConversation.priority}
                  onValueChange={(value) => updateConversationMutation.mutate({ priority: value })}
                >
                  <SelectTrigger className="w-32" data-testid="select-conversation-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedConversation.status}
                  onValueChange={(value) => updateConversationMutation.mutate({ status: value })}
                >
                  <SelectTrigger className="w-32" data-testid="select-conversation-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingMessages ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-3/4" />
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg) => {
                const isAdmin = msg.senderUserType === "admin";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      isAdmin 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>No messages yet</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className="min-h-[60px] max-h-[120px]"
                data-testid="input-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select a conversation to view messages</p>
          </div>
        </div>
      )}

      {/* Right Panel - Conversation Details */}
      {selectedConversation && (
        <div className="w-80 border-l p-4 space-y-4">
          <h3 className="font-semibold text-lg">Conversation Details</h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">User Type</p>
              <Badge variant="outline">{selectedConversation.userType}</Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Country</p>
              <Badge variant="outline">{selectedConversation.countryCode}</Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <span className={`text-sm px-2 py-1 rounded inline-block ${getStatusColor(selectedConversation.status)}`}>
                {selectedConversation.status}
              </span>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Priority</p>
              <Badge variant={getPriorityColor(selectedConversation.priority)}>
                {selectedConversation.priority}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
              <p className="text-sm">
                {selectedConversation.assignedToAdmin?.email || "Unassigned"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => updateConversationMutation.mutate({ assignedToAdminId: user?.id || null })}
                disabled={selectedConversation.assignedToAdminId === user?.id}
                data-testid="button-assign-to-me"
              >
                {selectedConversation.assignedToAdminId === user?.id ? "Assigned to you" : "Assign to me"}
              </Button>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">Created</p>
              <p className="text-sm">
                {formatDistanceToNow(new Date(selectedConversation.createdAt), { addSuffix: true })}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Message</p>
              <p className="text-sm">
                {formatDistanceToNow(new Date(selectedConversation.lastMessageAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
