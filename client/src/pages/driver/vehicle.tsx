import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Car, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

// Comprehensive vehicle model options (100+ models, same as KYC documents page)
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
  // Other
  "Other",
] as const;

// Vehicle registration schema
const vehicleSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required").max(100),
  vehiclePlate: z.string().min(1, "License plate is required").max(20),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

export default function DriverVehicle() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch driver home data to check if vehicle exists
  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const vehicle = (driverData as any)?.vehicle;
  const hasVehicle = !!vehicle;

  // Dropdown state for model
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [customModel, setCustomModel] = useState<string>("");
  const [modelInitialized, setModelInitialized] = useState(false);

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleType: vehicle?.vehicleType || "",
      vehicleModel: "", // Start empty to force dropdown selection
      vehiclePlate: vehicle?.vehiclePlate || "",
    },
  });

  // Initialize model dropdown from existing vehicle data
  useEffect(() => {
    if (vehicle && !modelInitialized) {
      const savedModel = vehicle.vehicleModel || "";
      
      // Check if saved model matches predefined options
      const isModelPredefined = VEHICLE_MODELS.includes(savedModel as any);
      if (isModelPredefined && savedModel !== "Other") {
        setSelectedModel(savedModel);
        setCustomModel("");
        form.setValue("vehicleModel", savedModel);
      } else if (savedModel) {
        // Custom model - select "Other" and prefill custom field
        setSelectedModel("Other");
        setCustomModel(savedModel);
        form.setValue("vehicleModel", savedModel);
      }
      setModelInitialized(true);
    }
  }, [vehicle, modelInitialized, form]);

  // Reset form when vehicle data loads
  if (vehicle && !form.getValues().vehicleType) {
    form.reset({
      vehicleType: vehicle.vehicleType,
      vehicleModel: vehicle.vehicleModel,
      vehiclePlate: vehicle.vehiclePlate,
    });
  }

  // Mutation to register vehicle (POST)
  const registerVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const result = await apiRequest("/api/driver/vehicle", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({
        title: "Vehicle registered",
        description: "Your vehicle has been registered successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to register vehicle. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to update vehicle (PATCH)
  const updateVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const result = await apiRequest("/api/driver/vehicle", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      toast({
        title: "Vehicle updated",
        description: "Your vehicle information has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Unable to update vehicle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VehicleFormData) => {
    // Validate dropdown selection
    if (!selectedModel) {
      toast({
        title: "Validation error",
        description: "Please select a vehicle model",
        variant: "destructive",
      });
      return;
    }
    
    // Build final model value from dropdown selection + custom input
    let finalModel = selectedModel;
    
    if (selectedModel === "Other") {
      if (!customModel?.trim()) {
        toast({
          title: "Validation error",
          description: "Please enter a custom vehicle model",
          variant: "destructive",
        });
        return;
      }
      finalModel = customModel.trim();
    }
    
    const submitData = {
      ...data,
      vehicleModel: finalModel,
    };
    
    if (hasVehicle) {
      updateVehicleMutation.mutate(submitData);
    } else {
      registerVehicleMutation.mutate(submitData);
    }
  };

  const isPending = registerVehicleMutation.isPending || updateVehicleMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-6 w-6" />
            Vehicle {hasVehicle ? "Information" : "Registration"}
          </CardTitle>
          <CardDescription>
            {hasVehicle
              ? "Update your vehicle information"
              : "Register your vehicle to start accepting rides"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasVehicle && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Vehicle Registered</span>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Vehicle Type */}
              <FormField
                control={form.control}
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
                        <SelectItem value="sedan">Sedan</SelectItem>
                        <SelectItem value="suv">SUV</SelectItem>
                        <SelectItem value="hatchback">Hatchback</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="rickshaw">Rickshaw</SelectItem>
                        <SelectItem value="auto-rickshaw">Auto Rickshaw</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vehicle Model Dropdown */}
              <FormItem>
                <FormLabel>Vehicle Model</FormLabel>
                <Select
                  value={selectedModel}
                  onValueChange={(value) => {
                    setSelectedModel(value);
                    if (value !== "Other") {
                      setCustomModel("");
                      form.setValue("vehicleModel", value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-vehicle-model">
                      <SelectValue placeholder="Select vehicle model" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VEHICLE_MODELS.map((model) => (
                      <SelectItem 
                        key={model} 
                        value={model}
                        data-testid={`option-model-${model.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModel === "Other" && (
                  <Input
                    id="customModel"
                    data-testid="input-custom-model"
                    value={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.value);
                      form.setValue("vehicleModel", e.target.value);
                    }}
                    placeholder="Enter custom model (e.g., Honda Accord 2018)"
                    className="mt-2"
                  />
                )}
                <FormMessage />
              </FormItem>

              {/* License Plate */}
              <FormField
                control={form.control}
                name="vehiclePlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Plate Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., ABC-1234"
                        data-testid="input-license-plate"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  isPending || 
                  !selectedModel || 
                  (selectedModel === "Other" && !customModel?.trim())
                }
                data-testid="button-submit-vehicle"
              >
                <Car className="h-4 w-4 mr-2" />
                {isPending
                  ? hasVehicle
                    ? "Updating..."
                    : "Registering..."
                  : hasVehicle
                  ? "Update Vehicle"
                  : "Register Vehicle"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
