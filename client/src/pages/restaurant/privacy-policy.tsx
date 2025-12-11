/**
 * Restaurant Partner Privacy Policy Page
 * 
 * Full-page privacy policy screen for restaurant partners.
 * Accessible from profile/settings.
 */

import { PrivacyPolicyPage } from "@/components/privacy/PrivacyPolicyPage";

export default function RestaurantPrivacyPolicy() {
  return (
    <PrivacyPolicyPage 
      backPath="/restaurant/profile" 
      role="restaurant"
    />
  );
}
