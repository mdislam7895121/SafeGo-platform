import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Send, FileUp, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SupportConversation {
  id: string;
  userId: string;
  userType: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

interface SupportMessage {
  id: string;
  conversationId: string;
  senderType: "user" | "admin";
  messageType: "text" | "image" | "file";
  body: string | null;
  read: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
  actorEmail: string;
}

export default function AdminSupportChat() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUserType, setFilterUserType] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch all conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/support/admin/conversations"],
    refetchInterval: 5000,
  }) as { data: SupportConversation[] };

  // Fetch selected conversation
  const { data: currentConversation } = useQuery({
    queryKey: selectedConversation ? ["/api/support/conversations", selectedConversation] : [],
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  }) as { data: SupportConversation | undefined };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/support/conversations/${selectedConversation}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, messageType: "text" }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/admin/conversations"] });
    },
  });

  const handleSendMessage = async () => {
    if (!messageBody.trim()) return;
    await sendMessageMutation.mutateAsync(messageBody);
    setMessageBody("");
  };

  // Filter and search conversations
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = `${conv.userId}${conv.userType}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterUserType === "all" || conv.userType === filterUserType;
    return matchesSearch && matchesType;
  });

  // Count unread messages
  const unreadCount = conversations.reduce((count, conv) => {
    return count + (conv.messages?.filter((msg) => !msg.read && msg.senderType === "user").length || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-background pb-6" data-testid="admin-support-chat-page">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Support Chat Management</h1>
            <p className="text-sm opacity-90">Real-time user support conversations</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white" data-testid="badge-unread-count">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 flex gap-4 h-[calc(100vh-180px)]" data-testid="support-chat-container">
        {/* Left Panel: Conversations */}
        <div className="w-96 border rounded-lg flex flex-col gap-3 p-4 bg-card">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search-conversations"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterUserType} onValueChange={setFilterUserType}>
                <SelectTrigger className="flex-1" data-testid="select-filter-usertype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="driver">Drivers</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="restaurant">Restaurants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredConversations.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No conversations found
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const unreadMsgs = conv.messages?.filter((m) => !m.read && m.senderType === "user").length || 0;
                return (
                  <Card
                    key={conv.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedConversation === conv.id
                        ? "bg-accent border-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedConversation(conv.id)}
                    data-testid={`card-conversation-${conv.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{conv.userType}</p>
                          {unreadMsgs > 0 && (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-unread-${conv.id}`}>
                              {unreadMsgs}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.userId}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-2">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {conv.messages && conv.messages[0] && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-2">
                        {conv.messages[0].body}
                      </p>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Chat */}
        <div className="flex-1 border rounded-lg flex flex-col bg-card overflow-hidden">
          {selectedConversation && currentConversation ? (
            <>
              {/* Header */}
              <div className="border-b p-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold">
                      {currentConversation.userType.charAt(0).toUpperCase() + currentConversation.userType.slice(1)}
                    </h2>
                    <p className="text-xs text-muted-foreground">{currentConversation.userId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedConversation(null)}
                    data-testid="button-close-conversation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                data-testid="div-messages-container"
              >
                {currentConversation.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                        msg.senderType === "admin"
                          ? "bg-blue-500 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1">
                        {msg.senderType === "admin" ? "Admin" : currentConversation.userType}
                      </p>
                      <p className="text-sm break-words">{msg.body}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="border-t p-4 flex gap-2 bg-muted/50">
                <Input
                  placeholder="Type message..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending}
                  size="icon"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled
                  data-testid="button-upload-file"
                  title="File upload coming soon"
                >
                  <FileUp className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a conversation to start managing support
            </div>
          )}
        </div>

        {/* Right Panel: Details */}
        {selectedConversation && currentConversation && (
          <div className="w-64 border rounded-lg p-4 bg-card flex flex-col gap-4 overflow-y-auto">
            <div>
              <h3 className="font-bold mb-3">Conversation Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">User Type</p>
                  <p className="font-medium capitalize">{currentConversation.userType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">User ID</p>
                  <p className="font-medium text-xs break-all">{currentConversation.userId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Messages</p>
                  <p className="font-medium">{currentConversation.messages?.length || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(currentConversation.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{new Date(currentConversation.updatedAt).toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-bold mb-3 text-sm">Unread Messages</h3>
              <div className="space-y-2">
                {(currentConversation.messages || [])
                  .filter((m) => !m.read && m.senderType === "user")
                  .slice(0, 5)
                  .map((msg) => (
                    <div key={msg.id} className="p-2 bg-muted rounded text-xs">
                      <p className="line-clamp-2">{msg.body}</p>
                      <p className="text-muted-foreground mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                {(currentConversation.messages || []).filter((m) => !m.read && m.senderType === "user").length === 0 && (
                  <p className="text-xs text-muted-foreground">All messages read</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
