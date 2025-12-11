import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ChevronLeft, Car, UtensilsCrossed, Store, Ticket, Phone, Mail, MapPin, Clock, CheckCircle, XCircle, Clock4, Send, Loader2, Bell, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface AdminNote {
  text: string;
  addedAt: string;
  addedBy: string;
}

interface NotificationLog {
  id: string;
  createdAt: string;
  toEmail: string;
  subject: string;
  templateName: string;
  statusTrigger: string;
  previousStatus?: string;
  success: boolean;
  errorMessage?: string;
}

interface Application {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  city: string;
  region: string;
  country: string;
  reviewedAt?: string;
  reviewedByAdminId?: string;
  adminNotes: AdminNote[];
  metadata?: {
    ip?: string;
    userAgent?: string;
    submittedAt?: string;
  };
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  serviceType?: string;
  vehicleType?: string;
  restaurantName?: string;
  ownerName?: string;
  businessEmail?: string;
  cuisineType?: string;
  shopName?: string;
  category?: string;
  businessName?: string;
  contactPerson?: string;
  ticketType?: string;
}

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-blue-500", icon: Clock4 },
  in_review: { label: "In Review", color: "bg-yellow-500", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-500", icon: XCircle }
};

const TYPE_CONFIG: Record<string, { icon: typeof Car; label: string; backPath: string }> = {
  drivers: { icon: Car, label: "Driver/Courier Application", backPath: "/admin/onboarding/drivers" },
  restaurants: { icon: UtensilsCrossed, label: "Restaurant Application", backPath: "/admin/onboarding/restaurants" },
  shops: { icon: Store, label: "Shop Application", backPath: "/admin/onboarding/shops" },
  tickets: { icon: Ticket, label: "Ticket Partner Application", backPath: "/admin/onboarding/tickets" }
};

export default function AdminOnboardingDetail() {
  const [, navigate] = useLocation();
  const [matchDrivers, paramsDrivers] = useRoute("/admin/onboarding/drivers/:id");
  const [matchRestaurants, paramsRestaurants] = useRoute("/admin/onboarding/restaurants/:id");
  const [matchShops, paramsShops] = useRoute("/admin/onboarding/shops/:id");
  const [matchTickets, paramsTickets] = useRoute("/admin/onboarding/tickets/:id");
  const { toast } = useToast();

  let type = "";
  let id = "";
  if (matchDrivers && paramsDrivers?.id) { type = "drivers"; id = paramsDrivers.id; }
  else if (matchRestaurants && paramsRestaurants?.id) { type = "restaurants"; id = paramsRestaurants.id; }
  else if (matchShops && paramsShops?.id) { type = "shops"; id = paramsShops.id; }
  else if (matchTickets && paramsTickets?.id) { type = "tickets"; id = paramsTickets.id; }

  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");

  const typeConfig = TYPE_CONFIG[type] || TYPE_CONFIG.drivers;
  const TypeIcon = typeConfig.icon;

  const { data: application, isLoading } = useQuery<Application>({
    queryKey: ['/api/partner-onboarding', type, id],
    queryFn: async () => {
      const response = await fetch(`/api/partner-onboarding/${type}/${id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch application');
      return response.json();
    },
    enabled: !!type && !!id
  });

  const { data: notificationData } = useQuery<{ logs: NotificationLog[] }>({
    queryKey: ['/api/partner-onboarding/notifications', id],
    queryFn: async () => {
      const response = await fetch(`/api/partner-onboarding/notifications/${id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: !!id
  });

  const updateMutation = useMutation({
    mutationFn: async ({ status, note }: { status: string; note?: string }) => {
      const response = await fetch(`/api/partner-onboarding/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, note })
      });
      if (!response.ok) throw new Error('Failed to update application');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner-onboarding', type, id] });
      queryClient.invalidateQueries({ queryKey: ['/api/partner-onboarding', type] });
      queryClient.invalidateQueries({ queryKey: ['/api/partner-onboarding/notifications', id] });
      toast({ title: "Updated", description: "Application status updated successfully. Email notification sent." });
      setAdminNote("");
      setNewStatus("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update application", variant: "destructive" });
    }
  });

  const handleStatusUpdate = () => {
    if (!newStatus) return;
    updateMutation.mutate({ status: newStatus, note: adminNote || undefined });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(typeConfig.backPath)} data-testid="button-back">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Application not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[application.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
  const StatusIcon = statusConfig.icon;
  const notes = Array.isArray(application.adminNotes) ? application.adminNotes : [];

  let primaryName = "";
  let contactEmail = application.email || application.businessEmail || "";
  let contactPhone = application.phoneNumber || "";

  switch (type) {
    case "drivers":
      primaryName = application.fullName || "";
      break;
    case "restaurants":
      primaryName = application.restaurantName || "";
      break;
    case "shops":
      primaryName = application.shopName || "";
      break;
    case "tickets":
      primaryName = application.businessName || "";
      break;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(typeConfig.backPath)} data-testid="button-back">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to {type.charAt(0).toUpperCase() + type.slice(1)}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-lg ${statusConfig.color} flex items-center justify-center`}>
            <TypeIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-primary-name">{primaryName}</h1>
            <p className="text-muted-foreground">{typeConfig.label}</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 text-base px-3 py-1">
          <StatusIcon className="h-4 w-4" />
          {statusConfig.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {type === "drivers" && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Full Name</Label>
                      <p className="font-medium" data-testid="text-fullname">{application.fullName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium" data-testid="text-email">{application.email}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Service Type</Label>
                      <p className="font-medium" data-testid="text-service-type">
                        {application.serviceType === "ride_driver" ? "Ride Driver" : "Delivery Courier"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Vehicle Type</Label>
                      <p className="font-medium capitalize" data-testid="text-vehicle-type">{application.vehicleType}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Country</Label>
                      <p className="font-medium" data-testid="text-country">{application.country}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Region Code</Label>
                      <p className="font-medium" data-testid="text-region">{application.region}</p>
                    </div>
                  </div>
                </>
              )}

              {type === "restaurants" && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Restaurant Name</Label>
                      <p className="font-medium" data-testid="text-restaurant-name">{application.restaurantName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Owner Name</Label>
                      <p className="font-medium" data-testid="text-owner-name">{application.ownerName}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Business Email</Label>
                      <p className="font-medium" data-testid="text-business-email">{application.businessEmail}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cuisine Type</Label>
                      <p className="font-medium" data-testid="text-cuisine-type">{application.cuisineType}</p>
                    </div>
                  </div>
                </>
              )}

              {type === "shops" && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Shop Name</Label>
                      <p className="font-medium" data-testid="text-shop-name">{application.shopName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Owner Name</Label>
                      <p className="font-medium" data-testid="text-owner-name">{application.ownerName}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium capitalize" data-testid="text-category">{application.category}</p>
                  </div>
                </>
              )}

              {type === "tickets" && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Business Name</Label>
                      <p className="font-medium" data-testid="text-business-name">{application.businessName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Contact Person</Label>
                      <p className="font-medium" data-testid="text-contact-person">{application.contactPerson}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ticket Type</Label>
                    <p className="font-medium capitalize" data-testid="text-ticket-type">{application.ticketType}</p>
                  </div>
                </>
              )}

              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-phone">{contactPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-location">{application.city}, {application.country}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Notes</CardTitle>
              <CardDescription>Internal notes about this application</CardDescription>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-md">
                      <p className="text-sm">{note.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {note.addedBy} - {formatDistanceToNow(new Date(note.addedAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>Notification history for this application</CardDescription>
            </CardHeader>
            <CardContent>
              {!notificationData?.logs || notificationData.logs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No notifications sent yet</p>
              ) : (
                <div className="space-y-3">
                  {notificationData.logs.map((log) => (
                    <div key={log.id} className="p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant={log.success ? "default" : "destructive"} className="text-xs">
                          {log.success ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Sent</>
                          ) : (
                            <><AlertCircle className="h-3 w-3 mr-1" /> Failed</>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{log.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        To: {log.toEmail}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status change: {log.previousStatus || 'N/A'} → {log.statusTrigger}
                      </p>
                      {log.errorMessage && (
                        <p className="text-xs text-destructive mt-1">Error: {log.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Add Note (Optional)</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add an internal note..."
                  rows={3}
                  data-testid="textarea-admin-note"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleStatusUpdate}
                disabled={!newStatus || updateMutation.isPending}
                data-testid="button-update-status"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Update Status
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Submitted: {format(new Date(application.createdAt), "MMM d, yyyy h:mm a")}</span>
              </div>
              {application.reviewedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span>Reviewed: {format(new Date(application.reviewedAt), "MMM d, yyyy h:mm a")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {application.metadata && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {application.metadata.ip && (
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p className="font-mono">{application.metadata.ip}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Region</Label>
                  <p>{application.region}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
