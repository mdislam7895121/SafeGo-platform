import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, User, Shield, Edit, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

export default function DriverProfile() {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNid, setShowNid] = useState(false);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  // Fetch Bangladesh identity data
  const { data: bdIdentity, isLoading: bdLoading } = useQuery({
    queryKey: ["/api/driver/bd-identity"],
    enabled: (driverData as any)?.profile?.countryCode === "BD",
  });

  // Fetch decrypted NID
  const { data: nidData } = useQuery({
    queryKey: ["/api/driver/nid"],
    enabled: showNid && (driverData as any)?.profile?.countryCode === "BD",
  });

  // Edit form state
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

  // Update BD identity mutation
  const updateBdIdentityMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const response = await apiRequest("PUT", "/api/driver/bd-identity", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bangladesh identity updated successfully",
      });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/driver/bd-identity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update Bangladesh identity",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleEditClick = () => {
    if (bdIdentity) {
      setEditForm({
        fullName: (bdIdentity as any).fullName || "",
        fatherName: (bdIdentity as any).fatherName || "",
        phoneNumber: (bdIdentity as any).phoneNumber || "",
        village: (bdIdentity as any).village || "",
        postOffice: (bdIdentity as any).postOffice || "",
        thana: (bdIdentity as any).thana || "",
        district: (bdIdentity as any).district || "",
        presentAddress: (bdIdentity as any).presentAddress || "",
        permanentAddress: (bdIdentity as any).permanentAddress || "",
        nid: "", // Leave empty - NID is optional, only update if user enters a new one
      });
    }
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    // Only include NID in payload if it's actually provided
    const payload = {
      ...editForm,
      // Remove NID from payload if it's empty (allows editing other fields without re-entering NID)
      nid: editForm.nid.trim() ? editForm.nid.trim() : undefined,
    };
    updateBdIdentityMutation.mutate(payload as typeof editForm);
  };

  const handleToggleNid = () => {
    setShowNid(!showNid);
  };

  const displayNid = showNid && nidData ? (nidData as any).nid : "••••••••";

  // Early return for loading state - AFTER all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const profile = (driverData as any)?.profile;
  const isBangladesh = profile?.countryCode === "BD";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/driver">
            <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium" data-testid="text-email">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Country</p>
              <p className="font-medium" data-testid="text-country">
                {profile?.countryCode === "BD" ? "🇧🇩 Bangladesh" : "🇺🇸 United States"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verification Status</p>
              <Badge variant={profile?.isVerified ? "default" : "secondary"} data-testid="badge-verification">
                {profile?.verificationStatus || "pending"}
              </Badge>
            </div>
            {profile?.rejectionReason && (
              <div className="bg-destructive/10 p-3 rounded-lg">
                <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
                <p className="text-sm">{profile.rejectionReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bangladesh Identity Information */}
        {isBangladesh && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Bangladesh Identity Information
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleEditClick}
                  data-testid="button-edit-profile"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bdLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : bdIdentity ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium" data-testid="text-fullname">
                      {(bdIdentity as any).fullName || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Father's Name</p>
                    <p className="font-medium" data-testid="text-fathername">
                      {(bdIdentity as any).fatherName || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium" data-testid="text-phone">
                      {(bdIdentity as any).phoneNumber || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Village</p>
                    <p className="font-medium" data-testid="text-village">
                      {(bdIdentity as any).village || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Post Office</p>
                    <p className="font-medium" data-testid="text-postoffice">
                      {(bdIdentity as any).postOffice || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Thana</p>
                    <p className="font-medium" data-testid="text-thana">
                      {(bdIdentity as any).thana || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">District</p>
                    <p className="font-medium" data-testid="text-district">
                      {(bdIdentity as any).district || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Present Address</p>
                    <p className="font-medium" data-testid="text-presentaddress">
                      {(bdIdentity as any).presentAddress || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Permanent Address</p>
                    <p className="font-medium" data-testid="text-permanentaddress">
                      {(bdIdentity as any).permanentAddress || "Not provided"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">National ID (NID)</p>
                        <p className="font-medium font-mono" data-testid="text-nid">
                          {displayNid}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleToggleNid}
                        data-testid="button-toggle-nid"
                      >
                        {showNid ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Show NID
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {((bdIdentity as any).nidFrontImageUrl || (bdIdentity as any).nidBackImageUrl) && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-2">NID Images</p>
                      <div className="flex gap-2">
                        {(bdIdentity as any).nidFrontImageUrl && (
                          <a
                            href={(bdIdentity as any).nidFrontImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            NID Front <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {(bdIdentity as any).nidBackImageUrl && (
                          <a
                            href={(bdIdentity as any).nidBackImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            NID Back <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Complete your Bangladesh identity details to speed up KYC approval.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={handleEditClick}
                    data-testid="button-complete-profile"
                  >
                    Complete Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bangladesh Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-fullName">Full Name *</Label>
                <Input
                  id="edit-fullName"
                  data-testid="input-edit-fullName"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="edit-fatherName">Father's Name *</Label>
                <Input
                  id="edit-fatherName"
                  data-testid="input-edit-fatherName"
                  value={editForm.fatherName}
                  onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                  placeholder="Enter father's name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phoneNumber">Phone Number *</Label>
                <Input
                  id="edit-phoneNumber"
                  data-testid="input-edit-phoneNumber"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div>
                <Label htmlFor="edit-nid">National ID (NID)</Label>
                <Input
                  id="edit-nid"
                  data-testid="input-edit-nid"
                  value={editForm.nid}
                  onChange={(e) => setEditForm({ ...editForm, nid: e.target.value })}
                  placeholder="10, 13, or 17 digits"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to keep your existing NID. Only enter if you want to update it.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-village">Village *</Label>
                <Input
                  id="edit-village"
                  data-testid="input-edit-village"
                  value={editForm.village}
                  onChange={(e) => setEditForm({ ...editForm, village: e.target.value })}
                  placeholder="Enter village"
                />
              </div>
              <div>
                <Label htmlFor="edit-postOffice">Post Office *</Label>
                <Input
                  id="edit-postOffice"
                  data-testid="input-edit-postOffice"
                  value={editForm.postOffice}
                  onChange={(e) => setEditForm({ ...editForm, postOffice: e.target.value })}
                  placeholder="Enter post office"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-thana">Thana *</Label>
                <Input
                  id="edit-thana"
                  data-testid="input-edit-thana"
                  value={editForm.thana}
                  onChange={(e) => setEditForm({ ...editForm, thana: e.target.value })}
                  placeholder="Enter thana"
                />
              </div>
              <div>
                <Label htmlFor="edit-district">District *</Label>
                <Input
                  id="edit-district"
                  data-testid="input-edit-district"
                  value={editForm.district}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                  placeholder="Enter district"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-presentAddress">Present Address *</Label>
              <Textarea
                id="edit-presentAddress"
                data-testid="input-edit-presentAddress"
                value={editForm.presentAddress}
                onChange={(e) => setEditForm({ ...editForm, presentAddress: e.target.value })}
                placeholder="Enter current address"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-permanentAddress">Permanent Address *</Label>
              <Textarea
                id="edit-permanentAddress"
                data-testid="input-edit-permanentAddress"
                value={editForm.permanentAddress}
                onChange={(e) => setEditForm({ ...editForm, permanentAddress: e.target.value })}
                placeholder="Enter permanent address"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateBdIdentityMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateBdIdentityMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
