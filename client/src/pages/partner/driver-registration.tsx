import { useState } from "react";
import { useLocation, Link, Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Car, Bike, ArrowLeft, ArrowRight, CheckCircle2, 
  Loader2, User, FileText, ShieldCheck,
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
  usaZipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Valid ZIP code required (e.g., 12345 or 12345-6789)"),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  emergencyContactRelationship: z.string().min(1, "Relationship is required"),
  ssnLast4: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits").optional().or(z.literal("")),
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
  driverLicenseNumber: z.string().min(5, "Driver license number is required"),
  driverLicenseState: z.string().min(2, "License issuing state is required"),
  driverLicenseExpiry: z.string().min(1, "License expiry date is required"),
});

const vehicleInfoSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().min(4, "Vehicle year is required"),
  vehicleColor: z.string().min(1, "Vehicle color is required"),
  vehiclePlate: z.string().min(1, "License plate is required"),
});

const nycComplianceSchema = z.object({
  tlcLicenseNumber: z.string().min(5, "TLC license number is required"),
  tlcLicenseExpiry: z.string().min(1, "TLC license expiry is required"),
  fhvLicenseNumber: z.string().min(1, "FHV number/barcode is required"),
  dmvInspectionDate: z.string().min(1, "DMV inspection date is required"),
  dmvInspectionExpiry: z.string().min(1, "DMV inspection expiry is required"),
});

const documentsSchema = z.object({
  nidNumber: z.string().min(10, "NID number is required (minimum 10 digits)"),
});

type PersonalInfoUSData = z.infer<typeof personalInfoSchemaUS>;
type PersonalInfoBDData = z.infer<typeof personalInfoSchemaBD>;
type LicenseInfoData = z.infer<typeof licenseInfoSchema>;
type VehicleInfoData = z.infer<typeof vehicleInfoSchema>;
type NycComplianceData = z.infer<typeof nycComplianceSchema>;

interface RegistrationData {
  personalInfo: Partial<PersonalInfoUSData & PersonalInfoBDData>;
  licenseInfo: Partial<LicenseInfoData>;
  vehicleInfo: Partial<VehicleInfoData>;
  nycCompliance: Partial<NycComplianceData>;
  documents: { nidNumber?: string };
}

function isNycBorough(city: string | undefined): boolean {
  if (!city) return false;
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
    { id: 1, title: "Personal Information", icon: User, desc: "Name, contact, address" },
    { id: 2, title: "Driver License", icon: FileText, desc: "License details & images" },
    { id: 3, title: "Vehicle Details", icon: Car, desc: "Vehicle info & documents" },
    { id: 4, title: "NYC Compliance", icon: Building2, desc: "TLC, FHV, DMV inspection" },
    { id: 5, title: "Review & Submit", icon: ShieldCheck, desc: "Verify and submit" },
  ] : [
    { id: 1, title: "Personal Information", icon: User, desc: "Name, contact, address" },
    { id: 2, title: "Driver License", icon: FileText, desc: "License details & images" },
    { id: 3, title: "Vehicle Details", icon: Car, desc: "Vehicle info & documents" },
    { id: 4, title: "Review & Submit", icon: ShieldCheck, desc: "Verify and submit" },
  ];

  const STEPS_BD = [
    { id: 1, title: "Personal Information", icon: User, desc: "ব্যক্তিগত তথ্য" },
    { id: 2, title: "Vehicle Information", icon: Car, desc: "গাড়ির তথ্য" },
    { id: 3, title: "Documents", icon: FileText, desc: "NID ও কাগজপত্র" },
    { id: 4, title: "Review & Submit", icon: ShieldCheck, desc: "জমা দিন" },
  ];

  const STEPS = isBD ? STEPS_BD : STEPS_US;

  const { data: existingProfile, isLoading: profileLoading } = useQuery<{ profile: any } | null>({
    queryKey: ["/api/partner-driver/registration/status", driverType],
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/partner-driver/registration/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-driver/registration/status"] });
      toast({
        title: "Application Submitted",
        description: "Your driver application has been submitted for review.",
      });
      setLocation("/customer");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error?.message || "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  const personalFormUS = useForm<PersonalInfoUSData>({
    resolver: zodResolver(personalInfoSchemaUS),
    mode: "onChange",
    defaultValues: {
      usaFullLegalName: user?.email?.split('@')[0] || "",
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
    mode: "onChange",
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
    mode: "onChange",
    defaultValues: {
      driverLicenseNumber: "",
      driverLicenseState: "",
      driverLicenseExpiry: "",
    },
  });

  const vehicleForm = useForm<VehicleInfoData>({
    resolver: zodResolver(vehicleInfoSchema),
    mode: "onChange",
    defaultValues: {
      vehicleType: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      vehicleColor: "",
      vehiclePlate: "",
    },
  });

  const nycForm = useForm<NycComplianceData>({
    resolver: zodResolver(nycComplianceSchema),
    mode: "onChange",
    defaultValues: {
      tlcLicenseNumber: "",
      tlcLicenseExpiry: "",
      fhvLicenseNumber: "",
      dmvInspectionDate: "",
      dmvInspectionExpiry: "",
    },
  });

  const [nidNumber, setNidNumber] = useState("");

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
          const needsNycCompliance = values.usaState === 'NY' && isNycBorough(values.usaCity);
          setIsNycDriver(needsNycCompliance);
        }
      } else if (currentStep === 2) {
        isValid = await licenseForm.trigger();
        if (isValid) {
          if (!licenseFrontFile || !licenseBackFile) {
            toast({
              title: "Missing Documents",
              description: "Please upload both front and back images of your driver license.",
              variant: "destructive",
            });
            return;
          }
          setFormData(prev => ({ ...prev, licenseInfo: licenseForm.getValues() }));
        }
      } else if (currentStep === 3) {
        isValid = await vehicleForm.trigger();
        if (isValid) {
          if (!registrationFile || !insuranceFile) {
            toast({
              title: "Missing Documents",
              description: "Please upload vehicle registration and insurance documents.",
              variant: "destructive",
            });
            return;
          }
          setFormData(prev => ({ ...prev, vehicleInfo: vehicleForm.getValues() }));
        }
      } else if (currentStep === 4 && isNycDriver) {
        isValid = await nycForm.trigger();
        if (isValid) {
          if (!tlcFrontFile || !tlcBackFile || !fhvFile || !dmvInspectionFile) {
            toast({
              title: "Missing NYC Documents",
              description: "Please upload all required NYC compliance documents (TLC front/back, FHV document, DMV inspection).",
              variant: "destructive",
            });
            return;
          }
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
        if (!nidNumber || nidNumber.trim().length < 10) {
          toast({ 
            title: "NID Required", 
            description: "Please enter a valid NID number (minimum 10 digits)",
            variant: "destructive" 
          });
          return;
        }
        isValid = true;
        setFormData(prev => ({ ...prev, documents: { nidNumber } }));
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
      vehicleInfo: {
        vehicleType: formData.vehicleInfo.vehicleType,
        vehicleMake: formData.vehicleInfo.vehicleMake,
        vehicleModel: formData.vehicleInfo.vehicleModel,
        vehicleYear: formData.vehicleInfo.vehicleYear,
        vehicleColor: formData.vehicleInfo.vehicleColor,
        vehiclePlate: formData.vehicleInfo.vehiclePlate,
        registrationDocumentUrl: "pending_upload",
        insuranceDocumentUrl: "pending_upload",
      },
      documents: {
        driverLicenseNumber: formData.licenseInfo.driverLicenseNumber,
        driverLicenseExpiry: formData.licenseInfo.driverLicenseExpiry,
        driverLicenseState: formData.licenseInfo.driverLicenseState,
        driverLicenseFrontUrl: "pending_upload",
        driverLicenseBackUrl: "pending_upload",
      },
      nycCompliance: isNycDriver ? {
        tlcLicenseNumber: formData.nycCompliance.tlcLicenseNumber,
        tlcLicenseExpiry: formData.nycCompliance.tlcLicenseExpiry,
        tlcLicenseFrontUrl: "pending_upload",
        tlcLicenseBackUrl: "pending_upload",
        fhvLicenseNumber: formData.nycCompliance.fhvLicenseNumber,
        fhvDocumentUrl: "pending_upload",
        dmvInspectionDate: formData.nycCompliance.dmvInspectionDate,
        dmvInspectionExpiry: formData.nycCompliance.dmvInspectionExpiry,
        dmvInspectionImageUrl: "pending_upload",
      } : undefined,
    } : {
      driverType,
      countryCode,
      personalInfo: formData.personalInfo,
      vehicleInfo: {
        vehicleType: formData.vehicleInfo.vehicleType,
        vehicleModel: formData.vehicleInfo.vehicleModel,
        vehiclePlate: formData.vehicleInfo.vehiclePlate,
        vehicleMake: formData.vehicleInfo.vehicleMake,
        vehicleYear: formData.vehicleInfo.vehicleYear,
        vehicleColor: formData.vehicleInfo.vehicleColor,
      },
      documents: {
        nidNumber: formData.documents.nidNumber,
      },
    };
    
    submitMutation.mutate(submitData);
  };

  const StepIcon = STEPS[currentStep - 1].icon;

  const renderUSPersonalInfo = () => (
    <Form {...personalFormUS}>
      <form className="space-y-6">
        <FormField
          control={personalFormUS.control}
          name="usaFullLegalName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Legal Name *</FormLabel>
              <FormControl>
                <Input placeholder="As shown on your driver license" {...field} data-testid="input-legal-name" />
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

        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Home Address (US Standard Format)
          </h4>
          
          <FormField
            control={personalFormUS.control}
            name="usaStreet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address 1 *</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main Street" {...field} data-testid="input-street" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={personalFormUS.control}
            name="usaAptUnit"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Street Address 2 (Apt/Unit/Suite)</FormLabel>
                <FormControl>
                  <Input placeholder="Apt 4B, Suite 100, Unit 5" {...field} data-testid="input-apt" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
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
            <FormField
              control={personalFormUS.control}
              name="usaState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <Select 
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-state">
                        <SelectValue placeholder="Select" />
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
                  <FormDescription className="text-xs">5-digit or ZIP+4</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4">Emergency Contact</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={personalFormUS.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} data-testid="input-emergency-name" />
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
                <Select 
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
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

        <div className="border-t pt-6">
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
                    autoComplete="off"
                    {...field} 
                    data-testid="input-ssn-last4" 
                  />
                </FormControl>
                <FormDescription>
                  Optional for identity verification. We never store your full SSN.
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
      <form className="space-y-6">
        <FormField
          control={licenseForm.control}
          name="driverLicenseNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Driver License Number *</FormLabel>
              <FormControl>
                <Input placeholder="Enter your license number" {...field} data-testid="input-license-number" />
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
                <FormLabel>License Issuing State *</FormLabel>
                <Select 
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
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
                <FormLabel>License Expiration Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-license-expiry" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4">Driver License Images *</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Front of License *</Label>
              <label htmlFor="license-front" className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors ${licenseFrontFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                  <Upload className={`h-8 w-8 mx-auto mb-2 ${licenseFrontFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <p className="text-sm text-muted-foreground">{licenseFrontFile ? 'Image selected' : 'Upload front of license'}</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="license-front"
                    onChange={(e) => setLicenseFrontFile(e.target.files?.[0] || null)}
                    data-testid="input-license-front"
                  />
                  <Button type="button" variant="outline" size="sm" className="mt-2">Choose File</Button>
                  {licenseFrontFile && <p className="text-sm mt-2 text-green-600 font-medium">{licenseFrontFile.name}</p>}
                </div>
              </label>
            </div>
            
            <div className="space-y-2">
              <Label>Back of License *</Label>
              <label htmlFor="license-back" className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors ${licenseBackFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                  <Upload className={`h-8 w-8 mx-auto mb-2 ${licenseBackFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <p className="text-sm text-muted-foreground">{licenseBackFile ? 'Image selected' : 'Upload back of license'}</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="license-back"
                    onChange={(e) => setLicenseBackFile(e.target.files?.[0] || null)}
                    data-testid="input-license-back"
                  />
                  <Button type="button" variant="outline" size="sm" className="mt-2">Choose File</Button>
                  {licenseBackFile && <p className="text-sm mt-2 text-green-600 font-medium">{licenseBackFile.name}</p>}
                </div>
              </label>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );

  const renderVehicleInfo = () => (
    <Form {...vehicleForm}>
      <form className="space-y-6">
        <FormField
          control={vehicleForm.control}
          name="vehicleType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle Type *</FormLabel>
              <Select 
                onValueChange={field.onChange}
                value={field.value ?? ""}
              >
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
                <FormLabel>Vehicle Make *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Toyota, Honda, Ford" {...field} data-testid="input-vehicle-make" />
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
                <FormLabel>Vehicle Model *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Camry, Civic, F-150" {...field} data-testid="input-vehicle-model" />
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
                <FormLabel>Vehicle Year *</FormLabel>
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
                <FormLabel>Vehicle Color *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., White, Black, Silver" {...field} data-testid="input-vehicle-color" />
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
                <FormLabel>License Plate *</FormLabel>
                <FormControl>
                  <Input placeholder="ABC-1234" {...field} data-testid="input-vehicle-plate" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isUS && (
          <div className="border-t pt-6">
            <h4 className="font-semibold mb-4">Vehicle Documents *</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Registration *</Label>
                <label htmlFor="registration-doc" className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors ${registrationFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                    <Upload className={`h-8 w-8 mx-auto mb-2 ${registrationFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <p className="text-sm text-muted-foreground">{registrationFile ? 'Document selected' : 'Upload registration'}</p>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      className="hidden" 
                      id="registration-doc"
                      onChange={(e) => setRegistrationFile(e.target.files?.[0] || null)}
                      data-testid="input-registration-doc"
                    />
                    <Button type="button" variant="outline" size="sm" className="mt-2">Choose File</Button>
                    {registrationFile && <p className="text-sm mt-2 text-green-600 font-medium">{registrationFile.name}</p>}
                  </div>
                </label>
              </div>
              
              <div className="space-y-2">
                <Label>Vehicle Insurance *</Label>
                <label htmlFor="insurance-doc" className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate transition-colors ${insuranceFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                    <Upload className={`h-8 w-8 mx-auto mb-2 ${insuranceFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <p className="text-sm text-muted-foreground">{insuranceFile ? 'Document selected' : 'Upload insurance'}</p>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      className="hidden" 
                      id="insurance-doc"
                      onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)}
                      data-testid="input-insurance-doc"
                    />
                    <Button type="button" variant="outline" size="sm" className="mt-2">Choose File</Button>
                    {insuranceFile && <p className="text-sm mt-2 text-green-600 font-medium">{insuranceFile.name}</p>}
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
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 dark:text-blue-200">NYC TLC/FHV Compliance Required</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  As a driver operating in one of New York City's five boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island), 
                  you must provide TLC license, FHV permit, and DMV inspection documentation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h4 className="font-semibold">TLC (Taxi & Limousine Commission) License *</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <FormItem>
                  <FormLabel>TLC License Expiry *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-tlc-expiry" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>TLC License Front *</Label>
              <label htmlFor="tlc-front" className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-lg p-4 text-center hover-elevate transition-colors ${tlcFrontFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                  <Upload className={`h-6 w-6 mx-auto mb-1 ${tlcFrontFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <p className="text-xs text-muted-foreground">{tlcFrontFile ? tlcFrontFile.name : 'Upload TLC front'}</p>
                  <input type="file" accept="image/*" className="hidden" id="tlc-front" onChange={(e) => setTlcFrontFile(e.target.files?.[0] || null)} data-testid="input-tlc-front" />
                </div>
              </label>
            </div>
            <div className="space-y-2">
              <Label>TLC License Back *</Label>
              <label htmlFor="tlc-back" className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-lg p-4 text-center hover-elevate transition-colors ${tlcBackFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                  <Upload className={`h-6 w-6 mx-auto mb-1 ${tlcBackFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <p className="text-xs text-muted-foreground">{tlcBackFile ? tlcBackFile.name : 'Upload TLC back'}</p>
                  <input type="file" accept="image/*" className="hidden" id="tlc-back" onChange={(e) => setTlcBackFile(e.target.files?.[0] || null)} data-testid="input-tlc-back" />
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <h4 className="font-semibold">FHV (For-Hire Vehicle) Permit *</h4>
          
          <FormField
            control={nycForm.control}
            name="fhvLicenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FHV Number/Barcode *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter FHV number or scan barcode" {...field} data-testid="input-fhv-number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label>FHV Document/Sticker Image *</Label>
            <label htmlFor="fhv-doc" className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-lg p-4 text-center hover-elevate transition-colors ${fhvFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                <Upload className={`h-6 w-6 mx-auto mb-1 ${fhvFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                <p className="text-xs text-muted-foreground">{fhvFile ? fhvFile.name : 'Upload FHV document or sticker'}</p>
                <input type="file" accept="image/*" className="hidden" id="fhv-doc" onChange={(e) => setFhvFile(e.target.files?.[0] || null)} data-testid="input-fhv-doc" />
              </div>
            </label>
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <h4 className="font-semibold">DMV Vehicle Inspection *</h4>
          
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

          <div className="space-y-2">
            <Label>DMV Inspection Document *</Label>
            <label htmlFor="dmv-doc" className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-lg p-4 text-center hover-elevate transition-colors ${dmvInspectionFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
                <Upload className={`h-6 w-6 mx-auto mb-1 ${dmvInspectionFile ? 'text-green-600' : 'text-muted-foreground'}`} />
                <p className="text-xs text-muted-foreground">{dmvInspectionFile ? dmvInspectionFile.name : 'Upload DMV inspection sticker/paper'}</p>
                <input type="file" accept="image/*,.pdf" className="hidden" id="dmv-doc" onChange={(e) => setDmvInspectionFile(e.target.files?.[0] || null)} data-testid="input-dmv-doc" />
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
              <FormLabel>ফোন নম্বর *</FormLabel>
              <FormControl>
                <Input placeholder="01XXXXXXXXX" {...field} data-testid="input-phone" />
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
              <FormLabel>জন্ম তারিখ *</FormLabel>
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
              <FormLabel>পিতার নাম *</FormLabel>
              <FormControl>
                <Input placeholder="পিতার সম্পূর্ণ নাম" {...field} data-testid="input-father-name" />
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
              <FormLabel>বর্তমান ঠিকানা *</FormLabel>
              <FormControl>
                <Input placeholder="বর্তমান ঠিকানা" {...field} data-testid="input-present-address" />
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
              <FormLabel>স্থায়ী ঠিকানা</FormLabel>
              <FormControl>
                <Input placeholder="স্থায়ী ঠিকানা (ঐচ্ছিক)" {...field} data-testid="input-permanent-address" />
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
                <FormLabel>জরুরি যোগাযোগের নাম *</FormLabel>
                <FormControl>
                  <Input placeholder="নাম" {...field} data-testid="input-emergency-name" />
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
                <FormLabel>জরুরি যোগাযোগের ফোন *</FormLabel>
                <FormControl>
                  <Input placeholder="ফোন নম্বর" {...field} data-testid="input-emergency-phone" />
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>জাতীয় পরিচয়পত্র নম্বর (NID) *</Label>
        <Input 
          placeholder="NID নম্বর লিখুন (ন্যূনতম ১০ সংখ্যা)" 
          value={nidNumber}
          onChange={(e) => setNidNumber(e.target.value)}
          data-testid="input-nid-number" 
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>NID সামনের ছবি</Label>
          <label htmlFor="nid-front" className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate ${nidFrontFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
              <Upload className={`h-8 w-8 mx-auto mb-2 ${nidFrontFile ? 'text-green-600' : 'text-muted-foreground'}`} />
              <p className="text-sm text-muted-foreground">{nidFrontFile ? nidFrontFile.name : 'NID সামনের দিক'}</p>
              <input type="file" accept="image/*" className="hidden" id="nid-front" onChange={(e) => setNidFrontFile(e.target.files?.[0] || null)} data-testid="input-nid-front" />
            </div>
          </label>
        </div>
        <div className="space-y-2">
          <Label>NID পেছনের ছবি</Label>
          <label htmlFor="nid-back" className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate ${nidBackFile ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}>
              <Upload className={`h-8 w-8 mx-auto mb-2 ${nidBackFile ? 'text-green-600' : 'text-muted-foreground'}`} />
              <p className="text-sm text-muted-foreground">{nidBackFile ? nidBackFile.name : 'NID পেছনের দিক'}</p>
              <input type="file" accept="image/*" className="hidden" id="nid-back" onChange={(e) => setNidBackFile(e.target.files?.[0] || null)} data-testid="input-nid-back" />
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderReviewUS = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Name:</span>
            <span>{formData.personalInfo.usaFullLegalName}</span>
            <span className="text-muted-foreground">Phone:</span>
            <span>{formData.personalInfo.phone}</span>
            <span className="text-muted-foreground">Date of Birth:</span>
            <span>{formData.personalInfo.dateOfBirth}</span>
          </div>
          <div className="pt-2 border-t mt-2">
            <p className="text-muted-foreground text-xs mb-1">Address:</p>
            <p>{formData.personalInfo.usaStreet}{formData.personalInfo.usaAptUnit ? `, ${formData.personalInfo.usaAptUnit}` : ''}</p>
            <p>{formData.personalInfo.usaCity}, {formData.personalInfo.usaState} {formData.personalInfo.usaZipCode}</p>
          </div>
          <div className="pt-2 border-t">
            <p className="text-muted-foreground text-xs mb-1">Emergency Contact:</p>
            <p>{formData.personalInfo.emergencyContactName} ({formData.personalInfo.emergencyContactRelationship})</p>
            <p>{formData.personalInfo.emergencyContactPhone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Driver License</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">License #:</span>
            <span className="font-mono">{formData.licenseInfo.driverLicenseNumber}</span>
            <span className="text-muted-foreground">State:</span>
            <span>{formData.licenseInfo.driverLicenseState}</span>
            <span className="text-muted-foreground">Expires:</span>
            <span>{formData.licenseInfo.driverLicenseExpiry}</span>
          </div>
          <div className="flex gap-2 mt-3">
            {licenseFrontFile && <Badge variant="secondary" className="text-xs">Front image uploaded</Badge>}
            {licenseBackFile && <Badge variant="secondary" className="text-xs">Back image uploaded</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Type:</span>
            <span className="capitalize">{formData.vehicleInfo.vehicleType}</span>
            <span className="text-muted-foreground">Vehicle:</span>
            <span>{formData.vehicleInfo.vehicleYear} {formData.vehicleInfo.vehicleMake} {formData.vehicleInfo.vehicleModel}</span>
            <span className="text-muted-foreground">Color:</span>
            <span>{formData.vehicleInfo.vehicleColor}</span>
            <span className="text-muted-foreground">Plate:</span>
            <span className="font-mono">{formData.vehicleInfo.vehiclePlate}</span>
          </div>
          <div className="flex gap-2 mt-3">
            {registrationFile && <Badge variant="secondary" className="text-xs">Registration uploaded</Badge>}
            {insuranceFile && <Badge variant="secondary" className="text-xs">Insurance uploaded</Badge>}
          </div>
        </CardContent>
      </Card>

      {isNycDriver && formData.nycCompliance && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">NYC Compliance</CardTitle>
              <Badge className="bg-blue-600 text-xs">TLC/FHV</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">TLC License #:</span>
              <span className="font-mono">{formData.nycCompliance.tlcLicenseNumber}</span>
              <span className="text-muted-foreground">TLC Expiry:</span>
              <span>{formData.nycCompliance.tlcLicenseExpiry}</span>
              <span className="text-muted-foreground">FHV #:</span>
              <span className="font-mono">{formData.nycCompliance.fhvLicenseNumber}</span>
              <span className="text-muted-foreground">DMV Inspection:</span>
              <span>{formData.nycCompliance.dmvInspectionDate} - {formData.nycCompliance.dmvInspectionExpiry}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {tlcFrontFile && <Badge variant="secondary" className="text-xs">TLC front uploaded</Badge>}
              {tlcBackFile && <Badge variant="secondary" className="text-xs">TLC back uploaded</Badge>}
              {fhvFile && <Badge variant="secondary" className="text-xs">FHV doc uploaded</Badge>}
              {dmvInspectionFile && <Badge variant="secondary" className="text-xs">DMV inspection uploaded</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            By submitting this application, you agree to SafeGo's Terms of Service and Partner Agreement. 
            Your application will be reviewed within {config?.approvalMessage || '24-48 hours'}.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderReviewBD = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ব্যক্তিগত তথ্য</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">ফোন:</span>
            <span>{formData.personalInfo.phone}</span>
            <span className="text-muted-foreground">জন্ম তারিখ:</span>
            <span>{formData.personalInfo.dateOfBirth}</span>
            <span className="text-muted-foreground">পিতার নাম:</span>
            <span>{formData.personalInfo.fatherName}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">গাড়ির তথ্য</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">ধরন:</span>
            <span>{formData.vehicleInfo.vehicleType}</span>
            <span className="text-muted-foreground">মডেল:</span>
            <span>{formData.vehicleInfo.vehicleModel}</span>
            <span className="text-muted-foreground">প্লেট:</span>
            <span>{formData.vehicleInfo.vehiclePlate}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">কাগজপত্র</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">NID:</span>
            <span className="font-mono">{formData.documents.nidNumber}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            এই আবেদন জমা দিয়ে, আপনি SafeGo-এর সেবার শর্তাবলী এবং পার্টনার চুক্তিতে সম্মত হচ্ছেন।
            আপনার আবেদন পর্যালোচনা করা হবে।
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
            <Badge className="mt-2 bg-blue-600">NYC TLC/FHV Required</Badge>
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
                <span className={`text-sm whitespace-nowrap ${isCurrent ? 'font-medium' : ''}`}>{step.title}</span>
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
                <CardDescription>{STEPS[currentStep - 1].desc}</CardDescription>
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
