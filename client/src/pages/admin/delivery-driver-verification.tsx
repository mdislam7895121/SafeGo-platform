import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Ban,
  Unlock,
  Search,
  Filter,
  Car,
  Bike,
  Footprints,
  User,
  MapPin,
  IdCard,
  FileText,
  Loader2,
  AlertTriangle,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DeliveryDriverApplication {
  id: string;
  userId: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  isSuspended: boolean;
  isBlocked: boolean;
  fullName: string | null;
  fatherName: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  usaStreet: string | null;
  usaCity: string | null;
  usaState: string | null;
  usaZipCode: string | null;
  nidNumber: string | null;
  nidFrontImageUrl: string | null;
  nidBackImageUrl: string | null;
  governmentIdType: string | null;
  governmentIdLast4: string | null;
  governmentIdFrontImageUrl: string | null;
  governmentIdBackImageUrl: string | null;
  ssnLast4: string | null;
  backgroundCheckConsent: boolean | null;
  deliveryDriverMethod: string | null;
  driverLicenseNumber: string | null;
  driverLicenseFrontUrl: string | null;
  driverLicenseBackUrl: string | null;
  driverLicenseExpiry: string | null;
  vehicleRegistrationUrl: string | null;
  insuranceCardUrl: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  profilePhotoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  rejectionReason: string | null;
  onboardingCompletedAt: string | null;
  walletBalance: string | null;
  negativeBalance: string | null;
}

export default function DeliveryDriverVerification() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<DeliveryDriverApplication | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const { data: driversData, isLoading, refetch } = useQuery<{ drivers: DeliveryDriverApplication[] }>({
    queryKey: [`/api/admin/delivery-drivers?status=${activeTab}&countryFilter=${countryFilter}`],
  });

  const approveMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return apiRequest(`/api/admin/delivery-drivers/${driverId}/approve`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/admin/delivery-drivers") });
      toast({ title: "Driver Approved", description: "The driver has been verified and can now accept deliveries." });
      setShowDetailsDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to approve driver", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: string; reason: string }) => {
      return apiRequest(`/api/admin/delivery-drivers/${driverId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/admin/delivery-drivers") });
      toast({ title: "Driver Rejected", description: "The driver application has been rejected." });
      setShowRejectDialog(false);
      setShowDetailsDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to reject driver", variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: string; reason: string }) => {
      return apiRequest(`/api/admin/delivery-drivers/${driverId}/block`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/admin/delivery-drivers") });
      toast({ title: "Driver Blocked", description: "The driver has been blocked from the platform." });
      setShowBlockDialog(false);
      setShowDetailsDialog(false);
      setBlockReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to block driver", variant: "destructive" });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (driverId: string) => {
      return apiRequest(`/api/admin/delivery-drivers/${driverId}/unblock`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/admin/delivery-drivers") });
      toast({ title: "Driver Unblocked", description: "The driver has been unblocked." });
      setShowDetailsDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to unblock driver", variant: "destructive" });
    },
  });

  const drivers = driversData?.drivers || [];
  
  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch = !searchQuery || 
      driver.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phoneNumber?.includes(searchQuery);
    const matchesCountry = countryFilter === "all" || driver.countryCode === countryFilter;
    return matchesSearch && matchesCountry;
  });

  const getStatusBadge = (driver: DeliveryDriverApplication) => {
    if (driver.isBlocked) {
      return <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Blocked</Badge>;
    }
    if (driver.isSuspended) {
      return <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3" /> Suspended</Badge>;
    }
    if (driver.isVerified) {
      return <Badge variant="default" className="gap-1 bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>;
    }
    if (driver.verificationStatus === "rejected") {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  };

  const getDeliveryMethodIcon = (method: string | null) => {
    switch (method) {
      case "car": return <Car className="h-4 w-4" />;
      case "bike": return <Bike className="h-4 w-4" />;
      case "walking": return <Footprints className="h-4 w-4" />;
      default: return null;
    }
  };

  const openDriverDetails = (driver: DeliveryDriverApplication) => {
    setSelectedDriver(driver);
    setShowDetailsDialog(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Delivery Driver Verification" description="Review and verify delivery driver applications" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Delivery Driver Verification" 
        description="Review and verify delivery driver applications"
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-drivers"
            />
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-32" data-testid="select-country-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="BD">Bangladesh</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="verified" data-testid="tab-verified">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Verified
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            <XCircle className="h-4 w-4 mr-2" />
            Rejected
          </TabsTrigger>
          <TabsTrigger value="blocked" data-testid="tab-blocked">
            <Ban className="h-4 w-4 mr-2" />
            Blocked
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {activeTab === "pending" && "Pending Applications"}
                {activeTab === "verified" && "Verified Drivers"}
                {activeTab === "rejected" && "Rejected Applications"}
                {activeTab === "blocked" && "Blocked Drivers"}
              </CardTitle>
              <CardDescription>
                {filteredDrivers.length} driver(s) found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredDrivers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No drivers found in this category</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Delivery Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDrivers.map((driver) => (
                      <TableRow key={driver.id} data-testid={`driver-row-${driver.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              {driver.profilePhotoUrl ? (
                                <img src={driver.profilePhotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{driver.fullName || "N/A"}</p>
                              <p className="text-sm text-muted-foreground">{driver.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {driver.countryCode === "BD" ? "Bangladesh" : "United States"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeliveryMethodIcon(driver.deliveryDriverMethod)}
                            <span className="capitalize">{driver.deliveryDriverMethod || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(driver)}</TableCell>
                        <TableCell>
                          {driver.onboardingCompletedAt 
                            ? format(new Date(driver.onboardingCompletedAt), "MMM d, yyyy")
                            : "N/A"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDriverDetails(driver)}
                            data-testid={`button-view-${driver.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Driver Application Details
            </DialogTitle>
            <DialogDescription>
              Review the driver's submitted information and documents
            </DialogDescription>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    {selectedDriver.profilePhotoUrl ? (
                      <img src={selectedDriver.profilePhotoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedDriver.fullName || "N/A"}</h3>
                    <p className="text-muted-foreground">{selectedDriver.email}</p>
                  </div>
                </div>
                {getStatusBadge(selectedDriver)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Country:</span>
                      <span>{selectedDriver.countryCode === "BD" ? "Bangladesh" : "United States"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{selectedDriver.phoneNumber || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date of Birth:</span>
                      <span>{selectedDriver.dateOfBirth ? format(new Date(selectedDriver.dateOfBirth), "MMM d, yyyy") : "N/A"}</span>
                    </div>
                    {selectedDriver.countryCode === "BD" && selectedDriver.fatherName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Father's Name:</span>
                        <span>{selectedDriver.fatherName}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedDriver.countryCode === "BD" ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Present:</span>
                          <span className="text-right max-w-48 truncate">{selectedDriver.presentAddress || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Permanent:</span>
                          <span className="text-right max-w-48 truncate">{selectedDriver.permanentAddress || "N/A"}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Street:</span>
                          <span>{selectedDriver.usaStreet || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">City/State/ZIP:</span>
                          <span>{`${selectedDriver.usaCity || ""}, ${selectedDriver.usaState || ""} ${selectedDriver.usaZipCode || ""}`}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <IdCard className="h-4 w-4" />
                      Government ID
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedDriver.countryCode === "BD" ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NID Number:</span>
                          <span>{selectedDriver.nidNumber ? `****${selectedDriver.nidNumber.slice(-4)}` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NID Front:</span>
                          <span>{selectedDriver.nidFrontImageUrl ? "Uploaded" : "Not uploaded"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NID Back:</span>
                          <span>{selectedDriver.nidBackImageUrl ? "Uploaded" : "Not uploaded"}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID Type:</span>
                          <span className="capitalize">{selectedDriver.governmentIdType?.replace("_", " ") || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID Last 4:</span>
                          <span>****{selectedDriver.governmentIdLast4 || "----"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SSN Last 4:</span>
                          <span>***-**-{selectedDriver.ssnLast4 || "----"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Background Check:</span>
                          <Badge variant={selectedDriver.backgroundCheckConsent ? "default" : "destructive"}>
                            {selectedDriver.backgroundCheckConsent ? "Consented" : "Not consented"}
                          </Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Vehicle & Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Method:</span>
                      <div className="flex items-center gap-1">
                        {getDeliveryMethodIcon(selectedDriver.deliveryDriverMethod)}
                        <span className="capitalize">{selectedDriver.deliveryDriverMethod || "N/A"}</span>
                      </div>
                    </div>
                    {(selectedDriver.countryCode === "BD" || selectedDriver.deliveryDriverMethod === "car") && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">License #:</span>
                          <span>{selectedDriver.driverLicenseNumber ? `****${selectedDriver.driverLicenseNumber.slice(-4)}` : "N/A"}</span>
                        </div>
                        {selectedDriver.deliveryDriverMethod === "car" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Vehicle:</span>
                              <span>{`${selectedDriver.vehicleMake || ""} ${selectedDriver.vehicleModel || ""}`.trim() || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Plate:</span>
                              <span>{selectedDriver.vehiclePlate || "N/A"}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Emergency Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{selectedDriver.emergencyContactName || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{selectedDriver.emergencyContactPhone || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Relationship:</span>
                      <span>{selectedDriver.emergencyContactRelationship || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Wallet Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance:</span>
                      <span>${parseFloat(selectedDriver.walletBalance || "0").toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Negative Balance:</span>
                      <span className={parseFloat(selectedDriver.negativeBalance || "0") > 0 ? "text-red-600 font-medium" : ""}>
                        ${parseFloat(selectedDriver.negativeBalance || "0").toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedDriver.rejectionReason && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Rejection Reason</h4>
                  <p className="text-sm text-red-700 dark:text-red-300">{selectedDriver.rejectionReason}</p>
                </div>
              )}

              <DialogFooter className="gap-2 flex-wrap">
                {!selectedDriver.isVerified && selectedDriver.verificationStatus === "pending" && (
                  <>
                    <Button
                      onClick={() => approveMutation.mutate(selectedDriver.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-approve-driver"
                    >
                      {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve Driver
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      data-testid="button-reject-driver"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedDriver.isBlocked ? (
                  <Button
                    variant="outline"
                    onClick={() => unblockMutation.mutate(selectedDriver.id)}
                    disabled={unblockMutation.isPending}
                    data-testid="button-unblock-driver"
                  >
                    {unblockMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                    Unblock Driver
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowBlockDialog(true)}
                    data-testid="button-block-driver"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Block Driver
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Driver Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this driver application. The driver will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter the reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-2"
              data-testid="input-rejection-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDriver && rejectMutation.mutate({ driverId: selectedDriver.id, reason: rejectionReason })}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Reject Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Blocking this driver will prevent them from accessing the platform. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="block-reason">Block Reason</Label>
            <Textarea
              id="block-reason"
              placeholder="Enter the reason for blocking..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="mt-2"
              data-testid="input-block-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDriver && blockMutation.mutate({ driverId: selectedDriver.id, reason: blockReason })}
              disabled={!blockReason.trim() || blockMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {blockMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Block Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
