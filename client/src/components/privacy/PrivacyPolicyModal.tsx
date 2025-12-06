/**
 * PrivacyPolicyModal Component
 * 
 * Modal that appears when user must accept a new privacy policy.
 * Blocks all core actions until the policy is accepted.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PrivacyPolicyContent, ConsentPreferences } from "./PrivacyPolicyContent";
import { Shield } from "lucide-react";

interface PolicyData {
  version: string;
  title: string;
  contentUrl: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsentStatus {
  privacyPolicyVersion: string | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  policyAcceptedAt: string | null;
  marketingOptIn: boolean;
  dataSharingOptIn: boolean;
  locationPermission: boolean;
  trackingConsent: boolean;
}

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  policy: PolicyData | null;
  consentStatus: ConsentStatus | null;
  isLoading?: boolean;
  onAccept: (preferences: ConsentPreferences) => void;
  onDecline: () => void;
  isPending?: boolean;
}

export function PrivacyPolicyModal({
  isOpen,
  policy,
  consentStatus,
  isLoading = false,
  onAccept,
  onDecline,
  isPending = false,
}: PrivacyPolicyModalProps) {
  return (
    <Dialog open={isOpen} modal>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-hidden" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="modal-privacy-policy"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Policy Update
          </DialogTitle>
          <DialogDescription>
            We've updated our privacy policy. Please review and accept to continue using SafeGo.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <PrivacyPolicyContent
            policy={policy}
            consentStatus={consentStatus}
            mustAcceptNewPolicy={true}
            isLoading={isLoading}
            onAccept={onAccept}
            onDecline={onDecline}
            isPending={isPending}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PrivacyPolicyModal;
