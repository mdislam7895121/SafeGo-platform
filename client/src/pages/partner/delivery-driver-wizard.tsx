import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, Upload, User, MapPin,
  IdCard, Truck, FileText, ClipboardCheck, Car, Bike, Footprints, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OnboardingDraft {
  id: string;
  userId: string;
  countryCode: string;
  currentStep: number;
  isSubmitted: boolean;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  presentAddress?: string;
  permanentAddress?: string;
  homeAddress?: string;
  usaStreet?: string;
  usaCity?: string;
  usaState?: string;
  usaZipCode?: string;
  usaAptUnit?: string;
  nidNumber?: string;
  nidFrontImageUrl?: string;
  nidBackImageUrl?: string;
  governmentIdType?: string;
  governmentIdLast4?: string;
  governmentIdFrontUrl?: string;
  governmentIdBackUrl?: string;
  ssnLast4?: string;
  backgroundCheckConsent?: boolean;
  deliveryMethod?: string;
  drivingLicenseNumber?: string;
  drivingLicenseFrontUrl?: string;
  drivingLicenseBackUrl?: string;
  drivingLicenseExpiry?: string;
  vehicleRegistrationUrl?: string;
  insuranceCardUrl?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehiclePlate?: string;
  vehicleColor?: string;
  profilePhotoUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC"
];

const WIZARD_STEPS = [
  { id: 1, title: "Select Country", icon: Globe },
  { id: 2, title: "Personal Info", icon: User },
  { id: 3, title: "Address Info", icon: MapPin },
  { id: 4, title: "Government ID", icon: IdCard },
  { id: 5, title: "Delivery Method", icon: Truck },
  { id: 6, title: "Vehicle Documents", icon: FileText },
  { id: 7, title: "Review & Submit", icon: ClipboardCheck },
];

const personalInfoSchemaBD = z.object({
  fullName: z.string().min(2, "Full name is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  fatherName: z.string().min(2, "Father's name is required for Bangladesh"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
});

const personalInfoSchemaUS = z.object({
  fullName: z.string().min(2, "Full name is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  fatherName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
});

const addressInfoSchemaBD = z.object({
  presentAddress: z.string().min(5, "Present address is required"),
  permanentAddress: z.string().min(5, "Permanent address is required"),
});

const addressInfoSchemaUS = z.object({
  usaStreet: z.string().min(5, "Street address is required"),
  usaCity: z.string().min(2, "City is required"),
  usaState: z.string().min(2, "State is required"),
  usaZipCode: z.string().min(5, "ZIP code is required"),
  usaAptUnit: z.string().optional(),
});

const governmentIdSchemaBD = z.object({
  nidNumber: z.string().min(10, "NID number is required"),
  nidFrontImageUrl: z.string().optional(),
  nidBackImageUrl: z.string().optional(),
});

const governmentIdSchemaUS = z.object({
  governmentIdType: z.string().min(1, "ID type is required"),
  governmentIdLast4: z.string().length(4, "Last 4 digits required"),
  governmentIdFrontUrl: z.string().optional(),
  governmentIdBackUrl: z.string().optional(),
  ssnLast4: z.string().length(4, "SSN last 4 digits required"),
  backgroundCheckConsent: z.boolean().refine(val => val === true, "You must consent to background check"),
});

const deliveryMethodSchema = z.object({
  deliveryMethod: z.enum(["car", "bike", "walking"]),
});

const vehicleDocsSchema = z.object({
  drivingLicenseNumber: z.string().min(5, "License number required"),
  drivingLicenseFrontUrl: z.string().optional(),
  drivingLicenseBackUrl: z.string().optional(),
  drivingLicenseExpiry: z.string().optional(),
  vehicleRegistrationUrl: z.string().optional(),
  insuranceCardUrl: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
});

const finalReviewSchema = z.object({
  profilePhotoUrl: z.string().min(1, "Profile photo is required"),
  emergencyContactName: z.string().min(2, "Emergency contact name required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone required"),
  emergencyContactRelationship: z.string().optional(),
});

export default function DeliveryDriverWizard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(2);

  const { data: draftData, isLoading } = useQuery<{ exists: boolean; draft: OnboardingDraft | null }>({
    queryKey: ["/api/partner/delivery-driver/onboarding/draft"],
    enabled: !!user,
  });

  const draft = draftData?.draft;
  const countryCode = draft?.countryCode || "US";
  const isBD = countryCode === "BD";
  const isUS = countryCode === "US";

  useEffect(() => {
    if (draft?.currentStep) {
      setCurrentStep(draft.currentStep);
    }
  }, [draft?.currentStep]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step");
    if (stepParam) {
      const step = parseInt(stepParam, 10);
      if (step >= 2 && step <= 7) {
        setCurrentStep(step);
      }
    }
  }, []);

  const progressPercent = ((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100;

  const personalInfoFormBD = useForm({
    resolver: zodResolver(personalInfoSchemaBD),
    defaultValues: {
      fullName: draft?.fullName || "",
      firstName: draft?.firstName || "",
      lastName: draft?.lastName || "",
      middleName: draft?.middleName || "",
      fatherName: draft?.fatherName || "",
      dateOfBirth: draft?.dateOfBirth ? new Date(draft.dateOfBirth).toISOString().split("T")[0] : "",
      phoneNumber: draft?.phoneNumber || "",
    },
  });

  const personalInfoFormUS = useForm({
    resolver: zodResolver(personalInfoSchemaUS),
    defaultValues: {
      fullName: draft?.fullName || "",
      firstName: draft?.firstName || "",
      lastName: draft?.lastName || "",
      middleName: draft?.middleName || "",
      fatherName: draft?.fatherName || "",
      dateOfBirth: draft?.dateOfBirth ? new Date(draft.dateOfBirth).toISOString().split("T")[0] : "",
      phoneNumber: draft?.phoneNumber || "",
    },
  });

  const addressInfoFormBD = useForm({
    resolver: zodResolver(addressInfoSchemaBD),
    defaultValues: {
      presentAddress: draft?.presentAddress || "",
      permanentAddress: draft?.permanentAddress || "",
    },
  });

  const addressInfoFormUS = useForm({
    resolver: zodResolver(addressInfoSchemaUS),
    defaultValues: {
      usaStreet: draft?.usaStreet || "",
      usaCity: draft?.usaCity || "",
      usaState: draft?.usaState || "",
      usaZipCode: draft?.usaZipCode || "",
      usaAptUnit: draft?.usaAptUnit || "",
    },
  });

  const governmentIdFormBD = useForm({
    resolver: zodResolver(governmentIdSchemaBD),
    defaultValues: {
      nidNumber: draft?.nidNumber || "",
      nidFrontImageUrl: draft?.nidFrontImageUrl || "",
      nidBackImageUrl: draft?.nidBackImageUrl || "",
    },
  });

  const governmentIdFormUS = useForm({
    resolver: zodResolver(governmentIdSchemaUS),
    defaultValues: {
      governmentIdType: draft?.governmentIdType || "",
      governmentIdLast4: draft?.governmentIdLast4 || "",
      governmentIdFrontUrl: draft?.governmentIdFrontUrl || "",
      governmentIdBackUrl: draft?.governmentIdBackUrl || "",
      ssnLast4: draft?.ssnLast4 || "",
      backgroundCheckConsent: draft?.backgroundCheckConsent || false,
    },
  });

  const deliveryMethodForm = useForm({
    resolver: zodResolver(deliveryMethodSchema),
    defaultValues: {
      deliveryMethod: (draft?.deliveryMethod as "car" | "bike" | "walking") || "bike",
    },
  });

  const vehicleDocsForm = useForm({
    resolver: zodResolver(vehicleDocsSchema),
    defaultValues: {
      drivingLicenseNumber: draft?.drivingLicenseNumber || "",
      drivingLicenseFrontUrl: draft?.drivingLicenseFrontUrl || "",
      drivingLicenseBackUrl: draft?.drivingLicenseBackUrl || "",
      drivingLicenseExpiry: draft?.drivingLicenseExpiry || "",
      vehicleRegistrationUrl: draft?.vehicleRegistrationUrl || "",
      insuranceCardUrl: draft?.insuranceCardUrl || "",
      vehicleMake: draft?.vehicleMake || "",
      vehicleModel: draft?.vehicleModel || "",
      vehicleYear: draft?.vehicleYear || undefined,
      vehiclePlate: draft?.vehiclePlate || "",
      vehicleColor: draft?.vehicleColor || "",
    },
  });

  const finalReviewForm = useForm({
    resolver: zodResolver(finalReviewSchema),
    defaultValues: {
      profilePhotoUrl: draft?.profilePhotoUrl || "",
      emergencyContactName: draft?.emergencyContactName || "",
      emergencyContactPhone: draft?.emergencyContactPhone || "",
      emergencyContactRelationship: draft?.emergencyContactRelationship || "",
    },
  });

  const saveStepMutation = useMutation({
    mutationFn: async ({ step, data }: { step: number; data: any }) => {
      const response = await apiRequest(`/api/partner/delivery-driver/onboarding/step/${step}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery-driver/onboarding/draft"] });
      if (data.currentStep) {
        setCurrentStep(data.currentStep);
        setLocation(`/partner/delivery-driver/wizard?step=${data.currentStep}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitApplicationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/partner/delivery-driver/onboarding/submit", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/delivery-driver/onboarding/draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/profile"] });
      toast({
        title: "Application Submitted!",
        description: "Your delivery driver application is now pending verification.",
      });
      setLocation("/partner/delivery-driver/start");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error?.message || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStep2SubmitBD = (data: z.infer<typeof personalInfoSchemaBD>) => {
    saveStepMutation.mutate({ step: 2, data });
  };

  const handleStep2SubmitUS = (data: z.infer<typeof personalInfoSchemaUS>) => {
    saveStepMutation.mutate({ step: 2, data });
  };

  const handleStep3SubmitBD = (data: z.infer<typeof addressInfoSchemaBD>) => {
    saveStepMutation.mutate({ step: 3, data });
  };

  const handleStep3SubmitUS = (data: z.infer<typeof addressInfoSchemaUS>) => {
    saveStepMutation.mutate({ step: 3, data });
  };

  const handleStep4SubmitBD = (data: z.infer<typeof governmentIdSchemaBD>) => {
    saveStepMutation.mutate({ step: 4, data });
  };

  const handleStep4SubmitUS = (data: z.infer<typeof governmentIdSchemaUS>) => {
    saveStepMutation.mutate({ step: 4, data });
  };

  const handleStep5Submit = (data: z.infer<typeof deliveryMethodSchema>) => {
    saveStepMutation.mutate({ step: 5, data });
  };

  const handleStep6Submit = (data: z.infer<typeof vehicleDocsSchema>) => {
    saveStepMutation.mutate({ step: 6, data });
  };

  const handleFinalSubmit = (data: z.infer<typeof finalReviewSchema>) => {
    submitApplicationMutation.mutate(data);
  };

  const goBack = () => {
    let prevStep = currentStep - 1;
    if (prevStep < 2) {
      setLocation("/partner/delivery-driver/start");
      return;
    }
    if (isUS && prevStep === 5 && draft?.deliveryMethod !== "car") {
      prevStep = 5;
    }
    if (isBD && prevStep === 5) {
      prevStep = 4;
    }
    setCurrentStep(prevStep);
    setLocation(`/partner/delivery-driver/wizard?step=${prevStep}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-wizard" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">No Application Found</h1>
          <p className="text-muted-foreground mb-6">Please start a new application.</p>
          <Link href="/partner/delivery-driver/start">
            <Button data-testid="button-start-new">Start New Application</Button>
          </Link>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 2:
        if (isBD) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Step 2: Personal Information (Bangladesh)
                </CardTitle>
                <CardDescription>
                  Enter your personal details including father's name (required)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...personalInfoFormBD}>
                  <form onSubmit={personalInfoFormBD.handleSubmit(handleStep2SubmitBD)} className="space-y-4">
                    <FormField
                      control={personalInfoFormBD.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full legal name" {...field} data-testid="input-full-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalInfoFormBD.control}
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Father's Name * (Required for Bangladesh)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter father's name" {...field} data-testid="input-father-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalInfoFormBD.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-dob" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalInfoFormBD.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="+880 1XXXXXXXXX" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                        {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Step 2: Personal Information (United States)
              </CardTitle>
              <CardDescription>
                Enter your personal details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...personalInfoFormUS}>
                <form onSubmit={personalInfoFormUS.handleSubmit(handleStep2SubmitUS)} className="space-y-4">
                  <FormField
                    control={personalInfoFormUS.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full legal name" {...field} data-testid="input-full-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalInfoFormUS.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-dob" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalInfoFormUS.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 XXX-XXX-XXXX" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                      {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );

      case 3:
        if (isBD) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Step 3: Address Information (Bangladesh)
                </CardTitle>
                <CardDescription>Enter your present and permanent address</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...addressInfoFormBD}>
                  <form onSubmit={addressInfoFormBD.handleSubmit(handleStep3SubmitBD)} className="space-y-4">
                    <FormField
                      control={addressInfoFormBD.control}
                      name="presentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Present Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your current address" {...field} data-testid="input-present-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={addressInfoFormBD.control}
                      name="permanentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Permanent Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your permanent address" {...field} data-testid="input-permanent-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                        {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Step 3: Address Information (United States)
              </CardTitle>
              <CardDescription>Enter your home address</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...addressInfoFormUS}>
                <form onSubmit={addressInfoFormUS.handleSubmit(handleStep3SubmitUS)} className="space-y-4">
                  <FormField
                    control={addressInfoFormUS.control}
                    name="usaStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} data-testid="input-street" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addressInfoFormUS.control}
                    name="usaAptUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apt/Unit (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Apt 4B" {...field} data-testid="input-apt" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={addressInfoFormUS.control}
                      name="usaCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input placeholder="New York" {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={addressInfoFormUS.control}
                      name="usaState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-state">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={addressInfoFormUS.control}
                    name="usaZipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} data-testid="input-zip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                      {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );

      case 4:
        if (isBD) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IdCard className="h-5 w-5" />
                  Step 4: National ID (NID) Verification
                </CardTitle>
                <CardDescription>Enter your NID details for identity verification</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...governmentIdFormBD}>
                  <form onSubmit={governmentIdFormBD.handleSubmit(handleStep4SubmitBD)} className="space-y-4">
                    <FormField
                      control={governmentIdFormBD.control}
                      name="nidNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NID Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your 10 or 17 digit NID number" {...field} data-testid="input-nid" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={governmentIdFormBD.control}
                        name="nidFrontImageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NID Front Image</FormLabel>
                            <FormControl>
                              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Upload NID Front</p>
                                <Input type="hidden" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={governmentIdFormBD.control}
                        name="nidBackImageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NID Back Image</FormLabel>
                            <FormControl>
                              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Upload NID Back</p>
                                <Input type="hidden" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                        {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IdCard className="h-5 w-5" />
                Step 4: Government ID Verification
              </CardTitle>
              <CardDescription>Enter your government ID and SSN details</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...governmentIdFormUS}>
                <form onSubmit={governmentIdFormUS.handleSubmit(handleStep4SubmitUS)} className="space-y-4">
                  <FormField
                    control={governmentIdFormUS.control}
                    name="governmentIdType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Government ID Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-id-type">
                              <SelectValue placeholder="Select ID type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="drivers_license">Driver's License</SelectItem>
                            <SelectItem value="state_id">State ID</SelectItem>
                            <SelectItem value="passport">Passport</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={governmentIdFormUS.control}
                    name="governmentIdLast4"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last 4 Digits of ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="1234" maxLength={4} {...field} data-testid="input-id-last4" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={governmentIdFormUS.control}
                    name="ssnLast4"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSN Last 4 Digits *</FormLabel>
                        <FormControl>
                          <Input placeholder="1234" maxLength={4} {...field} data-testid="input-ssn-last4" />
                        </FormControl>
                        <FormDescription>Required for background check and tax reporting</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={governmentIdFormUS.control}
                    name="backgroundCheckConsent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-background-consent"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Background Check Consent *</FormLabel>
                          <FormDescription>
                            I authorize SafeGo to conduct a background check as part of the driver verification process.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                      {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );

      case 5:
        if (isBD) {
          setCurrentStep(6);
          setLocation("/partner/delivery-driver/wizard?step=6");
          return null;
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Step 5: Delivery Method
              </CardTitle>
              <CardDescription>Choose how you'll make deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...deliveryMethodForm}>
                <form onSubmit={deliveryMethodForm.handleSubmit(handleStep5Submit)} className="space-y-4">
                  <FormField
                    control={deliveryMethodForm.control}
                    name="deliveryMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="space-y-4"
                          >
                            <div 
                              className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                field.value === "car" 
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                                  : "border-muted hover:border-muted-foreground/30"
                              }`}
                              onClick={() => field.onChange("car")}
                              data-testid="delivery-option-car"
                            >
                              <RadioGroupItem value="car" id="car" />
                              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <Car className="h-6 w-6 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <Label htmlFor="car" className="text-base font-semibold cursor-pointer">Car</Label>
                                <p className="text-sm text-muted-foreground">
                                  Requires driver's license, vehicle registration, and insurance
                                </p>
                              </div>
                            </div>

                            <div 
                              className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                field.value === "bike" 
                                  ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                                  : "border-muted hover:border-muted-foreground/30"
                              }`}
                              onClick={() => field.onChange("bike")}
                              data-testid="delivery-option-bike"
                            >
                              <RadioGroupItem value="bike" id="bike" />
                              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                <Bike className="h-6 w-6 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <Label htmlFor="bike" className="text-base font-semibold cursor-pointer">Bicycle</Label>
                                <p className="text-sm text-muted-foreground">
                                  No driver's license required. Government ID only.
                                </p>
                              </div>
                            </div>

                            <div 
                              className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                field.value === "walking" 
                                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" 
                                  : "border-muted hover:border-muted-foreground/30"
                              }`}
                              onClick={() => field.onChange("walking")}
                              data-testid="delivery-option-walking"
                            >
                              <RadioGroupItem value="walking" id="walking" />
                              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                                <Footprints className="h-6 w-6 text-orange-600" />
                              </div>
                              <div className="flex-1">
                                <Label htmlFor="walking" className="text-base font-semibold cursor-pointer">Walking</Label>
                                <p className="text-sm text-muted-foreground">
                                  Deliver on foot. Government ID only required.
                                </p>
                              </div>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                      {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );

      case 6:
        const needsVehicleDocs = isBD || (isUS && draft?.deliveryMethod === "car");

        if (!needsVehicleDocs) {
          setCurrentStep(7);
          setLocation("/partner/delivery-driver/wizard?step=7");
          return null;
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Step 6: Vehicle Documents
              </CardTitle>
              <CardDescription>
                {isBD 
                  ? "Upload your driving license and vehicle documents" 
                  : "Upload your driver's license, registration, and insurance"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...vehicleDocsForm}>
                <form onSubmit={vehicleDocsForm.handleSubmit(handleStep6Submit)} className="space-y-4">
                  <FormField
                    control={vehicleDocsForm.control}
                    name="drivingLicenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver's License Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter license number" {...field} data-testid="input-license-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={vehicleDocsForm.control}
                      name="vehicleMake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Make</FormLabel>
                          <FormControl>
                            <Input placeholder="Toyota" {...field} data-testid="input-vehicle-make" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleDocsForm.control}
                      name="vehicleModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Model</FormLabel>
                          <FormControl>
                            <Input placeholder="Camry" {...field} data-testid="input-vehicle-model" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={vehicleDocsForm.control}
                    name="vehiclePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Plate Number</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC-1234" {...field} data-testid="input-vehicle-plate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" disabled={saveStepMutation.isPending} data-testid="button-next">
                      {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );

      case 7:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Step 7: Review & Submit
              </CardTitle>
              <CardDescription>Review your information and submit your application</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Application Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Country:</span>
                    <span>{countryCode === "BD" ? "Bangladesh" : "United States"}</span>
                    <span className="text-muted-foreground">Full Name:</span>
                    <span>{draft?.fullName || "Not provided"}</span>
                    {isUS && (
                      <>
                        <span className="text-muted-foreground">Delivery Method:</span>
                        <span className="capitalize">{draft?.deliveryMethod || "Not selected"}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Form {...finalReviewForm}>
                <form onSubmit={finalReviewForm.handleSubmit(handleFinalSubmit)} className="space-y-4">
                  <FormField
                    control={finalReviewForm.control}
                    name="profilePhotoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Photo *</FormLabel>
                        <FormControl>
                          <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Upload a clear photo of yourself</p>
                            <Input 
                              placeholder="Enter photo URL or upload" 
                              {...field} 
                              className="mt-2"
                              data-testid="input-profile-photo" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={finalReviewForm.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact person's name" {...field} data-testid="input-emergency-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={finalReviewForm.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Phone *</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact phone number" {...field} data-testid="input-emergency-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={finalReviewForm.control}
                    name="emergencyContactRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Spouse, Parent, Friend" {...field} data-testid="input-emergency-relationship" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitApplicationMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-submit"
                    >
                      {submitApplicationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Submit Application
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/partner/delivery-driver/start">
            <Button variant="ghost" data-testid="button-back-to-start">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Start
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Delivery Driver Onboarding</h2>
            <Badge variant="outline">
              {countryCode === "BD" ? "🇧🇩 Bangladesh" : "🇺🇸 United States"}
            </Badge>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span>Step {currentStep} of {WIZARD_STEPS.length}</span>
            <span>{Math.round(progressPercent)}% Complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          <div className="flex justify-between mt-4">
            {WIZARD_STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              const isSkipped = (step.id === 5 && isBD) || (step.id === 6 && isUS && draft?.deliveryMethod !== "car");
              
              return (
                <div 
                  key={step.id}
                  className={`flex flex-col items-center ${isSkipped ? "opacity-40" : ""}`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs ${
                    isCompleted ? "bg-green-500 text-white" :
                    isActive ? "bg-primary text-primary-foreground" : 
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs mt-1 hidden md:block">{step.id}</span>
                </div>
              );
            })}
          </div>
        </div>

        {renderStepContent()}
      </div>
    </div>
  );
}
