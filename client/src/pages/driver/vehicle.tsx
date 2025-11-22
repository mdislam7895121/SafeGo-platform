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

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleType: vehicle?.vehicleType || "",
      vehicleModel: vehicle?.vehicleModel || "",
      vehiclePlate: vehicle?.vehiclePlate || "",
    },
  });

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
      const response = await apiRequest("POST", "/api/driver/vehicle", data);
      return response.json();
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
      const response = await apiRequest("PATCH", "/api/driver/vehicle", data);
      return response.json();
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
    if (hasVehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      registerVehicleMutation.mutate(data);
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

              {/* Vehicle Model */}
              <FormField
                control={form.control}
                name="vehicleModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Toyota Camry 2020"
                        data-testid="input-vehicle-model"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                disabled={isPending}
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
