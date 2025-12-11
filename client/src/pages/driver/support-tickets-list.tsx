import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  Filter,
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
  Inbox,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SupportTicket {
  id: string;
  ticketCode: string;
  subject: string;
  category: string;
  subcategory?: string;
  tripId?: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
  messages?: { createdAt: string }[];
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

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { 
    label: "Open", 
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Clock 
  },
  in_progress: { 
    label: "In Progress", 
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: MessageSquare 
  },
  resolved: { 
    label: "Resolved", 
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle2 
  },
  closed: { 
    label: "Closed", 
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    icon: CheckCircle2 
  },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function DriverSupportTicketsList() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<{
    tickets: SupportTicket[];
    total: number;
  }>({
    queryKey: ["/api/driver/support-center/tickets", statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      
      const response = await fetch(`/api/driver/support-center/tickets?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const tickets = data?.tickets || [];
  const activeTickets = tickets.filter(t => t.status !== "closed" && t.status !== "resolved");
  const resolvedTickets = tickets.filter(t => t.status === "closed" || t.status === "resolved");

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Error Loading Tickets</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error ? error.message : "Failed to load support tickets"}
                </p>
              </div>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderTicketCard = (ticket: SupportTicket) => {
    const CategoryIcon = categoryIcons[ticket.category] || FileText;
    const statusInfo = statusConfig[ticket.status] || statusConfig.open;
    const priorityInfo = priorityConfig[ticket.priority] || priorityConfig.normal;
    const StatusIcon = statusInfo.icon;
    const messageCount = ticket._count?.messages || 0;
    const lastActivity = ticket.messages?.[0]?.createdAt || ticket.updatedAt;

    return (
      <Card
        key={ticket.id}
        className="hover-elevate cursor-pointer transition-all"
        onClick={() => setLocation(`/driver/support-ticket/${ticket.id}`)}
        data-testid={`card-ticket-${ticket.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2.5 rounded-xl bg-muted">
              <CategoryIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-base truncate">{ticket.subject}</h3>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
                {ticket.priority === "urgent" || ticket.priority === "high" ? (
                  <Badge variant="outline" className={`text-xs ${priorityInfo.color}`}>
                    {priorityInfo.label}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{ticket.ticketCode}</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {messageCount}
                </span>
                <span>
                  {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Support Tickets
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your support requests
            </p>
          </div>
          <Button onClick={() => setLocation("/driver/support-help-center")} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>

        <div className="flex gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <Filter className="h-4 w-4 mr-2 opacity-50" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Inbox className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Tickets Found</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  You haven't created any support tickets yet. Need help with something?
                </p>
                <Button onClick={() => setLocation("/driver/support-help-center")} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active" data-testid="tab-active">
                Active ({activeTickets.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" data-testid="tab-resolved">
                Resolved ({resolvedTickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3">
              {activeTickets.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center text-center">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
                      <p className="text-muted-foreground">All caught up! No active tickets.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                activeTickets.map(renderTicketCard)
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-3">
              {resolvedTickets.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center text-center">
                      <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No resolved tickets yet.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                resolvedTickets.map(renderTicketCard)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
