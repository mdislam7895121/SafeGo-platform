/**
 * Shop Partner Privacy Policy Page
 * 
 * Full-page privacy policy screen for shop partners.
 * Accessible from profile/settings.
 */

import { PrivacyPolicyPage } from "@/components/privacy/PrivacyPolicyPage";

export default function ShopPartnerPrivacyPolicy() {
  return (
    <PrivacyPolicyPage 
      backPath="/shop-partner/profile" 
      role="shop_partner"
    />
  );
}
