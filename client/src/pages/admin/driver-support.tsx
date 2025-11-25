import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  User,
  Headphones,
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
  Send,
  StickyNote,
  RefreshCw,
  ChevronRight,
  Phone,
  MapPin,
  Mail,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  countryCode?: string;
}

interface TicketMessage {
  id: string;
  senderRole: string;
  senderName: string;
  messageBody: string;
  attachmentUrls?: string[];
  createdAt: string;
}

interface StatusHistory {
  id: string;
  previousStatus?: string;
  newStatus: string;
  changedByRole: string;
  note?: string;
  createdAt: string;
  changedBy?: { email: string };
}

interface SupportTicket {
  id: string;
  ticketCode: string;
  subject: string;
  category: string;
  subcategory?: string;
  tripId?: string;
  status: string;
  priority: string;
  description: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  driver: DriverInfo;
  assignedAdmin?: { id?: string; email: string };
  messages?: TicketMessage[];
  statusHistory?: StatusHistory[];
  _count?: {
    messages: number;
  };
}

const categoryIcons: Record<string, typeof FileText> = {
  account_documents: FileText,
  trip_issues: Car,
  payment_earnings: DollarSign,
  incentives_promotions: Gift,
  safety_emergency: Shield,
  app_technical: Smartphone,
};

const categoryLabels: Record<string, string> = {
  account_documents: "Account & Documents",
  trip_issues: "Trip Issues",
  payment_earnings: "Payment & Earnings",
  incentives_promotions: "Incentives & Promotions",
  safety_emergency: "Safety & Emergency",
  app_technical: "App & Technical",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function AdminDriverSupport() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{
    tickets: SupportTicket[];
    total: number;
    statusCounts: Record<string, number>;
  }>({
    queryKey: ["/api/admin/support-center/driver-tickets", statusFilter, categoryFilter, priorityFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/admin/support-center/driver-tickets?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const { data: ticketDetail, isLoading: isDetailLoading } = useQuery<{ ticket: SupportTicket }>({
    queryKey: ["/api/admin/support-center/driver-tickets", selectedTicket?.id, "detail"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/support-center/driver-tickets/${selectedTicket?.id}`);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    enabled: !!selectedTicket?.id && isDetailOpen,
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, messageBody }: { ticketId: string; messageBody: string }) => {
      return apiRequest(`/api/admin/support-center/driver-tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ messageBody }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-center/driver-tickets"] });
      setReplyText("");
      toast({ title: "Reply Sent", description: "Your message has been sent to the driver." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send reply", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, status, note }: { ticketId: string; status: string; note?: string }) => {
      return apiRequest(`/api/admin/support-center/driver-tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-center/driver-tickets"] });
      setIsStatusDialogOpen(false);
      setStatusNote("");
      toast({ title: "Status Updated", description: "Ticket status has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async ({ ticketId, adminNotes }: { ticketId: string; adminNotes: string }) => {
      return apiRequest(`/api/admin/support-center/driver-tickets/${ticketId}/admin-notes`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-center/driver-tickets"] });
      toast({ title: "Notes Saved", description: "Internal notes have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save notes", variant: "destructive" });
    },
  });

  const tickets = data?.tickets || [];
  const statusCounts = data?.statusCounts || {};
  const detail = ticketDetail?.ticket;

  const handleOpenDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAdminNotes(ticket.adminNotes || "");
    setIsDetailOpen(true);
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedTicket) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, messageBody: replyText.trim() });
  };

  const handleUpdateStatus = () => {
    if (!newStatus || !selectedTicket) return;
    statusMutation.mutate({ ticketId: selectedTicket.id, status: newStatus, note: statusNote || undefined });
  };

  const handleSaveNotes = () => {
    if (!selectedTicket) return;
    notesMutation.mutate({ ticketId: selectedTicket.id, adminNotes });
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Error Loading Tickets</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error ? error.message : "Failed to load tickets"}
                </p>
              </div>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Driver Support Tickets
          </h1>
          <p className="text-muted-foreground">
            Manage driver support requests and issues
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.open || 0}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <MessageSquare className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.in_progress || 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.resolved || 0}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <CheckCircle2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.closed || 0}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-priority-filter">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
              <h3 className="font-semibold text-lg mb-1">No Tickets Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No driver support tickets yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const CategoryIcon = categoryIcons[ticket.category] || FileText;
                const statusInfo = statusConfig[ticket.status] || statusConfig.open;
                const priorityInfo = priorityConfig[ticket.priority] || priorityConfig.normal;

                return (
                  <div
                    key={ticket.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover-elevate cursor-pointer transition-all"
                    onClick={() => handleOpenDetail(ticket)}
                    data-testid={`row-ticket-${ticket.id}`}
                  >
                    <div className="flex-shrink-0 p-2 rounded-lg bg-muted">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{ticket.subject}</span>
                        <Badge variant="outline" className={`text-xs ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{ticket.ticketCode}</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.driver.firstName} {ticket.driver.lastName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {ticket._count?.messages || 0}
                        </span>
                        <span>{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {selectedTicket?.ticketCode}
              </span>
            </SheetTitle>
          </SheetHeader>

          {isDetailLoading || !detail ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">{detail.subject}</h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusConfig[detail.status]?.color}>
                    {statusConfig[detail.status]?.label}
                  </Badge>
                  <Badge variant="outline" className={priorityConfig[detail.priority]?.color}>
                    {priorityConfig[detail.priority]?.label} Priority
                  </Badge>
                  <Badge variant="outline">
                    {categoryLabels[detail.category] || detail.category}
                  </Badge>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Driver Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{detail.driver.firstName} {detail.driver.lastName}</span>
                    </div>
                    {detail.driver.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{detail.driver.email}</span>
                      </div>
                    )}
                    {detail.driver.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{detail.driver.phoneNumber}</span>
                      </div>
                    )}
                    {detail.driver.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{detail.driver.city}, {detail.driver.countryCode}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                  {detail.description}
                </p>
              </div>

              <div className="flex gap-2">
                <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-update-status">
                      Update Status
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Ticket Status</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">New Status</label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger data-testid="select-new-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Note (optional)</label>
                        <Textarea
                          placeholder="Add a note about this status change..."
                          value={statusNote}
                          onChange={(e) => setStatusNote(e.target.value)}
                          rows={3}
                          data-testid="textarea-status-note"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateStatus}
                        disabled={!newStatus || statusMutation.isPending}
                        data-testid="button-confirm-status"
                      >
                        {statusMutation.isPending ? "Updating..." : "Update Status"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversation
                </h4>
                <ScrollArea className="h-64 border rounded-lg p-3">
                  {detail.messages && detail.messages.length > 0 ? (
                    <div className="space-y-4">
                      {detail.messages.map((message) => (
                        <div key={message.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={
                              message.senderRole === "support" || message.senderRole === "admin"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted"
                            }>
                              {message.senderRole === "support" || message.senderRole === "admin" ? (
                                <Headphones className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{message.senderName}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.createdAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{message.messageBody}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      No messages yet
                    </div>
                  )}
                </ScrollArea>

                {detail.status !== "closed" && detail.status !== "resolved" && (
                  <div className="mt-3 flex gap-2">
                    <Textarea
                      placeholder="Type your reply to the driver..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      className="flex-1"
                      data-testid="textarea-reply"
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Internal Notes
                  <span className="text-xs text-muted-foreground">(Not visible to driver)</span>
                </h4>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add internal notes about this ticket..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    data-testid="textarea-admin-notes"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={notesMutation.isPending}
                    data-testid="button-save-notes"
                  >
                    {notesMutation.isPending ? "Saving..." : "Save Notes"}
                  </Button>
                </div>
              </div>

              {detail.statusHistory && detail.statusHistory.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Status History
                    </h4>
                    <div className="space-y-2">
                      {detail.statusHistory.map((history) => (
                        <div key={history.id} className="flex items-center gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          <span className="capitalize">
                            {history.previousStatus ? (
                              <>{history.previousStatus.replace("_", " ")} → {history.newStatus.replace("_", " ")}</>
                            ) : (
                              <>Created as {history.newStatus.replace("_", " ")}</>
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(history.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
