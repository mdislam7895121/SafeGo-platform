import { Users } from "lucide-react";
import { FeaturePlaceholderLayout } from "@/components/restaurant/FeaturePlaceholderLayout";

export default function SettingsStaff() {
  return (
    <FeaturePlaceholderLayout
      title="Staff & Roles"
      subtitle="Manage staff accounts and permissions for your restaurant."
      icon={Users}
      plannedCapabilities={[
        "Invite staff and assign roles",
        "Control who can manage orders, menus, and payouts",
        "Audit key staff actions for security",
        "Set custom permissions for different staff members",
        "Monitor staff login activity and access logs"
      ]}
      statusTag="In planning"
      infoNote="Staff management is currently available in the Staff section with role-based access control. This enhanced interface will provide more granular permission controls."
    />
  );
}
