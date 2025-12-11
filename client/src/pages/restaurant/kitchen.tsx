import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, ChefHat, Clock, Check, AlertCircle, Loader2,
  Timer, Bell, Package, RefreshCw, Utensils, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface KitchenTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  status: "queued" | "preparing" | "ready" | "handed_to_driver" | "cancelled";
  priority: "normal" | "rush" | "delayed";
  items: {
    name: string;
    quantity: number;
    specialInstructions?: string;
    options?: string[];
  }[];
  estimatedPrepTime: number;
  actualPrepTime?: number;
  createdAt: string;
  startedAt?: string;
  readyAt?: string;
  completedAt?: string;
  customerName?: string;
  deliveryType: "pickup" | "delivery";
}

interface KitchenStats {
  queuedCount: number;
  preparingCount: number;
  readyCount: number;
  handedOffToday: number;
  avgPrepTime: number;
}

interface KitchenResponse {
  tickets: KitchenTicket[];
  stats: KitchenStats;
}

const statusColors = {
  queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  preparing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  ready: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  handed_to_driver: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

const priorityColors = {
  normal: "",
  rush: "ring-2 ring-red-500",
  delayed: "ring-2 ring-yellow-500",
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function KitchenDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data, isLoading, error, refetch } = useQuery<KitchenResponse>({
    queryKey: ["/api/restaurant/kitchen/tickets"],
    refetchInterval: 15000,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const response = await apiRequest(`/api/restaurant/kitchen/tickets/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/kitchen/tickets"] });
      const statusMessages = {
        preparing: "Started preparing order",
        ready: "Order marked as ready",
        handed_to_driver: "Order handed to driver",
      };
      toast({
        title: "Status updated",
        description: statusMessages[variables.status as keyof typeof statusMessages] || "Ticket updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update ticket status.",
        variant: "destructive",
      });
    },
  });

  const tickets = data?.tickets || [];
  const stats = data?.stats || {
    queuedCount: 0,
    preparingCount: 0,
    readyCount: 0,
    handedOffToday: 0,
    avgPrepTime: 0,
  };

  const activeTickets = tickets.filter((t) => t.status !== "handed_to_driver" && t.status !== "cancelled");
  const completedTickets = tickets.filter((t) => t.status === "handed_to_driver");

  const filteredActiveTickets = priorityFilter === "all"
    ? activeTickets
    : activeTickets.filter((t) => t.priority === priorityFilter);

  const handleStartPreparing = (ticketId: string) => {
    updateTicketMutation.mutate({ ticketId, status: "preparing" });
  };

  const handleMarkReady = (ticketId: string) => {
    updateTicketMutation.mutate({ ticketId, status: "ready" });
  };

  const handleHandoff = (ticketId: string) => {
    updateTicketMutation.mutate({ ticketId, status: "handed_to_driver" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Link href="/restaurant">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Kitchen Display
              </h1>
              <p className="text-sm text-muted-foreground">Manage incoming orders</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-queued">{stats.queuedCount}</p>
                  <p className="text-sm text-muted-foreground">Queued</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-preparing">{stats.preparingCount}</p>
                  <p className="text-sm text-muted-foreground">Preparing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-ready">{stats.readyCount}</p>
                  <p className="text-sm text-muted-foreground">Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-avg-time">
                    {formatDuration(stats.avgPrepTime)}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Prep</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Failed to load kitchen tickets. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="active" data-testid="tab-active">
                Active ({activeTickets.length})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                Completed ({completedTickets.length})
              </TabsTrigger>
            </TabsList>

            {activeTab === "active" && (
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-priority-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="rush">Rush Only</SelectItem>
                  <SelectItem value="delayed">Delayed Only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="active" className="mt-4">
            {filteredActiveTickets.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="p-8 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <ChefHat className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">No active orders</h3>
                  <p className="text-sm text-muted-foreground">
                    New orders will appear here automatically
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredActiveTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className={`${priorityColors[ticket.priority]}`}
                    data-testid={`ticket-${ticket.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            #{ticket.orderNumber}
                            {ticket.priority === "rush" && (
                              <Badge variant="destructive" className="text-[10px]">RUSH</Badge>
                            )}
                            {ticket.priority === "delayed" && (
                              <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">DELAYED</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Package className="h-3 w-3" />
                            {ticket.deliveryType === "pickup" ? "Pickup" : "Delivery"}
                            {ticket.customerName && ` · ${ticket.customerName}`}
                          </CardDescription>
                        </div>
                        <Badge className={statusColors[ticket.status]}>
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {ticket.items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="font-medium text-sm min-w-[24px]">
                              {item.quantity}x
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.name}</p>
                              {item.options && item.options.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {item.options.join(", ")}
                                </p>
                              )}
                              {item.specialInstructions && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                  Note: {item.specialInstructions}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(ticket.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Est. {ticket.estimatedPrepTime}m
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {ticket.status === "queued" && (
                          <Button
                            className="flex-1"
                            onClick={() => handleStartPreparing(ticket.id)}
                            disabled={updateTicketMutation.isPending}
                            data-testid={`button-start-${ticket.id}`}
                          >
                            {updateTicketMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Utensils className="h-4 w-4 mr-2" />
                                Start Preparing
                              </>
                            )}
                          </Button>
                        )}
                        {ticket.status === "preparing" && (
                          <Button
                            className="flex-1"
                            variant="default"
                            onClick={() => handleMarkReady(ticket.id)}
                            disabled={updateTicketMutation.isPending}
                            data-testid={`button-ready-${ticket.id}`}
                          >
                            {updateTicketMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Bell className="h-4 w-4 mr-2" />
                                Mark Ready
                              </>
                            )}
                          </Button>
                        )}
                        {ticket.status === "ready" && (
                          <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => handleHandoff(ticket.id)}
                            disabled={updateTicketMutation.isPending}
                            data-testid={`button-handoff-${ticket.id}`}
                          >
                            {updateTicketMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Hand to Driver
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completedTickets.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No completed orders today
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {completedTickets.map((ticket) => (
                  <Card key={ticket.id} className="bg-muted/30" data-testid={`completed-ticket-${ticket.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">#{ticket.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {ticket.items.length} items · {ticket.deliveryType}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {ticket.actualPrepTime ? `${ticket.actualPrepTime}m` : "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Completed {ticket.completedAt && formatTimeAgo(ticket.completedAt)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
