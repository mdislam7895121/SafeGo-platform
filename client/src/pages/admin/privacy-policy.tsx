/**
 * Admin Privacy Policy Page
 * 
 * Full-page privacy policy screen for administrators.
 * Accessible from settings/profile.
 */

import { PrivacyPolicyPage } from "@/components/privacy/PrivacyPolicyPage";

export default function AdminPrivacyPolicy() {
  return (
    <PrivacyPolicyPage 
      backPath="/admin" 
      role="admin"
    />
  );
}
