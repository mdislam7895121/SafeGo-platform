/**
 * PrivacyPolicyEnforcer Component
 * 
 * Wrapper component that enforces privacy policy acceptance.
 * 
 * POST-VERIFICATION ENFORCEMENT LOGIC:
 * - Users are NOT blocked from onboarding/KYC flows
 * - Policy acceptance is ONLY required after user is verified (approved)
 * - Once verified, users must accept the policy before using core business features
 * - Admins are never blocked from Admin Panel
 */

import { usePrivacyPolicy } from "@/hooks/use-privacy-policy";
import { PrivacyPolicyModal } from "./PrivacyPolicyModal";
import { AlertCircle } from "lucide-react";

interface PrivacyPolicyEnforcerProps {
  children: React.ReactNode;
  allowedPaths?: string[];
}

const ALWAYS_ALLOWED_PATHS = [
  "/profile",
  "/settings",
  "/help",
  "/support",
  "/privacy",
  "/login",
  "/signup",
  "/logout",
  "/onboarding",
  "/kyc",
  "/verification",
  "/register",
  "/pending",
  "/waiting",
  "/status",
  "/complete-profile",
  "/setup",
  "/admin",
];

const ONBOARDING_PATHS = [
  "/driver/onboarding",
  "/driver/kyc",
  "/driver/verification",
  "/driver/pending",
  "/driver/register",
  "/driver/setup",
  "/driver/complete-profile",
  "/customer/onboarding",
  "/customer/kyc",
  "/customer/verification",
  "/customer/register",
  "/customer/setup",
  "/customer/complete-profile",
  "/restaurant/onboarding",
  "/restaurant/kyc",
  "/restaurant/verification",
  "/restaurant/pending",
  "/restaurant/register",
  "/restaurant/setup",
  "/restaurant/complete-profile",
  "/shop-partner/onboarding",
  "/shop-partner/kyc",
  "/shop-partner/verification",
  "/shop-partner/pending",
  "/shop-partner/register",
  "/shop-partner/setup",
  "/shop-partner/complete-profile",
  "/ticket-operator/onboarding",
  "/ticket-operator/kyc",
  "/ticket-operator/verification",
  "/ticket-operator/pending",
  "/ticket-operator/register",
  "/ticket-operator/setup",
  "/ticket-operator/complete-profile",
  "/rental-partner/onboarding",
  "/rental-partner/kyc",
  "/rental-partner/verification",
  "/rental-partner/pending",
  "/rental-partner/register",
  "/rental-partner/setup",
  "/rental-partner/complete-profile",
];

export function PrivacyPolicyEnforcer({ 
  children, 
  allowedPaths = [] 
}: PrivacyPolicyEnforcerProps) {
  const {
    policy,
    consentStatus,
    mustAcceptNewPolicy,
    verificationStatus,
    isVerified,
    isLoading,
    acceptPolicy,
    declinePolicy,
    isAccepting,
  } = usePrivacyPolicy();

  const allAllowedPaths = [...ALWAYS_ALLOWED_PATHS, ...ONBOARDING_PATHS, ...allowedPaths];
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  
  const isAllowedPath = allAllowedPaths.some(path => 
    currentPath.includes(path) || currentPath.endsWith(path)
  );

  const isOnboardingPath = ONBOARDING_PATHS.some(path => 
    currentPath.includes(path) || currentPath.startsWith(path)
  );

  if (isLoading) {
    return <>{children}</>;
  }

  if (!isVerified && isOnboardingPath) {
    return (
      <>
        <div 
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-muted border border-border rounded-lg p-3 shadow-lg flex items-start gap-3"
          data-testid="banner-policy-reminder"
        >
          <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Terms & Privacy</p>
            <p>You'll be asked to accept our Terms & Privacy Policy after your account is verified.</p>
          </div>
        </div>
        {children}
      </>
    );
  }

  if (!mustAcceptNewPolicy || isAllowedPath) {
    return <>{children}</>;
  }

  if (isVerified && mustAcceptNewPolicy && !isAllowedPath) {
    return (
      <>
        <PrivacyPolicyModal
          isOpen={true}
          policy={policy}
          consentStatus={consentStatus}
          isLoading={isLoading}
          onAccept={acceptPolicy}
          onDecline={declinePolicy}
          isPending={isAccepting}
        />
        {children}
      </>
    );
  }

  return <>{children}</>;
}

export default PrivacyPolicyEnforcer;
