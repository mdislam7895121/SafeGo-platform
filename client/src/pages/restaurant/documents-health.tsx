import { Shield } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function DocumentsHealth() {
  return (
    <FeaturePlaceholderLayout
      title="Health & Safety"
      subtitle="Manage health certificates and safety compliance."
      icon={Shield}
      plannedCapabilities={[
        "Upload health inspection documents",
        "Track safety certifications and expiry",
        "Provide proof of compliance to delivery partners",
        "Receive renewal reminders before expiration",
        "Maintain audit trail of all health-related documents"
      ]}
      statusTag="Future release"
      infoNote="Health and safety document management ensures your restaurant remains compliant with local regulations. This feature will be integrated with automatic expiry notifications."
    />
  );
}
