import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Target, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface OpportunitySetting {
  id: string;
  bonusType: "trip_boost" | "surge_boost" | "peak_hour_boost" | "per_ride_bonus";
  countryCode: string;
  currency: string;
  baseAmount: string;
  promoAmount?: string | null;
  promoMultiplier?: string | null;
  zoneId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive: boolean;
  notes?: string | null;
}

const formSchema = z.object({
  bonusType: z.enum(["trip_boost", "surge_boost", "peak_hour_boost", "per_ride_bonus"]),
  countryCode: z.string().min(2, "Country code required"),
  currency: z.string().min(3, "Currency required"),
  baseAmount: z.string().min(1, "Base amount required"),
  promoAmount: z.string().optional(),
  promoMultiplier: z.string().optional(),
  zoneId: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AdminOpportunityBonusesEdit() {
  const [, params] = useRoute("/admin/opportunity-bonuses/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const id = params?.id;

  // Fetch the opportunity setting
  const { data: setting, isLoading } = useQuery<OpportunitySetting>({
    queryKey: ["/api/admin/opportunity-settings", id],
    enabled: !!id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bonusType: "trip_boost",
      countryCode: "",
      currency: "",
      baseAmount: "",
      promoAmount: "",
      promoMultiplier: "",
      zoneId: "",
      startAt: "",
      endAt: "",
      isActive: true,
      notes: "",
    },
  });

  // Pre-fill form when data is loaded
  useEffect(() => {
    if (setting) {
      form.reset({
        bonusType: setting.bonusType,
        countryCode: setting.countryCode,
        currency: setting.currency,
        baseAmount: setting.baseAmount,
        promoAmount: setting.promoAmount || "",
        promoMultiplier: setting.promoMultiplier || "",
        zoneId: setting.zoneId || "",
        startAt: setting.startAt ? new Date(setting.startAt).toISOString().split("T")[0] : "",
        endAt: setting.endAt ? new Date(setting.endAt).toISOString().split("T")[0] : "",
        isActive: setting.isActive,
        notes: setting.notes || "",
      });
    }
  }, [setting, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {
        bonusType: values.bonusType,
        countryCode: values.countryCode,
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
      if (values.zoneId) {
        payload.zoneId = values.zoneId;
      }
      if (values.startAt) {
        payload.startAt = new Date(values.startAt).toISOString();
      }
      if (values.endAt) {
        payload.endAt = new Date(values.endAt).toISOString();
      }
      if (values.notes) {
        payload.notes = values.notes;
      }

      return apiRequest("PATCH", `/api/admin/opportunity-settings/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-settings"] });
      toast({
        title: "Success",
        description: "Opportunity bonus updated successfully",
      });
      setLocation("/admin/opportunity-bonuses");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update bonus",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  const handleCancel = () => {
    setLocation("/admin/opportunity-bonuses");
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

  if (!setting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Bonus setting not found</p>
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
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Edit Opportunity Bonus</h1>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Update Opportunity Bonus Setting</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Bonus Type */}
                <FormField
                  control={form.control}
                  name="bonusType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bonus-type">
                            <SelectValue placeholder="Select bonus type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="trip_boost">Trip Boost</SelectItem>
                          <SelectItem value="surge_boost">Surge Boost</SelectItem>
                          <SelectItem value="peak_hour_boost">Peak Hour Boost</SelectItem>
                          <SelectItem value="per_ride_bonus">Per-Ride Bonus</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                {/* Zone ID */}
                <FormField
                  control={form.control}
                  name="zoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone ID (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="downtown-dhaka"
                          {...field}
                          data-testid="input-zone-id"
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

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes or instructions"
                          className="resize-none"
                          rows={3}
                          {...field}
                          data-testid="input-notes"
                        />
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
                          Enable or disable this bonus setting
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
