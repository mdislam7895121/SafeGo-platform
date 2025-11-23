import { Activity } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function SupportStatus() {
  return (
    <FeaturePlaceholderLayout
      title="System Status"
      subtitle="Monitor SafeGo platform health and operational status."
      icon={Activity}
      plannedCapabilities={[
        "View real-time platform availability and uptime",
        "Check status of order processing, payments, and notifications",
        "Subscribe to status updates and incident notifications",
        "Access historical uptime reports",
        "View planned maintenance schedules"
      ]}
      statusTag="Future release"
      infoNote="The system status dashboard will provide transparency into platform operations. Real-time monitoring and incident reporting will be available in a future update."
    />
  );
}
