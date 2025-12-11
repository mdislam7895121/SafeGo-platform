/**
 * PrivacyPolicyPage Component
 * 
 * Full-page privacy policy screen for settings/profile access.
 * Used by all roles to view and manage privacy preferences.
 */

import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePrivacyPolicy } from "@/hooks/use-privacy-policy";
import { PrivacyPolicyContent, ConsentPreferences } from "./PrivacyPolicyContent";

interface PrivacyPolicyPageProps {
  backPath: string;
  role: "customer" | "driver" | "restaurant" | "shop_partner" | "ticket_operator" | "admin";
  isPreviewMode?: boolean;
}

export function PrivacyPolicyPage({ 
  backPath, 
  role,
  isPreviewMode = false 
}: PrivacyPolicyPageProps) {
  const {
    policy,
    consentStatus,
    mustAcceptNewPolicy,
    isLoading,
    acceptPolicy,
    updatePreferences,
    declinePolicy,
    isAccepting,
    isUpdating,
  } = usePrivacyPolicy();

  const handleAccept = (preferences: ConsentPreferences) => {
    if (mustAcceptNewPolicy) {
      acceptPolicy(preferences);
    } else {
      updatePreferences(preferences);
    }
  };

  const roleDisplayNames: Record<string, string> = {
    customer: "Customer",
    driver: "Driver",
    restaurant: "Restaurant Partner",
    shop_partner: "Shop Partner",
    ticket_operator: "Ticket/Rental Partner",
    admin: "Admin",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-4 sm:p-6">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <Link href={backPath}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-primary-foreground hover:bg-primary-foreground/10" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
              Privacy Policy
            </h1>
            {isPreviewMode && (
              <p className="text-sm text-primary-foreground/70">
                Viewing as: {roleDisplayNames[role]}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <PrivacyPolicyContent
          policy={policy}
          consentStatus={consentStatus}
          mustAcceptNewPolicy={mustAcceptNewPolicy}
          isLoading={isLoading}
          isPreviewMode={isPreviewMode || role === "admin"}
          onAccept={handleAccept}
          onDecline={declinePolicy}
          isPending={isAccepting || isUpdating}
        />
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
