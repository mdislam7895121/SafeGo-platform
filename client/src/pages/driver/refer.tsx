import { useState } from "react";
import { Copy, Check, Users, Gift, Mail } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function DriverRefer() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const { data: bonusData } = useQuery({
    queryKey: ["/api/driver/referral-bonus"],
  });

  const profile = (driverData as any)?.profile;
  const referralCode = profile?.id?.slice(0, 8).toUpperCase() || "SAFEGO123";
  const referralLink = `https://safego.app/driver/register?ref=${referralCode}`;
  
  // Dynamic referral bonus from API
  const currency = bonusData?.currencySymbol || (profile?.countryCode === "BD" ? "৳" : "$");
  const rewardAmount = bonusData?.effectiveBonus || (profile?.countryCode === "BD" ? "500" : "50");
  const isPromoActive = bonusData?.isPromoActive || false;
  const promoLabel = bonusData?.promoLabel;
  const promoEndDate = bonusData?.promoEndDate;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`Join SafeGo as a Driver! Use my referral code ${referralCode} and earn ${currency}${rewardAmount}. Sign up here: ${referralLink}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent("Join SafeGo as a Driver");
    const body = encodeURIComponent(`Hi!\n\nI'm inviting you to become a driver with SafeGo. Use my referral code ${referralCode} to sign up and we'll both earn ${currency}${rewardAmount}!\n\nSign up here: ${referralLink}\n\nHappy driving!`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-background">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Reward Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary/20 mb-4">
              <Gift className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-2" data-testid="text-reward-amount">
              {currency}{rewardAmount}
            </h2>
            <p className="text-muted-foreground">
              Earn for each friend who becomes a driver
            </p>
            {isPromoActive && promoLabel && (
              <div className="mt-3 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg inline-block">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  {promoLabel}
                </p>
                {promoEndDate && (
                  <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-1">
                    Limited-time offer until {new Date(promoEndDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral Code Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Referral Code
            </CardTitle>
            <CardDescription>
              Share this code with friends who want to become drivers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-6 bg-muted rounded-lg text-center">
              <p className="text-4xl font-bold tracking-wider text-primary" data-testid="text-referral-code">
                {referralCode}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Referral Link</label>
              <div className="flex gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="font-mono text-sm"
                  data-testid="input-referral-link"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <Button
                onClick={handleCopy}
                variant="outline"
                className="w-full"
                data-testid="button-copy"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
              <Button
                onClick={handleWhatsAppShare}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-share-whatsapp"
              >
                <SiWhatsapp className="h-4 w-4 mr-2" />
                Share via WhatsApp
              </Button>
              <Button
                onClick={handleEmailShare}
                variant="outline"
                className="w-full"
                data-testid="button-share-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Share via Email
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Share Your Code</h4>
                <p className="text-sm text-muted-foreground">
                  Send your referral code to friends who want to drive with SafeGo
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">They Sign Up</h4>
                <p className="text-sm text-muted-foreground">
                  Your friend registers as a driver using your referral code
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">Complete Rides</h4>
                <p className="text-sm text-muted-foreground">
                  After they complete their first 10 rides, you both earn {currency}{rewardAmount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Referral reward is credited after the new driver completes 10 rides</li>
              <li>• Both referrer and referee must maintain active driver status</li>
              <li>• Rewards are non-transferable and cannot be exchanged for cash</li>
              <li>• SafeGo reserves the right to modify or cancel the program anytime</li>
              <li>• Fraudulent activity will result in account suspension</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
