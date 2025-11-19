import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Filter, FileText, Eye, Check, X, Car, Users, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Driver {
  id: string;
  userId: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  hasProfilePhoto: boolean;
  hasNID: boolean;
  hasDMVLicense: boolean;
  hasTLCLicense: boolean;
  vehicleDocuments: number;
  isComplete: boolean;
  missingFields: string[];
  lastUpdated: string;
}

interface Customer {
  id: string;
  userId: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  hasNID: boolean;
  hasNIDImages: boolean;
  fullName: string | null;
  fatherName: string | null;
  phoneNumber: string | null;
  village: string | null;
  postOffice: string | null;
  thana: string | null;
  district: string | null;
  lastUpdated: string;
}

interface Restaurant {
  id: string;
  userId: string;
  email: string;
  restaurantName: string;
  address: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  lastUpdated: string;
}

interface PaginatedResponse<T> {
  drivers?: T[];
  customers?: T[];
  restaurants?: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface DocumentDetails {
  id: string;
  email: string;
  countryCode: string;
  verificationStatus: string;
  isVerified: boolean;
  rejectionReason: string | null;
  profilePhotoUrl?: string;
  fullName?: string | null;
  fatherName?: string | null;
  phoneNumber?: string | null;
  village?: string | null;
  postOffice?: string | null;
  thana?: string | null;
  district?: string | null;
  nidFrontImageUrl?: string | null;
  nidBackImageUrl?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  usaState?: string | null;
  dmvLicenseImageUrl?: string | null;
  tlcLicenseImageUrl?: string | null;
  vehicleDocuments?: Array<{
    id: string;
    documentType: string;
    fileUrl: string;
    description: string | null;
    uploadedAt: string;
    expiresAt: string | null;
  }>;
  restaurantName?: string;
  address?: string;
  isComplete?: boolean;
  missingFields?: string[];
  lastUpdated: string;
}

export default function AdminDocumentCenter() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"drivers" | "customers" | "restaurants">("drivers");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    type: "drivers" | "customers" | "restaurants";
    id: string | null;
  }>({
    open: false,
    type: "drivers",
    id: null,
  });

  // Parse URL query parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    const statusParam = urlParams.get("status");
    const countryParam = urlParams.get("country");
    const searchParam = urlParams.get("search");
    const pageParam = urlParams.get("page");
    
    if (tabParam && (tabParam === "drivers" || tabParam === "customers" || tabParam === "restaurants")) {
      setActiveTab(tabParam);
    }
    if (statusParam) setStatusFilter(statusParam);
    if (countryParam) setCountryFilter(countryParam);
    if (searchParam) setSearchQuery(searchParam);
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, []);

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("search", searchQuery);
  if (countryFilter !== "all") queryParams.append("country", countryFilter);
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", "20");

  const queryString = queryParams.toString();
  const fullUrl = `/api/admin/documents/${activeTab}${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<PaginatedResponse<Driver | Customer | Restaurant>>({
    queryKey: [fullUrl],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch document details for review
  const { data: documentDetails, isLoading: isLoadingDetails } = useQuery<DocumentDetails>({
    queryKey: [`/api/admin/documents/${reviewDialog.type}/${reviewDialog.id}/details`],
    enabled: reviewDialog.open && !!reviewDialog.id,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      return apiRequest("POST", `/api/admin/documents/${type}/${id}/approve`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Documents approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/documents/${reviewDialog.type}`] });
      setReviewDialog({ open: false, type: "drivers", id: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve documents",
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ type, id, reason }: { type: string; id: string; reason?: string }) => {
      return apiRequest("POST", `/api/admin/documents/${type}/${id}/reject`, { reason });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Documents rejected",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/documents/${reviewDialog.type}`] });
      setReviewDialog({ open: false, type: "drivers", id: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject documents",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate({ type: reviewDialog.type, id });
  };

  const handleReject = (id: string) => {
    const reason = prompt("Enter rejection reason (optional):");
    rejectMutation.mutate({ type: reviewDialog.type, id, reason: reason || undefined });
  };

  const getStatusBadge = (verificationStatus: string) => {
    switch (verificationStatus) {
      case "approved":
        return <Badge className="bg-green-500" data-testid="badge-status-approved">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-status-pending">Pending Review</Badge>;
    }
  };

  const getCountryBadge = (countryCode: string) => {
    switch (countryCode) {
      case "BD":
        return <Badge variant="outline" data-testid={`badge-country-bd`}>Bangladesh</Badge>;
      case "US":
        return <Badge variant="outline" data-testid={`badge-country-us`}>United States</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-country-${countryCode.toLowerCase()}`}>{countryCode}</Badge>;
    }
  };

  const renderDriversTab = () => {
    const drivers = (data?.drivers || []) as Driver[];

    return (
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </>
        ) : drivers.length > 0 ? (
          drivers.map((driver) => (
            <Card key={driver.id} className="hover-elevate" data-testid={`card-driver-${driver.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-semibold truncate" data-testid={`text-email-${driver.id}`}>
                        {driver.email}
                      </p>
                      {getCountryBadge(driver.countryCode)}
                      {getStatusBadge(driver.verificationStatus)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                      <div>
                        <p className="text-muted-foreground">Profile Photo</p>
                        <p className="font-medium" data-testid={`text-profile-photo-${driver.id}`}>
                          {driver.hasProfilePhoto ? "✓ Uploaded" : "✗ Missing"}
                        </p>
                      </div>
                      {driver.countryCode === "BD" && (
                        <div>
                          <p className="text-muted-foreground">NID</p>
                          <p className="font-medium" data-testid={`text-nid-${driver.id}`}>
                            {driver.hasNID ? "✓ Uploaded" : "✗ Missing"}
                          </p>
                        </div>
                      )}
                      {driver.countryCode === "US" && (
                        <>
                          <div>
                            <p className="text-muted-foreground">DMV License</p>
                            <p className="font-medium" data-testid={`text-dmv-${driver.id}`}>
                              {driver.hasDMVLicense ? "✓ Uploaded" : "✗ Missing"}
                            </p>
                          </div>
                          {driver.hasTLCLicense !== null && (
                            <div>
                              <p className="text-muted-foreground">TLC License</p>
                              <p className="font-medium" data-testid={`text-tlc-${driver.id}`}>
                                {driver.hasTLCLicense ? "✓ Uploaded" : "✗ Missing"}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <p className="text-muted-foreground">Vehicle Docs</p>
                        <p className="font-medium" data-testid={`text-vehicle-docs-${driver.id}`}>
                          {driver.vehicleDocuments} file(s)
                        </p>
                      </div>
                    </div>

                    {driver.missingFields.length > 0 && (
                      <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950 rounded-md">
                        <p className="text-xs text-orange-800 dark:text-orange-200" data-testid={`text-missing-fields-${driver.id}`}>
                          <strong>Missing:</strong> {driver.missingFields.join(", ")}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {format(new Date(driver.lastUpdated), "PPp")}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReviewDialog({ open: true, type: "drivers", id: driver.id })}
                    data-testid={`button-review-${driver.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <Car className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No drivers found</p>
          </div>
        )}
      </div>
    );
  };

  const renderCustomersTab = () => {
    const customers = (data?.customers || []) as Customer[];

    return (
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </>
        ) : customers.length > 0 ? (
          customers.map((customer) => (
            <Card key={customer.id} className="hover-elevate" data-testid={`card-customer-${customer.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-semibold truncate" data-testid={`text-email-${customer.id}`}>
                        {customer.email}
                      </p>
                      {getCountryBadge(customer.countryCode)}
                      {getStatusBadge(customer.verificationStatus)}
                    </div>

                    {customer.countryCode === "BD" && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-2">
                        <div>
                          <p className="text-muted-foreground">Full Name</p>
                          <p className="font-medium" data-testid={`text-fullname-${customer.id}`}>
                            {customer.fullName || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">NID</p>
                          <p className="font-medium" data-testid={`text-nid-${customer.id}`}>
                            {customer.hasNID ? "✓ Provided" : "✗ Missing"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">NID Images</p>
                          <p className="font-medium" data-testid={`text-nid-images-${customer.id}`}>
                            {customer.hasNIDImages ? "✓ Uploaded" : "✗ Missing"}
                          </p>
                        </div>
                      </div>
                    )}

                    {customer.countryCode !== "BD" && (
                      <p className="text-sm text-muted-foreground">No documents required</p>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {format(new Date(customer.lastUpdated), "PPp")}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReviewDialog({ open: true, type: "customers", id: customer.id })}
                    data-testid={`button-review-${customer.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No customers found</p>
          </div>
        )}
      </div>
    );
  };

  const renderRestaurantsTab = () => {
    const restaurants = (data?.restaurants || []) as Restaurant[];

    return (
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </>
        ) : restaurants.length > 0 ? (
          restaurants.map((restaurant) => (
            <Card key={restaurant.id} className="hover-elevate" data-testid={`card-restaurant-${restaurant.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-semibold truncate" data-testid={`text-restaurant-name-${restaurant.id}`}>
                        {restaurant.restaurantName}
                      </p>
                      {getCountryBadge(restaurant.countryCode)}
                      {getStatusBadge(restaurant.verificationStatus)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium truncate" data-testid={`text-email-${restaurant.id}`}>
                          {restaurant.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Address</p>
                        <p className="font-medium truncate" data-testid={`text-address-${restaurant.id}`}>
                          {restaurant.address}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {format(new Date(restaurant.lastUpdated), "PPp")}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReviewDialog({ open: true, type: "restaurants", id: restaurant.id })}
                    data-testid={`button-review-${restaurant.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No restaurants found</p>
          </div>
        )}
      </div>
    );
  };

  const renderReviewDialog = () => {
    if (!documentDetails) return null;

    return (
      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-review">
          <DialogHeader>
            <DialogTitle>Document Review</DialogTitle>
            <DialogDescription>
              Review and verify all submitted documents
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="detail-email">{documentDetails.email}</p>
                  </div>
                  {documentDetails.restaurantName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Restaurant Name</p>
                      <p className="font-medium" data-testid="detail-restaurant-name">{documentDetails.restaurantName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium" data-testid="detail-country">{documentDetails.countryCode === "BD" ? "Bangladesh" : documentDetails.countryCode === "US" ? "United States" : documentDetails.countryCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(documentDetails.verificationStatus)}
                  </div>
                  {documentDetails.rejectionReason && (
                    <div>
                      <p className="text-sm text-muted-foreground">Rejection Reason</p>
                      <p className="font-medium text-destructive" data-testid="detail-rejection-reason">{documentDetails.rejectionReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Driver/Customer Identity Fields */}
              {(documentDetails.fullName || documentDetails.firstName) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Identity Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    {documentDetails.countryCode === "BD" && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Full Name</p>
                          <p className="font-medium" data-testid="detail-fullname">{documentDetails.fullName || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Father's Name</p>
                          <p className="font-medium" data-testid="detail-fathername">{documentDetails.fatherName || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium" data-testid="detail-phone">{documentDetails.phoneNumber || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Village</p>
                          <p className="font-medium" data-testid="detail-village">{documentDetails.village || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Post Office</p>
                          <p className="font-medium" data-testid="detail-postoffice">{documentDetails.postOffice || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Thana</p>
                          <p className="font-medium" data-testid="detail-thana">{documentDetails.thana || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">District</p>
                          <p className="font-medium" data-testid="detail-district">{documentDetails.district || "N/A"}</p>
                        </div>
                      </>
                    )}
                    {documentDetails.countryCode === "US" && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">First Name</p>
                          <p className="font-medium" data-testid="detail-firstname">{documentDetails.firstName || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Middle Name</p>
                          <p className="font-medium" data-testid="detail-middlename">{documentDetails.middleName || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Last Name</p>
                          <p className="font-medium" data-testid="detail-lastname">{documentDetails.lastName || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">State</p>
                          <p className="font-medium" data-testid="detail-state">{documentDetails.usaState || "N/A"}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Document Images */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Document Images</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {documentDetails.profilePhotoUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Profile Photo</p>
                      <img 
                        src={documentDetails.profilePhotoUrl} 
                        alt="Profile" 
                        className="w-32 h-32 object-cover rounded-lg border"
                        data-testid="image-profile-photo"
                      />
                    </div>
                  )}
                  {documentDetails.nidFrontImageUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">NID Front</p>
                      <img 
                        src={documentDetails.nidFrontImageUrl} 
                        alt="NID Front" 
                        className="max-w-md w-full rounded-lg border"
                        data-testid="image-nid-front"
                      />
                    </div>
                  )}
                  {documentDetails.nidBackImageUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">NID Back</p>
                      <img 
                        src={documentDetails.nidBackImageUrl} 
                        alt="NID Back" 
                        className="max-w-md w-full rounded-lg border"
                        data-testid="image-nid-back"
                      />
                    </div>
                  )}
                  {documentDetails.dmvLicenseImageUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">DMV Driver License</p>
                      <img 
                        src={documentDetails.dmvLicenseImageUrl} 
                        alt="DMV License" 
                        className="max-w-md w-full rounded-lg border"
                        data-testid="image-dmv-license"
                      />
                    </div>
                  )}
                  {documentDetails.tlcLicenseImageUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">TLC License</p>
                      <img 
                        src={documentDetails.tlcLicenseImageUrl} 
                        alt="TLC License" 
                        className="max-w-md w-full rounded-lg border"
                        data-testid="image-tlc-license"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vehicle Documents */}
              {documentDetails.vehicleDocuments && documentDetails.vehicleDocuments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Vehicle Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {documentDetails.vehicleDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`vehicle-doc-${doc.id}`}>
                          <div>
                            <p className="font-medium capitalize">{doc.documentType}</p>
                            {doc.description && (
                              <p className="text-sm text-muted-foreground">{doc.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Uploaded: {format(new Date(doc.uploadedAt), "PPp")}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                            data-testid={`button-view-doc-${doc.id}`}
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Missing Fields Warning */}
              {documentDetails.missingFields && documentDetails.missingFields.length > 0 && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader>
                    <CardTitle className="text-base text-orange-600 dark:text-orange-400">Missing Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {documentDetails.missingFields.map((field, idx) => (
                        <li key={idx} className="text-sm" data-testid={`missing-field-${idx}`}>{field}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setReviewDialog({ open: false, type: "drivers", id: null })}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => reviewDialog.id && handleReject(reviewDialog.id)}
                  disabled={rejectMutation.isPending}
                  data-testid="button-reject"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={() => reviewDialog.id && handleApprove(reviewDialog.id)}
                  disabled={approveMutation.isPending || (documentDetails.missingFields && documentDetails.missingFields.length > 0)}
                  data-testid="button-approve"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Document Center</h1>
            <p className="text-sm opacity-90">Review and manage uploaded verification documents</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    activeTab === "drivers"
                      ? "Search by driver email..."
                      : activeTab === "customers"
                      ? "Search by customer email..."
                      : "Search by restaurant email..."
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={countryFilter} onValueChange={(value) => { setCountryFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
                {data && (
                  <Badge variant="secondary" data-testid="text-total-count">
                    {data.pagination.total} total
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "drivers" | "customers" | "restaurants")}>
              <TabsList className="grid w-full grid-cols-3 mb-6" data-testid="tabs-list">
                <TabsTrigger value="drivers" data-testid="tab-drivers">
                  <Car className="h-4 w-4 mr-2" />
                  Drivers
                </TabsTrigger>
                <TabsTrigger value="customers" data-testid="tab-customers">
                  <Users className="h-4 w-4 mr-2" />
                  Customers
                </TabsTrigger>
                <TabsTrigger value="restaurants" data-testid="tab-restaurants">
                  <UtensilsCrossed className="h-4 w-4 mr-2" />
                  Restaurants
                </TabsTrigger>
              </TabsList>

              <TabsContent value="drivers" data-testid="content-drivers">
                {renderDriversTab()}
              </TabsContent>

              <TabsContent value="customers" data-testid="content-customers">
                {renderCustomersTab()}
              </TabsContent>

              <TabsContent value="restaurants" data-testid="content-restaurants">
                {renderRestaurantsTab()}
              </TabsContent>
            </Tabs>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === data.pagination.totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      {renderReviewDialog()}
    </div>
  );
}
