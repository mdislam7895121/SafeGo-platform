import { BadgeCheck } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function DocumentsKYC() {
  return (
    <FeaturePlaceholderLayout
      title="KYC / Verification"
      subtitle="Complete identity and business verification for your restaurant."
      icon={BadgeCheck}
      plannedCapabilities={[
        "Submit country-specific documents (Bangladesh NID/passport, US EIN/SSN, etc.)",
        "Track verification status and required actions",
        "Protect your account with stronger identity checks",
        "Upload supporting documents securely",
        "Receive real-time verification updates"
      ]}
      statusTag="Planned feature"
      infoNote="KYC verification strengthens account security and enables access to advanced features. Document upload and verification workflows will be implemented with country-specific requirements in a future release. Please note: This is a visual placeholder only — no actual verification functionality is available yet."
    />
  );
}
