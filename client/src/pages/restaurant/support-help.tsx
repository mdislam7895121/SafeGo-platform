import { HelpCircle } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function SupportHelp() {
  return (
    <FeaturePlaceholderLayout
      title="Help Center"
      subtitle="Find answers to common questions about using SafeGo Eats."
      icon={HelpCircle}
      plannedCapabilities={[
        "Browse frequently asked questions",
        "Learn how to manage orders, menus, and payouts",
        "Get tips to improve your restaurant performance",
        "Search for specific topics and solutions",
        "Access video tutorials and guides"
      ]}
      statusTag="In planning"
      infoNote="The Help Center will provide comprehensive documentation and self-service support resources. For immediate assistance, you can create support tickets in the Support section."
    />
  );
}
