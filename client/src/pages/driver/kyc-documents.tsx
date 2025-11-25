import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { FileUpload } from "@/components/file-upload";
import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VEHICLE_BRANDS_MODELS, VEHICLE_COLORS as STANDARD_COLORS } from "../../../../shared/vehicleCatalog";

// Predefined vehicle color options
const VEHICLE_COLORS = [
  "Black",
  "White",
  "Silver",
  "Gray",
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Brown",
  "Gold",
  "Orange",
  "Beige",
  "Purple",
  "Pink",
  "Other",
] as const;

// Comprehensive vehicle model options (100+ models)
const VEHICLE_MODELS = [
  // Tesla
  "Tesla Model 3",
  "Tesla Model S",
  "Tesla Model X",
  "Tesla Model Y",
  // Toyota
  "Toyota Camry",
  "Toyota Corolla",
  "Toyota RAV4",
  "Toyota Highlander",
  "Toyota Prius",
  "Toyota Tacoma",
  "Toyota Tundra",
  "Toyota 4Runner",
  "Toyota Sienna",
  "Toyota Avalon",
  "Toyota C-HR",
  "Toyota Venza",
  // Honda
  "Honda Civic",
  "Honda Accord",
  "Honda CR-V",
  "Honda Pilot",
  "Honda Odyssey",
  "Honda HR-V",
  "Honda Ridgeline",
  "Honda Fit",
  "Honda Passport",
  "Honda Insight",
  // Nissan
  "Nissan Altima",
  "Nissan Sentra",
  "Nissan Maxima",
  "Nissan Rogue",
  "Nissan Murano",
  "Nissan Pathfinder",
  "Nissan Armada",
  "Nissan Frontier",
  "Nissan Titan",
  "Nissan Kicks",
  "Nissan Versa",
  // Ford
  "Ford F-150",
  "Ford Mustang",
  "Ford Explorer",
  "Ford Escape",
  "Ford Edge",
  "Ford Expedition",
  "Ford Ranger",
  "Ford Bronco",
  "Ford Fusion",
  "Ford Focus",
  "Ford EcoSport",
  "Ford Maverick",
  // Chevrolet
  "Chevrolet Silverado",
  "Chevrolet Equinox",
  "Chevrolet Malibu",
  "Chevrolet Traverse",
  "Chevrolet Tahoe",
  "Chevrolet Suburban",
  "Chevrolet Colorado",
  "Chevrolet Blazer",
  "Chevrolet Trax",
  "Chevrolet Camaro",
  "Chevrolet Corvette",
  // Hyundai
  "Hyundai Elantra",
  "Hyundai Sonata",
  "Hyundai Tucson",
  "Hyundai Santa Fe",
  "Hyundai Palisade",
  "Hyundai Kona",
  "Hyundai Venue",
  "Hyundai Ioniq",
  "Hyundai Accent",
  // Kia
  "Kia Seltos",
  "Kia Sportage",
  "Kia Sorento",
  "Kia Telluride",
  "Kia Forte",
  "Kia K5",
  "Kia Soul",
  "Kia Niro",
  "Kia Carnival",
  "Kia Stinger",
  // BMW
  "BMW 3 Series",
  "BMW 5 Series",
  "BMW X3",
  "BMW X5",
  "BMW X1",
  "BMW X7",
  "BMW 7 Series",
  "BMW 4 Series",
  "BMW i4",
  "BMW iX",
  // Mercedes-Benz
  "Mercedes-Benz C-Class",
  "Mercedes-Benz E-Class",
  "Mercedes-Benz S-Class",
  "Mercedes-Benz GLE",
  "Mercedes-Benz GLC",
  "Mercedes-Benz GLA",
  "Mercedes-Benz GLB",
  "Mercedes-Benz A-Class",
  // Lexus
  "Lexus RX",
  "Lexus ES",
  "Lexus NX",
  "Lexus IS",
  "Lexus GX",
  "Lexus UX",
  "Lexus LS",
  "Lexus LX",
  // Mazda
  "Mazda CX-5",
  "Mazda CX-9",
  "Mazda Mazda3",
  "Mazda Mazda6",
  "Mazda CX-30",
  "Mazda CX-50",
  "Mazda MX-5 Miata",
  // Subaru
  "Subaru Outback",
  "Subaru Forester",
  "Subaru Crosstrek",
  "Subaru Ascent",
  "Subaru Impreza",
  "Subaru Legacy",
  "Subaru WRX",
  // Volkswagen
  "Volkswagen Jetta",
  "Volkswagen Passat",
  "Volkswagen Tiguan",
  "Volkswagen Atlas",
  "Volkswagen Taos",
  "Volkswagen Golf",
  "Volkswagen ID.4",
  // Jeep
  "Jeep Grand Cherokee",
  "Jeep Wrangler",
  "Jeep Cherokee",
  "Jeep Compass",
  "Jeep Renegade",
  "Jeep Gladiator",
  // Dodge
  "Dodge Charger",
  "Dodge Challenger",
  "Dodge Durango",
  "Dodge Ram 1500",
  // Audi
  "Audi A4",
  "Audi A6",
  "Audi Q5",
  "Audi Q7",
  "Audi Q3",
  "Audi e-tron",
  // Acura
  "Acura TLX",
  "Acura MDX",
  "Acura RDX",
  "Acura Integra",
  "Acura ILX",
  // Infiniti
  "Infiniti Q50",
  "Infiniti QX60",
  "Infiniti QX80",
  "Infiniti QX50",
  // Cadillac
  "Cadillac Escalade",
  "Cadillac XT5",
  "Cadillac XT4",
  "Cadillac CT5",
  // GMC
  "GMC Sierra",
  "GMC Yukon",
  "GMC Terrain",
  "GMC Acadia",
  // Ram
  "Ram 1500",
  "Ram 2500",
  "Ram 3500",
  // Buick
  "Buick Enclave",
  "Buick Encore",
  "Buick Envision",
  // Lincoln
  "Lincoln Navigator",
  "Lincoln Aviator",
  "Lincoln Corsair",
  // Volvo
  "Volvo XC90",
  "Volvo XC60",
  "Volvo S60",
  "Volvo V60",
  // Other
  "Other",
] as const;

export default function DriverKYCDocuments() {
  const { toast } = useToast();
  const [usaNameForm, setUsaNameForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [vehicleFormInitialized, setVehicleFormInitialized] = useState(false);
  const [nidNumber, setNidNumber] = useState("");
  const [ssnNumber, setSsnNumber] = useState("");
  const [isEditingNID, setIsEditingNID] = useState(false);
  const [isEditingSSN, setIsEditingSSN] = useState(false);
  
  // Vehicle KYC text fields state
  const [vehicleKYCForm, setVehicleKYCForm] = useState({
    vehicleColor: "",
    vehicleModel: "",
    licensePlateNumber: "",
  });
  
  // Dropdown state for brand, color and model
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [customColor, setCustomColor] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [customModel, setCustomModel] = useState<string>("");
  const [customBrand, setCustomBrand] = useState<string>("");
  
  // Staged hydration: track when brand is ready so model can sync
  const [brandHydrated, setBrandHydrated] = useState(false);
  const [pendingModel, setPendingModel] = useState<{model: string; custom: string} | null>(null);

  // Filter models based on selected brand
  const availableModels = useMemo(() => {
    if (!selectedBrand || selectedBrand === "Other") {
      return ["Other"]; // Always include "Other" option for custom entry
    }
    const brandModels = VEHICLE_BRANDS_MODELS[selectedBrand as keyof typeof VEHICLE_BRANDS_MODELS] || [];
    return [...brandModels, "Other"]; // Add "Other" option to allow custom model
  }, [selectedBrand]);

  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: vehicleDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ["/api/driver/vehicle-documents"],
  });

  const profile = (driverData as any)?.profile;
  const isUSA = profile?.countryCode === "US";
  const isBD = profile?.countryCode === "BD";
  const isNY = profile?.usaState === "NY";
  
  // Check if driver is in NYC (for TLC requirements)
  const cityLower = (profile?.usaCity || "").toLowerCase();
  const isNYC = isNY && (
    cityLower.includes("new york") ||
    cityLower.includes("nyc") ||
    cityLower.includes("brooklyn") ||
    cityLower.includes("queens") ||
    cityLower.includes("manhattan") ||
    cityLower.includes("bronx") ||
    cityLower.includes("staten island")
  );

  // Initialize USA name form when driver data loads
  useEffect(() => {
    if (profile && profile.firstName && !formInitialized) {
      setUsaNameForm({
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        lastName: profile.lastName || "",
      });
      setFormInitialized(true);
    }
  }, [profile, formInitialized]);

  // STAGE 1: Initialize brand from vehicle data (runs first)
  useEffect(() => {
    if (driverData && !vehicleFormInitialized) {
      const vehicle = (driverData as any)?.vehicle;
      
      // Mark as initialized even if no vehicle exists (new driver)
      if (!vehicle) {
        setBrandHydrated(true);
        setVehicleFormInitialized(true);
        return;
      }
      
      const savedColor = vehicle.color || "";
      const savedModel = vehicle.vehicleModel || "";
      
      // Parse brand from vehicle.make or from vehicleModel
      let derivedBrand = vehicle.make || "";
      let derivedModelOnly = savedModel;
      
      if (!derivedBrand && savedModel) {
        // Try to parse brand from legacy combined model (e.g., "Toyota Camry", "Mercedes-Benz C-Class")
        const catalogBrands = Object.keys(VEHICLE_BRANDS_MODELS);
        for (const brand of catalogBrands) {
          if (savedModel.startsWith(`${brand} `)) {
            derivedBrand = brand;
            derivedModelOnly = savedModel.substring(brand.length + 1); // Extract model-only part
            break;
          }
        }
      } else if (derivedBrand && savedModel.startsWith(`${derivedBrand} `)) {
        // If we have make and vehicleModel is combined, extract model-only
        derivedModelOnly = savedModel.substring(derivedBrand.length + 1);
      }
      
      // If model extraction resulted in empty string, use full savedModel as fallback
      if (!derivedModelOnly.trim() && savedModel) {
        derivedModelOnly = savedModel;
      }
      
      // Set brand first (STAGE 1)
      if (derivedBrand && Object.keys(VEHICLE_BRANDS_MODELS).includes(derivedBrand)) {
        setSelectedBrand(derivedBrand);
        // Queue model for STAGE 2
        setPendingModel({ model: derivedModelOnly, custom: savedModel });
      } else if (derivedBrand || savedModel) {
        // Custom brand case
        setSelectedBrand("Other");
        setCustomBrand(derivedBrand || "");
        // For custom brand, set model directly
        setSelectedModel("Other");
        setCustomModel(savedModel);
      }
      
      // Initialize color (doesn't need staging)
      const isColorPredefined = STANDARD_COLORS.includes(savedColor as any);
      if (isColorPredefined && savedColor !== "Other") {
        setSelectedColor(savedColor);
        setCustomColor("");
      } else if (savedColor) {
        setSelectedColor("Other");
        setCustomColor(savedColor);
      }
      
      setVehicleKYCForm({
        vehicleColor: savedColor,
        vehicleModel: savedModel,
        licensePlateNumber: vehicle.licensePlate || "",
      });
      
      setBrandHydrated(true);
      setVehicleFormInitialized(true);
    }
  }, [driverData, vehicleFormInitialized]);

  // STAGE 2: Set model AFTER brand is hydrated and availableModels has synced
  // This effect runs when pendingModel exists and we have available models to choose from
  useEffect(() => {
    // Only process if we have a pending model and the brand is set (not "Other")
    if (!pendingModel || !selectedBrand || selectedBrand === "Other") {
      return;
    }
    
    // Wait for availableModels to have at least the "Other" option
    if (availableModels.length === 0) {
      return;
    }
    
    const { model, custom } = pendingModel;
    
    // Check if model matches available models for this brand
    if (availableModels.includes(model)) {
      setSelectedModel(model);
      setCustomModel("");
    } else if (availableModels.includes(custom)) {
      // Try full saved model string
      setSelectedModel(custom);
      setCustomModel("");
    } else if (model || custom) {
      // Model not in catalog - use custom input with the legacy combined string
      setSelectedModel("Other");
      setCustomModel(custom || model);
    }
    
    // Clear pending model after processing
    setPendingModel(null);
  }, [pendingModel, availableModels, selectedBrand]);

  // Helper for multipart form uploads using fetch (FormData not supported by apiRequest)
  const uploadFile = async (endpoint: string, fieldName: string, file: File, extraData?: Record<string, string>) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    if (extraData) {
      Object.entries(extraData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    const token = localStorage.getItem("safego_token");
    const headers: any = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers,
      credentials: "include",
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Upload failed");
    }
    
    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return { success: true };
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    
    return { success: true };
  };

  // Upload mutations
  const uploadProfilePhotoMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/profile-photo", "file", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadDMVLicenseMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/dmv-license", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadTLCLicenseMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/tlc-license", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadVehicleDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) =>
      uploadFile("/api/driver/upload/vehicle-document", "document", file, { documentType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/vehicle-documents"] });
    },
  });

  const uploadNIDImageMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/nid-image", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const uploadSSNCardMutation = useMutation({
    mutationFn: async (file: File) => uploadFile("/api/driver/upload/ssn-card", "licenseImage", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
  });

  const updateNIDMutation = useMutation({
    mutationFn: async (nidNumber: string) => {
      const result = await apiRequest("/api/driver/identity/nid", {
        method: "PUT",
        body: JSON.stringify({ nidNumber }),
        headers: { "Content-Type": "application/json" },
      });
      return result || { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "NID number updated successfully",
      });
      setIsEditingNID(false);
      setNidNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update NID number",
        variant: "destructive",
      });
    },
  });

  const updateSSNMutation = useMutation({
    mutationFn: async (ssn: string) => {
      const result = await apiRequest("/api/driver/identity/ssn", {
        method: "PUT",
        body: JSON.stringify({ ssn }),
        headers: { "Content-Type": "application/json" },
      });
      return result || { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SSN updated successfully",
      });
      setIsEditingSSN(false);
      setSsnNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update SSN",
        variant: "destructive",
      });
    },
  });

  const updateUSANameMutation = useMutation({
    mutationFn: async (data: typeof usaNameForm) => {
      // Validate required fields
      if (!data.firstName?.trim() || !data.lastName?.trim()) {
        throw new Error("First name and last name are required");
      }
      const result = await apiRequest("/api/driver/usa-name", {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result || { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Name updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update name",
        variant: "destructive",
      });
    },
  });

  const handleVehicleKYCSave = () => {
    // Validate brand selection
    if (isUSA && !selectedBrand) {
      toast({
        title: "Validation error",
        description: "Please select a vehicle brand",
        variant: "destructive",
      });
      return;
    }
    
    // Validate dropdown selections
    if (isUSA && !selectedColor) {
      toast({
        title: "Validation error",
        description: "Please select a vehicle color",
        variant: "destructive",
      });
      return;
    }
    
    // For custom brand, validate customModel directly; otherwise check selectedModel
    if (isUSA && selectedBrand !== "Other" && !selectedModel) {
      toast({
        title: "Validation error",
        description: "Please select a vehicle model",
        variant: "destructive",
      });
      return;
    }
    
    // Build final values from dropdown selections + custom inputs
    let finalColor = selectedColor;
    let finalModel = selectedModel;
    
    // If "Other" is selected, validate and use the custom value
    if (selectedColor === "Other") {
      if (!customColor?.trim()) {
        toast({
          title: "Validation error",
          description: "Please enter a custom color",
          variant: "destructive",
        });
        return;
      }
      finalColor = customColor.trim();
    }
    
    // Handle model validation for both custom brand and catalog brand with "Other" model
    if (selectedBrand === "Other" || selectedModel === "Other") {
      if (!customModel?.trim()) {
        toast({
          title: "Validation error",
          description: "Please enter a vehicle model",
          variant: "destructive",
        });
        return;
      }
      finalModel = customModel.trim();
    }
    
    // Validate license plate
    if (isUSA && !vehicleKYCForm.licensePlateNumber?.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter a license plate number",
        variant: "destructive",
      });
      return;
    }
    
    // Determine the final brand (catalog brand or custom brand)
    const finalBrand = selectedBrand === "Other" 
      ? (customBrand.trim() || undefined)
      : selectedBrand;
    
    // Build display name for backward compatibility: "Brand Model" format
    let vehicleDisplayName = finalModel;
    if (finalBrand && finalModel) {
      vehicleDisplayName = `${finalBrand} ${finalModel}`;
    }
    
    const data = {
      vehicleMake: finalBrand || undefined,
      vehicleColor: finalColor,
      vehicleModel: finalModel, // Model-only value
      vehicleDisplayName, // Combined "Brand Model" for legacy compatibility
      licensePlateNumber: vehicleKYCForm.licensePlateNumber,
    };
    
    updateVehicleKYCMutation.mutate(data);
  };

  const updateVehicleKYCMutation = useMutation({
    mutationFn: async (data: { vehicleMake?: string; vehicleColor: string; vehicleModel: string; vehicleDisplayName?: string; licensePlateNumber: string }) => {
      const result = await apiRequest("/api/driver/vehicle-kyc-details", {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      return result || { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vehicle details updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle details",
        variant: "destructive",
      });
    },
  });

  // Initialize USA name form when profile loads
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Check KYC completeness
  const missingFields: string[] = [];
  
  if (!profile?.profilePhotoUrl) {
    missingFields.push("Profile photo");
  }

  if (isBD) {
    if (!profile?.nidEncrypted && !profile?.nidNumber) {
      missingFields.push("National ID (NID)");
    }
  }

  if (isUSA) {
    if (!profile?.firstName) missingFields.push("First name");
    if (!profile?.lastName) missingFields.push("Last name");
    if (!profile?.dmvLicenseImageUrl) missingFields.push("DMV license");
    if (isNY && !profile?.tlcLicenseImageUrl) missingFields.push("TLC license");
    // Identity documents for USA
    if (!profile?.hasSSN) missingFields.push("Social Security Number");
    // SSN card image upload removed - no longer required
  }

  if (isBD) {
    // Identity documents for Bangladesh
    if (!profile?.hasNID) missingFields.push("National ID Number");
    if (!profile?.nidImageUrl) missingFields.push("NID image");
  }

  const vehicleDocs = (vehicleDocuments as any)?.documents || [];
  const hasVehicleRegistration = vehicleDocs.some((doc: any) => doc.documentType === "registration");
  const hasVehicleInsurance = vehicleDocs.some((doc: any) => doc.documentType === "insurance");
  const hasVehicleInspection = vehicleDocs.some((doc: any) => doc.documentType === "vehicleInspection");
  const hasDriverLicenseVehicle = vehicleDocs.some((doc: any) => doc.documentType === "driverLicenseVehicle");
  const hasTLCDiamond = vehicleDocs.some((doc: any) => doc.documentType === "tlcDiamond");

  // Check all required vehicle documents
  if (!hasVehicleRegistration) {
    missingFields.push("Vehicle registration document");
  }
  
  if (!hasVehicleInsurance) {
    missingFields.push("Vehicle insurance document");
  }
  
  if (!hasVehicleInspection) {
    missingFields.push("Vehicle inspection document");
  }
  
  if (!hasDriverLicenseVehicle) {
    missingFields.push("Driver license document");
  }
  
  // License plate photo upload removed - now using text field instead
  
  // NYC-specific requirements
  if (isNYC && !hasTLCDiamond) {
    missingFields.push("TLC Diamond document");
  }

  // Check vehicle KYC text fields for USA drivers
  const vehicle = (driverData as any)?.vehicle;
  if (isUSA) {
    if (!vehicle?.color) missingFields.push("Vehicle color");
    if (!vehicle?.vehicleModel) missingFields.push("Vehicle model");
    if (!vehicle?.licensePlate) missingFields.push("License plate number");
  }

  const isKYCComplete = missingFields.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/driver/profile">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">KYC Documents</h1>
          </div>
          <Badge variant={isKYCComplete ? "default" : "secondary"} data-testid="badge-kyc-status">
            {isKYCComplete ? (
              <><CheckCircle className="h-4 w-4 mr-1" /> Complete</>
            ) : (
              <><AlertCircle className="h-4 w-4 mr-1" /> Incomplete</>
            )}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* KYC Status Card */}
        {!isKYCComplete && (
          <Card className="border-warning bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-5 w-5" />
                Missing Required Documents
              </CardTitle>
              <CardDescription>
                Please upload the following to complete your KYC verification:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {missingFields.map((field) => (
                  <li key={field} className="text-sm">{field}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
            <CardDescription>Required for all drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              label="Profile Photo"
              accept="image/*"
              maxSizeMB={5}
              currentFileUrl={profile?.profilePhotoUrl}
              onUpload={async (file) => {
                const result = await uploadProfilePhotoMutation.mutateAsync(file);
                return { url: result.profilePhotoUrl };
              }}
              testId="profile-photo"
            />
          </CardContent>
        </Card>

        {/* USA Driver Fields */}
        {isUSA && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Legal Name</CardTitle>
                <CardDescription>Required for USA drivers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      data-testid="input-firstname"
                      value={usaNameForm.firstName}
                      onChange={(e) => setUsaNameForm({ ...usaNameForm, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      data-testid="input-middlename"
                      value={usaNameForm.middleName}
                      onChange={(e) => setUsaNameForm({ ...usaNameForm, middleName: e.target.value })}
                      placeholder="Michael"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      data-testid="input-lastname"
                      value={usaNameForm.lastName}
                      onChange={(e) => setUsaNameForm({ ...usaNameForm, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateUSANameMutation.mutate(usaNameForm)}
                  disabled={!usaNameForm.firstName || !usaNameForm.lastName || updateUSANameMutation.isPending}
                  data-testid="button-save-name"
                >
                  {updateUSANameMutation.isPending ? "Saving..." : "Save Name"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>DMV Driver License</CardTitle>
                <CardDescription>Required for all USA drivers</CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  label="DMV License Image"
                  accept="image/*"
                  maxSizeMB={5}
                  currentFileUrl={profile?.dmvLicenseImageUrl}
                  onUpload={async (file) => {
                    const result = await uploadDMVLicenseMutation.mutateAsync(file);
                    return { url: result.dmvLicenseImageUrl };
                  }}
                  testId="dmv-license"
                />
              </CardContent>
            </Card>

            {isNY && (
              <Card>
                <CardHeader>
                  <CardTitle>TLC License</CardTitle>
                  <CardDescription>Required for NY state drivers</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    label="TLC License Image"
                    accept="image/*"
                    maxSizeMB={5}
                    currentFileUrl={profile?.tlcLicenseImageUrl}
                    onUpload={async (file) => {
                      const result = await uploadTLCLicenseMutation.mutateAsync(file);
                      return { url: result.tlcLicenseImageUrl };
                    }}
                    testId="tlc-license"
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Identity Documents Section */}
        {(isBD || isUSA) && (
          <Card>
            <CardHeader>
              <CardTitle>Identity Documents</CardTitle>
              <CardDescription>Country-specific identity verification documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bangladesh - NID */}
              {isBD && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nidNumber">National ID Number (NID)</Label>
                    {profile?.hasNID && !isEditingNID ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="nidNumber"
                          value={profile?.nidNumber || ""}
                          disabled
                          data-testid="input-nid-masked"
                          className="bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingNID(true)}
                          data-testid="button-edit-nid"
                        >
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="nidNumber"
                          value={nidNumber}
                          onChange={(e) => setNidNumber(e.target.value.replace(/\D/g, ""))}
                          placeholder="Enter 10-17 digit NID"
                          maxLength={17}
                          data-testid="input-nid"
                        />
                        <Button
                          onClick={() => updateNIDMutation.mutate(nidNumber)}
                          disabled={!nidNumber || nidNumber.length < 10 || updateNIDMutation.isPending}
                          data-testid="button-save-nid"
                        >
                          {updateNIDMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        {isEditingNID && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setIsEditingNID(false);
                              setNidNumber("");
                            }}
                            data-testid="button-cancel-nid"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter your 10-17 digit National ID number
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">NID Image</h4>
                    <p className="text-sm text-muted-foreground">Upload a clear photo of your National ID card</p>
                    <FileUpload
                      label=""
                      accept="image/*"
                      maxSizeMB={5}
                      currentFileUrl={profile?.nidImageUrl}
                      onUpload={async (file) => {
                        const result = await uploadNIDImageMutation.mutateAsync(file);
                        return { url: result.nidImageUrl };
                      }}
                      testId="nid-image"
                    />
                  </div>
                </>
              )}

              {/* USA - SSN */}
              {isUSA && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ssnNumber">Social Security Number (SSN)</Label>
                    {profile?.hasSSN && !isEditingSSN ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="ssnNumber"
                          value={profile?.ssnMasked || ""}
                          disabled
                          data-testid="input-ssn-masked"
                          className="bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingSSN(true)}
                          data-testid="button-edit-ssn"
                        >
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="ssnNumber"
                          value={ssnNumber}
                          onChange={(e) => {
                            // Allow digits and dashes only
                            const value = e.target.value.replace(/[^\d-]/g, "");
                            setSsnNumber(value);
                          }}
                          placeholder="XXX-XX-XXXX"
                          maxLength={11}
                          data-testid="input-ssn"
                        />
                        <Button
                          onClick={() => updateSSNMutation.mutate(ssnNumber)}
                          disabled={!ssnNumber || ssnNumber.replace(/\D/g, "").length !== 9 || updateSSNMutation.isPending}
                          data-testid="button-save-ssn"
                        >
                          {updateSSNMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        {isEditingSSN && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setIsEditingSSN(false);
                              setSsnNumber("");
                            }}
                            data-testid="button-cancel-ssn"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter your 9-digit Social Security Number (format: XXX-XX-XXXX or XXXXXXXXX)
                    </p>
                  </div>

                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vehicle Details (KYC Dropdown Fields) */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
            <CardDescription>{isUSA ? "Required for USA drivers" : "Vehicle information for KYC"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vehicle Brand Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="vehicleBrand">Vehicle Brand {isUSA && "*"}</Label>
                <Select
                  value={selectedBrand}
                  onValueChange={(value) => {
                    setSelectedBrand(value);
                    if (value === "Other") {
                      // When brand is "Other", auto-enable custom model input
                      setSelectedModel("Other");
                    } else {
                      setSelectedModel(""); // Reset model when brand changes to a catalog brand
                      setCustomModel("");
                      setCustomBrand(""); // Clear custom brand when switching to catalog brand
                    }
                  }}
                >
                  <SelectTrigger id="vehicleBrand" data-testid="select-vehicle-brand">
                    <SelectValue placeholder="Select vehicle brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(VEHICLE_BRANDS_MODELS).map((brand) => (
                      <SelectItem key={brand} value={brand} data-testid={`option-brand-${brand.toLowerCase()}`}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBrand === "Other" && (
                  <Input
                    id="customBrand"
                    data-testid="input-custom-brand"
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    placeholder="Enter custom brand (e.g., Rivian)"
                    className="mt-2"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedBrand === "Other" ? "Enter your vehicle brand" : "Select your vehicle manufacturer/brand"}
                </p>
              </div>

              {/* Vehicle Model Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="vehicleModel">Vehicle Model {isUSA && "*"}</Label>
                {selectedBrand === "Other" ? (
                  // For custom brand, show only the custom model input
                  <Input
                    id="customModel"
                    data-testid="input-custom-model"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="Enter vehicle model (e.g., R1T, Model Y)"
                  />
                ) : (
                  <>
                    <Select
                      value={selectedModel}
                      onValueChange={(value) => {
                        setSelectedModel(value);
                        if (value !== "Other") {
                          setCustomModel("");
                        }
                      }}
                      disabled={!selectedBrand}
                    >
                      <SelectTrigger id="vehicleModel" data-testid="select-vehicle-model">
                        <SelectValue placeholder={selectedBrand ? "Select model" : "Select brand first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model} value={model} data-testid={`option-model-${model.toLowerCase().replace(/\s+/g, '-')}`}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedModel === "Other" && (
                      <Input
                        id="customModelCatalog"
                        data-testid="input-custom-model-catalog"
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        placeholder="Enter custom model (e.g., Accord 2018)"
                        className="mt-2"
                      />
                    )}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  {!selectedBrand ? "Select brand first" : selectedBrand === "Other" || selectedModel === "Other" ? "Enter model and year" : "Select your vehicle model"}
                </p>
              </div>

              {/* Vehicle Color Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="vehicleColor">Vehicle Color {isUSA && "*"}</Label>
                <Select
                  value={selectedColor}
                  onValueChange={(value) => {
                    setSelectedColor(value);
                    if (value !== "Other") {
                      setCustomColor("");
                    }
                  }}
                >
                  <SelectTrigger id="vehicleColor" data-testid="select-vehicle-color">
                    <SelectValue placeholder="Select vehicle color" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_COLORS.map((color) => (
                      <SelectItem key={color} value={color} data-testid={`option-color-${color.toLowerCase()}`}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedColor === "Other" && (
                  <Input
                    id="customColor"
                    data-testid="input-custom-color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="Enter custom color"
                    className="mt-2"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedColor === "Other" ? "Enter custom color" : "Select your vehicle's color"}
                </p>
              </div>

              {/* License Plate Number */}
              <div className="space-y-2">
                <Label htmlFor="licensePlateNumber">License Plate Number {isUSA && "*"}</Label>
                <Input
                  id="licensePlateNumber"
                  data-testid="input-license-plate"
                  value={vehicleKYCForm.licensePlateNumber}
                  onChange={(e) => setVehicleKYCForm({ ...vehicleKYCForm, licensePlateNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g., NYC1230"
                />
                <p className="text-xs text-muted-foreground">Enter plate number (no photo needed)</p>
              </div>
            </div>

            <Button
              onClick={handleVehicleKYCSave}
              disabled={
                (isUSA && (!selectedBrand || !selectedColor || !vehicleKYCForm.licensePlateNumber)) ||
                (isUSA && selectedBrand !== "Other" && !selectedModel) ||
                (selectedColor === "Other" && !customColor?.trim()) ||
                (selectedBrand === "Other" && !customModel?.trim()) ||
                (selectedBrand !== "Other" && selectedModel === "Other" && !customModel?.trim()) ||
                updateVehicleKYCMutation.isPending
              }
              data-testid="button-save-vehicle-kyc"
            >
              {updateVehicleKYCMutation.isPending ? "Saving..." : "Save Vehicle Details"}
            </Button>
          </CardContent>
        </Card>

        {/* Vehicle Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Documents</CardTitle>
            <CardDescription>Upload all required documents for your vehicle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Registration Document */}
            <div className="space-y-2">
              <h4 className="font-medium">Registration Document</h4>
              <p className="text-sm text-muted-foreground">Upload vehicle registration</p>
              <FileUpload
                label=""
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "registration",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="registration-doc"
              />
            </div>

            {/* Insurance Document */}
            <div className="space-y-2">
              <h4 className="font-medium">Insurance Document</h4>
              <p className="text-sm text-muted-foreground">Upload insurance certificate</p>
              <FileUpload
                label=""
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "insurance",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="insurance-doc"
              />
            </div>

            {/* Vehicle Inspection */}
            <div className="space-y-2">
              <h4 className="font-medium">Vehicle Inspection</h4>
              <p className="text-sm text-muted-foreground">Upload official inspection report</p>
              <FileUpload
                label=""
                accept="image/*,application/pdf"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "vehicleInspection",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="vehicle-inspection-doc"
              />
            </div>

            {/* Driver License (Vehicle Section) */}
            <div className="space-y-2">
              <h4 className="font-medium">Driver License</h4>
              <p className="text-sm text-muted-foreground">Upload a clear photo of your driver license</p>
              <FileUpload
                label=""
                accept="image/*"
                maxSizeMB={10}
                onUpload={async (file) => {
                  const result = await uploadVehicleDocMutation.mutateAsync({
                    file,
                    documentType: "driverLicenseVehicle",
                  });
                  return { url: result.document.fileUrl };
                }}
                testId="driver-license-vehicle-doc"
              />
            </div>

            {/* TLC Diamond (NYC only) */}
            {isNYC && (
              <div className="space-y-2 p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                <h4 className="font-medium">TLC Diamond</h4>
                <p className="text-sm text-muted-foreground">Upload a clear photo of the TLC Diamond/medallion</p>
                <FileUpload
                  label=""
                  accept="image/*"
                  maxSizeMB={10}
                  onUpload={async (file) => {
                    const result = await uploadVehicleDocMutation.mutateAsync({
                      file,
                      documentType: "tlcDiamond",
                    });
                    return { url: result.document.fileUrl };
                  }}
                  testId="tlc-diamond-doc"
                />
              </div>
            )}

            {/* Uploaded Documents List */}
            {docsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : vehicleDocs.length > 0 ? (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="text-sm font-medium">Uploaded Documents</h4>
                <div className="space-y-2">
                  {vehicleDocs.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {doc.documentType === "vehicleInspection" ? "Vehicle Inspection" :
                             doc.documentType === "driverLicenseVehicle" ? "Driver License" :
                             doc.documentType === "licensePlate" ? "License Plate" :
                             doc.documentType === "tlcDiamond" ? "TLC Diamond" :
                             doc.documentType === "registration" ? "Registration" :
                             doc.documentType === "insurance" ? "Insurance" :
                             doc.documentType.charAt(0).toUpperCase() + doc.documentType.slice(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                        data-testid={`link-vehicle-doc-${doc.id}`}
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
