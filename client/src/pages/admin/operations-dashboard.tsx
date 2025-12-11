import { useQuery } from "@tanstack/react-query";
import { 
  Car, UtensilsCrossed, Package, Users, LayoutDashboard,
  RefreshCw, MapPin, Clock, DollarSign, AlertTriangle, 
  TrendingUp, TrendingDown, CheckCircle, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/admin/PageHeader";
import { useState, useEffect } from "react";

interface MonitoringOverview {
  activeRides: {
    total: number;
    searching: number;
    assigned: number;
    inProgress: number;
    nearCompletion: number;
  };
  activeOrders: {
    total: number;
    pending: number;
    preparing: number;
    readyForPickup: number;
    inDelivery: number;
  };
  activeParcels: {
    total: number;
    awaitingPickup: number;
    inTransit: number;
    outForDelivery: number;
    scheduled: number;
  };
  driverAvailability: {
    online: number;
    busy: number;
    offline: number;
    total: number;
    utilizationPercent: number;
  };
  slaMetrics: {
    onTimePickupRate: number;
    onTimeDeliveryRate: number;
    avgWaitTimeMinutes: number;
    avgDeliveryTimeMinutes: number;
    targetOnTimeRate: number;
  };
  paymentMetrics: {
    cashRidesActive: number;
    onlineRidesActive: number;
    pendingPayments: number;
    failedPaymentsToday: number;
  };
  timestamp: string;
}

interface LiveMapData {
  drivers: Array<{
    driverId: string;
    lat: number;
    lng: number;
    status: string;
    currentServiceMode: string;
    currentAssignmentId?: string;
    currentAssignmentType?: string;
  }>;
  rides: Array<{
    rideId: string;
    status: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    driverId?: string;
    customerMasked?: string;
  }>;
  foodOrders: Array<{
    orderId: string;
    status: string;
    restaurantLat: number;
    restaurantLng: number;
    deliveryLat: number;
    deliveryLng: number;
    driverId?: string;
    restaurantName?: string;
    customerMasked?: string;
  }>;
  parcels: Array<{
    deliveryId: string;
    status: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    driverId?: string;
    isScheduled?: boolean;
    customerMasked?: string;
  }>;
  timestamp: string;
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  subtitle,
  color = "primary"
}: {
  title: string;
  value: string | number;
  icon: any;
  trend?: { direction: "up" | "down" | "neutral"; value: string };
  subtitle?: string;
  color?: "primary" | "green" | "orange" | "red" | "blue";
}) {
  const colorClasses = {
    primary: "text-primary",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Icon className={`h-8 w-8 ${colorClasses[color]} opacity-80`} />
            {trend && (
              <div className={`flex items-center text-xs ${
                trend.direction === "up" ? "text-green-600" : 
                trend.direction === "down" ? "text-red-600" : 
                "text-muted-foreground"
              }`}>
                {trend.direction === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                 trend.direction === "down" ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBreakdown({ 
  title, 
  items 
}: { 
  title: string; 
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${item.color}`} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted mt-2">
          {items.filter(i => i.value > 0).map((item, index) => (
            <div 
              key={index}
              className={`${item.color}`}
              style={{ width: `${(item.value / total) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OperationsDashboard() {
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<{ success: boolean; data: MonitoringOverview }>({
    queryKey: ["/api/admin/monitoring/overview", countryFilter],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: liveMapData, isLoading: mapLoading, refetch: refetchMap } = useQuery<{ success: boolean; data: LiveMapData }>({
    queryKey: ["/api/admin/monitoring/live-map", countryFilter],
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const handleRefresh = () => {
    refetchOverview();
    refetchMap();
  };

  const monitoringData = overview?.data;
  const mapData = liveMapData?.data;

  const onTimeRate = monitoringData?.slaMetrics?.onTimePickupRate || 0;
  const targetRate = monitoringData?.slaMetrics?.targetOnTimeRate || 90;

  if (overviewLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Operations Dashboard"
        description="Real-time monitoring of all services"
        icon={LayoutDashboard}
        backButton={{ label: "Back to Dashboard", href: "/admin" }}
        actions={
          <div className="flex items-center gap-2">
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-country">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="BD">Bangladesh</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`h-7 text-xs ${autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}`}
              data-testid="button-auto-refresh"
            >
              {autoRefresh ? "Auto" : "Paused"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="h-7 text-xs"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      >
        <div className="text-xs opacity-75">
          Last updated: {monitoringData?.timestamp ? new Date(monitoringData.timestamp).toLocaleTimeString() : 'Loading...'}
        </div>
      </PageHeader>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Rides"
            value={monitoringData?.activeRides?.total || 0}
            icon={Car}
            subtitle={`${monitoringData?.activeRides?.inProgress || 0} in progress`}
            color="blue"
          />
          <MetricCard
            title="Active Food Orders"
            value={monitoringData?.activeOrders?.total || 0}
            icon={UtensilsCrossed}
            subtitle={`${monitoringData?.activeOrders?.inDelivery || 0} in delivery`}
            color="orange"
          />
          <MetricCard
            title="Active Parcels"
            value={monitoringData?.activeParcels?.total || 0}
            icon={Package}
            subtitle={`${monitoringData?.activeParcels?.scheduled || 0} scheduled`}
            color="green"
          />
          <MetricCard
            title="Online Drivers"
            value={monitoringData?.driverAvailability?.online || 0}
            icon={Users}
            subtitle={`${monitoringData?.driverAvailability?.utilizationPercent || 0}% utilization`}
            color="primary"
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList data-testid="tabs-monitoring">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="rides" data-testid="tab-rides">Rides</TabsTrigger>
            <TabsTrigger value="food" data-testid="tab-food">Food Orders</TabsTrigger>
            <TabsTrigger value="parcels" data-testid="tab-parcels">Parcels</TabsTrigger>
            <TabsTrigger value="drivers" data-testid="tab-drivers">Drivers</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="h-4 w-4" /> Ride Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBreakdown
                    title=""
                    items={[
                      { label: "Searching Driver", value: monitoringData?.activeRides?.searching || 0, color: "bg-yellow-500" },
                      { label: "Driver Assigned", value: monitoringData?.activeRides?.assigned || 0, color: "bg-blue-500" },
                      { label: "In Progress", value: monitoringData?.activeRides?.inProgress || 0, color: "bg-green-500" },
                      { label: "Near Completion", value: monitoringData?.activeRides?.nearCompletion || 0, color: "bg-purple-500" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4" /> Food Order Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBreakdown
                    title=""
                    items={[
                      { label: "Pending", value: monitoringData?.activeOrders?.pending || 0, color: "bg-gray-500" },
                      { label: "Preparing", value: monitoringData?.activeOrders?.preparing || 0, color: "bg-yellow-500" },
                      { label: "Ready", value: monitoringData?.activeOrders?.readyForPickup || 0, color: "bg-blue-500" },
                      { label: "In Delivery", value: monitoringData?.activeOrders?.inDelivery || 0, color: "bg-green-500" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" /> Parcel Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBreakdown
                    title=""
                    items={[
                      { label: "Awaiting Pickup", value: monitoringData?.activeParcels?.awaitingPickup || 0, color: "bg-gray-500" },
                      { label: "In Transit", value: monitoringData?.activeParcels?.inTransit || 0, color: "bg-blue-500" },
                      { label: "Out for Delivery", value: monitoringData?.activeParcels?.outForDelivery || 0, color: "bg-green-500" },
                      { label: "Scheduled", value: monitoringData?.activeParcels?.scheduled || 0, color: "bg-purple-500" },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> SLA Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>On-Time Pickup Rate</span>
                      <span className={onTimeRate >= targetRate ? "text-green-600" : "text-red-600"}>
                        {onTimeRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={onTimeRate} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">Target: {targetRate}%</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{monitoringData?.slaMetrics?.avgWaitTimeMinutes || 0}</p>
                      <p className="text-xs text-muted-foreground">Avg Wait (min)</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{monitoringData?.slaMetrics?.avgDeliveryTimeMinutes || 0}</p>
                      <p className="text-xs text-muted-foreground">Avg Delivery (min)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Payment Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{monitoringData?.paymentMetrics?.onlineRidesActive || 0}</p>
                      <p className="text-xs text-muted-foreground">Online Payments</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{monitoringData?.paymentMetrics?.cashRidesActive || 0}</p>
                      <p className="text-xs text-muted-foreground">Cash Rides</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{monitoringData?.paymentMetrics?.pendingPayments || 0}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{monitoringData?.paymentMetrics?.failedPaymentsToday || 0}</p>
                      <p className="text-xs text-muted-foreground">Failed Today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Driver Fleet Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-3xl font-bold text-green-600">{monitoringData?.driverAvailability?.online || 0}</p>
                    <p className="text-sm text-green-700 dark:text-green-400">Online & Available</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-3xl font-bold text-blue-600">{monitoringData?.driverAvailability?.busy || 0}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">Currently Busy</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-950/20 rounded-lg border border-gray-200 dark:border-gray-800">
                    <p className="text-3xl font-bold text-gray-600">{monitoringData?.driverAvailability?.offline || 0}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-400">Offline</p>
                  </div>
                  <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-3xl font-bold text-primary">{monitoringData?.driverAvailability?.utilizationPercent || 0}%</p>
                    <p className="text-sm text-muted-foreground">Utilization Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rides" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Car className="h-5 w-5" /> Active Rides ({mapData?.rides?.length || 0})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!mapData?.rides || mapData.rides.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active rides</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {mapData.rides.map((ride) => (
                      <div key={ride.rideId} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`ride-${ride.rideId}`}>
                        <div className="flex items-center gap-3">
                          <Car className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">{ride.rideId.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">{ride.customerMasked || 'Customer'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            ride.status === 'in_progress' ? 'default' :
                            ride.status === 'searching_driver' ? 'secondary' :
                            'outline'
                          }>
                            {ride.status.replace(/_/g, ' ')}
                          </Badge>
                          {ride.driverId ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="food" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5" /> Active Food Orders ({mapData?.foodOrders?.length || 0})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!mapData?.foodOrders || mapData.foodOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active food orders</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {mapData.foodOrders.map((order) => (
                      <div key={order.orderId} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`order-${order.orderId}`}>
                        <div className="flex items-center gap-3">
                          <UtensilsCrossed className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="text-sm font-medium">{order.restaurantName || order.orderId.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">{order.customerMasked || 'Customer'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            order.status === 'on_the_way' ? 'default' :
                            order.status === 'preparing' ? 'secondary' :
                            'outline'
                          }>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parcels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-5 w-5" /> Active Parcels ({mapData?.parcels?.length || 0})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!mapData?.parcels || mapData.parcels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active parcel deliveries</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {mapData.parcels.map((parcel) => (
                      <div key={parcel.deliveryId} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`parcel-${parcel.deliveryId}`}>
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{parcel.deliveryId.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">{parcel.customerMasked || 'Customer'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {parcel.isScheduled && (
                            <Badge variant="outline" className="text-purple-600 border-purple-600">Scheduled</Badge>
                          )}
                          <Badge variant={
                            parcel.status === 'out_for_delivery' ? 'default' :
                            parcel.status === 'picked_up' ? 'secondary' :
                            'outline'
                          }>
                            {parcel.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" /> Online Drivers ({mapData?.drivers?.length || 0})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!mapData?.drivers || mapData.drivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No online drivers</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {mapData.drivers.map((driver) => (
                      <div key={driver.driverId} className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`driver-${driver.driverId}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${
                            driver.status === 'available' ? 'bg-green-500' :
                            driver.status === 'busy' ? 'bg-blue-500' :
                            'bg-gray-500'
                          }`} />
                          <div>
                            <p className="text-sm font-medium">{driver.driverId.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 inline mr-1" />
                              {driver.lat.toFixed(4)}, {driver.lng.toFixed(4)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{driver.currentServiceMode}</Badge>
                          <Badge variant={driver.status === 'available' ? 'default' : 'secondary'}>
                            {driver.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
