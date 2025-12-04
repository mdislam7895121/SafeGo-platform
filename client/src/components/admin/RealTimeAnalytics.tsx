import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Car,
  AlertCircle,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface AnalyticsData {
  activeUsers: number;
  activeUsersChange: number;
  partnerGrowth: number;
  partnerGrowthChange: number;
  totalOrders: number;
  ordersChange: number;
  activeRides: number;
  ridesChange: number;
  failureRate: number;
  failureRateChange: number;
  lastUpdated: string;
}

interface ChartDataPoint {
  time: string;
  value: number;
}

interface MetricCardProps {
  title: string;
  value: number | string;
  change: number;
  icon: any;
  color: string;
  format?: "number" | "percent" | "currency";
  chartData?: ChartDataPoint[];
}

function MiniSparkline({ data, color }: { data: ChartDataPoint[]; color: string }) {
  if (!data || data.length < 2) return null;
  
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.value - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="w-20 h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function MetricCard({ title, value, change, icon: Icon, color, format = "number", chartData }: MetricCardProps) {
  const isPositive = change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  
  const formatValue = (val: number | string) => {
    if (typeof val === "string") return val;
    switch (format) {
      case "percent":
        return `${val.toFixed(1)}%`;
      case "currency":
        return new Intl.NumberFormat("en-US", { 
          style: "currency", 
          currency: "USD",
          minimumFractionDigits: 0 
        }).format(val);
      default:
        return new Intl.NumberFormat("en-US").format(val);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{formatValue(value)}</p>
            <div className="flex items-center gap-1">
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-xs font-medium gap-0.5 px-1.5",
                  isPositive 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {Math.abs(change).toFixed(1)}%
              </Badge>
              <span className="text-xs text-muted-foreground">vs last hour</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={cn("p-2 rounded-lg", color)}>
              <Icon className="h-5 w-5" />
            </div>
            {chartData && (
              <MiniSparkline 
                data={chartData} 
                color={isPositive ? "#22c55e" : "#ef4444"} 
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RealTimeAnalytics() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [chartHistory, setChartHistory] = useState<Record<string, ChartDataPoint[]>>({
    activeUsers: [],
    orders: [],
    rides: [],
    failures: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      
      if (!host || host.includes("undefined")) {
        console.warn("Invalid host for WebSocket, falling back to polling");
        setIsLoading(false);
        return;
      }
      
      const wsUrl = `${protocol}//${host}/api/admin/notifications/ws?token=${token}`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setIsLoading(false);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "analytics" || data.type === "notification") {
            if (data.payload?.activeUsers !== undefined) {
              setAnalytics(data.payload);
              const now = new Date().toLocaleTimeString();
              setChartHistory(prev => ({
                activeUsers: [...prev.activeUsers.slice(-29), { time: now, value: data.payload.activeUsers }],
                orders: [...prev.orders.slice(-29), { time: now, value: data.payload.totalOrders }],
                rides: [...prev.rides.slice(-29), { time: now, value: data.payload.activeRides }],
                failures: [...prev.failures.slice(-29), { time: now, value: data.payload.failureRate }],
              }));
            }
          }
        } catch (err) {
          console.error("Failed to parse analytics data:", err);
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = () => {
        wsRef.current?.close();
      };
    } catch (err) {
      console.error("WebSocket connection failed:", err);
      setIsLoading(false);
    }
  }, [token]);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/phase3a/analytics/realtime", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
        setIsLoading(false);
        
        const now = new Date().toLocaleTimeString();
        setChartHistory(prev => ({
          activeUsers: [...prev.activeUsers.slice(-29), { time: now, value: data.activeUsers || 0 }],
          orders: [...prev.orders.slice(-29), { time: now, value: data.totalOrders || 0 }],
          rides: [...prev.rides.slice(-29), { time: now, value: data.activeRides || 0 }],
          failures: [...prev.failures.slice(-29), { time: now, value: data.failureRate || 0 }],
        }));
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setIsLoading(false);
    }
  }, [token]);

  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchAnalyticsData();
    connectWebSocket();
    
    if (!isConnected) {
      pollingIntervalRef.current = setInterval(fetchAnalyticsData, 10000);
    }
    
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchAnalyticsData, connectWebSocket, isConnected]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchAnalyticsData();
    if (!isConnected) {
      connectWebSocket();
    }
  };

  if (isLoading && !analytics) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Real-Time Analytics</h2>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs gap-1",
              isConnected 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            )}
            data-testid="badge-connection-status"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Reconnecting...
              </>
            )}
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="gap-2"
          data-testid="button-refresh-analytics"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Active Users"
          value={analytics?.activeUsers || 0}
          change={analytics?.activeUsersChange || 0}
          icon={Users}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          chartData={chartHistory.activeUsers}
        />
        <MetricCard
          title="Partner Growth"
          value={analytics?.partnerGrowth || 0}
          change={analytics?.partnerGrowthChange || 0}
          icon={TrendingUp}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <MetricCard
          title="Total Orders"
          value={analytics?.totalOrders || 0}
          change={analytics?.ordersChange || 0}
          icon={ShoppingBag}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          chartData={chartHistory.orders}
        />
        <MetricCard
          title="Active Rides"
          value={analytics?.activeRides || 0}
          change={analytics?.ridesChange || 0}
          icon={Car}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          chartData={chartHistory.rides}
        />
        <MetricCard
          title="Failure Rate"
          value={analytics?.failureRate || 0}
          change={analytics?.failureRateChange || 0}
          icon={AlertCircle}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          format="percent"
          chartData={chartHistory.failures}
        />
      </div>

      {analytics?.lastUpdated && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
