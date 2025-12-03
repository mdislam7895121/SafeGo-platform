import { useState, useEffect } from "react";
import { useLocation, Link, Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Car, Bike, ArrowLeft, ArrowRight, CheckCircle2, 
  Loader2, User, FileText, CreditCard, ShieldCheck,
  Upload, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isPartnerAvailable, getPartnerConfig, type PartnerType } from "@shared/partnerAvailability";

const personalInfoSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  fatherName: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  homeAddress: z.string().optional(),
});

const vehicleInfoSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehiclePlate: z.string().min(1, "Vehicle plate is required"),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleColor: z.string().optional(),
});

const documentsSchema = z.object({
  nidNumber: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  driverLicenseExpiry: z.string().optional(),
  governmentIdType: z.string().optional(),
  governmentIdLast4: z.string().optional(),
  ssnLast4: z.string().optional(),
});

const payoutSchema = z.object({
  payoutMethod: z.string().min(1, "Payout method is required"),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  mfsProvider: z.string().optional(),
  mfsNumber: z.string().optional(),
});

type PersonalInfoData = z.infer<typeof personalInfoSchema>;
type VehicleInfoData = z.infer<typeof vehicleInfoSchema>;
type DocumentsData = z.infer<typeof documentsSchema>;
type PayoutData = z.infer<typeof payoutSchema>;

interface RegistrationData {
  personalInfo: Partial<PersonalInfoData>;
  vehicleInfo: Partial<VehicleInfoData>;
  documents: Partial<DocumentsData>;
  payout: Partial<PayoutData>;
}

const STEPS = [
  { id: 1, title: "Personal Information", icon: User },
  { id: 2, title: "Vehicle Information", icon: Car },
  { id: 3, title: "Documents", icon: FileText },
  { id: 4, title: "Payout Setup", icon: CreditCard },
  { id: 5, title: "Review & Submit", icon: ShieldCheck },
];

export default function DriverRegistration() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationData>({
    personalInfo: {},
    vehicleInfo: {},
    documents: {},
    payout: {},
  });
  const [nidFrontFile, setNidFrontFile] = useState<File | null>(null);
  const [nidBackFile, setNidBackFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  const driverType: 'ride' | 'delivery' = typeParam === 'delivery' ? 'delivery' : 'ride';
  
  const countryCode = user?.countryCode || "BD";
  const isBD = countryCode === "BD";
  const partnerType: PartnerType = driverType === 'ride' ? 'driver_ride' : 'driver_delivery';
  const config = getPartnerConfig(partnerType, countryCode);
  const isAvailable = isPartnerAvailable(partnerType, countryCode);

  const { data: existingProfile, isLoading: profileLoading } = useQuery<{ profile: any } | null>({
    queryKey: ["/api/driver/registration/status", driverType],
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/driver/registration/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/registration/status"] });
      toast({
        title: "Application Submitted",
        description: "Your driver application has been submitted for review.",
      });
      setLocation("/customer");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const personalForm = useForm<PersonalInfoData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      phone: "",
      dateOfBirth: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      fatherName: "",
      presentAddress: "",
      permanentAddress: "",
      homeAddress: "",
    },
  });

  const vehicleForm = useForm<VehicleInfoData>({
    resolver: zodResolver(vehicleInfoSchema),
    defaultValues: {
      vehicleType: "",
      vehicleModel: "",
      vehiclePlate: "",
      vehicleYear: "",
      vehicleMake: "",
      vehicleColor: "",
    },
  });

  const documentsForm = useForm<DocumentsData>({
    resolver: zodResolver(documentsSchema),
    defaultValues: {
      nidNumber: "",
      driverLicenseNumber: "",
      driverLicenseExpiry: "",
      governmentIdType: "",
      governmentIdLast4: "",
      ssnLast4: "",
    },
  });

  const payoutForm = useForm<PayoutData>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      payoutMethod: isBD ? "mfs" : "bank",
      bankName: "",
      accountNumber: "",
      routingNumber: "",
      mfsProvider: "",
      mfsNumber: "",
    },
  });

  if (!user) {
    return <Redirect to={`/login?returnTo=/partner/${driverType === 'ride' ? 'ride' : 'delivery'}/start`} />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-registration" />
      </div>
    );
  }

  if (existingProfile?.profile?.verificationStatus === "pending") {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Application Under Review</h2>
              <p className="text-muted-foreground mb-4">
                Your driver application is currently being reviewed. {config?.approvalMessage}
              </p>
              <Button onClick={() => setLocation("/customer")} data-testid="button-back-customer">
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (existingProfile?.profile?.verificationStatus === "approved") {
    return <Redirect to="/driver" />;
  }

  if (!isAvailable && config?.waitlistEnabled) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/customer">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Coming Soon to Your Area</h2>
              <p className="text-muted-foreground mb-4">{config?.approvalMessage}</p>
              <Button onClick={() => {
                toast({
                  title: "Waitlist Joined",
                  description: "We'll notify you when driver registration opens in your area.",
                });
                setLocation("/customer");
              }} data-testid="button-join-waitlist">
                Join Waitlist
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const progressPercent = (currentStep / STEPS.length) * 100;

  const handleNext = async () => {
    let isValid = false;
    
    if (currentStep === 1) {
      isValid = await personalForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, personalInfo: personalForm.getValues() }));
      }
    } else if (currentStep === 2) {
      isValid = await vehicleForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, vehicleInfo: vehicleForm.getValues() }));
      }
    } else if (currentStep === 3) {
      if (isBD && !documentsForm.getValues().nidNumber) {
        toast({ title: "NID number is required", variant: "destructive" });
        return;
      }
      if (!isBD && !documentsForm.getValues().driverLicenseNumber) {
        toast({ title: "Driver license number is required", variant: "destructive" });
        return;
      }
      isValid = true;
      setFormData(prev => ({ ...prev, documents: documentsForm.getValues() }));
    } else if (currentStep === 4) {
      isValid = await payoutForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, payout: payoutForm.getValues() }));
      }
    }
    
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    const submitData = {
      driverType,
      countryCode,
      ...formData.personalInfo,
      ...formData.vehicleInfo,
      ...formData.documents,
      ...formData.payout,
    };
    submitMutation.mutate(submitData);
  };

  const StepIcon = STEPS[currentStep - 1].icon;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/customer">
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/20 to-green-500/20 flex items-center justify-center mx-auto mb-4">
            {driverType === 'ride' ? (
              <Car className="h-8 w-8 text-blue-600" />
            ) : (
              <Bike className="h-8 w-8 text-green-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {driverType === 'ride' ? 'Ride Driver' : 'Delivery Driver'} Registration
          </h1>
          <p className="text-muted-foreground mt-2">
            Complete all steps to submit your application
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Step {currentStep} of {STEPS.length}</span>
            <span>{Math.round(progressPercent)}% Complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-shrink-0 ${
                  isCompleted ? 'bg-green-100 dark:bg-green-900/30' :
                  isCurrent ? 'bg-primary/10' : 'bg-muted'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Icon className={`h-4 w-4 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                )}
                <span className={`text-sm ${isCurrent ? 'font-medium' : ''}`}>{step.title}</span>
              </div>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                <CardDescription>
                  {currentStep === 1 && "Enter your personal details"}
                  {currentStep === 2 && "Add your vehicle information"}
                  {currentStep === 3 && "Upload required documents"}
                  {currentStep === 4 && "Set up your payout method"}
                  {currentStep === 5 && "Review and submit your application"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <Form {...personalForm}>
                <form className="space-y-4">
                  <FormField
                    control={personalForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={personalForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-dob" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isBD && (
                    <>
                      <FormField
                        control={personalForm.control}
                        name="fatherName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Father's Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter father's name" {...field} data-testid="input-father-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={personalForm.control}
                        name="presentAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Present Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Current address" {...field} data-testid="input-present-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={personalForm.control}
                        name="permanentAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Permanent Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Permanent address" {...field} data-testid="input-permanent-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  {!isBD && (
                    <FormField
                      control={personalForm.control}
                      name="homeAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Home Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Your home address" {...field} data-testid="input-home-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={personalForm.control}
                      name="emergencyContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Contact name" {...field} data-testid="input-emergency-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Contact phone" {...field} data-testid="input-emergency-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            )}

            {currentStep === 2 && (
              <Form {...vehicleForm}>
                <form className="space-y-4">
                  <FormField
                    control={vehicleForm.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vehicle-type">
                              <SelectValue placeholder="Select vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {driverType === 'ride' ? (
                              <>
                                <SelectItem value="car">Car</SelectItem>
                                <SelectItem value="suv">SUV</SelectItem>
                                <SelectItem value="sedan">Sedan</SelectItem>
                                {isBD && <SelectItem value="cng">CNG Auto</SelectItem>}
                              </>
                            ) : (
                              <>
                                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                                <SelectItem value="bicycle">Bicycle</SelectItem>
                                <SelectItem value="scooter">Scooter</SelectItem>
                                <SelectItem value="car">Car</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={vehicleForm.control}
                      name="vehicleMake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Make</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Toyota" {...field} data-testid="input-vehicle-make" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vehicleForm.control}
                      name="vehicleModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Camry" {...field} data-testid="input-vehicle-model" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={vehicleForm.control}
                      name="vehicleYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Year</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 2020" {...field} data-testid="input-vehicle-year" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vehicleForm.control}
                      name="vehicleColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Color</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., White" {...field} data-testid="input-vehicle-color" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={vehicleForm.control}
                    name="vehiclePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Plate Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter plate number" {...field} data-testid="input-vehicle-plate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {currentStep === 3 && (
              <Form {...documentsForm}>
                <form className="space-y-4">
                  {isBD ? (
                    <>
                      <FormField
                        control={documentsForm.control}
                        name="nidNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NID Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter NID number" {...field} data-testid="input-nid-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <Label>NID Front Image</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload NID front</p>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="nid-front"
                            onChange={(e) => setNidFrontFile(e.target.files?.[0] || null)}
                            data-testid="input-nid-front"
                          />
                          <label htmlFor="nid-front">
                            <Button type="button" variant="outline" size="sm" className="mt-2">
                              Choose File
                            </Button>
                          </label>
                          {nidFrontFile && <p className="text-sm mt-2">{nidFrontFile.name}</p>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>NID Back Image</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload NID back</p>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="nid-back"
                            onChange={(e) => setNidBackFile(e.target.files?.[0] || null)}
                            data-testid="input-nid-back"
                          />
                          <label htmlFor="nid-back">
                            <Button type="button" variant="outline" size="sm" className="mt-2">
                              Choose File
                            </Button>
                          </label>
                          {nidBackFile && <p className="text-sm mt-2">{nidBackFile.name}</p>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <FormField
                        control={documentsForm.control}
                        name="driverLicenseNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Driver License Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter license number" {...field} data-testid="input-license-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={documentsForm.control}
                        name="driverLicenseExpiry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Expiry Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-license-expiry" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <Label>Driver License Image</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Upload driver license photo</p>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="license-image"
                            onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                            data-testid="input-license-image"
                          />
                          <label htmlFor="license-image">
                            <Button type="button" variant="outline" size="sm" className="mt-2">
                              Choose File
                            </Button>
                          </label>
                          {licenseFile && <p className="text-sm mt-2">{licenseFile.name}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={documentsForm.control}
                          name="governmentIdType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Government ID Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-gov-id-type">
                                    <SelectValue placeholder="Select ID type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="ssn">SSN</SelectItem>
                                  <SelectItem value="passport">Passport</SelectItem>
                                  <SelectItem value="state_id">State ID</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={documentsForm.control}
                          name="governmentIdLast4"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last 4 Digits</FormLabel>
                              <FormControl>
                                <Input placeholder="Last 4 digits" maxLength={4} {...field} data-testid="input-gov-id-last4" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={documentsForm.control}
                        name="ssnLast4"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SSN Last 4 (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Last 4 digits of SSN" maxLength={4} {...field} data-testid="input-ssn-last4" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </form>
              </Form>
            )}

            {currentStep === 4 && (
              <Form {...payoutForm}>
                <form className="space-y-4">
                  <FormField
                    control={payoutForm.control}
                    name="payoutMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payout-method">
                              <SelectValue placeholder="Select payout method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bank">Bank Transfer</SelectItem>
                            {isBD && (
                              <>
                                <SelectItem value="mfs">Mobile Money (bKash/Nagad)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {payoutForm.watch("payoutMethod") === "bank" && (
                    <>
                      <FormField
                        control={payoutForm.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter bank name" {...field} data-testid="input-bank-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payoutForm.control}
                        name="accountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter account number" {...field} data-testid="input-account-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {!isBD && (
                        <FormField
                          control={payoutForm.control}
                          name="routingNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Routing Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter routing number" {...field} data-testid="input-routing-number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}
                  {payoutForm.watch("payoutMethod") === "mfs" && isBD && (
                    <>
                      <FormField
                        control={payoutForm.control}
                        name="mfsProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MFS Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-mfs-provider">
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="bkash">bKash</SelectItem>
                                <SelectItem value="nagad">Nagad</SelectItem>
                                <SelectItem value="rocket">Rocket</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payoutForm.control}
                        name="mfsNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter mobile number" {...field} data-testid="input-mfs-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </form>
              </Form>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Application Summary</h4>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Personal Information</p>
                    <div className="text-sm text-muted-foreground">
                      <p>Phone: {formData.personalInfo.phone}</p>
                      <p>DOB: {formData.personalInfo.dateOfBirth}</p>
                      <p>Emergency: {formData.personalInfo.emergencyContactName} ({formData.personalInfo.emergencyContactPhone})</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Vehicle Information</p>
                    <div className="text-sm text-muted-foreground">
                      <p>Type: {formData.vehicleInfo.vehicleType}</p>
                      <p>Model: {formData.vehicleInfo.vehicleMake} {formData.vehicleInfo.vehicleModel} ({formData.vehicleInfo.vehicleYear})</p>
                      <p>Plate: {formData.vehicleInfo.vehiclePlate}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Documents</p>
                    <div className="text-sm text-muted-foreground">
                      {isBD ? (
                        <p>NID: {formData.documents.nidNumber}</p>
                      ) : (
                        <p>License: {formData.documents.driverLicenseNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Payout</p>
                    <div className="text-sm text-muted-foreground">
                      <p>Method: {formData.payout.payoutMethod === 'mfs' ? 'Mobile Money' : 'Bank Transfer'}</p>
                    </div>
                  </div>
                </div>

                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      By submitting this application, you agree to SafeGo's Terms of Service and Partner Agreement. 
                      Your application will be reviewed and you will be notified of the outcome.
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      {config?.approvalMessage}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                data-testid="button-back-step"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} data-testid="button-next-step">
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitMutation.isPending}
                  data-testid="button-submit"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Submit Application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
