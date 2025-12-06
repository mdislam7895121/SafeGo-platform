/**
 * PrivacyPolicyEnforcer Component
 * 
 * Wrapper component that enforces privacy policy acceptance.
 * Shows modal if user must accept new policy before accessing core features.
 * Allows access to: profile, settings, help, and policy text even if not accepted.
 */

import { usePrivacyPolicy } from "@/hooks/use-privacy-policy";
import { PrivacyPolicyModal } from "./PrivacyPolicyModal";

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
];

export function PrivacyPolicyEnforcer({ 
  children, 
  allowedPaths = [] 
}: PrivacyPolicyEnforcerProps) {
  const {
    policy,
    consentStatus,
    mustAcceptNewPolicy,
    isLoading,
    acceptPolicy,
    declinePolicy,
    isAccepting,
  } = usePrivacyPolicy();

  const allAllowedPaths = [...ALWAYS_ALLOWED_PATHS, ...allowedPaths];
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  const isAllowedPath = allAllowedPaths.some(path => 
    currentPath.includes(path) || currentPath.endsWith(path)
  );

  if (!mustAcceptNewPolicy || isAllowedPath) {
    return <>{children}</>;
  }

  return (
    <>
      <PrivacyPolicyModal
        isOpen={mustAcceptNewPolicy && !isAllowedPath}
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

export default PrivacyPolicyEnforcer;
