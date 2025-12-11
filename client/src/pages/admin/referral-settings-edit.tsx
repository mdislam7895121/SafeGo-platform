import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Gift, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface ReferralSetting {
  id: string;
  countryCode: string;
  userType: "driver" | "customer" | "restaurant";
  currency: string;
  baseAmount: string;
  promoAmount?: string | null;
  promoMultiplier?: string | null;
  promoLabel?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive: boolean;
}

const formSchema = z.object({
  countryCode: z.string().min(2, "Country code required"),
  userType: z.enum(["driver", "customer", "restaurant"]),
  currency: z.string().min(3, "Currency required"),
  baseAmount: z.string().min(1, "Base amount required"),
  promoAmount: z.string().optional(),
  promoMultiplier: z.string().optional(),
  promoLabel: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AdminReferralSettingsEdit() {
  const [, params] = useRoute("/admin/referral-settings/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const id = params?.id;

  // Fetch the referral setting
  const { data, isLoading, isError, error } = useQuery<{ setting: ReferralSetting }>({
    queryKey: ["/api/admin/referral-settings", id],
    enabled: !!id,
  });

  const setting = data?.setting;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      countryCode: "",
      userType: "driver",
      currency: "",
      baseAmount: "",
      promoAmount: "",
      promoMultiplier: "",
      promoLabel: "",
      startAt: "",
      endAt: "",
      isActive: true,
    },
  });

  // Pre-fill form when data is loaded
  useEffect(() => {
    if (setting) {
      form.reset({
        countryCode: setting.countryCode,
        userType: setting.userType,
        currency: setting.currency,
        baseAmount: setting.baseAmount,
        promoAmount: setting.promoAmount || "",
        promoMultiplier: setting.promoMultiplier || "",
        promoLabel: setting.promoLabel || "",
        startAt: setting.startAt ? new Date(setting.startAt).toISOString().split("T")[0] : "",
        endAt: setting.endAt ? new Date(setting.endAt).toISOString().split("T")[0] : "",
        isActive: setting.isActive,
      });
    }
  }, [setting, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {
        countryCode: values.countryCode,
        userType: values.userType,
        currency: values.currency,
        baseAmount: parseFloat(values.baseAmount),
        isActive: values.isActive,
      };

      if (values.promoAmount) {
        payload.promoAmount = parseFloat(values.promoAmount);
      }
      if (values.promoMultiplier) {
        payload.promoMultiplier = parseFloat(values.promoMultiplier);
      }
      if (values.promoLabel) {
        payload.promoLabel = values.promoLabel;
      }
      if (values.startAt) {
        payload.startAt = new Date(values.startAt).toISOString();
      }
      if (values.endAt) {
        payload.endAt = new Date(values.endAt).toISOString();
      }

      return apiRequest(`/api/admin/referral-settings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-settings"] });
      toast({
        title: "Success",
        description: "Referral setting updated successfully",
      });
      setLocation("/admin/referral-settings");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  const handleCancel = () => {
    setLocation("/admin/referral-settings");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="flex h-16 items-center px-6">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="p-6 max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    // Get HTTP status code from error object (ApiError has .status property)
    const statusCode = (error as any)?.status || null;

    const is404 = statusCode === 404;
    const isUnauthorized = statusCode === 401 || statusCode === 403;

    const displayMessage = is404
      ? "Setting not found"
      : isUnauthorized
      ? "You don't have permission to view this setting"
      : "Failed to load setting. Please try again.";

    if (!is404) {
      toast({
        title: "Error",
        description: displayMessage,
        variant: "destructive",
      });

      if (isUnauthorized) {
        setTimeout(() => setLocation("/admin/referral-settings"), 2000);
      }
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{displayMessage}</p>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="mt-4 w-full"
              data-testid="button-back"
            >
              Back to List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!setting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Setting not found</p>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="mt-4 w-full"
              data-testid="button-back"
            >
              Back to List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Edit Referral Setting</h1>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Update Referral Setting</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Country Code */}
                <FormField
                  control={form.control}
                  name="countryCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country Code</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BD">Bangladesh (BD)</SelectItem>
                          <SelectItem value="US">United States (US)</SelectItem>
                          <SelectItem value="IN">India (IN)</SelectItem>
                          <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* User Type */}
                <FormField
                  control={form.control}
                  name="userType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-type">
                            <SelectValue placeholder="Select user type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="driver">Driver</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="restaurant">Restaurant</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Currency */}
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BDT">BDT (৳)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Base Amount */}
                <FormField
                  control={form.control}
                  name="baseAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="50.00"
                          {...field}
                          data-testid="input-base-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Promo Amount */}
                <FormField
                  control={form.control}
                  name="promoAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promo Amount (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="100.00"
                          {...field}
                          data-testid="input-promo-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Promo Multiplier */}
                <FormField
                  control={form.control}
                  name="promoMultiplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promo Multiplier (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="1.5"
                          {...field}
                          data-testid="input-promo-multiplier"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Promo Label */}
                <FormField
                  control={form.control}
                  name="promoLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promo Label (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Limited Time Offer"
                          {...field}
                          data-testid="input-promo-label"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Start Date */}
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* End Date */}
                <FormField
                  control={form.control}
                  name="endAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Is Active */}
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Enable or disable this referral setting
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                    data-testid="button-cancel"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
