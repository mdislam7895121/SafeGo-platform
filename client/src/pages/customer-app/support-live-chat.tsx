import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  Send,
  X,
  User,
  Headphones,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

export default function SupportLiveChat() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessionData, isLoading: isLoadingSession } = useQuery<{ session: any }>({
    queryKey: ["/api/customer/support-center/live-chat", sessionId],
    enabled: !!sessionId,
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });

  const startChatMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/customer/support-center/live-chat/start", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      setSessionId(data.session.id);
      toast({
        title: "Chat started",
        description: "You're now connected with support",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start chat",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageBody: string) => {
      return apiRequest(`/api/customer/support-center/live-chat/${sessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ messageBody }),
      });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({
        queryKey: ["/api/customer/support-center/live-chat", sessionId],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const endChatMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/customer/support-center/live-chat/${sessionId}/end`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Chat ended",
        description: "Thank you for contacting support",
      });
      setSessionId(null);
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !sessionId) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleStartChat = () => {
    startChatMutation.mutate();
  };

  const handleEndChat = () => {
    if (confirm("Are you sure you want to end this chat session?")) {
      endChatMutation.mutate();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionData?.session?.messages]);

  const session = sessionData?.session;
  const messages = session?.messages || [];
  const isActive = session?.status === "active";
  const isWaiting = session?.status === "waiting";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Live Chat Support
            </h1>
            <p className="text-muted-foreground mt-1">
              Get instant help from our support team
            </p>
          </div>
          {sessionId && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndChat}
              data-testid="button-end-chat"
            >
              <X className="h-4 w-4 mr-2" />
              End Chat
            </Button>
          )}
        </div>

        {/* Chat Container */}
        <Card className="min-h-[600px] flex flex-col">
          {!sessionId ? (
            /* Start Chat Screen */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Start a Live Chat</h2>
                <p className="text-muted-foreground max-w-md">
                  Connect with our support team for instant assistance. Average response time is under 2 minutes.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  size="lg"
                  onClick={handleStartChat}
                  disabled={startChatMutation.isPending}
                  data-testid="button-start-chat"
                  className="w-full"
                >
                  {startChatMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Chat
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Available 24/7</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900/20">
                        <Headphones className="h-5 w-5 text-blue-600" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {session.agentName || "SafeGo Support"}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm">
                        {isActive ? (
                          <Badge variant="default" className="bg-green-600">
                            <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                            Active
                          </Badge>
                        ) : isWaiting ? (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Waiting for agent...
                          </Badge>
                        ) : (
                          <Badge variant="outline">Chat Ended</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[450px]">
                {isWaiting && messages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Connecting you with a support agent...</p>
                  </div>
                )}

                {messages.map((msg: any) => {
                  const isFromRestaurant = msg.senderRole === "restaurant";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isFromRestaurant ? "flex-row-reverse" : ""}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={isFromRestaurant ? "bg-primary/10" : "bg-blue-100 dark:bg-blue-900/20"}>
                          {isFromRestaurant ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Headphones className="h-4 w-4 text-blue-600" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 space-y-1 ${isFromRestaurant ? "items-end" : "items-start"}`}>
                        <div
                          className={`inline-block px-4 py-2 rounded-2xl max-w-[80%] ${
                            isFromRestaurant
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          }`}
                        >
                          <p className="text-sm">{msg.messageBody}</p>
                        </div>
                        <p className="text-xs text-muted-foreground px-1">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Message Input */}
              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={session.status === "ended"}
                    data-testid="input-message"
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!message.trim() || sendMessageMutation.isPending || session.status === "ended"}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>

        {/* Info Cards */}
        {!sessionId && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Clock className="h-8 w-8 text-blue-600 mx-auto" />
                  <p className="font-semibold">Fast Response</p>
                  <p className="text-sm text-muted-foreground">Average reply time under 2 minutes</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="font-semibold">24/7 Available</p>
                  <p className="text-sm text-muted-foreground">Support team always online</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Headphones className="h-8 w-8 text-purple-600 mx-auto" />
                  <p className="font-semibold">Expert Help</p>
                  <p className="text-sm text-muted-foreground">Trained support specialists</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
