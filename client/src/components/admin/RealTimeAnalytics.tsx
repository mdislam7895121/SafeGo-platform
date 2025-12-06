import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Users,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Car,
  AlertCircle,
  RefreshCw,
  Activity,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AnalyticsGrid, ConnectionBadge, BaseAnalyticsCard, AnimatedNumber } from "@/components/ui/analytics-card";

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
    <svg className="w-16 h-6 opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
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

interface MetricCardProps {
  title: string;
  value: number | string;
  change: number;
  icon: any;
  format?: "number" | "percent" | "currency";
  chartData?: ChartDataPoint[];
  testId?: string;
}

function MetricCard({ title, value, change, icon: Icon, format = "number", chartData, testId }: MetricCardProps) {
  const safeChange = format === "percent" && typeof value === "number" && value === 0 ? 0 : change;
  const isPositive = safeChange > 0;
  const isNegative = safeChange < 0;
  
  const getTrendIcon = () => {
    if (isPositive) return TrendingUp;
    if (isNegative) return TrendingDown;
    return Minus;
  };
  
  const TrendIcon = getTrendIcon();

  const getChangeColor = () => {
    if (isPositive) return "text-[#22C55E]";
    if (isNegative) return "text-[#EF4444]";
    return "text-[#9CA3AF]";
  };

  const getSparklineColor = () => {
    if (isPositive) return "#22C55E";
    if (isNegative) return "#EF4444";
    return "#9CA3AF";
  };

  return (
    <BaseAnalyticsCard icon={Icon} testId={testId}>
      <div className="flex flex-col justify-between h-full min-h-[92px]">
        <p className="text-[14px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
          {title}
        </p>

        <div className="flex-1 flex items-center justify-between">
          <p className="text-[32px] font-semibold text-[#111827] dark:text-white tracking-[-0.02em]">
            {typeof value === "number" ? (
              <AnimatedNumber value={format === "percent" ? Math.max(0, value) : value} format={format} />
            ) : (
              value
            )}
          </p>
          {chartData && chartData.length > 1 && (
            <MiniSparkline data={chartData} color={getSparklineColor()} />
          )}
        </div>

        <div className="flex items-center gap-1">
          <TrendIcon className={cn("w-3 h-3", getChangeColor())} />
          <span className={cn("text-[12px] font-normal", getChangeColor())}>
            {Math.abs(safeChange).toFixed(1)}%
          </span>
          <span className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280]">
            vs last hour
          </span>
        </div>
      </div>
    </BaseAnalyticsCard>
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
      <AnalyticsGrid>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1C1C1E] p-6 rounded-[14px] shadow-[0_4px_16px_rgba(0,0,0,0.04)] min-h-[140px]"
          >
            <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-4" />
            <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-4" />
            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </AnalyticsGrid>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[#111827] dark:text-white" />
          <h2 className="text-lg font-semibold text-[#111827] dark:text-white">Real-Time Analytics</h2>
          <ConnectionBadge isConnected={isConnected} />
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

      <AnalyticsGrid>
        <MetricCard
          title="Active Users"
          value={analytics?.activeUsers || 0}
          change={analytics?.activeUsersChange || 0}
          icon={Users}
          chartData={chartHistory.activeUsers}
          testId="card-active-users"
        />
        <MetricCard
          title="Partner Growth"
          value={analytics?.partnerGrowth || 0}
          change={analytics?.partnerGrowthChange || 0}
          icon={TrendingUp}
          testId="card-partner-growth"
        />
        <MetricCard
          title="Total Orders"
          value={analytics?.totalOrders || 0}
          change={analytics?.ordersChange || 0}
          icon={ShoppingBag}
          chartData={chartHistory.orders}
          testId="card-total-orders"
        />
        <MetricCard
          title="Active Rides"
          value={analytics?.activeRides || 0}
          change={analytics?.ridesChange || 0}
          icon={Car}
          chartData={chartHistory.rides}
          testId="card-active-rides"
        />
        <MetricCard
          title="Failure Rate"
          value={Math.max(0, analytics?.failureRate || 0)}
          change={analytics?.failureRateChange || 0}
          icon={AlertCircle}
          format="percent"
          chartData={chartHistory.failures}
          testId="card-failure-rate"
        />
      </AnalyticsGrid>

      {analytics?.lastUpdated && (
        <p className="text-xs text-[#9CA3AF] text-right">
          Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
