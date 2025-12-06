import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Search, Users, Clock, CheckCheck, Circle, Hash, Plus, Settings, AtSign, Paperclip, Smile } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  type: string;
  attachments: { url: string; type: string; name: string }[];
  mentions: string[];
  isEdited: boolean;
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  type: "channel" | "direct";
  description: string | null;
  memberCount: number;
  unreadCount: number;
  lastMessage: ChatMessage | null;
  members: { id: string; name: string; avatar: string | null; online: boolean }[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  online: boolean;
  lastSeen: string | null;
}

interface ChatData {
  channels: Channel[];
  directMessages: Channel[];
  onlineAdmins: AdminUser[];
  allAdmins: AdminUser[];
}

export default function AdminChat() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("channels");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false);
  const [showNewDMDialog, setShowNewDMDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newChannelForm, setNewChannelForm] = useState({
    name: "",
    description: "",
    members: [] as string[],
  });

  const { data, isLoading } = useQuery<ChatData>({
    queryKey: ["/api/admin/phase4/admin-chat"],
    refetchInterval: 5000,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["/api/admin/phase4/admin-chat/messages", selectedChannel?.id],
    enabled: !!selectedChannel,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { channelId: string; content: string }) => {
      return apiRequest(`/api/admin/phase4/admin-chat/messages`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/admin-chat/messages", selectedChannel?.id] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: typeof newChannelForm) => {
      return apiRequest(`/api/admin/phase4/admin-chat/channels`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Channel created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phase4/admin-chat"] });
      setShowNewChannelDialog(false);
      setNewChannelForm({ name: "", description: "", members: [] });
    },
    onError: () => {
      toast({ title: "Failed to create channel", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChannel) return;
    sendMessageMutation.mutate({
      channelId: selectedChannel.id,
      content: messageInput,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMemberToggle = (memberId: string, checked: boolean) => {
    setNewChannelForm((prev) => ({
      ...prev,
      members: checked
        ? [...prev.members, memberId]
        : prev.members.filter((id) => id !== memberId),
    }));
  };

  const getStatusColor = (online: boolean) => {
    return online ? "bg-green-500" : "bg-gray-400";
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Internal Admin Chat"
        description="Secure communication between admins"
        icon={MessageCircle}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
      />

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 h-[calc(100vh-200px)]">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Conversations</CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowNewChannelDialog(true)}
                    data-testid="button-new-channel"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-2"
                data-testid="input-search"
              />
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="channels">
                    <Hash className="h-4 w-4 mr-1" />
                    Channels
                  </TabsTrigger>
                  <TabsTrigger value="dms">
                    <MessageCircle className="h-4 w-4 mr-1" />
                    DMs
                  </TabsTrigger>
                  <TabsTrigger value="online">
                    <Users className="h-4 w-4 mr-1" />
                    Online
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="channels" className="m-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-2 space-y-1">
                      {isLoading ? (
                        <div className="space-y-2 p-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                          ))}
                        </div>
                      ) : (
                        data?.channels?.map((channel) => (
                          <div
                            key={channel.id}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedChannel?.id === channel.id
                                ? "bg-primary/10 border border-primary"
                                : "hover-elevate"
                            }`}
                            onClick={() => setSelectedChannel(channel)}
                            data-testid={`channel-${channel.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium flex-1">{channel.name}</span>
                              {channel.unreadCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {channel.unreadCount}
                                </Badge>
                              )}
                            </div>
                            {channel.lastMessage && (
                              <p className="text-xs text-muted-foreground truncate mt-1 pl-6">
                                {channel.lastMessage.senderName}: {channel.lastMessage.content}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="dms" className="m-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-2 space-y-1">
                      {data?.directMessages?.map((dm) => (
                        <div
                          key={dm.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedChannel?.id === dm.id
                              ? "bg-primary/10 border border-primary"
                              : "hover-elevate"
                          }`}
                          onClick={() => setSelectedChannel(dm)}
                          data-testid={`dm-${dm.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={dm.members[0]?.avatar || ""} />
                                <AvatarFallback>
                                  {dm.members[0]?.name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(dm.members[0]?.online)}`} />
                            </div>
                            <span className="font-medium flex-1">{dm.name}</span>
                            {dm.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {dm.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => setShowNewDMDialog(true)}
                        data-testid="button-new-dm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Message
                      </Button>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="online" className="m-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground px-2 mb-2">
                        {data?.onlineAdmins?.length || 0} online now
                      </p>
                      <div className="space-y-1">
                        {data?.onlineAdmins?.map((admin) => (
                          <div
                            key={admin.id}
                            className="flex items-center gap-2 p-2 rounded-lg hover-elevate cursor-pointer"
                            data-testid={`admin-${admin.id}`}
                          >
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={admin.avatar || ""} />
                                <AvatarFallback>{admin.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{admin.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{admin.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 flex flex-col">
            {selectedChannel ? (
              <>
                <CardHeader className="border-b flex-row items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {selectedChannel.type === "channel" ? (
                      <Hash className="h-5 w-5" />
                    ) : (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selectedChannel.members[0]?.avatar || ""} />
                        <AvatarFallback>{selectedChannel.members[0]?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <CardTitle className="text-lg">{selectedChannel.name}</CardTitle>
                      {selectedChannel.description && (
                        <CardDescription className="text-xs">{selectedChannel.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {selectedChannel.memberCount}
                    </Badge>
                    <Button size="icon" variant="ghost">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden">
                  <ScrollArea className="h-[400px] p-4">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-16 w-64" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messagesData?.messages?.map((message, idx) => {
                          const showAvatar = idx === 0 || messagesData.messages[idx - 1].senderId !== message.senderId;
                          return (
                            <div key={message.id} className={`flex gap-3 ${!showAvatar ? "pl-13" : ""}`} data-testid={`message-${message.id}`}>
                              {showAvatar && (
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={message.senderAvatar || ""} />
                                  <AvatarFallback>{message.senderName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                              )}
                              <div className={!showAvatar ? "ml-13" : ""}>
                                {showAvatar && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{message.senderName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(message.createdAt), "HH:mm")}
                                    </span>
                                    {message.isEdited && (
                                      <span className="text-xs text-muted-foreground">(edited)</span>
                                    )}
                                  </div>
                                )}
                                <p className="text-sm">{message.content}</p>
                                {message.attachments?.length > 0 && (
                                  <div className="flex gap-2 mt-2">
                                    {message.attachments.map((att, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        <Paperclip className="h-3 w-3 mr-1" />
                                        {att.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder={`Message #${selectedChannel.name}`}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1"
                      data-testid="input-message"
                    />
                    <Button size="icon" variant="ghost">
                      <AtSign className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost">
                      <Smile className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendMessageMutation.isPending}
                      data-testid="button-send"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center h-full">
                <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a conversation to start chatting</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={showNewChannelDialog} onOpenChange={setShowNewChannelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel Name</Label>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="general-discussion"
                  value={newChannelForm.name}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, name: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  data-testid="input-channel-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What's this channel about?"
                value={newChannelForm.description}
                onChange={(e) => setNewChannelForm({ ...newChannelForm, description: e.target.value })}
                data-testid="textarea-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Add Members</Label>
              <ScrollArea className="h-40 border rounded-lg p-2">
                <div className="space-y-2">
                  {data?.allAdmins?.map((admin) => (
                    <div key={admin.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-${admin.id}`}
                        checked={newChannelForm.members.includes(admin.id)}
                        onCheckedChange={(checked) => handleMemberToggle(admin.id, checked as boolean)}
                        data-testid={`checkbox-member-${admin.id}`}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={admin.avatar || ""} />
                        <AvatarFallback>{admin.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`member-${admin.id}`} className="flex-1 cursor-pointer">
                        {admin.name}
                      </Label>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(admin.online)}`} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChannelDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createChannelMutation.mutate(newChannelForm)}
              disabled={createChannelMutation.isPending || !newChannelForm.name}
              data-testid="button-create-channel"
            >
              {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewDMDialog} onOpenChange={setShowNewDMDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-60">
            <div className="space-y-2 p-1">
              {data?.allAdmins?.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer"
                  onClick={() => {
                    setShowNewDMDialog(false);
                  }}
                  data-testid={`dm-admin-${admin.id}`}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={admin.avatar || ""} />
                      <AvatarFallback>{admin.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(admin.online)}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">{admin.role}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
