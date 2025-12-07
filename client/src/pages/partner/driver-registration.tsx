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
  Upload, AlertCircle, MapPin, Building2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isPartnerAvailable, getPartnerConfig, type PartnerType } from "@shared/partnerAvailability";

const NYC_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' }
];

const EMERGENCY_RELATIONSHIPS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'child', label: 'Child' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];

const personalInfoSchemaUS = z.object({
  usaFullLegalName: z.string().min(2, "Full legal name is required"),
  phone: z.string().min(10, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  usaStreet: z.string().min(5, "Street address is required"),
  usaAptUnit: z.string().optional(),
  usaCity: z.string().min(2, "City is required"),
  usaState: z.string().min(2, "State is required"),
  usaZipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Valid ZIP code required (e.g., 12345)"),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  emergencyContactRelationship: z.string().min(1, "Emergency contact relationship is required"),
  ssnLast4: z.string().max(4).regex(/^\d{4}$/, "Must be exactly 4 digits").optional().or(z.literal("")),
});

const personalInfoSchemaBD = z.object({
  phone: z.string().min(10, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  fatherName: z.string().min(2, "Father's name is required"),
  presentAddress: z.string().min(5, "Present address is required"),
  permanentAddress: z.string().optional(),
});

const licenseInfoSchema = z.object({
  driverLicenseNumber: z.string().min(5, "License number is required"),
  driverLicenseState: z.string().min(2, "License state is required"),
  driverLicenseExpiry: z.string().min(1, "License expiry is required"),
  driverLicenseFrontUrl: z.string().optional(),
  driverLicenseBackUrl: z.string().optional(),
});

const vehicleInfoSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehiclePlate: z.string().min(1, "Vehicle plate is required"),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleColor: z.string().optional(),
  registrationDocumentUrl: z.string().optional(),
  insuranceDocumentUrl: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
});

const nycComplianceSchema = z.object({
  tlcLicenseNumber: z.string().min(5, "TLC license number is required"),
  tlcLicenseFrontUrl: z.string().optional(),
  tlcLicenseBackUrl: z.string().optional(),
  tlcLicenseExpiry: z.string().optional(),
  fhvLicenseNumber: z.string().min(1, "FHV license number is required"),
  fhvDocumentUrl: z.string().optional(),
  dmvInspectionDate: z.string().min(1, "DMV inspection date is required"),
  dmvInspectionExpiry: z.string().min(1, "DMV inspection expiry is required"),
  dmvInspectionImageUrl: z.string().optional(),
});

const documentsSchema = z.object({
  nidNumber: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  driverLicenseExpiry: z.string().optional(),
  driverLicenseState: z.string().optional(),
  governmentIdType: z.string().optional(),
  governmentIdLast4: z.string().optional(),
  ssnLast4: z.string().optional(),
});

type PersonalInfoUSData = z.infer<typeof personalInfoSchemaUS>;
type PersonalInfoBDData = z.infer<typeof personalInfoSchemaBD>;
type LicenseInfoData = z.infer<typeof licenseInfoSchema>;
type VehicleInfoData = z.infer<typeof vehicleInfoSchema>;
type NycComplianceData = z.infer<typeof nycComplianceSchema>;
type DocumentsData = z.infer<typeof documentsSchema>;

interface RegistrationData {
  personalInfo: Partial<PersonalInfoUSData & PersonalInfoBDData>;
  licenseInfo: Partial<LicenseInfoData>;
  vehicleInfo: Partial<VehicleInfoData>;
  nycCompliance: Partial<NycComplianceData>;
  documents: Partial<DocumentsData>;
}

function isNycBorough(city: string | undefined, state: string | undefined): boolean {
  if (!city || state !== 'NY') return false;
  const normalizedCity = city.trim().toLowerCase();
  return NYC_BOROUGHS.some(borough => normalizedCity.includes(borough.toLowerCase()));
}

export default function DriverRegistration() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isNycDriver, setIsNycDriver] = useState(false);
  const [formData, setFormData] = useState<RegistrationData>({
    personalInfo: {},
    licenseInfo: {},
    vehicleInfo: {},
    nycCompliance: {},
    documents: {},
  });
  const [licenseFrontFile, setLicenseFrontFile] = useState<File | null>(null);
  const [licenseBackFile, setLicenseBackFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [tlcFrontFile, setTlcFrontFile] = useState<File | null>(null);
  const [tlcBackFile, setTlcBackFile] = useState<File | null>(null);
  const [fhvFile, setFhvFile] = useState<File | null>(null);
  const [dmvInspectionFile, setDmvInspectionFile] = useState<File | null>(null);
  const [nidFrontFile, setNidFrontFile] = useState<File | null>(null);
  const [nidBackFile, setNidBackFile] = useState<File | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  const driverType: 'ride' | 'delivery' = typeParam === 'delivery' ? 'delivery' : 'ride';
  
  const countryCode = user?.countryCode || "US";
  const isBD = countryCode === "BD";
  const isUS = countryCode === "US";
  const partnerType: PartnerType = driverType === 'ride' ? 'driver_ride' : 'driver_delivery';
  const config = getPartnerConfig(partnerType, countryCode);
  const isAvailable = isPartnerAvailable(partnerType, countryCode);

  const STEPS_US = isNycDriver ? [
    { id: 1, title: "Personal Information", icon: User },
    { id: 2, title: "Driver License", icon: FileText },
    { id: 3, title: "Vehicle Details", icon: Car },
    { id: 4, title: "NYC Compliance", icon: Building2 },
    { id: 5, title: "Review & Submit", icon: ShieldCheck },
  ] : [
    { id: 1, title: "Personal Information", icon: User },
    { id: 2, title: "Driver License", icon: FileText },
    { id: 3, title: "Vehicle Details", icon: Car },
    { id: 4, title: "Review & Submit", icon: ShieldCheck },
  ];

  const STEPS_BD = [
    { id: 1, title: "Personal Information", icon: User },
    { id: 2, title: "Vehicle Information", icon: Car },
    { id: 3, title: "Documents", icon: FileText },
    { id: 4, title: "Review & Submit", icon: ShieldCheck },
  ];

  const STEPS = isBD ? STEPS_BD : STEPS_US;

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

  const personalFormUS = useForm<PersonalInfoUSData>({
    resolver: zodResolver(personalInfoSchemaUS),
    defaultValues: {
      usaFullLegalName: "",
      phone: "",
      dateOfBirth: "",
      usaStreet: "",
      usaAptUnit: "",
      usaCity: "",
      usaState: "",
      usaZipCode: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      ssnLast4: "",
    },
  });

  const personalFormBD = useForm<PersonalInfoBDData>({
    resolver: zodResolver(personalInfoSchemaBD),
    defaultValues: {
      phone: "",
      dateOfBirth: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      fatherName: "",
      presentAddress: "",
      permanentAddress: "",
    },
  });

  const licenseForm = useForm<LicenseInfoData>({
    resolver: zodResolver(licenseInfoSchema),
    defaultValues: {
      driverLicenseNumber: "",
      driverLicenseState: "",
      driverLicenseExpiry: "",
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

  const nycForm = useForm<NycComplianceData>({
    resolver: zodResolver(nycComplianceSchema),
    defaultValues: {
      tlcLicenseNumber: "",
      tlcLicenseExpiry: "",
      fhvLicenseNumber: "",
      dmvInspectionDate: "",
      dmvInspectionExpiry: "",
    },
  });

  const documentsForm = useForm<DocumentsData>({
    resolver: zodResolver(documentsSchema),
    defaultValues: {
      nidNumber: "",
      driverLicenseNumber: "",
      driverLicenseExpiry: "",
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
    
    if (isUS) {
      if (currentStep === 1) {
        isValid = await personalFormUS.trigger();
        if (isValid) {
          const values = personalFormUS.getValues();
          setFormData(prev => ({ ...prev, personalInfo: values }));
          const needsNycCompliance = values.usaState === 'NY' && 
            isNycBorough(values.usaCity, values.usaState);
          setIsNycDriver(needsNycCompliance);
        }
      } else if (currentStep === 2) {
        isValid = await licenseForm.trigger();
        if (isValid) {
          setFormData(prev => ({ ...prev, licenseInfo: licenseForm.getValues() }));
        }
      } else if (currentStep === 3) {
        isValid = await vehicleForm.trigger();
        if (isValid) {
          setFormData(prev => ({ ...prev, vehicleInfo: vehicleForm.getValues() }));
        }
      } else if (currentStep === 4 && isNycDriver) {
        isValid = await nycForm.trigger();
        if (isValid) {
          setFormData(prev => ({ ...prev, nycCompliance: nycForm.getValues() }));
        }
      }
    } else {
      if (currentStep === 1) {
        isValid = await personalFormBD.trigger();
        if (isValid) {
          setFormData(prev => ({ ...prev, personalInfo: personalFormBD.getValues() }));
        }
      } else if (currentStep === 2) {
        isValid = await vehicleForm.trigger();
        if (isValid) {
          setFormData(prev => ({ ...prev, vehicleInfo: vehicleForm.getValues() }));
        }
      } else if (currentStep === 3) {
        const docs = documentsForm.getValues();
        if (!docs.nidNumber || docs.nidNumber.trim().length < 10) {
          toast({ 
            title: "NID তথ্য প্রয়োজন", 
            description: "সঠিক জাতীয় পরিচয়পত্র নম্বর লিখুন",
            variant: "destructive" 
          });
          return;
        }
        isValid = true;
        setFormData(prev => ({ ...prev, documents: docs }));
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
    const submitData = isUS ? {
      driverType,
      countryCode,
      personalInfo: {
        phone: formData.personalInfo.phone,
        dateOfBirth: formData.personalInfo.dateOfBirth,
        emergencyContactName: formData.personalInfo.emergencyContactName,
        emergencyContactPhone: formData.personalInfo.emergencyContactPhone,
        emergencyContactRelationship: formData.personalInfo.emergencyContactRelationship,
        usaFullLegalName: formData.personalInfo.usaFullLegalName,
        usaStreet: formData.personalInfo.usaStreet,
        usaAptUnit: formData.personalInfo.usaAptUnit,
        usaCity: formData.personalInfo.usaCity,
        usaState: formData.personalInfo.usaState,
        usaZipCode: formData.personalInfo.usaZipCode,
        ssnLast4: formData.personalInfo.ssnLast4,
      },
      vehicleInfo: formData.vehicleInfo,
      documents: {
        driverLicenseNumber: formData.licenseInfo.driverLicenseNumber,
        driverLicenseExpiry: formData.licenseInfo.driverLicenseExpiry,
        driverLicenseState: formData.licenseInfo.driverLicenseState,
        driverLicenseFrontUrl: formData.licenseInfo.driverLicenseFrontUrl,
        driverLicenseBackUrl: formData.licenseInfo.driverLicenseBackUrl,
      },
      nycCompliance: isNycDriver ? formData.nycCompliance : undefined,
    } : {
      driverType,
      countryCode,
      personalInfo: formData.personalInfo,
      vehicleInfo: formData.vehicleInfo,
      documents: formData.documents,
    };
    
    submitMutation.mutate(submitData);
  };

  const StepIcon = STEPS[currentStep - 1].icon;

  const renderUSPersonalInfo = () => (
    <Form {...personalFormUS}>
      <form className="space-y-4">
        <FormField
          control={personalFormUS.control}
          name="usaFullLegalName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Legal Name *</FormLabel>
              <FormControl>
                <Input placeholder="As shown on driver license" {...field} data-testid="input-legal-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={personalFormUS.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={personalFormUS.control}
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
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Home Address
          </h4>
          
          <FormField
            control={personalFormUS.control}
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
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField
              control={personalFormUS.control}
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
            <FormField
              control={personalFormUS.control}
              name="usaCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input placeholder="City" {...field} data-testid="input-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField
              control={personalFormUS.control}
              name="usaState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={personalFormUS.control}
              name="usaZipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="12345" maxLength={10} {...field} data-testid="input-zip" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Emergency Contact</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={personalFormUS.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Contact name" {...field} data-testid="input-emergency-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={personalFormUS.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone *</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 123-4567" {...field} data-testid="input-emergency-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={personalFormUS.control}
            name="emergencyContactRelationship"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Relationship *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-relationship">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EMERGENCY_RELATIONSHIPS.map(rel => (
                      <SelectItem key={rel.value} value={rel.value}>{rel.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border-t pt-4 mt-4">
          <FormField
            control={personalFormUS.control}
            name="ssnLast4"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SSN Last 4 Digits (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="••••" 
                    maxLength={4} 
                    type="password"
                    {...field} 
                    data-testid="input-ssn-last4" 
                  />
                </FormControl>
                <FormDescription>
                  We never store your full SSN. This is optional for identity verification.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );

  const renderLicenseInfo = () => (
    <Form {...licenseForm}>
      <form className="space-y-4">
        <FormField
          control={licenseForm.control}
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={licenseForm.control}
            name="driverLicenseState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License State *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-license-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {US_STATES.map(state => (
                      <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={licenseForm.control}
            name="driverLicenseExpiry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expiration Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-license-expiry" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>License Front Image *</Label>
            <label htmlFor="license-front" className="block cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Upload front of license</p>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="license-front"
                  onChange={(e) => setLicenseFrontFile(e.target.files?.[0] || null)}
                  data-testid="input-license-front"
                />
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                  Choose File
                </span>
                {licenseFrontFile && <p className="text-sm mt-2 text-primary font-medium">{licenseFrontFile.name}</p>}
              </div>
            </label>
          </div>
          
          <div className="space-y-2">
            <Label>License Back Image *</Label>
            <label htmlFor="license-back" className="block cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Upload back of license</p>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="license-back"
                  onChange={(e) => setLicenseBackFile(e.target.files?.[0] || null)}
                  data-testid="input-license-back"
                />
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                  Choose File
                </span>
                {licenseBackFile && <p className="text-sm mt-2 text-primary font-medium">{licenseBackFile.name}</p>}
              </div>
            </label>
          </div>
        </div>
      </form>
    </Form>
  );

  const renderVehicleInfo = () => (
    <Form {...vehicleForm}>
      <form className="space-y-4">
        <FormField
          control={vehicleForm.control}
          name="vehicleType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-vehicle-type">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {driverType === 'ride' ? (
                    <>
                      <SelectItem value="sedan">Sedan</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="minivan">Minivan</SelectItem>
                      <SelectItem value="luxury">Luxury</SelectItem>
                      {isBD && <SelectItem value="cng">CNG Auto</SelectItem>}
                    </>
                  ) : (
                    <>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="bicycle">Bicycle</SelectItem>
                      <SelectItem value="scooter">Scooter</SelectItem>
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
                <FormLabel>Make *</FormLabel>
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
                <FormLabel>Model *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Camry" {...field} data-testid="input-vehicle-model" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={vehicleForm.control}
            name="vehicleYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <FormControl>
                  <Input placeholder="2024" maxLength={4} {...field} data-testid="input-vehicle-year" />
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
                <FormLabel>Color</FormLabel>
                <FormControl>
                  <Input placeholder="White" {...field} data-testid="input-vehicle-color" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={vehicleForm.control}
            name="vehiclePlate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plate Number *</FormLabel>
                <FormControl>
                  <Input placeholder="ABC-1234" {...field} data-testid="input-vehicle-plate" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isUS && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Vehicle Documents</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Registration *</Label>
                <label htmlFor="registration-doc" className="block cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Upload registration</p>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      className="hidden" 
                      id="registration-doc"
                      onChange={(e) => setRegistrationFile(e.target.files?.[0] || null)}
                      data-testid="input-registration-doc"
                    />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                      Choose File
                    </span>
                    {registrationFile && <p className="text-sm mt-2 text-primary font-medium">{registrationFile.name}</p>}
                  </div>
                </label>
              </div>
              
              <div className="space-y-2">
                <Label>Vehicle Insurance *</Label>
                <label htmlFor="insurance-doc" className="block cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Upload insurance</p>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      className="hidden" 
                      id="insurance-doc"
                      onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)}
                      data-testid="input-insurance-doc"
                    />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                      Choose File
                    </span>
                    {insuranceFile && <p className="text-sm mt-2 text-primary font-medium">{insuranceFile.name}</p>}
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </form>
    </Form>
  );

  const renderNycCompliance = () => (
    <Form {...nycForm}>
      <form className="space-y-6">
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>NYC TLC/FHV Compliance Required:</strong> As a driver operating in one of New York City's five boroughs, 
              you must provide additional documentation including your TLC license, FHV permit, and DMV inspection records.
            </p>
          </CardContent>
        </Card>

        <div className="border-b pb-4">
          <h4 className="font-medium mb-3">TLC License</h4>
          
          <FormField
            control={nycForm.control}
            name="tlcLicenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TLC License Number *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter TLC license number" {...field} data-testid="input-tlc-number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={nycForm.control}
            name="tlcLicenseExpiry"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>TLC License Expiry</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-tlc-expiry" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>TLC License Front *</Label>
              <label htmlFor="tlc-front" className="block cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Upload TLC front</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="tlc-front"
                    onChange={(e) => setTlcFrontFile(e.target.files?.[0] || null)}
                    data-testid="input-tlc-front"
                  />
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                    Choose File
                  </span>
                  {tlcFrontFile && <p className="text-sm mt-2 text-primary font-medium">{tlcFrontFile.name}</p>}
                </div>
              </label>
            </div>
            
            <div className="space-y-2">
              <Label>TLC License Back *</Label>
              <label htmlFor="tlc-back" className="block cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Upload TLC back</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="tlc-back"
                    onChange={(e) => setTlcBackFile(e.target.files?.[0] || null)}
                    data-testid="input-tlc-back"
                  />
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                    Choose File
                  </span>
                  {tlcBackFile && <p className="text-sm mt-2 text-primary font-medium">{tlcBackFile.name}</p>}
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="border-b pb-4">
          <h4 className="font-medium mb-3">FHV (For-Hire Vehicle) License</h4>
          
          <FormField
            control={nycForm.control}
            name="fhvLicenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FHV License/Barcode Number *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter FHV number or barcode" {...field} data-testid="input-fhv-number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2 mt-4">
            <Label>FHV Document/Sticker *</Label>
            <label htmlFor="fhv-doc" className="block cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Upload FHV document or sticker image</p>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="fhv-doc"
                  onChange={(e) => setFhvFile(e.target.files?.[0] || null)}
                  data-testid="input-fhv-doc"
                />
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                  Choose File
                </span>
                {fhvFile && <p className="text-sm mt-2 text-primary font-medium">{fhvFile.name}</p>}
              </div>
            </label>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">DMV Inspection</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={nycForm.control}
              name="dmvInspectionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inspection Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-dmv-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={nycForm.control}
              name="dmvInspectionExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inspection Expiry *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-dmv-expiry" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2 mt-4">
            <Label>DMV Inspection Document *</Label>
            <label htmlFor="dmv-doc" className="block cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Upload DMV inspection paper/photo</p>
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  className="hidden" 
                  id="dmv-doc"
                  onChange={(e) => setDmvInspectionFile(e.target.files?.[0] || null)}
                  data-testid="input-dmv-doc"
                />
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                  Choose File
                </span>
                {dmvInspectionFile && <p className="text-sm mt-2 text-primary font-medium">{dmvInspectionFile.name}</p>}
              </div>
            </label>
          </div>
        </div>
      </form>
    </Form>
  );

  const renderBDPersonalInfo = () => (
    <Form {...personalFormBD}>
      <form className="space-y-4">
        <FormField
          control={personalFormBD.control}
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
          control={personalFormBD.control}
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
        <FormField
          control={personalFormBD.control}
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
          control={personalFormBD.control}
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
          control={personalFormBD.control}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={personalFormBD.control}
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
            control={personalFormBD.control}
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
  );

  const renderBDDocuments = () => (
    <Form {...documentsForm}>
      <form className="space-y-4">
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
          <label htmlFor="nid-front" className="block cursor-pointer">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
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
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                Choose File
              </span>
              {nidFrontFile && <p className="text-sm mt-2 text-primary font-medium">{nidFrontFile.name}</p>}
            </div>
          </label>
        </div>
        <div className="space-y-2">
          <Label>NID Back Image</Label>
          <label htmlFor="nid-back" className="block cursor-pointer">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors">
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
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-2">
                Choose File
              </span>
              {nidBackFile && <p className="text-sm mt-2 text-primary font-medium">{nidBackFile.name}</p>}
            </div>
          </label>
        </div>
      </form>
    </Form>
  );

  const renderReviewUS = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4 space-y-4">
        <h4 className="font-medium">Application Summary</h4>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Personal Information</p>
          <div className="text-sm text-muted-foreground">
            <p>Name: {formData.personalInfo.usaFullLegalName}</p>
            <p>Phone: {formData.personalInfo.phone}</p>
            <p>DOB: {formData.personalInfo.dateOfBirth}</p>
            <p>Address: {formData.personalInfo.usaStreet}{formData.personalInfo.usaAptUnit ? `, ${formData.personalInfo.usaAptUnit}` : ''}, {formData.personalInfo.usaCity}, {formData.personalInfo.usaState} {formData.personalInfo.usaZipCode}</p>
            <p>Emergency: {formData.personalInfo.emergencyContactName} ({formData.personalInfo.emergencyContactRelationship}) - {formData.personalInfo.emergencyContactPhone}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Driver License</p>
          <div className="text-sm text-muted-foreground">
            <p>License: {formData.licenseInfo.driverLicenseNumber}</p>
            <p>State: {formData.licenseInfo.driverLicenseState}</p>
            <p>Expires: {formData.licenseInfo.driverLicenseExpiry}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Vehicle Information</p>
          <div className="text-sm text-muted-foreground">
            <p>Type: {formData.vehicleInfo.vehicleType}</p>
            <p>Vehicle: {formData.vehicleInfo.vehicleMake} {formData.vehicleInfo.vehicleModel} ({formData.vehicleInfo.vehicleYear})</p>
            <p>Plate: {formData.vehicleInfo.vehiclePlate}</p>
          </div>
        </div>

        {isNycDriver && formData.nycCompliance && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">NYC Compliance</p>
              <Badge variant="secondary" className="text-xs">TLC/FHV</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>TLC License: {formData.nycCompliance.tlcLicenseNumber}</p>
              <p>FHV Number: {formData.nycCompliance.fhvLicenseNumber}</p>
              <p>DMV Inspection: {formData.nycCompliance.dmvInspectionDate} - {formData.nycCompliance.dmvInspectionExpiry}</p>
            </div>
          </div>
        )}
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
  );

  const renderReviewBD = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4 space-y-4">
        <h4 className="font-medium">Application Summary</h4>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Personal Information</p>
          <div className="text-sm text-muted-foreground">
            <p>Phone: {formData.personalInfo.phone}</p>
            <p>DOB: {formData.personalInfo.dateOfBirth}</p>
            <p>Father: {formData.personalInfo.fatherName}</p>
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
            <p>NID: {formData.documents.nidNumber}</p>
          </div>
        </div>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            এই আবেদন জমা দিয়ে, আপনি SafeGo-এর সেবার শর্তাবলী এবং পার্টনার চুক্তিতে সম্মত হচ্ছেন।
            আপনার আবেদন পর্যালোচনা করা হবে এবং ফলাফল সম্পর্কে আপনাকে জানানো হবে।
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
            {config?.approvalMessage}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderStepContent = () => {
    if (isUS) {
      if (currentStep === 1) return renderUSPersonalInfo();
      if (currentStep === 2) return renderLicenseInfo();
      if (currentStep === 3) return renderVehicleInfo();
      if (isNycDriver) {
        if (currentStep === 4) return renderNycCompliance();
        if (currentStep === 5) return renderReviewUS();
      } else {
        if (currentStep === 4) return renderReviewUS();
      }
    } else {
      if (currentStep === 1) return renderBDPersonalInfo();
      if (currentStep === 2) return renderVehicleInfo();
      if (currentStep === 3) return renderBDDocuments();
      if (currentStep === 4) return renderReviewBD();
    }
    return null;
  };

  const isLastStep = currentStep === STEPS.length;

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
          {isNycDriver && (
            <Badge className="mt-2" variant="secondary">NYC TLC/FHV Required</Badge>
          )}
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
                  {isUS ? (
                    <>
                      {currentStep === 1 && "Enter your personal details and address"}
                      {currentStep === 2 && "Provide your driver license information"}
                      {currentStep === 3 && "Add your vehicle details and documents"}
                      {currentStep === 4 && (isNycDriver ? "Complete NYC TLC/FHV compliance" : "Review and submit your application")}
                      {currentStep === 5 && "Review and submit your application"}
                    </>
                  ) : (
                    <>
                      {currentStep === 1 && "Enter your personal details"}
                      {currentStep === 2 && "Add your vehicle information"}
                      {currentStep === 3 && "Upload required documents"}
                      {currentStep === 4 && "Review and submit your application"}
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderStepContent()}

            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                data-testid="button-previous"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {isLastStep ? (
                <Button 
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  data-testid="button-submit"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext} data-testid="button-next">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
