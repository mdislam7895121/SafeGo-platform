import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertCircle, FileText, History, Phone, MessageCircle, ChevronRight } from "lucide-react";

interface SafetySummary {
  safetyScore: number;
  totalIncidents: number;
  monthlyIncidents: number;
  resolvedIncidents: number;
  pendingIncidents: number;
  quickActions: Array<{
    id: string;
    label: string;
    icon: string;
    href: string;
  }>;
  lastUpdated: string;
}

function getSafetyScoreColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getSafetyScoreBadge(score: number): { variant: "default" | "secondary" | "destructive"; label: string } {
  if (score >= 90) return { variant: "default", label: "Excellent" };
  if (score >= 70) return { variant: "secondary", label: "Good" };
  return { variant: "destructive", label: "Needs Attention" };
}

export default function DriverSafety() {
  const { data, isLoading, error } = useQuery<SafetySummary>({
    queryKey: ["/api/driver/safety/summary"],
  });

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Unable to load safety center</p>
            <p className="text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-safety-title">Safety Center</h1>
          <p className="text-muted-foreground">Manage your safety and report incidents</p>
        </div>
        <Link href="/driver/safety/emergency">
          <Button variant="destructive" className="gap-2" data-testid="button-emergency-sos">
            <AlertCircle className="h-4 w-4" />
            Emergency SOS
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : data ? (
        <>
          <Card className="relative overflow-hidden" data-testid="card-safety-score">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Safety Score</CardTitle>
                  <CardDescription>Your overall safety rating</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <span className={`text-5xl font-bold ${getSafetyScoreColor(data.safetyScore)}`} data-testid="text-safety-score">
                  {data.safetyScore}
                </span>
                <div className="flex flex-col gap-1">
                  <Badge {...getSafetyScoreBadge(data.safetyScore)} data-testid="badge-safety-status">
                    {getSafetyScoreBadge(data.safetyScore).label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">out of 100</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card data-testid="card-total-incidents">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{data.totalIncidents}</div>
                <p className="text-sm text-muted-foreground">Total Incidents</p>
              </CardContent>
            </Card>
            <Card data-testid="card-monthly-incidents">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{data.monthlyIncidents}</div>
                <p className="text-sm text-muted-foreground">This Month</p>
              </CardContent>
            </Card>
            <Card data-testid="card-resolved-incidents">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{data.resolvedIncidents}</div>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>
            <Card data-testid="card-pending-incidents">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.pendingIncidents}</div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common safety actions and resources</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Link href="/driver/safety/emergency">
                <Card className="hover-elevate cursor-pointer" data-testid="link-emergency-toolkit">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Emergency Toolkit</h4>
                      <p className="text-sm text-muted-foreground">SOS & quick support</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/driver/safety/report">
                <Card className="hover-elevate cursor-pointer" data-testid="link-report-incident">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Report Incident</h4>
                      <p className="text-sm text-muted-foreground">File a safety report</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/driver/safety/history">
                <Card className="hover-elevate cursor-pointer" data-testid="link-incident-history">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Incident History</h4>
                      <p className="text-sm text-muted-foreground">View past reports</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Safety Resources</CardTitle>
              <CardDescription>Guidelines and support contacts</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="p-2 bg-muted rounded-lg">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium">24/7 Safety Hotline</h4>
                  <p className="text-sm text-muted-foreground">+1-800-SAFEGO</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="p-2 bg-muted rounded-lg">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium">In-App Support Chat</h4>
                  <p className="text-sm text-muted-foreground">Average response: 5 min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
