import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Car, Package, UtensilsCrossed, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Step = 1 | 2 | 3 | 4;

interface RegistrationData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  countryCode: string;
  // BD Address
  presentAddress: string;
  permanentAddress: string;
  district: string;
  thana: string;
  postOffice: string;
  postalCode: string;
  village: string;
  // US Address
  homeAddress: string;
  // BD KYC
  fatherName: string;
  dateOfBirth: string;
  nidNumber: string;
  nidFrontImageUrl: string;
  nidBackImageUrl: string;
  // US KYC
  governmentIdType: string;
  governmentIdLast4: string;
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export default function CustomerRegister() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState<RegistrationData>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    countryCode: "",
    presentAddress: "",
    permanentAddress: "",
    district: "",
    thana: "",
    postOffice: "",
    postalCode: "",
    village: "",
    homeAddress: "",
    fatherName: "",
    dateOfBirth: "",
    nidNumber: "",
    nidFrontImageUrl: "",
    nidBackImageUrl: "",
    governmentIdType: "",
    governmentIdLast4: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
  });

  const updateFormData = (field: keyof RegistrationData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(4, prev + 1) as Step);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) {
      if (!formData.fullName || !formData.email || !formData.phone || !formData.password || !formData.countryCode) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return false;
      }
      if (formData.password.length < 6) {
        toast({
          title: "Invalid password",
          description: "Password must be at least 6 characters",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (formData.countryCode === "BD") {
        if (!formData.presentAddress || !formData.permanentAddress || !formData.district || !formData.thana) {
          toast({
            title: "Missing information",
            description: "Please fill in all required address fields",
            variant: "destructive",
          });
          return false;
        }
      } else if (formData.countryCode === "US") {
        if (!formData.homeAddress) {
          toast({
            title: "Missing information",
            description: "Please enter your home address",
            variant: "destructive",
          });
          return false;
        }
      }
      return true;
    }

    if (currentStep === 3) {
      if (formData.countryCode === "BD") {
        if (!formData.fatherName || !formData.dateOfBirth || !formData.nidNumber) {
          toast({
            title: "Missing KYC information",
            description: "Please fill in all required KYC fields for Bangladesh",
            variant: "destructive",
          });
          return false;
        }
      } else if (formData.countryCode === "US") {
        if (!formData.dateOfBirth || !formData.governmentIdType || !formData.governmentIdLast4) {
          toast({
            title: "Missing KYC information",
            description: "Please fill in all required KYC fields for United States",
            variant: "destructive",
          });
          return false;
        }
      }
      return true;
    }

    if (currentStep === 4) {
      if (!formData.emergencyContactName || !formData.emergencyContactPhone) {
        toast({
          title: "Missing information",
          description: "Please provide emergency contact details",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create user account
      const signupResponse = await apiRequest("POST", "/api/auth/signup", {
        email: formData.email,
        password: formData.password,
        role: "customer",
        countryCode: formData.countryCode,
      });

      // Step 2: Login to get token
      const loginResponse: any = await apiRequest("POST", "/api/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      // Store token
      localStorage.setItem("token", loginResponse.token);

      // Step 3: Update customer profile with all KYC data
      const profileData: any = {
        fullName: formData.fullName,
        phoneNumber: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
      };

      if (formData.countryCode === "BD") {
        profileData.fatherName = formData.fatherName;
        profileData.presentAddress = formData.presentAddress;
        profileData.permanentAddress = formData.permanentAddress;
        profileData.district = formData.district;
        profileData.thana = formData.thana;
        profileData.postOffice = formData.postOffice;
        profileData.postalCode = formData.postalCode;
        profileData.village = formData.village;
        profileData.nidNumber = formData.nidNumber;
        if (formData.nidFrontImageUrl) profileData.nidFrontImageUrl = formData.nidFrontImageUrl;
        if (formData.nidBackImageUrl) profileData.nidBackImageUrl = formData.nidBackImageUrl;
      } else if (formData.countryCode === "US") {
        profileData.homeAddress = formData.homeAddress;
        profileData.governmentIdType = formData.governmentIdType;
        profileData.governmentIdLast4 = formData.governmentIdLast4;
      }

      await apiRequest("PATCH", "/api/customer/profile", profileData);

      toast({
        title: "Registration successful!",
        description: "Your account is pending verification. You'll be notified once approved.",
      });

      // Redirect to customer dashboard
      setTimeout(() => {
        window.location.href = "/customer";
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Basic Information";
      case 2:
        return "Address Details";
      case 3:
        return "Identity Verification (KYC)";
      case 4:
        return "Emergency Contact";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Logo and branding */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex gap-1">
              <Car className="h-8 w-8 text-primary" />
              <UtensilsCrossed className="h-8 w-8 text-primary" />
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">SafeGo</h1>
          <p className="text-muted-foreground mt-2">Join as a Customer</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full ${
                  currentStep >= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step ? <Check className="h-4 w-4" /> : step}
              </div>
              {step < 4 && (
                <div
                  className={`h-0.5 w-12 ${currentStep > step ? "bg-primary" : "bg-muted"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Registration form */}
        <Card>
          <CardHeader>
            <CardTitle>{getStepTitle()}</CardTitle>
            <CardDescription>Step {currentStep} of 4</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => updateFormData("fullName", e.target.value)}
                    data-testid="input-fullname"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    data-testid="input-phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password (min 6 characters)"
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                    data-testid="input-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={formData.countryCode}
                    onValueChange={(value) => updateFormData("countryCode", value)}
                  >
                    <SelectTrigger id="country" data-testid="select-country">
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BD">Bangladesh</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Address */}
            {currentStep === 2 && formData.countryCode === "BD" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="presentAddress">Present Address</Label>
                  <Textarea
                    id="presentAddress"
                    placeholder="House/Flat, Road, Area"
                    value={formData.presentAddress}
                    onChange={(e) => updateFormData("presentAddress", e.target.value)}
                    data-testid="input-present-address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="permanentAddress">Permanent Address</Label>
                  <Textarea
                    id="permanentAddress"
                    placeholder="Village/House, Area"
                    value={formData.permanentAddress}
                    onChange={(e) => updateFormData("permanentAddress", e.target.value)}
                    data-testid="input-permanent-address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="district">District (Zilla)</Label>
                    <Input
                      id="district"
                      placeholder="e.g., Dhaka"
                      value={formData.district}
                      onChange={(e) => updateFormData("district", e.target.value)}
                      data-testid="input-district"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thana">Upazila / Thana</Label>
                    <Input
                      id="thana"
                      placeholder="e.g., Gulshan"
                      value={formData.thana}
                      onChange={(e) => updateFormData("thana", e.target.value)}
                      data-testid="input-thana"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postOffice">Post Office (Optional)</Label>
                    <Input
                      id="postOffice"
                      placeholder="Post office name"
                      value={formData.postOffice}
                      onChange={(e) => updateFormData("postOffice", e.target.value)}
                      data-testid="input-post-office"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code (Optional)</Label>
                    <Input
                      id="postalCode"
                      placeholder="e.g., 1212"
                      value={formData.postalCode}
                      onChange={(e) => updateFormData("postalCode", e.target.value)}
                      data-testid="input-postal-code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="village">Village (Optional)</Label>
                  <Input
                    id="village"
                    placeholder="Village name if applicable"
                    value={formData.village}
                    onChange={(e) => updateFormData("village", e.target.value)}
                    data-testid="input-village"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && formData.countryCode === "US" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="homeAddress">Home Address</Label>
                  <Textarea
                    id="homeAddress"
                    placeholder="Street address, City, State, ZIP code"
                    value={formData.homeAddress}
                    onChange={(e) => updateFormData("homeAddress", e.target.value)}
                    rows={4}
                    data-testid="input-home-address"
                  />
                </div>
              </div>
            )}

            {/* Step 3: KYC */}
            {currentStep === 3 && formData.countryCode === "BD" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input
                    id="fatherName"
                    placeholder="Enter father's name"
                    value={formData.fatherName}
                    onChange={(e) => updateFormData("fatherName", e.target.value)}
                    data-testid="input-father-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                    data-testid="input-dob"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nidNumber">NID Number</Label>
                  <Input
                    id="nidNumber"
                    placeholder="Enter your National ID number"
                    value={formData.nidNumber}
                    onChange={(e) => updateFormData("nidNumber", e.target.value)}
                    data-testid="input-nid"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nidFront">NID Front Image URL (Optional)</Label>
                  <Input
                    id="nidFront"
                    placeholder="URL to NID front image"
                    value={formData.nidFrontImageUrl}
                    onChange={(e) => updateFormData("nidFrontImageUrl", e.target.value)}
                    data-testid="input-nid-front"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can upload document images later from your profile
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nidBack">NID Back Image URL (Optional)</Label>
                  <Input
                    id="nidBack"
                    placeholder="URL to NID back image"
                    value={formData.nidBackImageUrl}
                    onChange={(e) => updateFormData("nidBackImageUrl", e.target.value)}
                    data-testid="input-nid-back"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && formData.countryCode === "US" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                    data-testid="input-dob"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="govIdType">Government ID Type</Label>
                  <Select
                    value={formData.governmentIdType}
                    onValueChange={(value) => updateFormData("governmentIdType", value)}
                  >
                    <SelectTrigger id="govIdType" data-testid="select-id-type">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drivers_license">Driver's License</SelectItem>
                      <SelectItem value="state_id">State ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="govIdLast4">ID Last 4 Digits</Label>
                  <Input
                    id="govIdLast4"
                    placeholder="Last 4 digits of your government ID"
                    maxLength={4}
                    value={formData.governmentIdLast4}
                    onChange={(e) => updateFormData("governmentIdLast4", e.target.value)}
                    data-testid="input-id-last4"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Emergency Contact */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyName">Emergency Contact Name</Label>
                  <Input
                    id="emergencyName"
                    placeholder="Full name of emergency contact"
                    value={formData.emergencyContactName}
                    onChange={(e) => updateFormData("emergencyContactName", e.target.value)}
                    data-testid="input-emergency-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    placeholder="+1234567890"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => updateFormData("emergencyContactPhone", e.target.value)}
                    data-testid="input-emergency-phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyRelation">Relationship (Optional)</Label>
                  <Input
                    id="emergencyRelation"
                    placeholder="e.g., Parent, Spouse, Sibling"
                    value={formData.emergencyContactRelation}
                    onChange={(e) => updateFormData("emergencyContactRelation", e.target.value)}
                    data-testid="input-emergency-relation"
                  />
                </div>

                <div className="rounded-md bg-muted p-4">
                  <h4 className="font-medium mb-2">What happens next?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Your account will be created with "Pending" verification status</li>
                    <li>• Admin will review your KYC documents</li>
                    <li>• You'll receive a notification once approved</li>
                    <li>• After approval, you can book rides, order food, and send parcels</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-4">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <Link href="/login">
                  <Button variant="ghost" type="button" data-testid="button-to-login">
                    Back to Login
                  </Button>
                </Link>
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? "Creating account..." : "Complete Registration"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
