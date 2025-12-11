import { AlertTriangle } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function ReviewsComplaints() {
  return (
    <FeaturePlaceholderLayout
      title="Complaints & Issues"
      subtitle="Central place to review and respond to customer complaints."
      icon={AlertTriangle}
      plannedCapabilities={[
        "View complaints linked to specific orders",
        "Respond with suggested resolutions",
        "Escalate issues to SafeGo support when needed",
        "Track resolution status and timelines",
        "Access complaint history and patterns"
      ]}
      statusTag="Future release"
      infoNote="The complaint management system will be integrated with the existing support ticket system in a future phase. Routing and security controls are already configured."
    />
  );
}
