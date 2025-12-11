import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CustomerBackButton } from "@/components/customer/CustomerBackButton";
import {
  Ticket,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  ArrowRight,
  Calendar,
  Users,
  Bus,
  Train,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatCurrency";

interface TicketBooking {
  id: string;
  bookingNumber: string;
  journeyDate: string;
  departureTime: string;
  seatNumbers: string[];
  numberOfSeats: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  bookedAt: string;
  listing: {
    routeName: string;
    originCity: string;
    originStation?: string;
    destinationCity: string;
    destinationStation?: string;
    vehicleType: string;
    vehicleBrand?: string;
    amenities?: string[];
  };
  operator: {
    operatorName: string;
    logo?: string;
    officePhone?: string;
  };
}

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; label: string }> = {
  booked: { variant: "outline", icon: Clock, label: "বুক হয়েছে" },
  confirmed: { variant: "default", icon: CheckCircle, label: "নিশ্চিত" },
  completed: { variant: "secondary", icon: CheckCircle, label: "সম্পন্ন" },
  cancelled_by_customer: { variant: "destructive", icon: XCircle, label: "বাতিল (আপনি)" },
  cancelled_by_operator: { variant: "destructive", icon: XCircle, label: "বাতিল (অপারেটর)" },
  no_show: { variant: "destructive", icon: AlertCircle, label: "অনুপস্থিত" },
};

const vehicleTypeLabels: Record<string, string> = {
  bus: "বাস",
  coach: "কোচ",
  ac_bus: "এসি বাস",
  train: "ট্রেন",
};

function BookingStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function VehicleIcon({ type }: { type: string }) {
  if (type === "train") {
    return <Train className="h-5 w-5 text-primary" />;
  }
  return <Bus className="h-5 w-5 text-primary" />;
}

export default function BDMyTickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: string | null }>({ open: false, bookingId: null });
  const [cancelReason, setCancelReason] = useState("");

  const statusFilter = activeTab === "all" ? undefined : activeTab;

  const { data, isLoading } = useQuery<{ bookings: TicketBooking[]; pagination: any }>({
    queryKey: ["/api/tickets/my-bookings", statusFilter],
    queryFn: () => apiRequest(`/api/tickets/my-bookings${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      return apiRequest(`/api/tickets/my-bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/my-bookings"] });
      toast({
        title: "সফল!",
        description: "টিকেট বাতিল করা হয়েছে।",
      });
      setCancelDialog({ open: false, bookingId: null });
      setCancelReason("");
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "টিকেট বাতিল করা যায়নি।",
        variant: "destructive",
      });
    },
  });

  const bookings = data?.bookings || [];

  const filteredBookings = activeTab === "all" 
    ? bookings 
    : activeTab === "active"
    ? bookings.filter((b) => ["booked", "confirmed"].includes(b.status))
    : activeTab === "completed"
    ? bookings.filter((b) => b.status === "completed")
    : bookings.filter((b) => ["cancelled_by_customer", "cancelled_by_operator", "no_show"].includes(b.status));

  const openCancelDialog = (bookingId: string) => {
    setCancelDialog({ open: true, bookingId });
  };

  const handleCancelBooking = () => {
    if (cancelDialog.bookingId) {
      cancelMutation.mutate({ bookingId: cancelDialog.bookingId, reason: cancelReason });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <CustomerBackButton
            fallbackRoute="/customer"
            fallbackTab="tickets"
            label="ফিরে যান"
          />
          <div className="flex-1">
            <h1 className="text-lg font-bold" data-testid="text-title">
              আমার টিকেট
            </h1>
            <p className="text-xs text-muted-foreground">বুক করা সব টিকেট</p>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">সব</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">চলমান</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">সম্পন্ন</TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled">বাতিল</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">কোনো টিকেট নেই</p>
                  <Link href="/customer/bd-tickets">
                    <Button className="mt-4" data-testid="button-browse-tickets">
                      টিকেট খুঁজুন
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              filteredBookings.map((booking) => (
                <Card key={booking.id} className="hover-elevate" data-testid={`card-booking-${booking.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                          <VehicleIcon type={booking.listing.vehicleType} />
                        </div>
                        <div>
                          <h3 className="font-medium" data-testid={`text-route-${booking.id}`}>
                            {booking.listing.routeName || `${booking.listing.originCity} - ${booking.listing.destinationCity}`}
                          </h3>
                          <p className="text-xs text-muted-foreground" data-testid={`text-booking-number-${booking.id}`}>
                            #{booking.bookingNumber}
                          </p>
                        </div>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium">{booking.listing.originCity}</span>
                        {booking.listing.originStation && (
                          <span className="text-muted-foreground">({booking.listing.originStation})</span>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium">{booking.listing.destinationCity}</span>
                        {booking.listing.destinationStation && (
                          <span className="text-muted-foreground">({booking.listing.destinationStation})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(booking.journeyDate), "dd MMM yyyy", { locale: bn })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {booking.departureTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {booking.numberOfSeats} সিট
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {vehicleTypeLabels[booking.listing.vehicleType] || booking.listing.vehicleType}
                      </Badge>
                    </div>

                    <div className="text-sm bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">
                        <span className="font-medium">সিট:</span> {(booking.seatNumbers || []).join(", ") || "N/A"}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">অপারেটর:</span> {booking.operator.operatorName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">মোট</p>
                        <p className="font-bold text-lg" data-testid={`text-total-${booking.id}`}>
                          {formatCurrency(Number(booking.totalAmount), "BDT")}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {["booked", "confirmed"].includes(booking.status) && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openCancelDialog(booking.id)}
                            data-testid={`button-cancel-${booking.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            বাতিল
                          </Button>
                        )}
                        <Link href={`/customer/bd-ticket/${booking.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-${booking.id}`}>
                            বিস্তারিত
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ open, bookingId: cancelDialog.bookingId })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>টিকেট বাতিল করুন</DialogTitle>
            <DialogDescription>
              আপনি কি নিশ্চিত যে এই টিকেট বাতিল করতে চান?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="বাতিলের কারণ লিখুন (ঐচ্ছিক)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              data-testid="input-cancel-reason"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCancelDialog({ open: false, bookingId: null })}
              data-testid="button-cancel-dialog"
            >
              না, রাখুন
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              হ্যাঁ, বাতিল করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
