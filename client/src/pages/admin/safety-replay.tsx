import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, Play, Pause, SkipBack, SkipForward, MapPin, Clock, AlertTriangle, User, Car, Phone, Video, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface SafetyIncident {
  id: string;
  incidentType: string;
  severity: string;
  rideId: string;
  driverId: string;
  driverName: string;
  customerId: string;
  customerName: string;
  vehiclePlate: string;
  occurredAt: string;
  location: { lat: number; lng: number; address: string };
  status: string;
  sosTriggered: boolean;
  routeDeviation: boolean;
  tripData: {
    pickup: { lat: number; lng: number; address: string };
    dropoff: { lat: number; lng: number; address: string };
    waypoints: { lat: number; lng: number; timestamp: string }[];
    plannedRoute: { lat: number; lng: number }[];
    actualRoute: { lat: number; lng: number }[];
  };
  timeline: { timestamp: string; event: string; details: string }[];
  evidence: { type: string; url: string; timestamp: string }[];
}

interface IncidentsResponse {
  incidents: SafetyIncident[];
  stats: {
    total: number;
    critical: number;
    sosTriggered: number;
    routeDeviations: number;
    pending: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function SafetyReplay() {
  const [, navigate] = useLocation();
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const { data, isLoading } = useQuery<IncidentsResponse>({
    queryKey: ["/api/admin/phase4/safety-incidents", severityFilter, typeFilter, searchQuery, currentPage],
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "sos":
        return <Badge variant="destructive"><Phone className="h-3 w-3 mr-1" />SOS</Badge>;
      case "route_deviation":
        return <Badge className="bg-purple-500">Route Deviation</Badge>;
      case "speed_violation":
        return <Badge className="bg-orange-500">Speed Violation</Badge>;
      case "accident":
        return <Badge variant="destructive">Accident</Badge>;
      case "harassment":
        return <Badge variant="destructive">Harassment</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
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
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Safety Incident Replay</h1>
              <p className="text-[11px] text-muted-foreground">Review and analyze trip safety incidents</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Incidents</p>
                  <p className="text-2xl font-bold">{data?.stats?.total || 0}</p>
                </div>
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-500">{data?.stats?.critical || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">SOS Triggered</p>
                  <p className="text-2xl font-bold text-orange-500">{data?.stats?.sosTriggered || 0}</p>
                </div>
                <Phone className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Route Deviations</p>
                  <p className="text-2xl font-bold text-purple-500">{data?.stats?.routeDeviations || 0}</p>
                </div>
                <MapPin className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">{data?.stats?.pending || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Incidents</CardTitle>
              <div className="space-y-2 mt-2">
                <Input
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
                <div className="flex gap-2">
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger data-testid="select-severity">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="sos">SOS</SelectItem>
                      <SelectItem value="route_deviation">Route Deviation</SelectItem>
                      <SelectItem value="speed_violation">Speed Violation</SelectItem>
                      <SelectItem value="accident">Accident</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : !data?.incidents?.length ? (
                  <div className="text-center py-8">
                    <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No incidents found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.incidents.map((incident) => (
                      <div
                        key={incident.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedIncident?.id === incident.id
                            ? "border-primary bg-primary/5"
                            : "hover-elevate"
                        }`}
                        onClick={() => setSelectedIncident(incident)}
                        data-testid={`card-incident-${incident.id}`}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getTypeBadge(incident.incidentType)}
                          {getSeverityBadge(incident.severity)}
                          {incident.sosTriggered && (
                            <Badge variant="destructive" className="text-xs">SOS</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">Ride #{incident.rideId.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(incident.occurredAt), "MMM dd, HH:mm")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {incident.location.address}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedIncident ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Incident Replay
                      </CardTitle>
                      <CardDescription>
                        Ride #{selectedIncident.rideId.slice(0, 8)} - {format(new Date(selectedIncident.occurredAt), "MMM dd, yyyy HH:mm")}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {getSeverityBadge(selectedIncident.severity)}
                      {getTypeBadge(selectedIncident.incidentType)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <MapPin className="h-16 w-16 text-muted-foreground/50" />
                      <p className="absolute bottom-4 text-sm text-muted-foreground">
                        Map visualization would render here with route playback
                      </p>
                    </div>
                    <div className="absolute top-4 left-4 bg-background/90 rounded p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{selectedIncident.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="h-3 w-3" />
                        <span>{selectedIncident.driverName} ({selectedIncident.vehiclePlate})</span>
                      </div>
                    </div>
                    {selectedIncident.routeDeviation && (
                      <div className="absolute top-4 right-4">
                        <Badge variant="destructive">Route Deviation Detected</Badge>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setPlaybackPosition(0)}
                        data-testid="button-skip-back"
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        onClick={() => setIsPlaying(!isPlaying)}
                        data-testid="button-play-pause"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setPlaybackPosition(100)}
                        data-testid="button-skip-forward"
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <Slider
                          value={[playbackPosition]}
                          onValueChange={([v]) => setPlaybackPosition(v)}
                          max={100}
                          step={1}
                          data-testid="slider-playback"
                        />
                      </div>
                      <Select value={playbackSpeed.toString()} onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}>
                        <SelectTrigger className="w-20" data-testid="select-speed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.5">0.5x</SelectItem>
                          <SelectItem value="1">1x</SelectItem>
                          <SelectItem value="2">2x</SelectItem>
                          <SelectItem value="4">4x</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {Math.round(playbackPosition)}% - Playback at {playbackSpeed}x speed
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-green-500" />
                        Pickup
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.tripData.pickup.address}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-500" />
                        Dropoff
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.tripData.dropoff.address}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Event Timeline
                    </h4>
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {selectedIncident.timeline.map((event, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm border-l-2 pl-4 py-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(event.timestamp), "HH:mm:ss")}
                            </span>
                            <div>
                              <span className="font-medium">{event.event}</span>
                              <p className="text-xs text-muted-foreground">{event.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {selectedIncident.evidence?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Evidence
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        {selectedIncident.evidence.map((ev, idx) => (
                          <Button key={idx} variant="outline" size="sm">
                            {ev.type === "video" ? <Video className="h-4 w-4 mr-1" /> : <MapPin className="h-4 w-4 mr-1" />}
                            {ev.type}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" data-testid="button-export">
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center h-[600px]">
                <Shield className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select an incident to view replay</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
