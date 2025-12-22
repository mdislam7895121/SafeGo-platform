import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Ticket, 
  Bot,
  ChevronRight,
  ArrowLeft,
  Send,
  Plus,
  FileText,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

type RoleScope = "CUSTOMER" | "DRIVER" | "RESTAURANT";
type ConversationStatus = "open" | "escalated" | "resolved";

interface Conversation {
  id: string;
  userId: string;
  userRole: string;
  country: string;
  service: string;
  status: string;
  lastMessage: {
    content: string;
    direction: string;
    createdAt: string;
  } | null;
  messageCount: number;
  isEscalated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConversationDetail {
  id: string;
  userId: string;
  userRole: string;
  country: string;
  service: string;
  status: string;
  isEscalated: boolean;
  assignedAdminId: string | null;
  messages: Array<{
    id: string;
    direction: string;
    content: string;
    moderationFlags: any;
    sources: any;
    createdAt: string;
  }>;
  relatedEntities: {
    rideId: string | null;
    foodOrderId: string | null;
    deliveryId: string | null;
  };
  user: {
    id: string;
    email: string;
    countryCode: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface SupportTicket {
  id: string;
  ticketCode: string;
  roleScope: string;
  userId: string;
  country: string;
  service: string;
  reason: string;
  severity: string;
  status: string;
  assignedToAdminId: string | null;
  resolutionReason: string | null;
  lastNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export default function SafePilotSupportCenter() {
  const [activeTab, setActiveTab] = useState<"conversations" | "tickets">("conversations");
  const [roleScope, setRoleScope] = useState<RoleScope>("CUSTOMER");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [ticketReason, setTicketReason] = useState("");
  const [ticketSeverity, setTicketSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations, refetch: refetchConversations } = useQuery({
    queryKey: ["/api/admin/safepilot/support/conversations", roleScope, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        role_scope: roleScope,
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/safepilot/support/conversations?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  // Fetch conversation detail
  const { data: conversationDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["/api/admin/safepilot/support/conversations", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      const res = await fetch(`/api/admin/safepilot/support/conversations/${selectedConversation}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch conversation detail");
      return res.json() as Promise<ConversationDetail>;
    },
    enabled: !!selectedConversation,
  });

  // Fetch tickets
  const { data: ticketsData, isLoading: loadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["/api/admin/safepilot/support/tickets", roleScope, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(roleScope && { role_scope: roleScope }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/safepilot/support/tickets?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
    enabled: activeTab === "tickets",
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: {
      conversationId: string;
      roleScope: string;
      userId: string;
      country: string;
      service: string;
      reason: string;
      severity: string;
    }) => {
      const res = await fetch("/api/admin/safepilot/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      return res.json();
    },
    onSuccess: () => {
      setCreateTicketOpen(false);
      setTicketReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/safepilot/support"] });
      refetchConversations();
    },
  });

  const handleCreateTicket = () => {
    if (!conversationDetail || !ticketReason.trim()) return;
    
    createTicketMutation.mutate({
      conversationId: conversationDetail.id,
      roleScope: conversationDetail.userRole,
      userId: conversationDetail.userId,
      country: conversationDetail.country,
      service: conversationDetail.service || "ALL",
      reason: ticketReason,
      severity: ticketSeverity,
    });
  };

  const getStatusBadge = (status: string, isEscalated: boolean) => {
    if (isEscalated || status === "escalated") {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Escalated</Badge>;
    }
    if (status === "resolved") {
      return <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" /> Resolved</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Open</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <Badge variant="destructive">High</Badge>;
      case "MEDIUM":
        return <Badge variant="default" className="bg-yellow-500">Medium</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const conversations = conversationsData?.conversations || [];
  const tickets = ticketsData?.tickets || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-500" />
            SafePilot Support Center
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage and review SafePilot AI conversations across all user roles
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList className="bg-white dark:bg-gray-800 border">
            <TabsTrigger value="conversations" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2">
              <Ticket className="w-4 h-4" />
              Support Tickets
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-4 mb-4">
            <Select value={roleScope} onValueChange={(v) => setRoleScope(v as RoleScope)}>
              <SelectTrigger className="w-40 bg-white dark:bg-gray-800">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER">Customers</SelectItem>
                <SelectItem value="DRIVER">Drivers</SelectItem>
                <SelectItem value="RESTAURANT">Restaurants</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-white dark:bg-gray-800">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search conversations..." 
                className="pl-10 bg-white dark:bg-gray-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button variant="outline" onClick={() => {
              refetchConversations();
              refetchTickets();
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <TabsContent value="conversations" className="mt-0">
            <div className="grid grid-cols-12 gap-4">
              <div className={selectedConversation ? "col-span-4" : "col-span-12"}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{roleScope} Conversations</span>
                      <Badge variant="outline">{conversationsData?.total || 0} total</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                      {loadingConversations ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                      ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No conversations found</p>
                        </div>
                      ) : (
                        conversations.map((conv: Conversation) => (
                          <div
                            key={conv.id}
                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                              selectedConversation === conv.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                            }`}
                            onClick={() => setSelectedConversation(conv.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm truncate">{conv.userId.slice(0, 8)}...</span>
                              {getStatusBadge(conv.status, conv.isEscalated)}
                            </div>
                            {conv.lastMessage && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {conv.lastMessage.content}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                              <span>{conv.messageCount} messages</span>
                              <span>{format(new Date(conv.updatedAt), "MMM d, HH:mm")}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {selectedConversation && (
                <div className="col-span-8">
                  <Card>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)}>
                            <ArrowLeft className="w-4 h-4" />
                          </Button>
                          <div>
                            <CardTitle className="text-lg">Conversation Detail</CardTitle>
                            {conversationDetail?.user && (
                              <CardDescription>
                                {conversationDetail.user.email} | {conversationDetail.country}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conversationDetail && getStatusBadge(conversationDetail.status, conversationDetail.isEscalated)}
                          <Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Ticket className="w-4 h-4" />
                                Create Ticket
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create Support Ticket</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <label className="text-sm font-medium">Severity</label>
                                  <Select value={ticketSeverity} onValueChange={(v) => setTicketSeverity(v as any)}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="LOW">Low</SelectItem>
                                      <SelectItem value="MEDIUM">Medium</SelectItem>
                                      <SelectItem value="HIGH">High</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Reason for Escalation</label>
                                  <Textarea
                                    className="mt-1"
                                    placeholder="Describe why this conversation needs escalation..."
                                    value={ticketReason}
                                    onChange={(e) => setTicketReason(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateTicketOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateTicket} disabled={createTicketMutation.isPending}>
                                  {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[500px] p-4">
                        {loadingDetail ? (
                          <div className="text-center text-gray-500">Loading...</div>
                        ) : conversationDetail?.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`mb-4 flex ${msg.direction === "OUTBOUND" ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                msg.direction === "OUTBOUND"
                                  ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                                  : "bg-gray-100 dark:bg-gray-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {msg.direction === "OUTBOUND" ? (
                                  <Bot className="w-4 h-4" />
                                ) : (
                                  <Users className="w-4 h-4" />
                                )}
                                <span className="text-xs font-medium">
                                  {msg.direction === "OUTBOUND" ? "SafePilot" : "User"}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {format(new Date(msg.createdAt), "HH:mm")}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              {msg.moderationFlags && Object.keys(msg.moderationFlags).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                  <span className="text-xs text-yellow-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Moderation flags detected
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tickets" className="mt-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Support Tickets</span>
                  <Badge variant="outline">{ticketsData?.total || 0} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {loadingTickets ? (
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                  ) : tickets.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tickets found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {tickets.map((ticket: SupportTicket) => (
                        <div key={ticket.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-medium text-blue-600">{ticket.ticketCode}</span>
                              {getSeverityBadge(ticket.severity)}
                              <Badge variant={ticket.status === "RESOLVED" ? "secondary" : "outline"}>
                                {ticket.status}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-400">
                              {format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{ticket.reason}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>{ticket.roleScope}</span>
                            <span>{ticket.country}</span>
                            <span>{ticket.service}</span>
                            {ticket.resolvedAt && (
                              <span className="text-green-600">
                                Resolved: {format(new Date(ticket.resolvedAt), "MMM d, HH:mm")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
