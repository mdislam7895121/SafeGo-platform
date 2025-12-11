import { Star } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function PromotionsFeatured() {
  return (
    <FeaturePlaceholderLayout
      title="Featured Items"
      subtitle="Highlight special menu items to increase visibility and sales."
      icon={Star}
      plannedCapabilities={[
        "Pin signature dishes to the top of your menu",
        "Run time-limited spotlights on items",
        "Track performance of featured items",
        "Customize featured item displays for customers",
        "Set priorities for multiple featured items"
      ]}
      statusTag="In planning"
      infoNote="Featured items functionality will be added in a future update. The navigation structure is already in place and ready for implementation."
    />
  );
}
