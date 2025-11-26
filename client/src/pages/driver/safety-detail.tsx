import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, Calendar, MapPin, Clock, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface IncidentDetail {
  id: string;
  category: string;
  categoryLabel: string;
  description: string;
  incidentDate: string;
  status: string;
  statusLabel: string;
  tripId: string | null;
  tripType: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  attachments: string[];
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "RESOLVED":
      return "default";
    case "UNDER_REVIEW":
      return "secondary";
    case "SUBMITTED":
      return "outline";
    case "CLOSED":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "RESOLVED":
      return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
    case "UNDER_REVIEW":
      return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
    case "SUBMITTED":
      return <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    case "CLOSED":
      return <CheckCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    default:
      return <AlertCircle className="h-5 w-5" />;
  }
}

export default function DriverSafetyDetail() {
  const [, params] = useRoute("/driver/safety/history/:id");
  const incidentId = params?.id;

  const { data, isLoading, error } = useQuery<IncidentDetail>({
    queryKey: ["/api/driver/safety/incidents", incidentId],
    queryFn: async () => {
      const response = await fetch(`/api/driver/safety/incidents/${incidentId}`);
      if (!response.ok) throw new Error("Failed to fetch incident");
      return response.json();
    },
    enabled: !!incidentId
  });

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Incident Not Found</p>
            <p className="text-muted-foreground mb-6">This incident may have been deleted or doesn't exist.</p>
            <Link href="/driver/safety/history">
              <Button data-testid="button-back-to-history">Back to History</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/driver/safety/history">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-detail-title">Incident Details</h1>
          <p className="text-muted-foreground">Report ID: {data.id.substring(0, 8).toUpperCase()}</p>
        </div>
        <Badge variant={getStatusBadgeVariant(data.status)} className="text-sm" data-testid="badge-status">
          {data.statusLabel}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {getStatusIcon(data.status)}
            <div>
              <CardTitle>{data.categoryLabel}</CardTitle>
              <CardDescription>
                Reported on {format(new Date(data.createdAt), "MMMM d, yyyy 'at' h:mm a")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-2">Description</h4>
            <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
              {data.description}
            </p>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Incident Date</h4>
                <p className="text-sm text-muted-foreground" data-testid="text-incident-date">
                  {format(new Date(data.incidentDate), "MMMM d, yyyy")}
                </p>
              </div>
            </div>

            {data.tripType && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="font-medium">Trip Type</h4>
                  <p className="text-sm text-muted-foreground" data-testid="text-trip-type">
                    {data.tripType}
                  </p>
                </div>
              </div>
            )}

            {data.locationAddress && (
              <div className="flex items-start gap-3 md:col-span-2">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="font-medium">Location</h4>
                  <p className="text-sm text-muted-foreground" data-testid="text-location">
                    {data.locationAddress}
                  </p>
                </div>
              </div>
            )}
          </div>

          {data.attachments && data.attachments.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Attachments</h4>
                <div className="grid gap-2 md:grid-cols-3">
                  {data.attachments.map((url, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg text-center">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Attachment {index + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {data.status === "RESOLVED" && data.resolution && (
        <Card className="border-green-200 dark:border-green-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Resolution</CardTitle>
                <CardDescription>
                  Resolved on {data.resolvedAt ? format(new Date(data.resolvedAt), "MMMM d, yyyy") : "N/A"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground" data-testid="text-resolution">
              {data.resolution}
            </p>
          </CardContent>
        </Card>
      )}

      {data.status === "UNDER_REVIEW" && (
        <Card className="border-yellow-200 dark:border-yellow-900/50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Under Review</h4>
              <p className="text-sm text-muted-foreground">
                Our safety team is reviewing your report. We'll notify you once we have an update.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.status === "SUBMITTED" && (
        <Card className="border-blue-200 dark:border-blue-900/50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Submitted</h4>
              <p className="text-sm text-muted-foreground">
                Your incident has been submitted and is pending review. Average response time is 24-48 hours.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <h4 className="font-medium">Need help with this incident?</h4>
              <p className="text-sm text-muted-foreground">Contact our support team for assistance</p>
            </div>
          </div>
          <Link href="/driver/support">
            <Button variant="outline" data-testid="button-contact-support">
              Contact Support
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
