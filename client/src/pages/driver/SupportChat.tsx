import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send } from "lucide-react";

export default function DriverSupportChat() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");

  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/support/conversations"],
  });

  const { data: currentConversation } = useQuery({
    queryKey: selectedConversation ? ["/api/support/conversations", selectedConversation] : [],
    enabled: !!selectedConversation,
  });

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

  if (!selectedConversation) {
    return (
      <div className="p-6 space-y-4" data-testid="driver-support-chat">
        <h2 className="text-2xl font-bold">Support Chat</h2>
        {conversations.length === 0 ? (
          <Button onClick={() => {}} data-testid="button-create-support-ticket">
            Create New Ticket
          </Button>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv: any) => (
              <Card
                key={conv.id}
                className="p-4 cursor-pointer hover:bg-muted"
                onClick={() => setSelectedConversation(conv.id)}
                data-testid={`card-conversation-${conv.id}`}
              >
                <p className="font-medium">Support Conversation</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 h-full flex flex-col" data-testid="driver-support-chat-open">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Support Conversation</h2>
        <Button variant="outline" onClick={() => setSelectedConversation(null)}>
          Back
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3" data-testid="div-messages">
        {currentConversation?.messages?.map((msg: any) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === "admin" ? "justify-start" : "justify-end"}`}
            data-testid={`message-${msg.id}`}
          >
            <div
              className={`max-w-md p-3 rounded ${
                msg.senderType === "admin"
                  ? "bg-muted text-foreground"
                  : "bg-blue-500 text-white"
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
          data-testid="button-send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
