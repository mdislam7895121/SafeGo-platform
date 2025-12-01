import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, User, Mail, Calendar, Lock, Trash2, Upload, Phone, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, uploadWithAuth } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ManageAccount() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editEmailOpen, setEditEmailOpen] = useState(false);
  const [editPhoneOpen, setEditPhoneOpen] = useState(false);
  const [editDobOpen, setEditDobOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const countryCode = profile?.countryCode;
  const isUSDriver = countryCode === "US";
  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || "Driver";
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Update name mutation
  const updateNameMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("/api/driver/profile/name", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({ title: "Name updated successfully" });
      setEditNameOpen(false);
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setFullName("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update name",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update email mutation
  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const result = await apiRequest("/api/driver/email", {
        method: "PATCH",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({ title: "Email updated successfully" });
      setEditEmailOpen(false);
      setEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update phone mutation
  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const result = await apiRequest("/api/driver/profile/phone", {
        method: "PATCH",
        body: JSON.stringify({ phoneNumber: phone }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({ title: "Phone number updated successfully" });
      setEditPhoneOpen(false);
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update phone number",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update date of birth mutation
  const updateDobMutation = useMutation({
    mutationFn: async (dob: string) => {
      const result = await apiRequest("/api/driver/profile/dob", {
        method: "PATCH",
        body: JSON.stringify({ dateOfBirth: dob }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({ title: "Date of birth updated successfully" });
      setEditDobOpen(false);
      setDateOfBirth("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update date of birth",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const result = await apiRequest("/api/driver/password", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to change password",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Upload profile photo mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const data = await uploadWithAuth("/api/driver/upload/profile-photo", formData);
      if (!data?.success) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({ title: "Profile photo updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to upload photo",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (password: string) => {
      const result = await apiRequest("/api/driver/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
      });
      return result;
    },
    onSuccess: () => {
      toast({ title: "Account deleted successfully" });
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete account",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleEditName = () => {
    if (isUSDriver) {
      setFirstName(profile?.firstName || "");
      setMiddleName(profile?.middleName || "");
      setLastName(profile?.lastName || "");
    } else {
      setFullName(profile?.fullName || "");
    }
    setEditNameOpen(true);
  };

  const handleSaveName = () => {
    if (isUSDriver) {
      if (!firstName.trim() || !lastName.trim()) {
        toast({
          title: "Validation error",
          description: "First name and last name are required",
          variant: "destructive",
        });
        return;
      }
      updateNameMutation.mutate({ firstName, middleName, lastName });
    } else {
      if (!fullName.trim()) {
        toast({
          title: "Validation error",
          description: "Full name is required",
          variant: "destructive",
        });
        return;
      }
      updateNameMutation.mutate({ fullName });
    }
  };

  const handleEditEmail = () => {
    setEmail(profile?.email || "");
    setEditEmailOpen(true);
  };

  const handleSaveEmail = () => {
    if (!email.trim()) {
      toast({
        title: "Validation error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    updateEmailMutation.mutate(email);
  };

  const handleEditPhone = () => {
    setPhoneNumber(profile?.phoneNumber || "");
    setEditPhoneOpen(true);
  };

  /**
   * Normalize phone number to E.164 format
   * @param raw - Raw phone input
   * @param country - User's country code (US or BD)
   * @returns Normalized E.164 phone number or null if invalid
   */
  const normalizePhoneInput = (raw: string, country: string | undefined): { normalized: string | null; error: string | null } => {
    // Remove spaces, dashes, parentheses, and dots
    const cleaned = raw.replace(/[\s\-\(\)\.]/g, "");
    
    // If already starts with +, validate and return
    if (cleaned.startsWith("+")) {
      // Validate E.164: + followed by 7-15 digits
      if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
        return { normalized: cleaned, error: null };
      }
      return { normalized: null, error: "Invalid phone format. Please include country code (e.g., +1 555 123 4567)" };
    }
    
    // Auto-format based on country
    if (country === "US") {
      // US: 10 digits without country code → prepend +1
      if (/^\d{10}$/.test(cleaned)) {
        return { normalized: `+1${cleaned}`, error: null };
      }
      // US: 11 digits starting with 1 → prepend +
      if (/^1\d{10}$/.test(cleaned)) {
        return { normalized: `+${cleaned}`, error: null };
      }
      return { normalized: null, error: "For US numbers, enter 10 digits (e.g., 9293369016) or include +1" };
    }
    
    if (country === "BD") {
      // BD: 10-11 digits starting with 01 → convert to +880
      if (/^01[3-9]\d{8}$/.test(cleaned)) {
        return { normalized: `+880${cleaned.substring(1)}`, error: null };
      }
      // BD: 10 digits starting with 1 (without leading 0) → prepend +880
      if (/^1[3-9]\d{8}$/.test(cleaned)) {
        return { normalized: `+880${cleaned}`, error: null };
      }
      return { normalized: null, error: "For BD numbers, enter 11 digits starting with 01 (e.g., 01712345678) or include +880" };
    }
    
    // Generic: require + prefix for other countries
    return { normalized: null, error: "Please include country code starting with + (e.g., +44 20 7946 0958)" };
  };

  const handleSavePhone = () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Validation error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }
    
    // Normalize phone number to E.164 format
    const { normalized, error } = normalizePhoneInput(phoneNumber, countryCode);
    
    if (error || !normalized) {
      toast({
        title: "Invalid phone number",
        description: error || "Please enter a valid phone number with country code",
        variant: "destructive",
      });
      return;
    }
    
    updatePhoneMutation.mutate(normalized);
  };

  const handleEditDob = () => {
    if (profile?.dateOfBirth) {
      const date = new Date(profile.dateOfBirth);
      setDateOfBirth(date.toISOString().split('T')[0]);
    } else {
      setDateOfBirth("");
    }
    setEditDobOpen(true);
  };

  const handleSaveDob = () => {
    if (!dateOfBirth.trim()) {
      toast({
        title: "Validation error",
        description: "Date of birth is required",
        variant: "destructive",
      });
      return;
    }
    updateDobMutation.mutate(dateOfBirth);
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Validation error",
        description: "All password fields are required",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Validation error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose a file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please choose an image file (JPG or PNG)",
        variant: "destructive",
      });
      return;
    }

    uploadPhotoMutation.mutate(file);
  };

  const handleDeleteAccount = () => {
    if (!deletePassword.trim()) {
      toast({
        title: "Validation error",
        description: "Password is required to delete account",
        variant: "destructive",
      });
      return;
    }
    deleteAccountMutation.mutate(deletePassword);
  };

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Link href="/driver/account">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Manage Account</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">JPG or PNG. Max size 5MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhotoMutation.isPending}
                data-testid="button-change-photo"
              >
                {uploadPhotoMutation.isPending ? "Uploading..." : <><Upload className="h-4 w-4 mr-2" />Change Photo</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-full-name">{driverName}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleEditName} data-testid="button-edit-name">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-email">{profile?.email}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleEditEmail} data-testid="button-edit-email">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-phone">{profile?.phoneNumber || "Not set"}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleEditPhone} data-testid="button-edit-phone">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <Cake className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-dob">
                    {profile?.dateOfBirth 
                      ? new Date(profile.dateOfBirth).toLocaleDateString() 
                      : "Not set"}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleEditDob} data-testid="button-edit-dob">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Member Since</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-member-since">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setChangePasswordOpen(true)}
              data-testid="button-change-password"
            >
              <Lock className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>These actions cannot be undone</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteAccountOpen(true)}
              data-testid="button-delete-account"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent data-testid="dialog-edit-name">
          <DialogHeader>
            <DialogTitle>Edit Name</DialogTitle>
            <DialogDescription>Update your display name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isUSDriver ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name (Optional)</Label>
                  <Input
                    id="middleName"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Michael"
                    data-testid="input-middle-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    data-testid="input-last-name"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  data-testid="input-full-name"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameOpen(false)} data-testid="button-cancel-name">
              Cancel
            </Button>
            <Button onClick={handleSaveName} disabled={updateNameMutation.isPending} data-testid="button-save-name">
              {updateNameMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={editEmailOpen} onOpenChange={setEditEmailOpen}>
        <DialogContent data-testid="dialog-edit-email">
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
            <DialogDescription>Update your email address</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                data-testid="input-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmailOpen(false)} data-testid="button-cancel-email">
              Cancel
            </Button>
            <Button onClick={handleSaveEmail} disabled={updateEmailMutation.isPending} data-testid="button-save-email">
              {updateEmailMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Phone Dialog */}
      <Dialog open={editPhoneOpen} onOpenChange={setEditPhoneOpen}>
        <DialogContent data-testid="dialog-edit-phone">
          <DialogHeader>
            <DialogTitle>Edit Phone Number</DialogTitle>
            <DialogDescription>Update your phone number in international format</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={isUSDriver ? "+1 555 123 4567" : "+880 1XXXXXXXXX"}
                data-testid="input-phone"
              />
              <p className="text-xs text-muted-foreground">
                {isUSDriver 
                  ? "Enter your number in E.164 format: +1 followed by 10 digits (e.g., +1 555 123 4567)"
                  : countryCode === "BD"
                    ? "Enter your number in E.164 format: +880 followed by 10 digits (e.g., +880 1712345678)"
                    : "Enter your number with country code starting with + (e.g., +1234567890)"
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhoneOpen(false)} data-testid="button-cancel-phone">
              Cancel
            </Button>
            <Button onClick={handleSavePhone} disabled={updatePhoneMutation.isPending} data-testid="button-save-phone">
              {updatePhoneMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Date of Birth Dialog */}
      <Dialog open={editDobOpen} onOpenChange={setEditDobOpen}>
        <DialogContent data-testid="dialog-edit-dob">
          <DialogHeader>
            <DialogTitle>Edit Date of Birth</DialogTitle>
            <DialogDescription>Update your date of birth for identity verification</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                data-testid="input-dob"
              />
              <p className="text-xs text-muted-foreground">
                You must be at least 18 years old to drive with SafeGo. Your date of birth is used for identity verification.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDobOpen(false)} data-testid="button-cancel-dob">
              Cancel
            </Button>
            <Button onClick={handleSaveDob} disabled={updateDobMutation.isPending} data-testid="button-save-dob">
              {updateDobMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent data-testid="dialog-change-password">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)} data-testid="button-cancel-password">
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changePasswordMutation.isPending} data-testid="button-save-password">
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Alert Dialog */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent data-testid="dialog-delete-account">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="deletePassword">Enter your password to confirm *</Label>
            <Input
              id="deletePassword"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              data-testid="input-delete-password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
