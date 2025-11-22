import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Address form schema with country-specific validation
const createAddressSchema = (countryCode: string) => {
  const baseSchema = {
    streetAddress: z.string().min(1, "Street address is required").max(200),
    city: z.string().min(1, "City is required").max(100),
    state: z.string().min(1, "State is required").max(100),
    zipCode: z.string().min(1, "ZIP/Postal code is required"),
  };

  // US-specific ZIP code validation (5 digits)
  if (countryCode === "US") {
    return z.object({
      ...baseSchema,
      zipCode: z.string()
        .regex(/^\d{5}$/, "ZIP code must be exactly 5 digits")
        .length(5, "ZIP code must be exactly 5 digits"),
    });
  }

  // International: allow any non-empty string for postal code
  return z.object(baseSchema);
};

type AddressFormData = z.infer<ReturnType<typeof createAddressSchema>>;

// Separate component for the address form - keyed by countryCode to ensure correct validation
function AddressForm({ profile, countryCode }: { profile: any; countryCode: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Create schema based on country - this will be correct since component is keyed by countryCode
  const addressSchema = createAddressSchema(countryCode);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  // Update form when profile data loads - use useEffect to avoid state updates during render
  useEffect(() => {
    if (profile) {
      const currentAddress = {
        streetAddress: profile.usaStreet || profile.streetAddress || "",
        city: profile.usaCity || profile.city || "",
        state: profile.usaState || profile.state || "",
        zipCode: profile.usaZipCode || profile.zipCode || "",
      };
      form.reset(currentAddress);
    }
  }, [profile, form]);

  // Mutation to update address
  const updateAddressMutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      // Map to country-specific field names
      let payload: any;
      
      if (countryCode === "US") {
        payload = {
          usaStreet: data.streetAddress,
          usaCity: data.city,
          usaState: data.state,
          usaZipCode: data.zipCode,
        };
      } else if (countryCode === "BD") {
        // Bangladesh uses presentAddress and permanentAddress
        const fullAddress = `${data.streetAddress}, ${data.city}, ${data.state}, ${data.zipCode}`;
        payload = {
          presentAddress: fullAddress,
          permanentAddress: fullAddress, // Update both for now
        };
      } else {
        // International drivers (non-US, non-BD)
        payload = {
          streetAddress: data.streetAddress,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
        };
      }

      const response = await apiRequest("PATCH", "/api/driver/profile", payload);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate driver home query to refresh profile data
      queryClient.invalidateQueries({ queryKey: ["/api/driver/home"] });
      
      toast({
        title: "Address updated successfully",
        description: "Your address has been saved.",
      });
      
      // Navigate back to Account Settings
      navigate("/driver/account");
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Unable to update address right now. Please try again later.";
      toast({
        title: "Error updating address",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddressFormData) => {
    updateAddressMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Current Address</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Street Address */}
              <FormField
                control={form.control}
                name="streetAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Main St"
                        data-testid="input-street"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City and State */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="New York"
                          data-testid="input-city"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="NY"
                          data-testid="input-state"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ZIP Code */}
              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {countryCode === "US" ? "ZIP Code" : "Postal Code"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={countryCode === "US" ? "10001" : "Postal Code"}
                        data-testid="input-zip"
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
                disabled={updateAddressMutation.isPending}
                data-testid="button-save-address"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {updateAddressMutation.isPending ? "Saving..." : "Save Address"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EditAddress() {
  const [, navigate] = useLocation();

  // Fetch driver profile to get current address
  const { data: driverData, isLoading } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const countryCode = profile?.countryCode;

  // Don't render form until we have profile data with countryCode
  if (isLoading || !profile || !countryCode) {
    return (
      <div className="bg-background">
        <div className="bg-primary text-primary-foreground p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate("/driver/account")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Edit Address
          </h1>
        </div>
      </div>

      {/* Key the form by countryCode to ensure correct validation schema */}
      <AddressForm key={countryCode} profile={profile} countryCode={countryCode} />
    </div>
  );
}
