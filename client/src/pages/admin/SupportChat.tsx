import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Send, FileUp } from "lucide-react";

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

export default function AdminSupportChat() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/support/admin/conversations"],
  }) as { data: SupportConversation[] };

  // Fetch selected conversation
  const { data: currentConversation } = useQuery({
    queryKey: selectedConversation ? ["/api/support/conversations", selectedConversation] : [],
    enabled: !!selectedConversation,
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
  });

  const handleSendMessage = async () => {
    if (!messageBody.trim()) return;
    await sendMessageMutation.mutateAsync(messageBody);
    setMessageBody("");
  };

  const filteredConversations = conversations.filter((conv) =>
    `${conv.userId}${conv.userType}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full gap-4 p-4" data-testid="admin-support-chat">
      {/* Left Panel: Conversations */}
      <div className="w-80 border rounded-lg flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="input-search-conversations"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredConversations.map((conv) => (
            <Card
              key={conv.id}
              className={`p-3 cursor-pointer hover:bg-muted ${
                selectedConversation === conv.id ? "bg-accent" : ""
              }`}
              onClick={() => setSelectedConversation(conv.id)}
              data-testid={`card-conversation-${conv.id}`}
            >
              <div className="font-medium text-sm">{conv.userType}</div>
              <div className="text-xs text-muted-foreground">{conv.userId}</div>
              {conv.messages && conv.messages[0] && (
                <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {conv.messages[0].body}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Center Panel: Chat */}
      <div className="flex-1 border rounded-lg flex flex-col gap-3 p-4">
        {selectedConversation && currentConversation ? (
          <>
            <div className="border-b pb-2">
              <h2 className="font-bold">
                {currentConversation.userType} - {currentConversation.userId}
              </h2>
              <p className="text-xs text-muted-foreground">
                {new Date(currentConversation.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div
              className="flex-1 overflow-y-auto space-y-3"
              data-testid="div-messages-container"
            >
              {currentConversation.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-md p-2 rounded ${
                      msg.senderType === "admin"
                        ? "bg-blue-500 text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm">{msg.body}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 border-t pt-3">
              <Input
                placeholder="Type message..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
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
              <Button variant="outline" size="icon" data-testid="button-upload-file">
                <FileUp className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a conversation to start
          </div>
        )}
      </div>

      {/* Right Panel: User Details */}
      {selectedConversation && currentConversation && (
        <div className="w-64 border rounded-lg p-4 flex flex-col gap-3">
          <h3 className="font-bold">User Details</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <p className="font-medium">{currentConversation.userType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">User ID:</span>
              <p className="font-medium break-all">{currentConversation.userId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Messages:</span>
              <p className="font-medium">{currentConversation.messages?.length || 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>
              <p className="font-medium">
                {new Date(currentConversation.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
