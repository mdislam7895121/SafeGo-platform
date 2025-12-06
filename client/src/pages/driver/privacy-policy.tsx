/**
 * Driver Privacy Policy Page
 * 
 * Full-page privacy policy screen for drivers.
 * Accessible from account/settings.
 */

import { PrivacyPolicyPage } from "@/components/privacy/PrivacyPolicyPage";

export default function DriverPrivacyPolicy() {
  return (
    <PrivacyPolicyPage 
      backPath="/driver/account" 
      role="driver"
    />
  );
}
