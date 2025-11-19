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
  postalCode?: string;
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
  dmvLicenseFrontUrl?: string;
  dmvLicenseBackUrl?: string;
  dmvLicenseExpiry?: string;
  dmvLicenseNumber?: string;
  tlcLicenseImageUrl?: string;
  tlcLicenseFrontUrl?: string;
  tlcLicenseBackUrl?: string;
  tlcLicenseExpiry?: string;
  tlcLicenseNumber?: string;
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
  user: {
    id: string;
    email: string;
    countryCode: string;
    isBlocked: boolean;
  };
  vehicle: {
    id: string;
    vehicleType: string;
    vehicleModel: string;
    vehiclePlate: string;
    isOnline: boolean;
    totalEarnings: string;
    // USA vehicle fields
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
    registrationDocumentUrl?: string;
    registrationExpiry?: string;
    insuranceDocumentUrl?: string;
    insuranceExpiry?: string;
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

interface WalletSummary {
  driverId: string;
  driverCountry: string;
  totalTrips: number;
  totalEarnings: string;
  totalCommission: string;
  currentBalance: string;
  balanceStatus: 'positive' | 'negative' | 'zero';
  byService: {
    rides: {
      count: number;
      earnings: string;
      commission: string;
    };
    food: {
      count: number;
      earnings: string;
      commission: string;
    };
    parcels: {
      count: number;
      earnings: string;
      commission: string;
    };
  };
  byCountry: Record<string, {
    trips: number;
    earnings: number;
    commission: number;
  }>;
  recentTransactions: Array<{
    id: string;
    service: 'ride' | 'food' | 'parcel';
    type: 'trip_earning';
    amount: string;
    commission: string;
    netAmount: string;
    dateTime: string;
  }>;
}

// Helper function for currency formatting based on country
function formatCurrency(amount: string | number, countryCode: string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '—';
  
  if (countryCode === 'BD') {
    return `৳${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (countryCode === 'US') {
    return `$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    return `${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// Helper functions for USA name handling (backward compatibility)
function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  if (!fullName) return { firstName: "", middleName: "", lastName: "" };
  
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  } else if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  } else {
    // 3 or more parts: first = first word, last = last word, middle = everything in between
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middleName = parts.slice(1, -1).join(" ");
    return { firstName, middleName, lastName };
  }
}

function joinFullName(firstName: string, middleName: string, lastName: string): string {
  const parts = [firstName?.trim(), middleName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.join(" ");
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
    postalCode: "",
    thana: "",
    district: "",
    presentAddress: "",
    permanentAddress: "",
    nid: "",
  });

  // Edit USA profile dialog state
  const [showEditUsaDialog, setShowEditUsaDialog] = useState(false);
  const [editUsaForm, setEditUsaForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
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

  // Edit Vehicle dialog state (USA drivers)
  const [showEditVehicleDialog, setShowEditVehicleDialog] = useState(false);
  const [editVehicleForm, setEditVehicleForm] = useState({
    vehicleType: "",
    make: "",
    model: "",
    year: "",
    color: "",
    licensePlate: "",
    registrationDocumentUrl: "",
    registrationExpiry: "",
    insuranceDocumentUrl: "",
    insuranceExpiry: "",
    dmvInspectionType: "",
    dmvInspectionDate: "",
    dmvInspectionExpiry: "",
    dmvInspectionImageUrl: "",
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

  // Fetch wallet summary
  const { data: walletSummary, isLoading: isLoadingWallet } = useQuery<WalletSummary>({
    queryKey: [`/api/admin/drivers/${driverId}/wallet-summary`],
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
        postalCode: "",
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
      // Join name fields back into usaFullLegalName for backend compatibility
      const usaFullLegalName = joinFullName(data.firstName, data.middleName, data.lastName);
      
      // Only send non-empty fields
      const payload: any = {};
      
      // Add the joined full name
      if (usaFullLegalName.trim()) {
        payload.usaFullLegalName = usaFullLegalName;
      }
      
      // Add other fields
      Object.entries(data).forEach(([key, value]) => {
        // Skip the name fields as they're already joined
        if (key === 'firstName' || key === 'middleName' || key === 'lastName') return;
        
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
        firstName: "",
        middleName: "",
        lastName: "",
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
        postalCode: driver.postalCode || "",
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
      // Split existing full name into first/middle/last for edit form
      const nameParts = splitFullName(driver.usaFullLegalName || "");
      
      setEditUsaForm({
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
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

  // Update vehicle mutation  
  const updateVehicleMutation = useMutation({
    mutationFn: async (data: typeof editVehicleForm) => {
      // Convert year string to number
      const payload: any = {};
      if (data.vehicleType) payload.vehicleType = data.vehicleType;
      if (data.make) payload.make = data.make;
      if (data.model) payload.model = data.model;
      if (data.year) payload.year = parseInt(data.year);
      if (data.color) payload.color = data.color;
      if (data.licensePlate) payload.licensePlate = data.licensePlate;
      if (data.registrationDocumentUrl) payload.registrationDocumentUrl = data.registrationDocumentUrl;
      if (data.registrationExpiry) payload.registrationExpiry = data.registrationExpiry;
      if (data.insuranceDocumentUrl) payload.insuranceDocumentUrl = data.insuranceDocumentUrl;
      if (data.insuranceExpiry) payload.insuranceExpiry = data.insuranceExpiry;
      if (data.dmvInspectionType) payload.dmvInspectionType = data.dmvInspectionType;
      if (data.dmvInspectionDate) payload.dmvInspectionDate = data.dmvInspectionDate;
      if (data.dmvInspectionExpiry) payload.dmvInspectionExpiry = data.dmvInspectionExpiry;
      if (data.dmvInspectionImageUrl) payload.dmvInspectionImageUrl = data.dmvInspectionImageUrl;

      const response = await apiRequest("PATCH", `/api/admin/drivers/${driverId}/vehicle`, payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update vehicle");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Vehicle information updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/drivers/${driverId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      setShowEditVehicleDialog(false);
      setEditVehicleForm({
        vehicleType: "",
        make: "",
        model: "",
        year: "",
        color: "",
        licensePlate: "",
        registrationDocumentUrl: "",
        registrationExpiry: "",
        insuranceDocumentUrl: "",
        insuranceExpiry: "",
        dmvInspectionType: "",
        dmvInspectionDate: "",
        dmvInspectionExpiry: "",
        dmvInspectionImageUrl: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handler to open vehicle edit dialog with existing data
  const handleOpenEditVehicleDialog = () => {
    if (driver && driver.vehicle) {
      setEditVehicleForm({
        vehicleType: driver.vehicle.vehicleType || "",
        make: driver.vehicle.make || "",
        model: driver.vehicle.model || driver.vehicle.vehicleModel || "",
        year: driver.vehicle.year?.toString() || "",
        color: driver.vehicle.color || "",
        licensePlate: driver.vehicle.licensePlate || driver.vehicle.vehiclePlate || "",
        registrationDocumentUrl: driver.vehicle.registrationDocumentUrl || "",
        registrationExpiry: driver.vehicle.registrationExpiry ? driver.vehicle.registrationExpiry.split('T')[0] : "",
        insuranceDocumentUrl: driver.vehicle.insuranceDocumentUrl || "",
        insuranceExpiry: driver.vehicle.insuranceExpiry ? driver.vehicle.insuranceExpiry.split('T')[0] : "",
        dmvInspectionType: driver.vehicle.dmvInspectionType || "",
        dmvInspectionDate: driver.vehicle.dmvInspectionDate ? driver.vehicle.dmvInspectionDate.split('T')[0] : "",
        dmvInspectionExpiry: driver.vehicle.dmvInspectionExpiry ? driver.vehicle.dmvInspectionExpiry.split('T')[0] : "",
        dmvInspectionImageUrl: driver.vehicle.dmvInspectionImageUrl || "",
      });
    }
    setShowEditVehicleDialog(true);
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
                  {/* Profile Photo Section */}
                  {driver.profilePhotoUrl ? (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Profile Photo</p>
                      <div className="flex items-center gap-3">
                        <img 
                          src={driver.profilePhotoUrl} 
                          alt="Profile" 
                          className="w-16 h-16 rounded-md object-cover"
                          data-testid="img-profile-photo"
                        />
                        <a
                          href={driver.profilePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                          data-testid="link-profile-photo-full"
                        >
                          View Full Size
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Profile Photo</p>
                      <p className="text-sm text-yellow-600" data-testid="text-profile-photo-missing">
                        Profile photo not uploaded
                      </p>
                    </div>
                  )}

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
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Postal Code</p>
                      <p className="text-sm" data-testid="text-postal-code">
                        {driver.postalCode || <span className="text-muted-foreground">Not provided</span>}
                      </p>
                    </div>
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
                  {/* Profile Photo Status */}
                  <div className="mb-4 pb-4 border-b">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Profile Photo</p>
                    {driver.profilePhotoUrl ? (
                      <div className="flex items-center gap-2">
                        <img 
                          src={driver.profilePhotoUrl} 
                          alt="Profile" 
                          className="w-16 h-16 rounded-full object-cover border-2"
                          data-testid="img-usa-profile-photo"
                        />
                        <a
                          href={driver.profilePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                          data-testid="link-usa-profile-photo-full"
                        >
                          View Full Size
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-destructive" data-testid="text-usa-profile-photo-missing">
                        Profile photo not uploaded
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {driver.usaFullLegalName && (() => {
                      const nameParts = splitFullName(driver.usaFullLegalName);
                      return (
                        <>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">First Name</p>
                            <p className="text-sm" data-testid="text-usa-first-name">{nameParts.firstName || "—"}</p>
                          </div>
                          {nameParts.middleName && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Middle Name</p>
                              <p className="text-sm" data-testid="text-usa-middle-name">{nameParts.middleName}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Last Name</p>
                            <p className="text-sm" data-testid="text-usa-last-name">{nameParts.lastName || "—"}</p>
                          </div>
                        </>
                      );
                    })()}
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

                  {/* DMV License Documents Section (All USA drivers) */}
                  <div className="mt-6 pt-6 border-t space-y-3">
                    <p className="text-sm font-semibold text-foreground">DMV License Documents</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">DMV License Front</p>
                        {driver.dmvLicenseFrontUrl ? (
                          <a
                            href={driver.dmvLicenseFrontUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                            data-testid="link-dmv-front"
                          >
                            View Front Image
                          </a>
                        ) : (
                          <p className="text-sm text-destructive" data-testid="text-dmv-front-missing">Missing</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">DMV License Back</p>
                        {driver.dmvLicenseBackUrl ? (
                          <a
                            href={driver.dmvLicenseBackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                            data-testid="link-dmv-back"
                          >
                            View Back Image
                          </a>
                        ) : (
                          <p className="text-sm text-destructive" data-testid="text-dmv-back-missing">Missing</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">DMV License Expiry</p>
                        {driver.dmvLicenseExpiry ? (
                          <p className="text-sm" data-testid="text-dmv-expiry">
                            {format(new Date(driver.dmvLicenseExpiry), "PPP")}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground" data-testid="text-dmv-expiry-missing">Not provided</p>
                        )}
                      </div>
                      {driver.dmvLicenseNumber && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">DMV License Number</p>
                          <p className="text-sm font-mono" data-testid="text-dmv-number">{driver.dmvLicenseNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TLC License Documents Section (NY drivers only) */}
                  {driver.usaState === "NY" && (
                    <div className="mt-6 pt-6 border-t space-y-3">
                      <p className="text-sm font-semibold text-foreground">TLC License (New York)</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">TLC License Front</p>
                          {driver.tlcLicenseFrontUrl ? (
                            <a
                              href={driver.tlcLicenseFrontUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                              data-testid="link-tlc-front"
                            >
                              View Front Image
                            </a>
                          ) : (
                            <p className="text-sm text-destructive" data-testid="text-tlc-front-missing">Missing</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">TLC License Back</p>
                          {driver.tlcLicenseBackUrl ? (
                            <a
                              href={driver.tlcLicenseBackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                              data-testid="link-tlc-back"
                            >
                              View Back Image
                            </a>
                          ) : (
                            <p className="text-sm text-destructive" data-testid="text-tlc-back-missing">Missing</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">TLC License Expiry</p>
                          {driver.tlcLicenseExpiry ? (
                            <p className="text-sm" data-testid="text-tlc-expiry">
                              {format(new Date(driver.tlcLicenseExpiry), "PPP")}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground" data-testid="text-tlc-expiry-missing">Not provided</p>
                          )}
                        </div>
                        {driver.tlcLicenseNumber && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">TLC License Number</p>
                            <p className="text-sm font-mono" data-testid="text-tlc-number">{driver.tlcLicenseNumber}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact Section - Last section */}
                  {(driver.emergencyContactName || driver.emergencyContactPhone) && (
                    <div className="mt-6 pt-6 border-t space-y-3">
                      <p className="text-sm font-semibold text-foreground">Emergency Contact</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        {driver.emergencyContactName && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Name</p>
                            <p className="text-sm" data-testid="text-emergency-name">{driver.emergencyContactName}</p>
                          </div>
                        )}
                        {driver.emergencyContactPhone && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Phone</p>
                            <p className="text-sm" data-testid="text-emergency-phone">{driver.emergencyContactPhone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Vehicle Information (USA drivers only) */}
            {driver && driver.user?.countryCode === "US" && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!driver.vehicle && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive font-medium">
                        Vehicle information is incomplete. Please add vehicle details.
                      </p>
                    </div>
                  )}
                  {driver.vehicle && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Vehicle Type</p>
                          <p className="text-sm" data-testid="text-vehicle-type">{driver.vehicle.vehicleType || "—"}</p>
                        </div>
                        {driver.vehicle.make && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Make</p>
                            <p className="text-sm" data-testid="text-vehicle-make">{driver.vehicle.make}</p>
                          </div>
                        )}
                        {(driver.vehicle.model || driver.vehicle.vehicleModel) && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Model</p>
                            <p className="text-sm" data-testid="text-vehicle-model">{driver.vehicle.model || driver.vehicle.vehicleModel}</p>
                          </div>
                        )}
                        {driver.vehicle.year && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Year</p>
                            <p className="text-sm" data-testid="text-vehicle-year">{driver.vehicle.year}</p>
                          </div>
                        )}
                        {driver.vehicle.color && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Color</p>
                            <p className="text-sm" data-testid="text-vehicle-color">{driver.vehicle.color}</p>
                          </div>
                        )}
                        {(driver.vehicle.licensePlate || driver.vehicle.vehiclePlate) && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">License Plate</p>
                            <p className="text-sm font-mono" data-testid="text-vehicle-plate">{driver.vehicle.licensePlate || driver.vehicle.vehiclePlate}</p>
                          </div>
                        )}
                      </div>

                      {/* Registration Document */}
                      <div className="mt-6 pt-6 border-t space-y-3">
                        <p className="text-sm font-semibold text-foreground">Registration Document</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Status</p>
                            {driver.vehicle.registrationDocumentUrl ? (
                              <a
                                href={driver.vehicle.registrationDocumentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                                data-testid="link-registration-doc"
                              >
                                View Document
                              </a>
                            ) : (
                              <p className="text-sm text-destructive" data-testid="text-registration-missing">Missing</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Expiry Date</p>
                            {driver.vehicle.registrationExpiry ? (
                              <p className="text-sm" data-testid="text-registration-expiry">
                                {format(new Date(driver.vehicle.registrationExpiry), "PPP")}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not provided</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Insurance Document */}
                      <div className="mt-6 pt-6 border-t space-y-3">
                        <p className="text-sm font-semibold text-foreground">Insurance Document</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Status</p>
                            {driver.vehicle.insuranceDocumentUrl ? (
                              <a
                                href={driver.vehicle.insuranceDocumentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                                data-testid="link-insurance-doc"
                              >
                                View Document
                              </a>
                            ) : (
                              <p className="text-sm text-destructive" data-testid="text-insurance-missing">Missing</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Expiry Date</p>
                            {driver.vehicle.insuranceExpiry ? (
                              <p className="text-sm" data-testid="text-insurance-expiry">
                                {format(new Date(driver.vehicle.insuranceExpiry), "PPP")}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not provided</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DMV Inspection */}
                      <div className="mt-6 pt-6 border-t space-y-3">
                        <p className="text-sm font-semibold text-foreground">DMV Inspection</p>
                        
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Status:</p>
                          {driver.vehicle.dmvInspectionStatus === "VALID" && (
                            <Badge variant="default" className="bg-green-600" data-testid="badge-dmv-status">Valid</Badge>
                          )}
                          {driver.vehicle.dmvInspectionStatus === "EXPIRED" && (
                            <Badge variant="destructive" data-testid="badge-dmv-status">Expired</Badge>
                          )}
                          {(!driver.vehicle.dmvInspectionStatus || driver.vehicle.dmvInspectionStatus === "MISSING") && (
                            <Badge variant="secondary" data-testid="badge-dmv-status">Missing</Badge>
                          )}
                        </div>

                        {/* Warning Banners */}
                        {(!driver.vehicle.dmvInspectionImageUrl || driver.vehicle.dmvInspectionStatus === "MISSING") && (
                          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-sm text-destructive font-medium">
                              DMV inspection document is missing. Please request the driver to upload a valid inspection document.
                            </p>
                          </div>
                        )}
                        {driver.vehicle.dmvInspectionStatus === "EXPIRED" && (
                          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-sm text-destructive font-medium">
                              DMV inspection has expired. Please verify and request updated inspection documents.
                            </p>
                          </div>
                        )}

                        {/* Inspection Details */}
                        <div className="grid gap-4 md:grid-cols-2">
                          {driver.vehicle.dmvInspectionType && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Inspection Type</p>
                              <p className="text-sm" data-testid="text-dmv-type">{driver.vehicle.dmvInspectionType}</p>
                            </div>
                          )}
                          {driver.vehicle.dmvInspectionDate && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Inspection Date</p>
                              <p className="text-sm" data-testid="text-dmv-date">
                                {format(new Date(driver.vehicle.dmvInspectionDate), "PPP")}
                              </p>
                            </div>
                          )}
                          {driver.vehicle.dmvInspectionExpiry && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Expiry Date</p>
                              <p className="text-sm" data-testid="text-dmv-expiry">
                                {format(new Date(driver.vehicle.dmvInspectionExpiry), "PPP")}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Document</p>
                            {driver.vehicle.dmvInspectionImageUrl ? (
                              <a
                                href={driver.vehicle.dmvInspectionImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                                data-testid="link-dmv-doc"
                              >
                                View Document
                              </a>
                            ) : (
                              <p className="text-sm text-destructive" data-testid="text-dmv-doc-missing">Missing</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Warning if documents are missing */}
                      {(!driver.vehicle.registrationDocumentUrl || !driver.vehicle.insuranceDocumentUrl) && (
                        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                          <p className="text-sm text-destructive font-medium">
                            Vehicle information is incomplete. Please review registration and insurance documents.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Edit Button */}
                  <div className="mt-6 flex justify-end">
                    <Button 
                      variant="outline" 
                      onClick={handleOpenEditVehicleDialog}
                      data-testid="button-edit-vehicle"
                    >
                      Edit Vehicle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Commission & Wallet Summary */}
            {walletSummary && !isLoadingWallet && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Commission & Wallet Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* At-a-glance Stats */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Trips</p>
                      <p className="text-2xl font-bold" data-testid="text-total-trips">{walletSummary.totalTrips}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Earnings</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-total-earnings">
                        {formatCurrency(walletSummary.totalEarnings, walletSummary.driverCountry)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Commission</p>
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-total-commission">
                        {formatCurrency(walletSummary.totalCommission, walletSummary.driverCountry)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                      <p 
                        className={`text-2xl font-bold ${
                          walletSummary.balanceStatus === 'positive' ? 'text-green-600' :
                          walletSummary.balanceStatus === 'negative' ? 'text-red-600' :
                          'text-gray-600'
                        }`}
                        data-testid="text-current-balance"
                      >
                        {formatCurrency(walletSummary.currentBalance, walletSummary.driverCountry)}
                      </p>
                      {walletSummary.balanceStatus === 'negative' && (
                        <p className="text-xs text-destructive mt-1">Driver owes SafeGo</p>
                      )}
                      {walletSummary.balanceStatus === 'positive' && (
                        <p className="text-xs text-green-600 mt-1">SafeGo owes driver</p>
                      )}
                    </div>
                  </div>

                  {/* Service Breakdown */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Service Breakdown</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Rides */}
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          Rides
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Trips:</span>
                            <span className="font-medium" data-testid="text-rides-count">{walletSummary.byService.rides.count}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Earnings:</span>
                            <span className="font-medium text-green-600" data-testid="text-rides-earnings">
                              {formatCurrency(walletSummary.byService.rides.earnings, walletSummary.driverCountry)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Commission:</span>
                            <span className="font-medium text-blue-600" data-testid="text-rides-commission">
                              {formatCurrency(walletSummary.byService.rides.commission, walletSummary.driverCountry)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Food Orders */}
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Food Orders</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Orders:</span>
                            <span className="font-medium" data-testid="text-food-count">{walletSummary.byService.food.count}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Earnings:</span>
                            <span className="font-medium text-green-600" data-testid="text-food-earnings">
                              {formatCurrency(walletSummary.byService.food.earnings, walletSummary.driverCountry)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Commission:</span>
                            <span className="font-medium text-blue-600" data-testid="text-food-commission">
                              {formatCurrency(walletSummary.byService.food.commission, walletSummary.driverCountry)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Parcel Deliveries */}
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Parcel Deliveries</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Deliveries:</span>
                            <span className="font-medium" data-testid="text-parcels-count">{walletSummary.byService.parcels.count}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Earnings:</span>
                            <span className="font-medium text-green-600" data-testid="text-parcels-earnings">
                              {formatCurrency(walletSummary.byService.parcels.earnings, walletSummary.driverCountry)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Commission:</span>
                            <span className="font-medium text-blue-600" data-testid="text-parcels-commission">
                              {formatCurrency(walletSummary.byService.parcels.commission, walletSummary.driverCountry)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Country Breakdown */}
                  {Object.keys(walletSummary.byCountry).length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Country Breakdown</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {Object.entries(walletSummary.byCountry).map(([country, stats]) => (
                          <div key={country} className="p-3 border rounded-lg">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">
                              {country === 'BD' ? '🇧🇩 Bangladesh' : country === 'US' ? '🇺🇸 USA' : country}
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Trips:</span>
                                <span className="font-medium">{stats.trips}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Earnings:</span>
                                <span className="font-medium text-green-600">
                                  {formatCurrency(stats.earnings, country)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Commission:</span>
                                <span className="font-medium text-blue-600">
                                  {formatCurrency(stats.commission, country)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Transactions */}
                  {walletSummary.recentTransactions.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
                      <div className="space-y-2">
                        {walletSummary.recentTransactions.map((txn) => (
                          <div 
                            key={txn.id} 
                            className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                            data-testid={`transaction-${txn.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {txn.service === 'ride' ? 'Ride' : txn.service === 'food' ? 'Food' : 'Parcel'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(txn.dateTime), "PPp")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Trip Earning</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-green-600">
                                +{formatCurrency(txn.amount, walletSummary.driverCountry)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Commission: {formatCurrency(txn.commission, walletSummary.driverCountry)}
                              </p>
                            </div>
                          </div>
                        ))}
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
              <Label htmlFor="edit-postalCode">Postal Code</Label>
              <Input
                id="edit-postalCode"
                value={editForm.postalCode}
                onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                placeholder="4-6 digits (e.g., 1216)"
                data-testid="input-edit-postalCode"
              />
              <p className="text-xs text-muted-foreground">
                Must be 4-6 digits
              </p>
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
              <Label htmlFor="usa-firstName">First Name</Label>
              <Input
                id="usa-firstName"
                value={editUsaForm.firstName}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, firstName: e.target.value })}
                placeholder="Enter first name"
                data-testid="input-usa-firstName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-middleName">Middle Name (Optional)</Label>
              <Input
                id="usa-middleName"
                value={editUsaForm.middleName}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, middleName: e.target.value })}
                placeholder="Enter middle name"
                data-testid="input-usa-middleName"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usa-lastName">Last Name</Label>
              <Input
                id="usa-lastName"
                value={editUsaForm.lastName}
                onChange={(e) => setEditUsaForm({ ...editUsaForm, lastName: e.target.value })}
                placeholder="Enter last name"
                data-testid="input-usa-lastName"
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

      {/* Edit Vehicle Dialog */}
      <Dialog open={showEditVehicleDialog} onOpenChange={setShowEditVehicleDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle Information</DialogTitle>
            <DialogDescription>
              Update driver vehicle details and registration/insurance documents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="vehicle-type">Vehicle Type</Label>
              <select
                id="vehicle-type"
                value={editVehicleForm.vehicleType}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, vehicleType: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                data-testid="select-vehicle-type"
              >
                <option value="">Select type</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-make">Make</Label>
              <Input
                id="vehicle-make"
                value={editVehicleForm.make}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, make: e.target.value })}
                placeholder="e.g., Toyota, Honda"
                data-testid="input-vehicle-make"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-model">Model</Label>
              <Input
                id="vehicle-model"
                value={editVehicleForm.model}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, model: e.target.value })}
                placeholder="e.g., Camry, Accord"
                data-testid="input-vehicle-model"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-year">Year</Label>
              <Input
                id="vehicle-year"
                type="number"
                min="1900"
                max="2100"
                value={editVehicleForm.year}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, year: e.target.value })}
                placeholder="e.g., 2020"
                data-testid="input-vehicle-year"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-color">Color</Label>
              <Input
                id="vehicle-color"
                value={editVehicleForm.color}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, color: e.target.value })}
                placeholder="e.g., Black, White"
                data-testid="input-vehicle-color"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-plate">License Plate</Label>
              <Input
                id="vehicle-plate"
                value={editVehicleForm.licensePlate}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, licensePlate: e.target.value })}
                placeholder="e.g., ABC-1234"
                data-testid="input-vehicle-plate"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-registration-url">Registration Document URL</Label>
              <Input
                id="vehicle-registration-url"
                value={editVehicleForm.registrationDocumentUrl}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, registrationDocumentUrl: e.target.value })}
                placeholder="https://"
                data-testid="input-vehicle-registration-url"
              />
              <p className="text-xs text-muted-foreground">Paste the URL of the uploaded registration document</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-registration-expiry">Registration Expiry</Label>
              <Input
                id="vehicle-registration-expiry"
                type="date"
                value={editVehicleForm.registrationExpiry}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, registrationExpiry: e.target.value })}
                data-testid="input-vehicle-registration-expiry"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-insurance-url">Insurance Document URL</Label>
              <Input
                id="vehicle-insurance-url"
                value={editVehicleForm.insuranceDocumentUrl}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, insuranceDocumentUrl: e.target.value })}
                placeholder="https://"
                data-testid="input-vehicle-insurance-url"
              />
              <p className="text-xs text-muted-foreground">Paste the URL of the uploaded insurance document</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-insurance-expiry">Insurance Expiry</Label>
              <Input
                id="vehicle-insurance-expiry"
                type="date"
                value={editVehicleForm.insuranceExpiry}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, insuranceExpiry: e.target.value })}
                data-testid="input-vehicle-insurance-expiry"
              />
            </div>

            {/* DMV Inspection Fields */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold mb-3">DMV Inspection</h3>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dmv-inspection-type">Inspection Type</Label>
              <select
                id="dmv-inspection-type"
                value={editVehicleForm.dmvInspectionType}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, dmvInspectionType: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                data-testid="select-dmv-inspection-type"
              >
                <option value="">Select Type</option>
                <option value="Safety">Safety</option>
                <option value="Emissions">Emissions</option>
                <option value="Safety + Emissions">Safety + Emissions</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dmv-inspection-date">Inspection Date</Label>
              <Input
                id="dmv-inspection-date"
                type="date"
                value={editVehicleForm.dmvInspectionDate}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, dmvInspectionDate: e.target.value })}
                data-testid="input-dmv-inspection-date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dmv-inspection-expiry">Inspection Expiry</Label>
              <Input
                id="dmv-inspection-expiry"
                type="date"
                value={editVehicleForm.dmvInspectionExpiry}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, dmvInspectionExpiry: e.target.value })}
                data-testid="input-dmv-inspection-expiry"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dmv-inspection-url">Inspection Document URL</Label>
              <Input
                id="dmv-inspection-url"
                value={editVehicleForm.dmvInspectionImageUrl}
                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, dmvInspectionImageUrl: e.target.value })}
                placeholder="https://"
                data-testid="input-dmv-inspection-url"
              />
              <p className="text-xs text-muted-foreground">Paste the URL of the uploaded DMV inspection document</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditVehicleDialog(false)}
              disabled={updateVehicleMutation.isPending}
              data-testid="button-cancel-vehicle-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateVehicleMutation.mutate(editVehicleForm)}
              disabled={updateVehicleMutation.isPending}
              data-testid="button-save-vehicle-edit"
            >
              {updateVehicleMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
