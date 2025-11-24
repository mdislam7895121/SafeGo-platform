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
  payoutType: z.string().min(1, "Payout method type is required"),
  currency: z.string().min(3, "Currency is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  bankName: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  mobileWalletProvider: z.string().optional(),
  mobileWalletNumber: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddPayoutMethodFormProps {
  onSuccess: () => void;
}

export default function AddPayoutMethodForm({ onSuccess }: AddPayoutMethodFormProps) {
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<string>("BD");
  const [selectedPayoutType, setSelectedPayoutType] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      countryCode: "BD",
      currency: "BDT",
      payoutType: "",
      accountNumber: "",
      accountHolderName: "",
      bankName: "",
      routingNumber: "",
      swiftCode: "",
      mobileWalletProvider: "",
      mobileWalletNumber: "",
    },
  });

  // Update currency when country changes
  useEffect(() => {
    if (selectedCountry === "BD") {
      form.setValue("currency", "BDT");
    } else if (selectedCountry === "US") {
      form.setValue("currency", "USD");
    }
  }, [selectedCountry, form]);

  // Create payout account mutation using unified API
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Build account details based on payout type
      const accountDetails: Record<string, any> = {
        accountNumber: data.accountNumber,
        accountHolderName: data.accountHolderName,
      };

      if (data.payoutType === "bank_account") {
        accountDetails.bankName = data.bankName;
        accountDetails.routingNumber = data.routingNumber;
        accountDetails.swiftCode = data.swiftCode;
      } else if (data.payoutType === "mobile_wallet") {
        accountDetails.mobileWalletProvider = data.mobileWalletProvider;
        accountDetails.mobileWalletNumber = data.mobileWalletNumber || data.accountNumber;
      }

      const payload = {
        payoutType: data.payoutType,
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber || data.mobileWalletNumber,
        routingNumber: data.routingNumber,
        swiftCode: data.swiftCode,
        bankName: data.bankName || data.mobileWalletProvider || "",
        branchName: "",
        mobileWalletNumber: data.mobileWalletNumber,
      };

      return apiRequest("/api/payout/methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout/methods"] });
      toast({
        title: "Success",
        description: "Payout method added successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add payout account",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const showBankFields = selectedPayoutType === "bank_account";
  const showMobileWalletFields = selectedPayoutType === "mobile_wallet";

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

        <FormField
          control={form.control}
          name="payoutType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payout Method Type</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedPayoutType(value);
                }}
                value={field.value}
                data-testid="select-payout-type"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payout method type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="bank_account">Bank Account</SelectItem>
                  {selectedCountry === "BD" && (
                    <SelectItem value="mobile_wallet">Mobile Wallet (bKash, Nagad, Rocket)</SelectItem>
                  )}
                  {selectedCountry === "US" && (
                    <SelectItem value="stripe_connect">Stripe Connect</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedPayoutType && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This payout method requires <strong>FULL</strong> KYC verification. 
              Please ensure your KYC documents are submitted and verified before using this method.
            </AlertDescription>
          </Alert>
        )}

        {selectedPayoutType && (
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

            {showMobileWalletFields && (
              <>
                <FormField
                  control={form.control}
                  name="mobileWalletProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-wallet-provider">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bKash">bKash</SelectItem>
                          <SelectItem value="Nagad">Nagad</SelectItem>
                          <SelectItem value="Rocket">Rocket</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileWalletNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Wallet Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="01XXXXXXXXX" data-testid="input-mobile-wallet-number" />
                      </FormControl>
                      <FormDescription>
                        Enter your {form.watch("mobileWalletProvider") || "mobile wallet"} registered number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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

                {selectedCountry === "US" && (
                  <FormField
                    control={form.control}
                    name="swiftCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT Code (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="SWIFT/BIC code" data-testid="input-swift-code" />
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

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={createMutation.isPending || !selectedPayoutType}
            data-testid="button-submit-payout-method"
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Payout Account
          </Button>
        </div>
      </form>
    </Form>
  );
}
