import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { 
  ArrowLeft, Bell, CheckCheck, Filter, Search, X, BellOff,
  Car, UtensilsCrossed, ShoppingBag, Ticket, Key, Server,
  AlertTriangle, Volume2, VolumeX, ChevronRight, Clock, User,
  MapPin, History, RefreshCw, ExternalLink, Shield, AlertCircle,
  Info, XCircle, Settings, Activity, Layers, Wifi, WifiOff, Download
} from "lucide-react";
import { useAdminNotificationsWs } from "@/hooks/use-admin-notifications-ws";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface AdminNotification {
  id: string;
  type: string;
  severity: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string | null;
  countryCode: string | null;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface NotificationStats {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
  byCategory: Record<string, number>;
}

const categoryConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  ride: { label: "Ride-Hailing", icon: Car, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  food: { label: "Food Delivery", icon: UtensilsCrossed, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/10" },
  shop: { label: "Shop Partner", icon: ShoppingBag, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-500/10" },
  ticket: { label: "Ticket Operator", icon: Ticket, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  rental: { label: "Rental Vehicle", icon: Key, color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-500/10" },
  system: { label: "System", icon: Server, color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500/10" },
  security: { label: "Security", icon: Shield, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/10" },
};

const severityConfig: Record<string, { label: string; icon: any; color: string; badgeColor: string }> = {
  critical: { label: "Critical", icon: XCircle, color: "text-red-600", badgeColor: "bg-red-500 text-white" },
  warning: { label: "Warning", icon: AlertTriangle, color: "text-yellow-600", badgeColor: "bg-yellow-500 text-white" },
  info: { label: "Info", icon: Info, color: "text-blue-600", badgeColor: "bg-blue-500 text-white" },
};

const entityTypeConfig: Record<string, { label: string; icon: any }> = {
  driver: { label: "Driver", icon: Car },
  customer: { label: "Customer", icon: User },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed },
  parcel: { label: "Parcel", icon: ShoppingBag },
  kyc: { label: "KYC", icon: Shield },
  document: { label: "Document", icon: Layers },
  wallet: { label: "Wallet", icon: Activity },
  system: { label: "System", icon: Server },
};

function getNotificationCategory(notification: AdminNotification): string {
  const type = notification.type?.toLowerCase() || "";
  const entityType = notification.entityType?.toLowerCase() || "";
  
  if (type.includes("security") || type.includes("fraud")) return "security";
  if (entityType === "driver" || type.includes("ride") || type.includes("trip")) return "ride";
  if (entityType === "restaurant" || type.includes("food") || type.includes("order")) return "food";
  if (type.includes("shop") || type.includes("parcel")) return "shop";
  if (type.includes("ticket")) return "ticket";
  if (type.includes("rental")) return "rental";
  return "system";
}

function NotificationCard({ 
  notification, 
  onMarkRead, 
  onViewDetails,
  isMarkingRead 
}: { 
  notification: AdminNotification; 
  onMarkRead: () => void;
  onViewDetails: () => void;
  isMarkingRead: boolean;
}) {
  const category = getNotificationCategory(notification);
  const categoryInfo = categoryConfig[category] || categoryConfig.system;
  const severityInfo = severityConfig[notification.severity] || severityConfig.info;
  const entityInfo = entityTypeConfig[notification.entityType] || entityTypeConfig.system;
  const CategoryIcon = categoryInfo.icon;
  const SeverityIcon = severityInfo.icon;
  const EntityIcon = entityInfo.icon;

  return (
    <Card 
      className={`transition-all cursor-pointer hover-elevate ${
        !notification.isRead ? "border-l-4 border-l-primary bg-accent/30" : ""
      }`}
      onClick={onViewDetails}
      data-testid={`notification-card-${notification.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${categoryInfo.bgColor}`}>
            <CategoryIcon className={`h-5 w-5 ${categoryInfo.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={severityInfo.badgeColor}>
                  <SeverityIcon className="h-3 w-3 mr-1" />
                  {severityInfo.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <EntityIcon className="h-3 w-3 mr-1" />
                  {entityInfo.label}
                </Badge>
                {notification.countryCode && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {notification.countryCode}
                  </Badge>
                )}
                {!notification.isRead && (
                  <Badge className="bg-primary text-primary-foreground text-xs">New</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
              </span>
            </div>
            
            <h3 className="font-semibold text-sm mb-1 line-clamp-1">{notification.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {notification.actorEmail && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {notification.actorEmail}
                  </span>
                )}
              </div>
              {!notification.isRead && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead();
                  }}
                  disabled={isMarkingRead}
                  className="text-xs"
                  data-testid={`button-mark-read-${notification.id}`}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark Read
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationDetail({ 
  notification, 
  open, 
  onClose,
  onMarkRead
}: { 
  notification: AdminNotification | null;
  open: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
}) {
  if (!notification) return null;

  const category = getNotificationCategory(notification);
  const categoryInfo = categoryConfig[category] || categoryConfig.system;
  const severityInfo = severityConfig[notification.severity] || severityConfig.info;
  const entityInfo = entityTypeConfig[notification.entityType] || entityTypeConfig.system;
  const CategoryIcon = categoryInfo.icon;
  const SeverityIcon = severityInfo.icon;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${categoryInfo.bgColor}`}>
              <CategoryIcon className={`h-5 w-5 ${categoryInfo.color}`} />
            </div>
            <span className="line-clamp-1">{notification.title}</span>
          </SheetTitle>
          <SheetDescription>
            Notification details and activity log
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={severityInfo.badgeColor}>
              <SeverityIcon className="h-3 w-3 mr-1" />
              {severityInfo.label}
            </Badge>
            <Badge variant="outline">{categoryInfo.label}</Badge>
            <Badge variant="outline">{entityInfo.label}</Badge>
            {notification.countryCode && (
              <Badge variant="outline">
                <MapPin className="h-3 w-3 mr-1" />
                {notification.countryCode}
              </Badge>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-medium text-sm mb-2">Message</h4>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm mb-1">Created</h4>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            {notification.actorEmail && (
              <div>
                <h4 className="font-medium text-sm mb-1">Actor</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {notification.actorEmail}
                </p>
              </div>
            )}
          </div>

          {notification.entityId && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-2">Related Entity</h4>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-mono">{notification.entityId}</p>
                </div>
              </div>
            </>
          )}

          {notification.metadata && Object.keys(notification.metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-2">Metadata</h4>
                <ScrollArea className="h-32">
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(notification.metadata, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
              <History className="h-4 w-4" />
              Activity Log
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div className="flex-1">
                  <p className="text-sm">Notification created</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}
                  </p>
                </div>
              </div>
              {notification.isRead && (
                <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm">Marked as read</p>
                    <p className="text-xs text-muted-foreground">Status updated</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!notification.isRead && (
            <Button 
              onClick={() => {
                onMarkRead(notification.id);
                onClose();
              }}
              className="w-full"
              data-testid="button-detail-mark-read"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark as Read
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CategoryTabs({ 
  stats, 
  selectedCategory, 
  onSelect 
}: { 
  stats: NotificationStats | undefined;
  selectedCategory: string;
  onSelect: (category: string) => void;
}) {
  const categories = ["all", ...Object.keys(categoryConfig)];
  
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const config = cat === "all" ? { label: "All", icon: Bell, color: "text-primary", bgColor: "bg-primary/10" } : categoryConfig[cat];
          const Icon = config.icon;
          const count = cat === "all" ? stats?.total || 0 : stats?.byCategory?.[cat] || 0;
          
          return (
            <Button
              key={cat}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(cat)}
              className="flex-shrink-0 gap-1.5"
              data-testid={`tab-category-${cat}`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{config.label}</span>
              <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-xs">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default function AdminNotifications() {
  const { toast } = useToast();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("safego-admin-notification-sound") !== "false";
    }
    return true;
  });
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: "",
    severity: "",
    isRead: "",
    countryCode: "",
    entityType: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastNotificationCountRef = useRef<number>(0);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Could not play notification sound:", e);
    }
  }, [soundEnabled]);

  const { isConnected, reconnect } = useAdminNotificationsWs({
    enabled: true,
    onNotification: useCallback((notification) => {
      playNotificationSound();
      toast({
        title: notification.title,
        description: notification.message,
      });
    }, [playNotificationSound, toast]),
    onUnreadCountChange: useCallback((count) => {
      if (count > lastNotificationCountRef.current) {
        playNotificationSound();
      }
      lastNotificationCountRef.current = count;
    }, [playNotificationSound]),
  });

  const toggleSound = useCallback(() => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("safego-admin-notification-sound", newValue.toString());
  }, [soundEnabled]);

  const queryString = new URLSearchParams({
    page: page.toString(),
    pageSize: "20",
    ...(filters.type && { type: filters.type }),
    ...(filters.severity && { severity: filters.severity }),
    ...(filters.isRead && { isRead: filters.isRead }),
    ...(filters.countryCode && { countryCode: filters.countryCode }),
    ...(filters.entityType && { entityType: filters.entityType }),
  }).toString();

  const { data, isLoading, refetch } = useQuery<{
    notifications: AdminNotification[];
    pagination: PaginationInfo;
  }>({
    queryKey: ["/api/admin/notifications", queryString],
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/notifications/unread-count"],
  });

  const stats: NotificationStats = {
    total: data?.pagination?.total || 0,
    unread: unreadCount?.count || 0,
    critical: data?.notifications?.filter(n => n.severity === "critical").length || 0,
    warning: data?.notifications?.filter(n => n.severity === "warning").length || 0,
    info: data?.notifications?.filter(n => n.severity === "info").length || 0,
    byCategory: data?.notifications?.reduce((acc, n) => {
      const cat = getNotificationCategory(n);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {},
  };

  const filteredNotifications = (data?.notifications || []).filter(notification => {
    if (selectedCategory !== "all" && getNotificationCategory(notification) !== selectedCategory) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query) ||
        notification.type?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/notifications/${id}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/notifications/read-all", {
        method: "PATCH",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Marked ${data.count} notifications as read`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread-count"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (notification: AdminNotification) => {
    setSelectedNotification(notification);
    setDetailOpen(true);
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      type: "",
      severity: "",
      isRead: "",
      countryCode: "",
      entityType: "",
    });
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "") || searchQuery !== "";

  const exportNotificationsAsCSV = useCallback(() => {
    if (!data?.notifications?.length) return;
    
    const headers = ["ID", "Type", "Severity", "Title", "Message", "Entity Type", "Entity ID", "Country", "Actor", "Read", "Created At"];
    const rows = data.notifications.map(n => [
      n.id,
      n.type,
      n.severity,
      `"${n.title.replace(/"/g, '""')}"`,
      `"${n.message.replace(/"/g, '""')}"`,
      n.entityType,
      n.entityId || "",
      n.countryCode || "",
      n.actorEmail || "",
      n.isRead ? "Yes" : "No",
      format(new Date(n.createdAt), "yyyy-MM-dd HH:mm:ss")
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notifications-export-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Complete",
      description: `Exported ${data.notifications.length} notifications to CSV`,
    });
  }, [data?.notifications, toast]);

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header - Premium Minimal Design */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Link href="/admin">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                data-testid="button-back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">Notification Center</h1>
                <p className="text-[11px] text-muted-foreground">Real-time alerts and system notifications</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                    {isConnected ? (
                      <Wifi className="h-3 w-3 text-green-600" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-xs font-medium">
                      {isConnected ? "Live" : "Offline"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isConnected 
                    ? "WebSocket connected - Real-time updates active" 
                    : "WebSocket disconnected - Click refresh to reconnect"}
                </TooltipContent>
              </Tooltip>
              {!isConnected && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={reconnect}
                      data-testid="button-reconnect"
                    >
                      <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reconnect to real-time updates</TooltipContent>
              </Tooltip>
            )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                data-testid="button-toggle-sound"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending || !unreadCount?.count}
                className="hidden sm:flex"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark All
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={exportNotificationsAsCSV}
                disabled={!data?.notifications?.length}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Bell className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.unread}</p>
                <p className="text-xs text-muted-foreground">Unread</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.critical}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.warning}</p>
                <p className="text-xs text-muted-foreground">Warning</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-4">
        <CategoryTabs 
          stats={stats} 
          selectedCategory={selectedCategory} 
          onSelect={setSelectedCategory} 
        />

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-1.5"
                  data-testid="button-toggle-filters"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && <Badge variant="secondary" className="ml-1">Active</Badge>}
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                <div>
                  <Label className="text-xs mb-1.5 block">Severity</Label>
                  <Select value={filters.severity} onValueChange={(v) => handleFilterChange("severity", v)}>
                    <SelectTrigger data-testid="select-severity" className="h-9">
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Status</Label>
                  <Select value={filters.isRead} onValueChange={(v) => handleFilterChange("isRead", v)}>
                    <SelectTrigger data-testid="select-status" className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="false">Unread</SelectItem>
                      <SelectItem value="true">Read</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Country</Label>
                  <Select value={filters.countryCode} onValueChange={(v) => handleFilterChange("countryCode", v)}>
                    <SelectTrigger data-testid="select-country" className="h-9">
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All countries</SelectItem>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => markAllAsReadMutation.mutate()} 
                disabled={!unreadCount?.count}
                className="sm:hidden"
                data-testid="button-mark-all-read-mobile"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark All Read
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={hasActiveFilters ? "No notifications match your filters" : "All caught up!"}
            description={hasActiveFilters 
              ? "Try adjusting your filters to see more notifications." 
              : "You have no notifications at the moment. We'll notify you when something needs your attention."}
            iconColor="text-slate-400"
            iconBgColor="bg-slate-100 dark:bg-slate-800/50"
            action={hasActiveFilters ? {
              label: "Clear Filters",
              onClick: handleClearFilters,
              variant: "outline"
            } : undefined}
            testId="empty-notifications"
            size="md"
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={() => markAsReadMutation.mutate(notification.id)}
                onViewDetails={() => handleViewDetails(notification)}
                isMarkingRead={markAsReadMutation.isPending}
              />
            ))}

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <NotificationDetail
        notification={selectedNotification}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onMarkRead={(id) => markAsReadMutation.mutate(id)}
      />
    </div>
  );
}
