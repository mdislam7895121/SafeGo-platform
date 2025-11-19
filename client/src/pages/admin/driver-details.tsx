import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Car, Shield, Ban, Unlock, Trash2, Clock, DollarSign, Star, TrendingUp, AlertCircle, User, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DriverDetails {
  id: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  lastActive: string | null;
  isBlocked: boolean;
  // Bangladesh fields
  fullName?: string;
  fatherName?: string;
  phoneNumber?: string;
  village?: string;
  postOffice?: string;
  thana?: string;
  district?: string;
  presentAddress?: string;
  permanentAddress?: string;
  nidNumber?: string;
  nidFrontImageUrl?: string;
  nidBackImageUrl?: string;
  // Common KYC fields
  profilePhotoUrl?: string;
  // US fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  usaFullLegalName?: string;
  dateOfBirth?: string;
  usaPhoneNumber?: string;
  driverLicenseNumber?: string;
  licenseStateIssued?: string;
  driverLicenseExpiry?: string;
  driverLicenseImageUrl?: string;
  dmvLicenseImageUrl?: string;
  tlcLicenseImageUrl?: string;
  usaStreet?: string;
  usaCity?: string;
  usaState?: string;
  usaZipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  backgroundCheckStatus?: string;
  backgroundCheckDate?: string;
  // Legacy US fields
  homeAddress?: string;
  governmentIdType?: string;
  governmentIdLast4?: string;
  ssnLast4?: string;
  vehicle: {
    id: string;
    vehicleType: string;
    vehicleModel: string;
    vehiclePlate: string;
    isOnline: boolean;
    totalEarnings: string;
  } | null;
  stats: {
    rating: string;
    averageRating: string;
    totalTrips: number;
    totalEarnings: string;
    completionRate: string;
  } | null;
  wallet: {
    balance: string;
    negativeBalance: string;
  } | null;
}

interface Trip {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  serviceFare: string;
  driverPayout: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export default function AdminDriverDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/drivers/:id");
  const { toast } = useToast();
  const driverId = params?.id;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [showNid, setShowNid] = useState(false);
  const [nid, setNid] = useState<string>("");
  const [showSSN, setShowSSN] = useState(false);
  const [maskedSSN, setMaskedSSN] = useState<string>("");
  
  // Edit profile dialog state (Bangladesh)
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    fatherName: "",
    phoneNumber: "",
    village: "",
    postOffice: "",
    thana: "",
    district: "",
    presentAddress: "",
    permanentAddress: "",
    nid: "",
  });

  // Edit USA profile dialog state
  const [showEditUsaDialog, setShowEditUsaDialog] = useState(false);
  const [editUsaForm, setEditUsaForm] = useState({
    usaFullLegalName: "",
    dateOfBirth: "",
    ssn: "",
    driverLicenseNumber: "",
    licenseStateIssued: "",
    driverLicenseExpiry: "",
    usaPhoneNumber: "",
    usaStreet: "",
    usaCity: "",
    usaState: "",
    usaZipCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    backgroundCheckStatus: "pending",
  });

  // Fetch driver details
  const { data, isLoading } = useQuery<{ driver: DriverDetails }>({
    queryKey: [`/api/admin/drivers/${driverId}`],
    enabled: !!driverId,
  });
  
  const driver = data?.driver;

  // Fetch trip history
  const { data: trips } = useQuery<Trip[]>({
    queryKey: [`/api/admin/drivers/${driverId}/trips`],
    enabled: !!driverId,
  });

  // Suspend driver mutation
  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: suspensionReason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to suspend driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver suspended successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowSuspendDialog(false);
      setSuspensionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unsuspend driver mutation
  const unsuspendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/unsuspend`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unsuspend driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver suspension lifted successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Block driver mutation
  const blockMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/block`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to block driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver blocked successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowBlockDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unblock driver mutation
  const unblockMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}/unblock`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unblock driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver unblocked successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete driver mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/drivers/${driverId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete driver");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Driver deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      navigate("/admin/drivers");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setShowDeleteDialog(false);
    },
  });

  // Fetch NID (admin-only, secure endpoint)
  const fetchNidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/admin/drivers/${driverId}/nid`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch NID");
      }
      const data = await response.json();
      return data.nid;
    },
    onSuccess: (data) => {
      setNid(data);
      setShowNid(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      // Only send non-empty fields
      const payload: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value && value.trim()) {
          payload[key] = value.trim();
        }
      });

      const response = await apiRequest("PATCH", `/api/admin/drivers/${driverId}/profile`, payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      setShowEditDialog(false);
      setEditForm({
        fullName: "",
        fatherName: "",
        phoneNumber: "",
        village: "",
        postOffice: "",
        thana: "",
        district: "",
        presentAddress: "",
        permanentAddress: "",
        nid: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Fetch SSN (admin-only, secure endpoint)
  const fetchSSNMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/admin/drivers/${driverId}/ssn`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch SSN");
      }
      const data = await response.json();
      return data.maskedSSN;
    },
    onSuccess: (data) => {
      setMaskedSSN(data);
      setShowSSN(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update USA profile mutation
  const updateUsaProfileMutation = useMutation({
    mutationFn: async (data: typeof editUsaForm) => {
      // Only send non-empty fields
      const payload: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value && String(value).trim()) {
          payload[key] = key === 'ssn' || key === 'dateOfBirth' || key === 'driverLicenseExpiry' 
            ? value 
            : String(value).trim();
        }
      });

      const response = await apiRequest("PATCH", `/api/admin/drivers/${driverId}/usa-profile`, payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update USA profile");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "USA profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      setShowEditUsaDialog(false);
      setEditUsaForm({
        usaFullLegalName: "",
        dateOfBirth: "",
        ssn: "",
        driverLicenseNumber: "",
        licenseStateIssued: "",
        driverLicenseExpiry: "",
        usaPhoneNumber: "",
        usaStreet: "",
        usaCity: "",
        usaState: "",
        usaZipCode: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        backgroundCheckStatus: "pending",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handler to open edit dialog with existing data (Bangladesh)
  const handleOpenEditDialog = () => {
    if (driver) {
      setEditForm({
        fullName: driver.fullName || "",
        fatherName: driver.fatherName || "",
        phoneNumber: driver.phoneNumber || "",
        village: driver.village || "",
        postOffice: driver.postOffice || "",
        thana: driver.thana || "",
        district: driver.district || "",
        presentAddress: driver.presentAddress || "",
        permanentAddress: driver.permanentAddress || "",
        nid: driver.nidNumber || "",
      });
    }
    setShowEditDialog(true);
  };

  // Handler to open USA edit dialog with existing data
  const handleOpenEditUsaDialog = () => {
    if (driver) {
      setEditUsaForm({
        usaFullLegalName: driver.usaFullLegalName || "",
        dateOfBirth: driver.dateOfBirth ? driver.dateOfBirth.split('T')[0] : "",
        ssn: "", // Never pre-populate SSN for security
        driverLicenseNumber: driver.driverLicenseNumber || "",
        licenseStateIssued: driver.licenseStateIssued || "",
        driverLicenseExpiry: driver.driverLicenseExpiry ? driver.driverLicenseExpiry.split('T')[0] : "",
        usaPhoneNumber: driver.usaPhoneNumber || "",
        usaStreet: driver.usaStreet || "",
        usaCity: driver.usaCity || "",
        usaState: driver.usaState || "",
        usaZipCode: driver.usaZipCode || "",
        emergencyContactName: driver.emergencyContactName || "",
        emergencyContactPhone: driver.emergencyContactPhone || "",
        backgroundCheckStatus: driver.backgroundCheckStatus || "pending",
      });
    }
    setShowEditUsaDialog(true);
  };

  const getStatusBadge = () => {
    if (!driver) return null;
    if (driver.isBlocked) {
      return <Badge variant="destructive">Blocked</Badge>;
    }
    if (driver.isSuspended) {
      return <Badge className="bg-orange-500">Suspended</Badge>;
    }
    if (!driver.isVerified) {
      return <Badge variant="secondary">Pending KYC</Badge>;
    }
    if (driver.vehicle?.isOnline) {
      return <Badge className="bg-green-500">Online</Badge>;
    }
    return <Badge variant="outline">Offline</Badge>;
  };

  if (!driverId) {
    return <div>Invalid driver ID</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/drivers")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Driver Details</h1>
            {isLoading ? (
              <Skeleton className="h-4 w-48 mt-1 bg-primary-foreground/20" />
            ) : (
              <p className="text-sm opacity-90" data-testid="text-email">{driver?.email}</p>
            )}
          </div>
          {!isLoading && driver && getStatusBadge()}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : driver ? (
          <>
            {/* Driver Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Driver Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="text-driver-email">{driver.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium" data-testid="text-driver-country">{driver.countryCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Verification Status</p>
                    <Badge variant={driver.isVerified ? "default" : "secondary"} data-testid="text-verification-status">
                      {driver.verificationStatus}
                    </Badge>
                  </div>
                </div>

                {driver.vehicle && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle Type</p>
                      <p className="font-medium" data-testid="text-vehicle-type">{driver.vehicle.vehicleType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle Model</p>
                      <p className="font-medium" data-testid="text-vehicle-model">{driver.vehicle.vehicleModel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">License Plate</p>
                      <p className="font-medium" data-testid="text-vehicle-plate">{driver.vehicle.vehiclePlate}</p>
                    </div>
                  </div>
                )}

                {driver.lastActive && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Last Active</p>
                    <p className="font-medium" data-testid="text-last-active">
                      {format(new Date(driver.lastActive), "PPpp")}
                    </p>
                  </div>
                )}

                {driver.isSuspended && driver.suspensionReason && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-900 dark:text-orange-100">Suspended</p>
                        <p className="text-sm text-orange-800 dark:text-orange-200" data-testid="text-suspension-reason">
                          {driver.suspensionReason}
                        </p>
                        {driver.suspendedAt && (
                          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            Since {format(new Date(driver.suspendedAt), "PPp")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Star className="h-8 w-8 text-yellow-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-rating">
                      {driver.stats?.averageRating || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <TrendingUp className="h-8 w-8 text-blue-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-trips">
                      {driver.stats?.totalTrips || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <DollarSign className="h-8 w-8 text-green-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-earnings">
                      ${driver.stats?.totalEarnings || driver.vehicle?.totalEarnings || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Earnings</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <DollarSign className="h-8 w-8 text-purple-600 mb-2" />
                    <p className="text-2xl font-bold" data-testid="stat-wallet">
                      ${driver.wallet?.balance || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {driver.isSuspended ? (
                    <Button
                      variant="outline"
                      onClick={() => unsuspendMutation.mutate()}
                      disabled={unsuspendMutation.isPending}
                      data-testid="button-unsuspend"
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Lift Suspension
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowSuspendDialog(true)}
                      disabled={driver.isBlocked}
                      data-testid="button-suspend"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Suspend Driver
                    </Button>
                  )}

                  {driver.isBlocked ? (
                    <Button
                      variant="outline"
                      onClick={() => unblockMutation.mutate()}
                      disabled={unblockMutation.isPending}
                      data-testid="button-unblock"
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Unblock Driver
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => setShowBlockDialog(true)}
                      data-testid="button-block"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block Driver
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    data-testid="button-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Driver
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bangladesh Info - Only shown for Bangladesh drivers */}
            {driver.countryCode === "BD" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Bangladesh Identity Information
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenEditDialog}
                      data-testid="button-edit-profile"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {driver.fullName && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        <p className="text-sm" data-testid="text-full-name">{driver.fullName}</p>
                      </div>
                    )}
                    {driver.fatherName && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Father's Name</p>
                        <p className="text-sm" data-testid="text-father-name">{driver.fatherName}</p>
                      </div>
                    )}
                    {driver.phoneNumber && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                        <p className="text-sm" data-testid="text-phone">{driver.phoneNumber}</p>
                      </div>
                    )}
                    {driver.village && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Village</p>
                        <p className="text-sm" data-testid="text-village">{driver.village}</p>
                      </div>
                    )}
                    {driver.postOffice && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Post Office</p>
                        <p className="text-sm" data-testid="text-post-office">{driver.postOffice}</p>
                      </div>
                    )}
                    {driver.thana && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Thana</p>
                        <p className="text-sm" data-testid="text-thana">{driver.thana}</p>
                      </div>
                    )}
                    {driver.district && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">District</p>
                        <p className="text-sm" data-testid="text-district">{driver.district}</p>
                      </div>
                    )}
                    {driver.presentAddress && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Present Address</p>
                        <p className="text-sm" data-testid="text-present-address">{driver.presentAddress}</p>
                      </div>
                    )}
                    {driver.permanentAddress && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Permanent Address</p>
                        <p className="text-sm" data-testid="text-permanent-address">{driver.permanentAddress}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">NID Number</p>
                      {showNid ? (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono" data-testid="text-nid">{nid || driver.nidNumber || "Not available"}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNid(false)}
                            data-testid="button-hide-nid"
                          >
                            Hide
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchNidMutation.mutate()}
                          disabled={fetchNidMutation.isPending}
                          data-testid="button-show-nid"
                        >
                          {fetchNidMutation.isPending ? "Loading..." : "Show NID"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {(driver.nidFrontImageUrl || driver.nidBackImageUrl) && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">NID Images</p>
                      <div className="flex gap-2">
                        {driver.nidFrontImageUrl && (
                          <a
                            href={driver.nidFrontImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                            data-testid="link-nid-front"
                          >
                            View Front
                          </a>
                        )}
                        {driver.nidBackImageUrl && (
                          <a
                            href={driver.nidBackImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                            data-testid="link-nid-back"
                          >
                            View Back
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* USA Info - Only shown for US drivers */}
            {driver.countryCode === "US" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      USA Identity Information
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenEditUsaDialog}
                      data-testid="button-edit-usa-profile"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit USA Profile
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {driver.usaFullLegalName && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Legal Name</p>
                        <p className="text-sm" data-testid="text-usa-legal-name">{driver.usaFullLegalName}</p>
                      </div>
                    )}
                    {driver.dateOfBirth && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                        <p className="text-sm" data-testid="text-dob">{format(new Date(driver.dateOfBirth), "PPP")}</p>
                      </div>
                    )}
                    {driver.usaPhoneNumber && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                        <p className="text-sm" data-testid="text-usa-phone">{driver.usaPhoneNumber}</p>
                      </div>
                    )}
                    {driver.driverLicenseNumber && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Driver License Number</p>
                        <p className="text-sm font-mono" data-testid="text-license-number">{driver.driverLicenseNumber}</p>
                      </div>
                    )}
                    {driver.licenseStateIssued && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">License State</p>
                        <p className="text-sm" data-testid="text-license-state">{driver.licenseStateIssued}</p>
                      </div>
                    )}
                    {driver.driverLicenseExpiry && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">License Expiry</p>
                        <p className="text-sm" data-testid="text-license-expiry">{format(new Date(driver.driverLicenseExpiry), "PPP")}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">SSN</p>
                      {showSSN ? (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono" data-testid="text-ssn">{maskedSSN || "Not available"}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSSN(false)}
                            data-testid="button-hide-ssn"
                          >
                            Hide
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchSSNMutation.mutate()}
                          disabled={fetchSSNMutation.isPending}
                          data-testid="button-show-ssn"
                        >
                          {fetchSSNMutation.isPending ? "Loading..." : "Show SSN"}
                        </Button>
                      )}
                    </div>
                    {driver.backgroundCheckStatus && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Background Check</p>
                        <Badge 
                          variant={driver.backgroundCheckStatus === "cleared" ? "default" : driver.backgroundCheckStatus === "failed" ? "destructive" : "secondary"}
                          data-testid="badge-background-check"
                        >
                          {driver.backgroundCheckStatus}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {/* Address Section */}
                  {(driver.usaStreet || driver.usaCity || driver.usaState || driver.usaZipCode) && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Residential Address</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        {driver.usaStreet && (
                          <div>
                            <p className="text-xs text-muted-foreground">Street</p>
                            <p className="text-sm" data-testid="text-usa-street">{driver.usaStreet}</p>
                          </div>
                        )}
                        {driver.usaCity && (
                          <div>
                            <p className="text-xs text-muted-foreground">City</p>
                            <p className="text-sm" data-testid="text-usa-city">{driver.usaCity}</p>
                          </div>
                        )}
                        {driver.usaState && (
                          <div>
                            <p className="text-xs text-muted-foreground">State</p>
                            <p className="text-sm" data-testid="text-usa-state">{driver.usaState}</p>
                          </div>
                        )}
                        {driver.usaZipCode && (
                          <div>
                            <p className="text-xs text-muted-foreground">ZIP Code</p>
                            <p className="text-sm" data-testid="text-usa-zip">{driver.usaZipCode}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Emergency Contact Section */}
                  {(driver.emergencyContactName || driver.emergencyContactPhone) && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Emergency Contact</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        {driver.emergencyContactName && (
                          <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="text-sm" data-testid="text-emergency-name">{driver.emergencyContactName}</p>
                          </div>
                        )}
                        {driver.emergencyContactPhone && (
                          <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm" data-testid="text-emergency-phone">{driver.emergencyContactPhone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Trip History */}
            {trips && trips.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Trips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trips.slice(0, 10).map((trip) => (
                      <div key={trip.id} className="p-3 border rounded-lg" data-testid={`trip-${trip.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{trip.pickupAddress} → {trip.dropoffAddress}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(trip.createdAt), "PPp")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">${trip.driverPayout}</p>
                            <Badge variant={trip.status === "completed" ? "default" : "secondary"} className="mt-1">
                              {trip.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Driver not found</p>
          </div>
        )}
      </div>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a reason for suspending this driver. They will not be able to accept new ride requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for suspension..."
            value={suspensionReason}
            onChange={(e) => setSuspensionReason(e.target.value)}
            data-testid="textarea-suspension-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-suspend">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendMutation.mutate()}
              disabled={!suspensionReason || suspendMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Driver</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently block the driver from logging in. This action can be undone later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-block">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-block"
            >
              Block Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the driver account. This action cannot be undone. The driver must have no active trips and no negative wallet balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bangladesh Profile</DialogTitle>
            <DialogDescription>
              Update driver Bangladesh identity information. Leave NID blank to keep existing value.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-edit-fullName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-fatherName">Father's Name</Label>
              <Input
                id="edit-fatherName"
                value={editForm.fatherName}
                onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                placeholder="Enter father's name"
                data-testid="input-edit-fatherName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phoneNumber">Phone Number</Label>
              <Input
                id="edit-phoneNumber"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                placeholder="01XXXXXXXXX"
                data-testid="input-edit-phoneNumber"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-village">Village</Label>
              <Input
                id="edit-village"
                value={editForm.village}
                onChange={(e) => setEditForm({ ...editForm, village: e.target.value })}
                placeholder="Enter village name"
                data-testid="input-edit-village"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-postOffice">Post Office</Label>
              <Input
                id="edit-postOffice"
                value={editForm.postOffice}
                onChange={(e) => setEditForm({ ...editForm, postOffice: e.target.value })}
                placeholder="Enter post office"
                data-testid="input-edit-postOffice"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-thana">Thana</Label>
              <Input
                id="edit-thana"
                value={editForm.thana}
                onChange={(e) => setEditForm({ ...editForm, thana: e.target.value })}
                placeholder="Enter thana/upazila"
                data-testid="input-edit-thana"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-district">District</Label>
              <Input
                id="edit-district"
                value={editForm.district}
                onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                placeholder="Enter district"
                data-testid="input-edit-district"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-presentAddress">Present Address</Label>
              <Textarea
                id="edit-presentAddress"
                value={editForm.presentAddress}
                onChange={(e) => setEditForm({ ...editForm, presentAddress: e.target.value })}
                placeholder="Enter current address"
                data-testid="input-edit-presentAddress"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-permanentAddress">Permanent Address</Label>
              <Textarea
                id="edit-permanentAddress"
                value={editForm.permanentAddress}
                onChange={(e) => setEditForm({ ...editForm, permanentAddress: e.target.value })}
                placeholder="Enter permanent address"
                data-testid="input-edit-permanentAddress"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-nid">NID Number (10-17 digits)</Label>
              <Input
                id="edit-nid"
                value={editForm.nid}
                onChange={(e) => setEditForm({ ...editForm, nid: e.target.value })}
                placeholder="Enter NID (will be encrypted)"
                data-testid="input-edit-nid"
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep existing NID. Will be encrypted securely.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updateProfileMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateProfileMutation.mutate(editForm)}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit USA Profile Dialog */}
      <Dialog open={showEditUsaDialog} onOpenChange={setShowEditUsaDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit USA Profile</DialogTitle>
            <DialogDescription>
              Update driver USA identity information. SSN will be encrypted securely.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="usa-fullName">Full Legal Name</Label>
              <Input
                id="usa-fullName"
                value={editUsaForm.usaFullLegalName}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, usaFullLegalName: e.target.value })}
                placeholder="Enter full legal name"
                data-testid="input-usa-fullName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-dob">Date of Birth</Label>
              <Input
                id="usa-dob"
                type="date"
                value={editUsaForm.dateOfBirth}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, dateOfBirth: e.target.value })}
                data-testid="input-usa-dob"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-ssn">SSN (###-##-####)</Label>
              <Input
                id="usa-ssn"
                type="password"
                value={editUsaForm.ssn}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, ssn: e.target.value })}
                placeholder="Leave blank to keep existing"
                data-testid="input-usa-ssn"
              />
              <p className="text-xs text-muted-foreground">Will be encrypted. Leave blank to keep existing.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-phone">Phone Number</Label>
              <Input
                id="usa-phone"
                value={editUsaForm.usaPhoneNumber}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, usaPhoneNumber: e.target.value })}
                placeholder="(123) 456-7890"
                data-testid="input-usa-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-license">Driver License Number</Label>
              <Input
                id="usa-license"
                value={editUsaForm.driverLicenseNumber}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, driverLicenseNumber: e.target.value })}
                placeholder="Enter license number"
                data-testid="input-usa-license"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-license-state">License State</Label>
              <Input
                id="usa-license-state"
                value={editUsaForm.licenseStateIssued}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, licenseStateIssued: e.target.value.toUpperCase() })}
                placeholder="NY, CA, TX, etc."
                maxLength={2}
                data-testid="input-usa-license-state"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-license-expiry">License Expiry</Label>
              <Input
                id="usa-license-expiry"
                type="date"
                value={editUsaForm.driverLicenseExpiry}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, driverLicenseExpiry: e.target.value })}
                data-testid="input-usa-license-expiry"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-street">Street Address</Label>
              <Input
                id="usa-street"
                value={editUsaForm.usaStreet}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, usaStreet: e.target.value })}
                placeholder="123 Main St"
                data-testid="input-usa-street"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-city">City</Label>
              <Input
                id="usa-city"
                value={editUsaForm.usaCity}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, usaCity: e.target.value })}
                placeholder="New York"
                data-testid="input-usa-city"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-state">State</Label>
              <Input
                id="usa-state"
                value={editUsaForm.usaState}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, usaState: e.target.value.toUpperCase() })}
                placeholder="NY"
                maxLength={2}
                data-testid="input-usa-state"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-zip">ZIP Code</Label>
              <Input
                id="usa-zip"
                value={editUsaForm.usaZipCode}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, usaZipCode: e.target.value })}
                placeholder="10001"
                data-testid="input-usa-zip"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-emergency-name">Emergency Contact Name</Label>
              <Input
                id="usa-emergency-name"
                value={editUsaForm.emergencyContactName}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, emergencyContactName: e.target.value })}
                placeholder="Enter emergency contact"
                data-testid="input-usa-emergency-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-emergency-phone">Emergency Contact Phone</Label>
              <Input
                id="usa-emergency-phone"
                value={editUsaForm.emergencyContactPhone}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, emergencyContactPhone: e.target.value })}
                placeholder="(123) 456-7890"
                data-testid="input-usa-emergency-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-background-check">Background Check Status</Label>
              <select
                id="usa-background-check"
                value={editUsaForm.backgroundCheckStatus}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, backgroundCheckStatus: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                data-testid="select-usa-background-check"
              >
                <option value="pending">Pending</option>
                <option value="cleared">Cleared</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditUsaDialog(false)}
              disabled={updateUsaProfileMutation.isPending}
              data-testid="button-cancel-usa-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateUsaProfileMutation.mutate(editUsaForm)}
              disabled={updateUsaProfileMutation.isPending}
              data-testid="button-save-usa-edit"
            >
              {updateUsaProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
