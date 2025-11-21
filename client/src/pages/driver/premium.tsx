import { Crown, TrendingUp, Percent, MapPin, HeadphonesIcon, BarChart3, Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const benefits = [
  {
    icon: TrendingUp,
    title: "Priority Trip Requests",
    description: "Get first access to high-value ride requests in your area",
  },
  {
    icon: Percent,
    title: "Lower Commission Rates",
    description: "Save 5% on platform commission for every completed ride",
  },
  {
    icon: MapPin,
    title: "Exclusive Bonus Zones",
    description: "Unlock premium surge areas with higher earning potential",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Premium Support",
    description: "Dedicated support line with priority response times",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Detailed earnings insights and performance reports",
  },
];

export default function DriverPremium() {
  const { toast } = useToast();

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const currency = profile?.countryCode === "BD" ? "৳" : "$";
  const price = profile?.countryCode === "BD" ? "499" : "49";

  const handleSubscribe = () => {
    toast({
      title: "Coming Soon",
      description: "SafeGo Premium subscription will be available soon!",
    });
  };

  return (
    <div className="bg-background">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Pricing Card */}
        <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-50 via-white to-orange-50 dark:from-yellow-950/20 dark:via-background dark:to-orange-950/20">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-yellow-500/20 mb-4">
                <Sparkles className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
              </div>
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="text-5xl font-bold text-yellow-600 dark:text-yellow-500" data-testid="text-premium-price">
                  {currency}{price}
                </span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Cancel anytime, no commitment</p>
            </div>

            <Button
              onClick={handleSubscribe}
              className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold"
              data-testid="button-subscribe"
            >
              <Crown className="h-5 w-5 mr-2" />
              Subscribe Now
            </Button>
          </CardContent>
        </Card>

        {/* Benefits */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold px-1">Premium Benefits</h2>
          {benefits.map((benefit, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 flex-shrink-0">
                    <benefit.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                  <Check className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ROI Calculator */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings Potential</CardTitle>
            <CardDescription>
              See how Premium can boost your income
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Standard Driver</p>
                <p className="text-2xl font-bold">{currency}1,500</p>
                <p className="text-xs text-muted-foreground mt-1">Average weekly</p>
              </div>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <Crown className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">Premium Driver</p>
                </div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{currency}1,875</p>
                <p className="text-xs text-yellow-600/70 dark:text-yellow-500/70 mt-1">
                  +{currency}375/week more
                </p>
              </div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Monthly Profit After Subscription
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Average earnings increase minus subscription cost
                  </p>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  +{currency}{profile?.countryCode === "BD" ? "1,001" : "101"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">Can I cancel anytime?</h4>
              <p className="text-sm text-muted-foreground">
                Yes! You can cancel your subscription at any time. Your benefits will continue until the end of your current billing period.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">How much commission do I save?</h4>
              <p className="text-sm text-muted-foreground">
                Premium members save 5% on platform commission for every ride. Standard drivers pay 20%, while Premium members pay only 15%.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">When do I get priority requests?</h4>
              <p className="text-sm text-muted-foreground">
                Priority access is active immediately after subscription. You'll receive ride requests 30 seconds before non-premium drivers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
