import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Map, Car, Users, MapPin, Layers, Filter, RefreshCw, AlertTriangle, Circle, Square, Hexagon, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";

interface MapStats {
  activeDrivers: number;
  onlineDrivers: number;
  activeRides: number;
  pendingRequests: number;
  surgezones: number;
  hotspots: number;
  geofences: number;
}

interface Driver {
  id: string;
  name: string;
  status: string;
  vehicleType: string;
  location: { lat: number; lng: number };
  heading: number;
  currentRide: string | null;
}

interface Geofence {
  id: string;
  name: string;
  type: string;
  status: string;
  coordinates: { lat: number; lng: number }[];
  rules: Record<string, any>;
}

interface MapControlData {
  stats: MapStats;
  drivers: Driver[];
  geofences: Geofence[];
  heatmapData: { lat: number; lng: number; weight: number }[];
  surgeZones: { id: string; name: string; multiplier: number; coordinates: any }[];
}

export default function MapControl() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [showDrivers, setShowDrivers] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSurge, setShowSurge] = useState(true);
  const [driverFilter, setDriverFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<MapControlData>({
    queryKey: ["/api/admin/phase4/map-control"],
    refetchInterval: refreshInterval * 1000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "text-green-500";
      case "busy":
        return "text-yellow-500";
      case "offline":
        return "text-gray-500";
      case "on_ride":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md shrink-0">
              <Map className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Real-time Admin Map Control</h1>
              <p className="text-[11px] text-muted-foreground">Monitor and manage live operations on the map</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Car className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.activeDrivers || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Car className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.onlineDrivers || 0}</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Users className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.activeRides || 0}</p>
                <p className="text-xs text-muted-foreground">Rides</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.pendingRequests || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Hexagon className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.surgezones || 0}</p>
                <p className="text-xs text-muted-foreground">Surge Zones</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Circle className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.hotspots || 0}</p>
                <p className="text-xs text-muted-foreground">Hotspots</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <Square className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{data?.stats?.geofences || 0}</p>
                <p className="text-xs text-muted-foreground">Geofences</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Map Layers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Drivers</span>
                </div>
                <Switch
                  checked={showDrivers}
                  onCheckedChange={setShowDrivers}
                  data-testid="switch-drivers"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Geofences</span>
                </div>
                <Switch
                  checked={showGeofences}
                  onCheckedChange={setShowGeofences}
                  data-testid="switch-geofences"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Heatmap</span>
                </div>
                <Switch
                  checked={showHeatmap}
                  onCheckedChange={setShowHeatmap}
                  data-testid="switch-heatmap"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hexagon className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Surge Zones</span>
                </div>
                <Switch
                  checked={showSurge}
                  onCheckedChange={setShowSurge}
                  data-testid="switch-surge"
                />
              </div>

              <div className="pt-4 border-t">
                <Label className="text-sm mb-2 block">Driver Filter</Label>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger data-testid="select-driver-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="on_ride">On Ride</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Vehicle Type</Label>
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger data-testid="select-vehicle-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="comfort">Comfort</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="xl">XL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">
                  Refresh Interval: {refreshInterval}s
                </Label>
                <Slider
                  value={[refreshInterval]}
                  onValueChange={([v]) => setRefreshInterval(v)}
                  min={5}
                  max={60}
                  step={5}
                  data-testid="slider-refresh"
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Now
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Live Map
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />
                    Live
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Map className="h-24 w-24 text-muted-foreground/30" />
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                  <div className="bg-background/90 p-2 rounded-lg text-xs">
                    <p className="font-medium">Legend</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" /> Available
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> On Ride
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" /> Busy
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" /> Surge
                      </span>
                    </div>
                  </div>
                  <div className="bg-background/90 p-2 rounded-lg text-xs">
                    <p className="text-muted-foreground">
                      Interactive Google Map would render here
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drivers">Drivers ({data?.drivers?.length || 0})</TabsTrigger>
            <TabsTrigger value="geofences">Geofences ({data?.geofences?.length || 0})</TabsTrigger>
            <TabsTrigger value="surge">Surge Zones ({data?.surgeZones?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Operations Overview</CardTitle>
                <CardDescription>Real-time platform activity summary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                    <p className="text-2xl font-bold">3.2 min</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                    <p className="text-2xl font-bold">87%</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Completed Today</p>
                    <p className="text-2xl font-bold">1,234</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                    <p className="text-2xl font-bold">4.2%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <Card>
              <CardHeader>
                <CardTitle>Active Drivers</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {data?.drivers?.map((driver) => (
                        <div
                          key={driver.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                          data-testid={`row-driver-${driver.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(driver.status).replace("text-", "bg-")}`} />
                            <div>
                              <p className="font-medium">{driver.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {driver.vehicleType} | {driver.location.lat.toFixed(4)}, {driver.location.lng.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{driver.status.replace("_", " ")}</Badge>
                            <Button size="icon" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geofences">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Geofences</CardTitle>
                  <Button size="sm" data-testid="button-add-geofence">
                    <MapPin className="h-4 w-4 mr-2" />
                    Add Geofence
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {data?.geofences?.map((geofence) => (
                      <div
                        key={geofence.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                        data-testid={`row-geofence-${geofence.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Square className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{geofence.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {geofence.type} | {geofence.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={geofence.status === "active" ? "default" : "secondary"}>
                            {geofence.status}
                          </Badge>
                          <Button size="icon" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="surge">
            <Card>
              <CardHeader>
                <CardTitle>Surge Zones</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {data?.surgeZones?.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                        data-testid={`row-surge-${zone.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Hexagon className="h-5 w-5 text-red-500" />
                          <div>
                            <p className="font-medium">{zone.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Surge multiplier active
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">{zone.multiplier}x</Badge>
                          <Button size="icon" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
