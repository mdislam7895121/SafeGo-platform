import { FileText } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function DocumentsBusiness() {
  return (
    <FeaturePlaceholderLayout
      title="Business Documents"
      subtitle="Upload and manage your business licenses and permits."
      icon={FileText}
      plannedCapabilities={[
        "Store scanned licenses and certificates",
        "Track expiry dates and compliance reminders",
        "Share documents securely with SafeGo support",
        "Organize documents by category and jurisdiction",
        "Download copies for record-keeping"
      ]}
      statusTag="Planned feature"
      infoNote="Business document management will provide a secure repository for all compliance-related files. Upload functionality and expiry tracking will be added in a future release."
    />
  );
}
