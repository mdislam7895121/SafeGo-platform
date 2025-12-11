import { Store } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function SettingsProfile() {
  return (
    <FeaturePlaceholderLayout
      title="Store Profile"
      subtitle="Manage your restaurant identity, branding, and public details."
      icon={Store}
      plannedCapabilities={[
        "Update restaurant name, description, and categories",
        "Configure branding elements and photos",
        "Control what customers see in the SafeGo Eats app",
        "Set operating hours and delivery zones",
        "Manage contact information and social media links"
      ]}
      statusTag="Planned feature"
      infoNote="Store profile management will consolidate various settings into one convenient location. Some branding features are already available in the Branding section."
    />
  );
}
