import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Ticket,
  Car,
  User,
  Phone,
  MapPin,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface TicketBooking {
  id: string;
  bookingNumber: string;
  status: string;
  journeyDate: string;
  seatNumbers: string[];
  totalAmount: number;
  bookedAt: string;
  listing: {
    routeName: string;
    originCity: string;
    destinationCity: string;
    departureTime: string;
  };
  customer: {
    fullName: string;
    phoneNumber: string;
  };
}

interface RentalBooking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  renterName: string;
  renterPhone: string;
  pickupLocation: string;
  requestedAt: string;
  vehicle: {
    brand: string;
    model: string;
    registrationNumber: string;
  };
  customer: {
    fullName: string;
    phoneNumber: string;
  };
}

const ticketStatusLabels: Record<string, { label: string; color: string }> = {
  booked: { label: "নতুন", color: "bg-blue-500" },
  confirmed: { label: "নিশ্চিত", color: "bg-green-500" },
  completed: { label: "সম্পন্ন", color: "bg-gray-500" },
  cancelled_by_customer: { label: "বাতিল (গ্রাহক)", color: "bg-red-500" },
  cancelled_by_operator: { label: "বাতিল", color: "bg-red-500" },
  no_show: { label: "অনুপস্থিত", color: "bg-orange-500" },
};

const rentalStatusLabels: Record<string, { label: string; color: string }> = {
  requested: { label: "নতুন অনুরোধ", color: "bg-blue-500" },
  accepted: { label: "গৃহীত", color: "bg-green-500" },
  vehicle_assigned: { label: "গাড়ি প্রস্তুত", color: "bg-purple-500" },
  in_use: { label: "যাত্রা চলছে", color: "bg-yellow-500" },
  returned: { label: "ফেরত", color: "bg-gray-500" },
  completed: { label: "সম্পন্ন", color: "bg-gray-500" },
  cancelled_by_customer: { label: "বাতিল (গ্রাহক)", color: "bg-red-500" },
  cancelled_by_operator: { label: "বাতিল", color: "bg-red-500" },
};

export default function TicketOperatorBookings() {
  const [activeTab, setActiveTab] = useState("new");
  const { toast } = useToast();

  const { data: ticketData, isLoading: ticketLoading } = useQuery<{ bookings: TicketBooking[] }>({
    queryKey: ["/api/ticket-operator/ticket-bookings"],
  });

  const { data: rentalData, isLoading: rentalLoading } = useQuery<{ bookings: RentalBooking[] }>({
    queryKey: ["/api/ticket-operator/rental-bookings"],
  });

  const ticketStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      return apiRequest(`/api/ticket-operator/ticket-bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/ticket-bookings"] });
      toast({ title: "সফল!", description: "স্ট্যাটাস আপডেট হয়েছে" });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "স্ট্যাটাস আপডেট করা যায়নি",
        variant: "destructive",
      });
    },
  });

  const rentalStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      return apiRequest(`/api/ticket-operator/rental-bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/rental-bookings"] });
      toast({ title: "সফল!", description: "স্ট্যাটাস আপডেট হয়েছে" });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "স্ট্যাটাস আপডেট করা যায়নি",
        variant: "destructive",
      });
    },
  });

  const isLoading = ticketLoading || rentalLoading;

  const newTicketBookings = ticketData?.bookings?.filter(b => b.status === "booked") || [];
  const activeTicketBookings = ticketData?.bookings?.filter(b => b.status === "confirmed") || [];
  const completedTicketBookings = ticketData?.bookings?.filter(b => 
    ["completed", "cancelled_by_customer", "cancelled_by_operator", "no_show"].includes(b.status)
  ) || [];

  const newRentalBookings = rentalData?.bookings?.filter(b => b.status === "requested") || [];
  const activeRentalBookings = rentalData?.bookings?.filter(b => 
    ["accepted", "vehicle_assigned", "in_use"].includes(b.status)
  ) || [];
  const completedRentalBookings = rentalData?.bookings?.filter(b => 
    ["returned", "completed", "cancelled_by_customer", "cancelled_by_operator"].includes(b.status)
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6 pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">বুকিং ম্যানেজমেন্ট</h1>
          <p className="text-muted-foreground">আপনার সকল বুকিং পরিচালনা করুন</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 h-12">
            <TabsTrigger value="new" className="h-10" data-testid="tab-new">
              নতুন বুকিং
              {(newTicketBookings.length + newRentalBookings.length) > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {newTicketBookings.length + newRentalBookings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="h-10" data-testid="tab-completed">
              সম্পন্ন বুকিং
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-6 mt-6">
            {newTicketBookings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  টিকিট বুকিং ({newTicketBookings.length})
                </h3>
                {newTicketBookings.map((booking) => (
                  <Card key={booking.id} data-testid={`card-ticket-booking-${booking.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold">{booking.listing.routeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.listing.originCity} → {booking.listing.destinationCity}
                          </p>
                        </div>
                        <Badge>{ticketStatusLabels[booking.status]?.label || booking.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.customer.fullName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.customer.phoneNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(booking.journeyDate).toLocaleDateString("bn-BD")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.listing.departureTime}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="font-bold text-primary">
                          ৳{booking.totalAmount.toLocaleString("bn-BD")}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => ticketStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "confirmed" 
                            })}
                            disabled={ticketStatusMutation.isPending}
                            data-testid={`button-confirm-${booking.id}`}
                          >
                            {ticketStatusMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                বুকিং গ্রহণ
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => ticketStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "cancelled_by_operator" 
                            })}
                            disabled={ticketStatusMutation.isPending}
                            data-testid={`button-cancel-${booking.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            বাতিল
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTicketBookings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  চলমান টিকিট ({activeTicketBookings.length})
                </h3>
                {activeTicketBookings.map((booking) => (
                  <Card key={booking.id} data-testid={`card-active-ticket-${booking.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold">{booking.listing.routeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.customer.fullName} - {booking.customer.phoneNumber}
                          </p>
                        </div>
                        <Badge variant="default">{ticketStatusLabels[booking.status]?.label}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => ticketStatusMutation.mutate({ 
                            bookingId: booking.id, 
                            status: "completed" 
                          })}
                          disabled={ticketStatusMutation.isPending}
                          data-testid={`button-complete-${booking.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          সম্পন্ন
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => ticketStatusMutation.mutate({ 
                            bookingId: booking.id, 
                            status: "no_show" 
                          })}
                          disabled={ticketStatusMutation.isPending}
                          data-testid={`button-noshow-${booking.id}`}
                        >
                          অনুপস্থিত
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {newRentalBookings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  রেন্টাল অনুরোধ ({newRentalBookings.length})
                </h3>
                {newRentalBookings.map((booking) => (
                  <Card key={booking.id} data-testid={`card-rental-booking-${booking.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold">
                            {booking.vehicle.brand} {booking.vehicle.model}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {booking.vehicle.registrationNumber}
                          </p>
                        </div>
                        <Badge>{rentalStatusLabels[booking.status]?.label || booking.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.renterName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.renterPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {new Date(booking.startDate).toLocaleDateString("bn-BD")} - 
                            {new Date(booking.endDate).toLocaleDateString("bn-BD")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{booking.pickupLocation}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="font-bold text-primary">
                          ৳{booking.totalAmount.toLocaleString("bn-BD")}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => rentalStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "accepted" 
                            })}
                            disabled={rentalStatusMutation.isPending}
                            data-testid={`button-accept-rental-${booking.id}`}
                          >
                            বুকিং গ্রহণ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rentalStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "cancelled_by_operator" 
                            })}
                            disabled={rentalStatusMutation.isPending}
                            data-testid={`button-cancel-rental-${booking.id}`}
                          >
                            বাতিল
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeRentalBookings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  চলমান রেন্টাল ({activeRentalBookings.length})
                </h3>
                {activeRentalBookings.map((booking) => (
                  <Card key={booking.id} data-testid={`card-active-rental-${booking.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold">
                            {booking.vehicle.brand} {booking.vehicle.model}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {booking.renterName} - {booking.renterPhone}
                          </p>
                        </div>
                        <Badge variant="default">{rentalStatusLabels[booking.status]?.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {booking.status === "accepted" && (
                          <Button
                            size="sm"
                            onClick={() => rentalStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "vehicle_assigned" 
                            })}
                            disabled={rentalStatusMutation.isPending}
                            data-testid={`button-assign-${booking.id}`}
                          >
                            গাড়ি প্রস্তুত
                          </Button>
                        )}
                        {booking.status === "vehicle_assigned" && (
                          <Button
                            size="sm"
                            onClick={() => rentalStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "in_use" 
                            })}
                            disabled={rentalStatusMutation.isPending}
                            data-testid={`button-start-${booking.id}`}
                          >
                            যাত্রা শুরু
                          </Button>
                        )}
                        {booking.status === "in_use" && (
                          <Button
                            size="sm"
                            onClick={() => rentalStatusMutation.mutate({ 
                              bookingId: booking.id, 
                              status: "returned" 
                            })}
                            disabled={rentalStatusMutation.isPending}
                            data-testid={`button-return-${booking.id}`}
                          >
                            ফেরত নেওয়া হয়েছে
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {newTicketBookings.length === 0 && 
             activeTicketBookings.length === 0 && 
             newRentalBookings.length === 0 && 
             activeRentalBookings.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">কোনো নতুন বুকিং নেই</h3>
                  <p className="text-sm text-muted-foreground">
                    নতুন বুকিং আসলে এখানে দেখতে পাবেন
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-6 mt-6">
            {completedTicketBookings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  সম্পন্ন টিকিট ({completedTicketBookings.length})
                </h3>
                {completedTicketBookings.map((booking) => (
                  <Card key={booking.id} className="opacity-75" data-testid={`card-completed-ticket-${booking.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{booking.listing.routeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.customer.fullName}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            {ticketStatusLabels[booking.status]?.label || booking.status}
                          </Badge>
                          <p className="text-sm font-bold text-primary mt-1">
                            ৳{booking.totalAmount.toLocaleString("bn-BD")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {completedRentalBookings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  সম্পন্ন রেন্টাল ({completedRentalBookings.length})
                </h3>
                {completedRentalBookings.map((booking) => (
                  <Card key={booking.id} className="opacity-75" data-testid={`card-completed-rental-${booking.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {booking.vehicle.brand} {booking.vehicle.model}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {booking.renterName}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">
                            {rentalStatusLabels[booking.status]?.label || booking.status}
                          </Badge>
                          <p className="text-sm font-bold text-primary mt-1">
                            ৳{booking.totalAmount.toLocaleString("bn-BD")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {completedTicketBookings.length === 0 && completedRentalBookings.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">কোনো সম্পন্ন বুকিং নেই</h3>
                  <p className="text-sm text-muted-foreground">
                    সম্পন্ন বুকিং এখানে দেখতে পাবেন
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
