/**
 * Ticket/Rental Operator Privacy Policy Page
 * 
 * Full-page privacy policy screen for ticket and rental operators.
 * Accessible from profile/settings.
 */

import { PrivacyPolicyPage } from "@/components/privacy/PrivacyPolicyPage";

export default function TicketOperatorPrivacyPolicy() {
  return (
    <PrivacyPolicyPage 
      backPath="/ticket-operator/profile" 
      role="ticket_operator"
    />
  );
}
