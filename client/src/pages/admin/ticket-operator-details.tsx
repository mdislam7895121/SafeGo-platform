import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, Ticket, CheckCircle, XCircle, Clock, Ban, Bus, Ship, Train, Car,
  Route, Truck, Calendar, Wallet, MapPin, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface TicketOperatorDetails {
  id: string;
  operatorName: string;
  operatorType: string;
  phoneNumber: string;
  verificationStatus: string;
  rejectionReason?: string;
  ticketCommissionRate: number;
  rentalCommissionRate: number;
  walletBalance: number;
  negativeBalance: number;
  logoUrl?: string;
  bannerUrl?: string;
  // KYC fields
  nidNumber?: string;
  nidFrontImage?: string;
  nidBackImage?: string;
  ownerName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  presentAddress?: string;
  permanentAddress?: string;
  routePermitNumber?: string;
  routePermitImage?: string;
  routePermitExpiry?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  officeAddress?: string;
  officeEmail?: string;
  countryCode?: string;
  createdAt: string;
  verifiedAt?: string;
  user: { id: string; email: string; isBlocked: boolean; createdAt: string; countryCode?: string };
  routes: Array<{ id: string; origin: string; destination: string; price: number; departureTime?: string; isActive: boolean; createdAt?: string }>;
  vehicles: Array<{ id: string; vehicleType: string; registrationNumber: string; seatCapacity?: number; dailyRate?: number; isAvailable: boolean; createdAt?: string }>;
  ticketBookings: Array<{ id: string; bookingNumber?: string; status: string; totalAmount: number; createdAt: string }>;
  rentalBookings: Array<{ id: string; bookingNumber?: string; status: string; totalAmount: number; createdAt: string }>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock, label: "Pending Review" },
  approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "Rejected" },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Ban, label: "Suspended" },
};

const OPERATOR_TYPE_ICONS: Record<string, any> = {
  bus_company: Bus,
  ferry_company: Ship,
  train_operator: Train,
  rental_service: Car,
};

export default function TicketOperatorDetailsPage() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; ticketOperator: TicketOperatorDetails }>({
    queryKey: ["/api/admin/ticket-operators", params.id],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, rejectionReason }: { status: string; rejectionReason?: string }) => {
      return apiRequest(`/api/admin/ticket-operators/${params.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ticket-operators"] });
      toast({ title: "Status updated", description: "Ticket operator status has been updated" });
      setRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const operator = data?.ticketOperator;
  const statusConf = STATUS_CONFIG[operator?.verificationStatus?.toLowerCase() || "pending"] || STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;
  const TypeIcon = operator ? (OPERATOR_TYPE_ICONS[operator.operatorType] || Ticket) : Ticket;

  const getOperatorTypeLabel = (type: string) => {
    switch (type) {
      case "bus_company": return "Bus Company";
      case "ferry_company": return "Ferry Company";
      case "train_operator": return "Train Operator";
      case "rental_service": return "Rental Service";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!operator) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto text-center py-12">
          <Ticket className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Ticket Operator Not Found</h2>
          <Link href="/admin/ticket-operators">
            <Button>Back to Ticket Operators</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/ticket-operators">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" data-testid="text-operator-name">{operator.operatorName}</h1>
                <Badge variant="outline">{getOperatorTypeLabel(operator.operatorType)}</Badge>
              </div>
              <p className="text-muted-foreground">Ticket Operator Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusConf.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConf.label}
            </Badge>
            {operator.user.isBlocked && <Badge variant="destructive">User Blocked</Badge>}
          </div>
        </div>

        {operator.verificationStatus?.toLowerCase() === 'pending' && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold">Pending Approval</h3>
                    <p className="text-sm text-muted-foreground">Review the details and approve or reject this application</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRejectDialog(true)} data-testid="button-reject">
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => statusMutation.mutate({ status: "approved" })} data-testid="button-approve">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {operator.verificationStatus?.toLowerCase() === 'rejected' && operator.rejectionReason && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">Application Rejected</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">{operator.rejectionReason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">KYC Documents</TabsTrigger>
            <TabsTrigger value="routes">Routes ({operator.routes?.length || 0})</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles ({operator.vehicles?.length || 0})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Operator Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {operator.logoUrl ? (
                      <img 
                        src={operator.logoUrl} 
                        alt="Logo" 
                        className="h-16 w-16 rounded-lg object-cover cursor-pointer"
                        onClick={() => setImagePreview(operator.logoUrl!)}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                        <TypeIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{operator.operatorName}</h3>
                      <p className="text-sm text-muted-foreground">{getOperatorTypeLabel(operator.operatorType)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Phone</span>
                      <p className="font-medium">{operator.phoneNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium">{operator.user.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registered</span>
                      <p className="font-medium">{format(new Date(operator.createdAt), "MMM d, yyyy")}</p>
                    </div>
                    {operator.verifiedAt && (
                      <div>
                        <span className="text-muted-foreground">Verified</span>
                        <p className="font-medium">{format(new Date(operator.verifiedAt), "MMM d, yyyy")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
                      <Wallet className="h-5 w-5 text-green-600 mb-2" />
                      <span className="text-sm text-muted-foreground">Wallet Balance</span>
                      <p className="text-xl font-bold text-green-600">৳{operator.walletBalance?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
                      <Wallet className="h-5 w-5 text-red-600 mb-2" />
                      <span className="text-sm text-muted-foreground">Negative Balance</span>
                      <p className="text-xl font-bold text-red-600">৳{operator.negativeBalance?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Ticket Commission</span>
                      <p className="font-medium">{operator.ticketCommissionRate}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rental Commission</span>
                      <p className="font-medium">{operator.rentalCommissionRate}%</p>
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      Payout accounts are managed separately.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KYC Documents</CardTitle>
                <CardDescription>Verification documents submitted by the operator</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>NID Number</Label>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="font-mono">{operator.nidNumber || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Route Permit Number</Label>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="font-mono">{operator.routePermitNumber || 'Not provided'}</p>
                    </div>
                  </div>
                  {operator.bannerUrl && (
                    <div className="space-y-2 col-span-2">
                      <Label>Company Banner</Label>
                      <img 
                        src={operator.bannerUrl} 
                        alt="Banner" 
                        className="w-full h-48 object-cover rounded-lg cursor-pointer"
                        onClick={() => setImagePreview(operator.bannerUrl!)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Routes</CardTitle>
              </CardHeader>
              <CardContent>
                {!operator.routes?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No routes configured yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {operator.routes.map((route) => (
                      <div key={route.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <MapPin className="h-5 w-5 text-teal-600" />
                          <div>
                            <p className="font-medium">{route.origin} → {route.destination}</p>
                            <p className="text-sm text-muted-foreground">Departure: {route.departureTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={route.isActive ? "default" : "secondary"}>
                            {route.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="font-bold">৳{route.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                {!operator.vehicles?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No vehicles registered yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {operator.vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Truck className="h-5 w-5 text-teal-600" />
                          <span className="font-medium">{vehicle.vehicleType}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Registration</span>
                            <p className="font-mono">{vehicle.registrationNumber}</p>
                          </div>
                          {vehicle.seatCapacity && (
                            <div>
                              <span className="text-muted-foreground">Capacity</span>
                              <p>{vehicle.seatCapacity} seats</p>
                            </div>
                          )}
                          {vehicle.dailyRate && (
                            <div>
                              <span className="text-muted-foreground">Daily Rate</span>
                              <p className="font-bold">৳{vehicle.dailyRate}</p>
                            </div>
                          )}
                        </div>
                        <Badge variant={vehicle.isAvailable ? "default" : "secondary"} className="mt-3">
                          {vehicle.isAvailable ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Ticket Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  {!operator.ticketBookings?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No ticket bookings yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {operator.ticketBookings.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">#{booking.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(booking.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{booking.status}</Badge>
                            <span className="font-bold text-sm">৳{booking.totalAmount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Rental Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  {!operator.rentalBookings?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No rental bookings yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {operator.rentalBookings.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">#{booking.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(booking.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{booking.status}</Badge>
                            <span className="font-bold text-sm">৳{booking.totalAmount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Ticket Operator</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {operator.operatorName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Enter the reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => statusMutation.mutate({ status: "rejected", rejectionReason })}
                disabled={!rejectionReason.trim() || statusMutation.isPending}
              >
                {statusMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className="w-full h-auto rounded-lg" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
