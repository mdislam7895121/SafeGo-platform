import { Calendar } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function ScheduledOrders() {
  return (
    <FeaturePlaceholderLayout
      title="Scheduled Orders"
      subtitle="Manage orders that customers schedule for future delivery or pickup."
      icon={Calendar}
      plannedCapabilities={[
        "View upcoming scheduled orders and time windows",
        "Modify preparation and pickup times",
        "Pause or resume accepting scheduled orders",
        "Get notified before scheduled orders are due",
        "Manage capacity limits for different time slots"
      ]}
      statusTag="Planned feature"
      infoNote="Scheduled order routing is already configured and will be enabled in a future release. This feature will help you manage advance orders more efficiently."
    />
  );
}
