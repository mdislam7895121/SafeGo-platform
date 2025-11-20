import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Plus, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportWebSocket } from "@/hooks/useSupportWebSocket";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface UserSupportChatProps {
  onBack?: () => void;
}

interface SupportConversation {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  unreadCountUser: number;
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

export default function UserSupportChat({ onBack }: UserSupportChatProps) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<SupportConversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery<SupportConversation[]>({
    queryKey: ["/api/support/conversations"],
    refetchInterval: 10000,
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    queryFn: async () => {
      const response = await fetch(`/api/support/conversations/${selectedConversation?.id}/messages`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  // WebSocket integration
  const { isConnected, joinConversation, sendMessage: wsSendMessage } = useSupportWebSocket({
    token,
    onMessage: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations"] });
      if (data.conversationId === selectedConversation?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/support/conversations", data.conversationId, "messages"] });
      }
    },
  });

  // Join conversation when selected
  useEffect(() => {
    if (selectedConversation && isConnected) {
      joinConversation(selectedConversation.id);
    }
  }, [selectedConversation, isConnected, joinConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { subject: string; priority: string; initialMessage: string }) => {
      return apiRequest("/api/support/conversations", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations"] });
      setNewConversationOpen(false);
      setNewSubject("");
      setNewPriority("normal");
      setNewMessage("");
      setSelectedConversation(data);
      toast({
        title: "Conversation created",
        description: "Your support request has been submitted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      wsSendMessage(conversationId, content);
      return apiRequest(`/api/support/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations", selectedConversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
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

  const handleCreateConversation = () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both subject and message",
        variant: "destructive",
      });
      return;
    }
    createConversationMutation.mutate({
      subject: newSubject.trim(),
      priority: newPriority,
      initialMessage: newMessage.trim(),
    });
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "normal": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  // If viewing a conversation, show chat interface
  if (selectedConversation) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Chat Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversation(null)}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h2 className="font-bold text-lg">{selectedConversation.subject}</h2>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? "Live" : "Offline"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 ml-12">
            <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(selectedConversation.status)}`}>
              {selectedConversation.status}
            </span>
            <Badge variant={getPriorityColor(selectedConversation.priority)} className="text-xs">
              {selectedConversation.priority}
            </Badge>
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
              const isMe = msg.senderUserId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    isMe 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
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
    );
  }

  // Otherwise, show conversation list
  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Support
          </h1>
          <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-new-conversation">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Support Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    data-testid="input-subject"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newPriority} onValueChange={(v: any) => setNewPriority(v)}>
                    <SelectTrigger id="priority" data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue in detail..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[120px]"
                    data-testid="input-initial-message"
                  />
                </div>
                <Button
                  onClick={handleCreateConversation}
                  className="w-full"
                  disabled={createConversationMutation.isPending}
                  data-testid="button-create-conversation"
                >
                  Create Support Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4">
        {loadingConversations ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedConversation(conv)}
                data-testid={`conversation-${conv.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className={`font-semibold mb-1 ${conv.unreadCountUser > 0 ? "font-bold" : ""}`}>
                        {conv.subject}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(conv.status)}`}>
                          {conv.status}
                        </span>
                        <Badge variant={getPriorityColor(conv.priority)} className="text-xs">
                          {conv.priority}
                        </Badge>
                      </div>
                    </div>
                    {conv.unreadCountUser > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conv.unreadCountUser}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last updated {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-semibold mb-2">No support conversations yet</p>
              <p className="text-sm mb-4">Create a new support request to get help</p>
              <Button onClick={() => setNewConversationOpen(true)} data-testid="button-create-first">
                <Plus className="h-4 w-4 mr-2" />
                Create Support Request
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
