import { Printer } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function SettingsDevices() {
  return (
    <FeaturePlaceholderLayout
      title="Devices & Printers"
      subtitle="Connect tablets and receipt printers used in your restaurant."
      icon={Printer}
      plannedCapabilities={[
        "Register front-of-house and kitchen devices",
        "Configure receipt printer settings",
        "Monitor online/offline device status",
        "Manage multiple printer stations (kitchen, bar, etc.)",
        "Troubleshoot connectivity issues"
      ]}
      statusTag="Future release"
      infoNote="Device management will enable seamless integration with point-of-sale hardware. The system architecture supports multi-device environments."
    />
  );
}
