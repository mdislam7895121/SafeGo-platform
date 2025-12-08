import { useState } from "react";
import { useLocation, Link, Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  UtensilsCrossed, ArrowLeft, ArrowRight, CheckCircle2, 
  Loader2, Store, FileText, CreditCard, ShieldCheck,
  Upload, AlertCircle, Camera, MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isPartnerAvailable, getPartnerConfig } from "@shared/partnerAvailability";

// US state codes
const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "Washington DC" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

// Bangladesh districts
const BD_DISTRICTS = [
  "Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barisal", "Rangpur", "Mymensingh",
  "Comilla", "Gazipur", "Narayanganj", "Cox's Bazar", "Jessore", "Bogra", "Dinajpur", "Tangail",
];

const restaurantInfoSchema = z.object({
  restaurantName: z.string().min(2, "Restaurant name is required"),
  cuisineType: z.string().min(1, "Cuisine type is required"),
  address: z.string().min(3, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(), // US only
  district: z.string().optional(), // BD only
  zipCode: z.string().optional(), // US: required, BD: optional
  description: z.string().optional(),
  phone: z.string().min(7, "Phone number is required"),
});

const menuSetupSchema = z.object({
  hasExistingMenu: z.string().min(1, "Please select an option"),
  estimatedItems: z.string().optional(),
  primaryCategory: z.string().optional(),
});

const photosSchema = z.object({
  hasPhotos: z.string().min(1, "Please select an option"),
});

const documentsSchema = z.object({
  businessLicenseNumber: z.string().optional(),
  nidNumber: z.string().optional(),
  governmentIdType: z.string().optional(),
  governmentIdLast4: z.string().optional(),
  taxIdLast4: z.string().optional(),
});

const payoutSchema = z.object({
  payoutMethod: z.string().min(1, "Payout method is required"),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  mfsProvider: z.string().optional(),
  mfsNumber: z.string().optional(),
});

const kycSchema = z.object({
  ownerName: z.string().min(2, "Owner name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  emergencyContactName: z.string().min(2, "Emergency contact name required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone required"),
  fatherName: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  homeAddress: z.string().optional(),
});

type RestaurantInfoData = z.infer<typeof restaurantInfoSchema>;
type MenuSetupData = z.infer<typeof menuSetupSchema>;
type PhotosData = z.infer<typeof photosSchema>;
type DocumentsData = z.infer<typeof documentsSchema>;
type PayoutData = z.infer<typeof payoutSchema>;
type KycData = z.infer<typeof kycSchema>;

interface RegistrationData {
  restaurantInfo: Partial<RestaurantInfoData>;
  menuSetup: Partial<MenuSetupData>;
  photos: Partial<PhotosData>;
  documents: Partial<DocumentsData>;
  payout: Partial<PayoutData>;
  kyc: Partial<KycData>;
}

const STEPS = [
  { id: 1, title: "Restaurant Information", icon: Store },
  { id: 2, title: "Menu Setup", icon: UtensilsCrossed },
  { id: 3, title: "Photos & Branding", icon: Camera },
  { id: 4, title: "Business Documents", icon: FileText },
  { id: 5, title: "Bank/Payout Setup", icon: CreditCard },
  { id: 6, title: "KYC Verification", icon: ShieldCheck },
];

export default function RestaurantRegistration() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationData>({
    restaurantInfo: {},
    menuSetup: {},
    photos: {},
    documents: {},
    payout: {},
    kyc: {},
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [nidFrontFile, setNidFrontFile] = useState<File | null>(null);
  const [nidBackFile, setNidBackFile] = useState<File | null>(null);

  const countryCode = user?.countryCode || "BD";
  const isBD = countryCode === "BD";
  const config = getPartnerConfig('restaurant', countryCode);
  const isAvailable = isPartnerAvailable('restaurant', countryCode);

  const { data: existingProfile, isLoading: profileLoading } = useQuery<{ profile: any } | null>({
    queryKey: ["/api/restaurant/registration/status"],
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/restaurant/registration/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/registration/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/validate"] });
      toast({
        title: "Application Submitted",
        description: "Your restaurant partner application has been submitted for review. Redirecting to your dashboard...",
      });
      // Redirect to restaurant dashboard to see verification status
      setLocation("/partner/restaurant/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const restaurantInfoForm = useForm<RestaurantInfoData>({
    resolver: zodResolver(restaurantInfoSchema),
    defaultValues: {
      restaurantName: "",
      cuisineType: "",
      address: "",
      city: "",
      state: "",
      district: "",
      zipCode: "",
      description: "",
      phone: "",
    },
  });

  const menuSetupForm = useForm<MenuSetupData>({
    resolver: zodResolver(menuSetupSchema),
    defaultValues: {
      hasExistingMenu: "",
      estimatedItems: "",
      primaryCategory: "",
    },
  });

  const photosForm = useForm<PhotosData>({
    resolver: zodResolver(photosSchema),
    defaultValues: {
      hasPhotos: "",
    },
  });

  const documentsForm = useForm<DocumentsData>({
    resolver: zodResolver(documentsSchema),
    defaultValues: {
      businessLicenseNumber: "",
      nidNumber: "",
      governmentIdType: "",
      governmentIdLast4: "",
      taxIdLast4: "",
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

  const kycForm = useForm<KycData>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      ownerName: "",
      dateOfBirth: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      fatherName: "",
      presentAddress: "",
      permanentAddress: "",
      homeAddress: "",
    },
  });

  if (!user) {
    return <Redirect to="/login?returnTo=/partner/restaurant/start" />;
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
                Your restaurant application is being reviewed. {config?.approvalMessage}
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
    return <Redirect to="/restaurant" />;
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
                  description: "We'll notify you when SafeGo Eats opens in your area.",
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
      isValid = await restaurantInfoForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, restaurantInfo: restaurantInfoForm.getValues() }));
      }
    } else if (currentStep === 2) {
      isValid = await menuSetupForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, menuSetup: menuSetupForm.getValues() }));
      }
    } else if (currentStep === 3) {
      isValid = await photosForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, photos: photosForm.getValues() }));
      }
    } else if (currentStep === 4) {
      isValid = true;
      setFormData(prev => ({ ...prev, documents: documentsForm.getValues() }));
    } else if (currentStep === 5) {
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

  const handleSubmit = async () => {
    const isValid = await kycForm.trigger();
    if (!isValid) return;

    const submitData = {
      restaurantInfo: formData.restaurantInfo,
      documents: formData.documents,
      kyc: kycForm.getValues(),
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
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="h-8 w-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold">Join SafeGo Eats</h1>
          <p className="text-muted-foreground mt-2">
            Partner with us to grow your restaurant business
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
          {STEPS.map((step) => {
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
                  {currentStep === 1 && "Tell us about your restaurant"}
                  {currentStep === 2 && "Set up your menu structure"}
                  {currentStep === 3 && "Add photos of your restaurant"}
                  {currentStep === 4 && "Upload business documents"}
                  {currentStep === 5 && "Set up your payout method"}
                  {currentStep === 6 && "Verify your identity"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <Form {...restaurantInfoForm}>
                <form className="space-y-4">
                  <FormField
                    control={restaurantInfoForm.control}
                    name="restaurantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter restaurant name" {...field} data-testid="input-restaurant-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={restaurantInfoForm.control}
                    name="cuisineType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuisine Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-cuisine-type">
                              <SelectValue placeholder="Select cuisine type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bengali">Bengali</SelectItem>
                            <SelectItem value="chinese">Chinese</SelectItem>
                            <SelectItem value="indian">Indian</SelectItem>
                            <SelectItem value="italian">Italian</SelectItem>
                            <SelectItem value="american">American</SelectItem>
                            <SelectItem value="mexican">Mexican</SelectItem>
                            <SelectItem value="thai">Thai</SelectItem>
                            <SelectItem value="japanese">Japanese</SelectItem>
                            <SelectItem value="fast_food">Fast Food</SelectItem>
                            <SelectItem value="cafe">Cafe</SelectItem>
                            <SelectItem value="bakery">Bakery</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={restaurantInfoForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Full address" {...field} data-testid="input-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* City field - text input for all countries */}
                  <FormField
                    control={restaurantInfoForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={isBD ? "e.g., Dhaka, Chittagong" : "e.g., Brooklyn, Manhattan"} 
                            {...field} 
                            data-testid="input-city" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* US-specific: State dropdown */}
                  {!isBD && (
                    <FormField
                      control={restaurantInfoForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-state">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state.code} value={state.code}>
                                  {state.name} ({state.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* BD-specific: District dropdown */}
                  {isBD && (
                    <FormField
                      control={restaurantInfoForm.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>District</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-district">
                                <SelectValue placeholder="Select district" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BD_DISTRICTS.map((district) => (
                                <SelectItem key={district} value={district.toLowerCase()}>
                                  {district}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* ZIP/Postal Code field */}
                  <FormField
                    control={restaurantInfoForm.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isBD ? "Postal Code (Optional)" : "ZIP Code"}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={isBD ? "e.g., 1205" : "e.g., 11212"} 
                            {...field} 
                            data-testid="input-zip-code" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={restaurantInfoForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact number" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={restaurantInfoForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Tell customers about your restaurant..." {...field} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {currentStep === 2 && (
              <Form {...menuSetupForm}>
                <form className="space-y-4">
                  <FormField
                    control={menuSetupForm.control}
                    name="hasExistingMenu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Do you have a menu ready?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-has-menu">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes, I have a menu ready</SelectItem>
                            <SelectItem value="partial">I have a partial menu</SelectItem>
                            <SelectItem value="no">No, I need to create one</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={menuSetupForm.control}
                    name="estimatedItems"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated number of menu items</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-estimated-items">
                              <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 items</SelectItem>
                            <SelectItem value="11-25">11-25 items</SelectItem>
                            <SelectItem value="26-50">26-50 items</SelectItem>
                            <SelectItem value="50+">More than 50 items</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={menuSetupForm.control}
                    name="primaryCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary menu category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-primary-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="main_dishes">Main Dishes</SelectItem>
                            <SelectItem value="appetizers">Appetizers</SelectItem>
                            <SelectItem value="desserts">Desserts</SelectItem>
                            <SelectItem value="beverages">Beverages</SelectItem>
                            <SelectItem value="combo_meals">Combo Meals</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      You can add and manage your full menu after your application is approved. 
                      For now, just tell us about your menu structure.
                    </p>
                  </div>
                </form>
              </Form>
            )}

            {currentStep === 3 && (
              <Form {...photosForm}>
                <form className="space-y-4">
                  <FormField
                    control={photosForm.control}
                    name="hasPhotos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Do you have photos ready?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-has-photos">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes, I have photos ready</SelectItem>
                            <SelectItem value="some">I have some photos</SelectItem>
                            <SelectItem value="no">No, I'll add them later</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Restaurant Logo (Optional)</Label>
                      <label htmlFor="logo-upload" className="block cursor-pointer">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Upload your restaurant logo</p>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="logo-upload"
                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                            data-testid="input-logo"
                          />
                          <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                            Choose File
                          </span>
                          {logoFile && <p className="text-sm mt-2 text-primary font-medium">{logoFile.name}</p>}
                        </div>
                      </label>
                    </div>
                    <div className="space-y-2">
                      <Label>Cover Photo (Optional)</Label>
                      <label htmlFor="cover-upload" className="block cursor-pointer">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Upload a cover photo for your restaurant</p>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="cover-upload"
                            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                            data-testid="input-cover"
                          />
                          <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                            Choose File
                          </span>
                          {coverFile && <p className="text-sm mt-2 text-primary font-medium">{coverFile.name}</p>}
                        </div>
                      </label>
                    </div>
                  </div>
                </form>
              </Form>
            )}

            {currentStep === 4 && (
              <Form {...documentsForm}>
                <form className="space-y-4">
                  <FormField
                    control={documentsForm.control}
                    name="businessLicenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business License Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter license number" {...field} data-testid="input-license-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>Business License Document (Optional)</Label>
                    <label htmlFor="license-upload" className="block cursor-pointer">
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Upload business license</p>
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          className="hidden" 
                          id="license-upload"
                          onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                          data-testid="input-license-doc"
                        />
                        <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                          Choose File
                        </span>
                        {licenseFile && <p className="text-sm mt-2 text-primary font-medium">{licenseFile.name}</p>}
                      </div>
                    </label>
                  </div>
                  {!isBD && (
                    <FormField
                      control={documentsForm.control}
                      name="taxIdLast4"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax ID (Last 4 digits)</FormLabel>
                          <FormControl>
                            <Input placeholder="Last 4 digits" maxLength={4} {...field} data-testid="input-tax-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </form>
              </Form>
            )}

            {currentStep === 5 && (
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
                            {isBD && <SelectItem value="mfs">Mobile Money (bKash/Nagad)</SelectItem>}
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

            {currentStep === 6 && (
              <Form {...kycForm}>
                <form className="space-y-4">
                  <FormField
                    control={kycForm.control}
                    name="ownerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner/Manager Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full name" {...field} data-testid="input-owner-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={kycForm.control}
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
                        control={kycForm.control}
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
                        control={documentsForm.control}
                        name="nidNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NID Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter NID number" {...field} data-testid="input-nid-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>NID Front Image</Label>
                          <label htmlFor="nid-front" className="block cursor-pointer">
                            <div className="border-2 border-dashed rounded-lg p-4 text-center hover-elevate transition-colors">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                id="nid-front"
                                onChange={(e) => setNidFrontFile(e.target.files?.[0] || null)}
                              />
                              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                                Upload Front
                              </span>
                              {nidFrontFile && <p className="text-xs mt-1 text-primary font-medium">{nidFrontFile.name}</p>}
                            </div>
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label>NID Back Image</Label>
                          <label htmlFor="nid-back" className="block cursor-pointer">
                            <div className="border-2 border-dashed rounded-lg p-4 text-center hover-elevate transition-colors">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                id="nid-back"
                                onChange={(e) => setNidBackFile(e.target.files?.[0] || null)}
                              />
                              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                                Upload Back
                              </span>
                              {nidBackFile && <p className="text-xs mt-1 text-primary font-medium">{nidBackFile.name}</p>}
                            </div>
                          </label>
                        </div>
                      </div>
                      <FormField
                        control={kycForm.control}
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
                        control={kycForm.control}
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
                    <>
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
                                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                                  <SelectItem value="passport">Passport</SelectItem>
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
                        control={kycForm.control}
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
                    </>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={kycForm.control}
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
                      control={kycForm.control}
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

                  <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                    <CardContent className="p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        By submitting this application, you agree to SafeGo's Terms of Service and Restaurant Partner Agreement.
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                        {config?.approvalMessage}
                      </p>
                    </CardContent>
                  </Card>
                </form>
              </Form>
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
