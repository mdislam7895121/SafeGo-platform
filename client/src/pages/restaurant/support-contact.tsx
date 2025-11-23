import { Mail } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function SupportContact() {
  return (
    <FeaturePlaceholderLayout
      title="Contact Support"
      subtitle="Get direct assistance from the SafeGo support team."
      icon={Mail}
      plannedCapabilities={[
        "Submit urgent support requests outside of tickets",
        "Contact support via email, phone, or live chat",
        "Access priority support channels for verified restaurants",
        "Receive callback requests during business hours",
        "Track your support conversation history"
      ]}
      statusTag="Planned feature"
      infoNote="Direct contact channels will complement the existing support ticket system. For now, you can create and manage support tickets through the Support Tickets page."
    />
  );
}
