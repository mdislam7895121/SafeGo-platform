import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  countryCode: z.string().min(2, "Country is required"),
  payoutRailType: z.string().min(1, "Payout method type is required"),
  provider: z.string().min(1, "Provider is required"),
  currency: z.string().min(3, "Currency is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  bankName: z.string().optional(),
  branchCode: z.string().optional(),
  routingNumber: z.string().optional(),
  isDefault: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

interface PayoutRail {
  id: string;
  payoutRailType: string;
  provider: string;
  minPayoutAmount: string;
  requiresKycLevel: string;
}

interface AddPayoutMethodFormProps {
  onSuccess: () => void;
}

export default function AddPayoutMethodForm({ onSuccess }: AddPayoutMethodFormProps) {
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<string>("BD");
  const [selectedRailType, setSelectedRailType] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      countryCode: "BD",
      currency: "BDT",
      accountNumber: "",
      accountHolderName: "",
      bankName: "",
      branchCode: "",
      routingNumber: "",
      isDefault: false,
    },
  });

  // Fetch available payout rails for selected country
  const { data: payoutRailsData, isLoading: isLoadingRails } = useQuery<{ payoutRails: PayoutRail[] }>({
    queryKey: ["/api/config/payout/restaurant", selectedCountry],
    enabled: !!selectedCountry,
  });

  // Update currency when country changes
  useEffect(() => {
    if (selectedCountry === "BD") {
      form.setValue("currency", "BDT");
    } else if (selectedCountry === "US") {
      form.setValue("currency", "USD");
    }
  }, [selectedCountry, form]);

  // Create payout method mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Build masked details based on payout rail type
      let maskedDetails = "";
      if (data.payoutRailType.includes("MOBILE_MONEY")) {
        maskedDetails = `${data.provider} ***${data.accountNumber.slice(-4)}`;
      } else if (data.payoutRailType.includes("BANK")) {
        maskedDetails = `${data.bankName || data.provider} ****${data.accountNumber.slice(-4)}`;
      } else {
        maskedDetails = `${data.provider} ****${data.accountNumber.slice(-4)}`;
      }

      const payload = {
        countryCode: data.countryCode,
        payoutRailType: data.payoutRailType,
        provider: data.provider,
        currency: data.currency,
        maskedDetails,
        metadata: {
          accountNumber: data.accountNumber,
          accountHolderName: data.accountHolderName,
          bankName: data.bankName,
          branchCode: data.branchCode,
          routingNumber: data.routingNumber,
        },
        isDefault: data.isDefault,
      };

      return apiRequest("/api/restaurants/me/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/me/payout-methods"] });
      toast({
        title: "Success",
        description: "Payout method added successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add payout method",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const selectedRail = payoutRailsData?.payoutRails?.find(
    (rail) => rail.payoutRailType === selectedRailType
  );

  const showBankFields = selectedRailType.includes("BANK") || selectedRailType.includes("ACH");
  const showMobileMoneyFields = selectedRailType.includes("MOBILE_MONEY");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="countryCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedCountry(value);
                }}
                defaultValue={field.value}
                data-testid="select-country"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="BD">Bangladesh</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isLoadingRails ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <FormField
              control={form.control}
              name="payoutRailType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payout Method</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedRailType(value);
                      // Auto-fill provider based on selection
                      const rail = payoutRailsData?.payoutRails?.find(r => r.payoutRailType === value);
                      if (rail) {
                        form.setValue("provider", rail.provider);
                      }
                    }}
                    value={field.value}
                    data-testid="select-payout-rail-type"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payout method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payoutRailsData?.payoutRails?.map((rail) => (
                        <SelectItem key={rail.id} value={rail.payoutRailType}>
                          {rail.payoutRailType.replace(/_/g, " ")} - {rail.provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRail && selectedRail.requiresKycLevel !== "NONE" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This payout method requires <strong>{selectedRail.requiresKycLevel}</strong> KYC verification. 
                  Please ensure your KYC documents are submitted and verified before using this method.
                </AlertDescription>
              </Alert>
            )}

            {selectedRailType && (
              <>
                <FormField
                  control={form.control}
                  name="accountHolderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full name as per account" data-testid="input-account-holder-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showMobileMoneyFields && (
                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="01XXXXXXXXX" data-testid="input-mobile-number" />
                        </FormControl>
                        <FormDescription>
                          Enter your {form.watch("provider")} registered mobile number
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showBankFields && (
                  <>
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Dutch Bangla Bank" data-testid="input-bank-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter account number" data-testid="input-account-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedCountry === "BD" && (
                      <FormField
                        control={form.control}
                        name="branchCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch Code (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Branch code" data-testid="input-branch-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {selectedCountry === "US" && (
                      <FormField
                        control={form.control}
                        name="routingNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Routing Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="9-digit routing number" data-testid="input-routing-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} disabled data-testid="input-currency" />
                      </FormControl>
                      <FormDescription>Currency is automatically set based on country</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={createMutation.isPending || !selectedRailType}
            data-testid="button-submit-payout-method"
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Payout Method
          </Button>
        </div>
      </form>
    </Form>
  );
}
