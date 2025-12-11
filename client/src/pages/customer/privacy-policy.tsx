/**
 * Customer Privacy Policy Page
 * 
 * Full-page privacy policy screen for customers.
 * Accessible from profile/settings.
 */

import { PrivacyPolicyPage } from "@/components/privacy/PrivacyPolicyPage";

export default function CustomerPrivacyPolicy() {
  return (
    <PrivacyPolicyPage 
      backPath="/customer/profile" 
      role="customer"
    />
  );
}
