import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Smartphone, Banknote, Wallet, Info } from "lucide-react";

interface PaymentMethod {
  id: string;
  methodType: string;
  provider: string;
  priority: number;
  minAmount?: string;
  maxAmount?: string;
  requiresKycLevel: string;
}

export default function PaymentOptionsPage() {
  // Fetch payment methods for Bangladesh (FOOD service)
  // Note: In a real implementation, this would fetch the restaurant's country from their profile
  const { data, isLoading } = useQuery<{ paymentMethods: PaymentMethod[] }>({
    queryKey: ["/api/config/payment/customer?country=BD&service=FOOD"],
  });

  const getMethodIcon = (methodType: string) => {
    if (methodType.includes("CARD")) {
      return <CreditCard className="h-5 w-5" />;
    } else if (methodType.includes("MOBILE")) {
      return <Smartphone className="h-5 w-5" />;
    } else if (methodType === "CASH") {
      return <Banknote className="h-5 w-5" />;
    } else {
      return <Wallet className="h-5 w-5" />;
    }
  };

  const getMethodLabel = (methodType: string) => {
    return methodType.replace(/_/g, " ");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-payment-options">Customer Payment Options</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Payment methods available for customers ordering from your restaurant
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Customer payment methods are managed at the SafeGo platform level to ensure consistency and security.
          Future versions may allow fine-grained controls here.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.paymentMethods?.map((method) => (
            <Card key={method.id} data-testid={`card-payment-method-${method.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                    {getMethodIcon(method.methodType)}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base" data-testid={`text-method-type-${method.id}`}>
                      {getMethodLabel(method.methodType)}
                    </CardTitle>
                    <CardDescription className="text-xs" data-testid={`text-provider-${method.id}`}>
                      {method.provider}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Enabled
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {method.minAmount && (
                  <p data-testid={`text-min-amount-${method.id}`}>
                    Minimum: ৳{parseFloat(method.minAmount).toFixed(2)}
                  </p>
                )}
                {method.maxAmount && (
                  <p data-testid={`text-max-amount-${method.id}`}>
                    Maximum: ৳{parseFloat(method.maxAmount).toFixed(2)}
                  </p>
                )}
                {method.requiresKycLevel !== "NONE" && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Requires {method.requiresKycLevel} KYC
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">What does this mean for my restaurant?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            These are the payment methods customers can use when ordering from your restaurant on SafeGo Eats.
            All payment processing is handled securely by SafeGo.
          </p>
          <p>
            You will receive payouts for all completed orders through your configured payout methods,
            regardless of which payment method the customer used.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
