import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Globe,
  Smartphone,
  Car,
  Package,
  CreditCard,
  DollarSign,
  MessageSquare,
  Bell,
} from "lucide-react";
import { format } from "date-fns";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "outage";
  icon: typeof Globe;
  lastUpdate: Date;
}

interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  createdAt: Date;
  resolvedAt?: Date;
  updates: {
    time: Date;
    message: string;
  }[];
}

const services: ServiceStatus[] = [
  { name: "Restaurant Portal", status: "operational", icon: Globe, lastUpdate: new Date() },
  { name: "Customer App", status: "operational", icon: Smartphone, lastUpdate: new Date() },
  { name: "Driver App", status: "operational", icon: Car, lastUpdate: new Date() },
  { name: "Order Processing", status: "operational", icon: Package, lastUpdate: new Date() },
  { name: "Payment Processing", status: "operational", icon: CreditCard, lastUpdate: new Date() },
  { name: "Payout System", status: "operational", icon: DollarSign, lastUpdate: new Date() },
  { name: "Live Chat", status: "operational", icon: MessageSquare, lastUpdate: new Date() },
  { name: "Push Notifications", status: "operational", icon: Bell, lastUpdate: new Date() },
];

const incidents: Incident[] = [];

const getStatusIcon = (status: ServiceStatus["status"]) => {
  switch (status) {
    case "operational":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "degraded":
      return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    case "outage":
      return <XCircle className="h-5 w-5 text-red-600" />;
  }
};

const getStatusBadge = (status: ServiceStatus["status"]) => {
  switch (status) {
    case "operational":
      return <Badge className="bg-green-600 hover:bg-green-700">Operational</Badge>;
    case "degraded":
      return <Badge className="bg-yellow-600 hover:bg-yellow-700">Degraded</Badge>;
    case "outage":
      return <Badge className="bg-red-600 hover:bg-red-700">Outage</Badge>;
  }
};

const getIncidentStatusBadge = (status: Incident["status"]) => {
  const variants: Record<Incident["status"], { label: string; className: string }> = {
    investigating: { label: "Investigating", className: "bg-yellow-600 hover:bg-yellow-700" },
    identified: { label: "Identified", className: "bg-orange-600 hover:bg-orange-700" },
    monitoring: { label: "Monitoring", className: "bg-blue-600 hover:bg-blue-700" },
    resolved: { label: "Resolved", className: "bg-green-600 hover:bg-green-700" },
  };
  const variant = variants[status];
  return <Badge className={variant.className}>{variant.label}</Badge>;
};

export default function SupportStatus() {
  const allOperational = services.every(s => s.status === "operational");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">System Status</h1>
          <div className="flex items-center justify-center gap-2">
            {allOperational ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <p className="text-xl text-green-600 font-semibold">All Systems Operational</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-yellow-600" />
                <p className="text-xl text-yellow-600 font-semibold">Some Services Degraded</p>
              </>
            )}
          </div>
          <p className="text-muted-foreground">
            Last updated: {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        {/* Services Status Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Services</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const ServiceIcon = service.icon;
              return (
                <Card key={service.name} data-testid={`card-service-${service.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <ServiceIcon className="h-5 w-5" />
                      </div>
                      {getStatusIcon(service.status)}
                    </div>
                    <h3 className="font-semibold mb-1">{service.name}</h3>
                    {getStatusBadge(service.status)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Uptime Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Uptime Statistics</CardTitle>
            <CardDescription>Last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-bold text-green-600">99.98%</p>
                <p className="text-sm text-muted-foreground">Overall Uptime</p>
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Major Incidents</p>
              </div>
              <div>
                <p className="text-2xl font-bold">12 min</p>
                <p className="text-sm text-muted-foreground">Avg. Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Incidents */}
        {incidents.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Active Incidents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {incidents.map((incident) => (
                <div key={incident.id}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold mb-1">{incident.title}</h3>
                      <div className="flex items-center gap-2">
                        {getIncidentStatusBadge(incident.status)}
                        <Badge variant="outline" className="capitalize">
                          {incident.severity}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(incident.createdAt, "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 ml-4 border-l-2 border-muted pl-4">
                    {incident.updates.map((update, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="h-3 w-3" />
                          {format(update.time, "MMM d, h:mm a")}
                        </div>
                        <p>{update.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Incidents</h3>
              <p className="text-muted-foreground">
                All SafeGo services are operating normally
              </p>
            </CardContent>
          </Card>
        )}

        {/* Scheduled Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Maintenance</CardTitle>
            <CardDescription>Planned service windows</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center py-6 text-muted-foreground">
              No scheduled maintenance at this time
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
