import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Building2, Smartphone, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PayoutRailType,
  BankAccountType,
  BankAccountTypeLabels,
  CountryPayoutTypes,
  CountryMobileWalletProviders,
} from "@shared/types";

const formSchema = z.object({
  countryCode: z.string().min(2, "Country is required"),
  payoutType: z.string().min(1, "Payout method type is required"),
  currency: z.string().min(3, "Currency is required"),
  accountNumber: z.string().optional(),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  bankName: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  accountType: z.string().optional(),
  mobileWalletProvider: z.string().optional(),
  mobileWalletNumber: z.string().optional(),
}).refine((data) => {
  if (data.payoutType === "bank_account") {
    return !!data.accountNumber && data.accountNumber.length > 0;
  }
  return true;
}, {
  message: "Account number is required for bank accounts",
  path: ["accountNumber"],
}).refine((data) => {
  if (data.payoutType === "bank_account") {
    return !!data.accountType && data.accountType.length > 0;
  }
  return true;
}, {
  message: "Account type is required for bank accounts",
  path: ["accountType"],
}).refine((data) => {
  if (data.payoutType === "mobile_wallet") {
    return !!data.mobileWalletProvider && data.mobileWalletProvider.length > 0;
  }
  return true;
}, {
  message: "Wallet provider is required for mobile wallets",
  path: ["mobileWalletProvider"],
}).refine((data) => {
  if (data.payoutType === "mobile_wallet") {
    return !!data.mobileWalletNumber && data.mobileWalletNumber.length > 0;
  }
  return true;
}, {
  message: "Wallet number is required for mobile wallets",
  path: ["mobileWalletNumber"],
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
      accountType: "",
      mobileWalletProvider: "",
      mobileWalletNumber: "",
    },
  });

  useEffect(() => {
    if (selectedCountry === "BD") {
      form.setValue("currency", "BDT");
    } else if (selectedCountry === "US") {
      form.setValue("currency", "USD");
    }
    setSelectedPayoutType("");
    form.setValue("payoutType", "");
    form.setValue("accountType", "");
    form.setValue("mobileWalletProvider", "");
  }, [selectedCountry, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: Record<string, any> = {
        payoutType: data.payoutType,
        accountHolderName: data.accountHolderName,
        countryCode: data.countryCode,
        currency: data.currency,
      };

      if (data.payoutType === "bank_account") {
        payload.accountNumber = data.accountNumber;
        payload.bankName = data.bankName;
        payload.routingNumber = data.routingNumber;
        payload.swiftCode = data.swiftCode;
        payload.accountType = data.accountType;
        payload.branchName = "";
      } else if (data.payoutType === "mobile_wallet") {
        payload.mobileWalletProvider = data.mobileWalletProvider;
        payload.mobileWalletNumber = data.mobileWalletNumber;
        payload.accountNumber = data.mobileWalletNumber;
        payload.bankName = data.mobileWalletProvider;
      } else if (data.payoutType === "stripe_connect") {
        payload.accountNumber = "";
        payload.bankName = "Stripe Connect";
      }

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
  const showStripeFields = selectedPayoutType === "stripe_connect";

  const availablePayoutTypes = CountryPayoutTypes[selectedCountry] || [PayoutRailType.BANK_ACCOUNT];
  const availableWalletProviders = CountryMobileWalletProviders[selectedCountry] || [];

  const getPayoutTypeIcon = (type: string) => {
    switch (type) {
      case "bank_account":
        return <Building2 className="h-4 w-4 mr-2" />;
      case "mobile_wallet":
        return <Smartphone className="h-4 w-4 mr-2" />;
      case "stripe_connect":
        return <CreditCard className="h-4 w-4 mr-2" />;
      default:
        return null;
    }
  };

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
                  form.setValue("accountType", "");
                  form.setValue("mobileWalletProvider", "");
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
                  {availablePayoutTypes.includes(PayoutRailType.BANK_ACCOUNT) && (
                    <SelectItem value="bank_account">
                      <span className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2" />
                        Bank Account
                      </span>
                    </SelectItem>
                  )}
                  {availablePayoutTypes.includes(PayoutRailType.MOBILE_WALLET) && (
                    <SelectItem value="mobile_wallet">
                      <span className="flex items-center">
                        <Smartphone className="h-4 w-4 mr-2" />
                        Mobile Wallet (bKash, Nagad, Rocket)
                      </span>
                    </SelectItem>
                  )}
                  {availablePayoutTypes.includes(PayoutRailType.EXTERNAL_PROVIDER) && (
                    <SelectItem value="stripe_connect">
                      <span className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Stripe Connect
                      </span>
                    </SelectItem>
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
                          {availableWalletProviders.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {provider}
                            </SelectItem>
                          ))}
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
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-account-type">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(BankAccountTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the type of bank account (checking, savings, or business)
                      </FormDescription>
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
                        <FormDescription>
                          The 9-digit ABA routing number for your bank
                        </FormDescription>
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

            {showStripeFields && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Stripe Connect setup will be initiated after saving. You'll be redirected to complete 
                  the Stripe onboarding process to verify your business and connect your bank account.
                </AlertDescription>
              </Alert>
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
