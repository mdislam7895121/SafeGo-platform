import { Badge } from "@/components/ui/badge";
import { Globe, MapPin } from "lucide-react";

interface AccountTypeLabelProps {
  role: "driver" | "customer" | "restaurant" | "admin";
  countryCode: string;
  region?: string | null;
  className?: string;
}

export function AccountTypeLabel({ role, countryCode, region, className = "" }: AccountTypeLabelProps) {
  const roleLabels = {
    driver: "Driver",
    customer: "Customer",
    restaurant: "Restaurant",
    admin: "Admin",
  };

  const countryNames: Record<string, string> = {
    BD: "Bangladesh",
    US: "USA",
  };

  const roleLabel = roleLabels[role] || role;
  const countryLabel = countryNames[countryCode] || countryCode;
  const fullLabel = region 
    ? `${roleLabel} (${countryLabel} — ${region})`
    : `${roleLabel} (${countryLabel})`;

  return (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 ${className}`}
      data-testid="badge-account-type"
    >
      {region ? <MapPin className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
      <span className="text-xs font-medium">{fullLabel}</span>
    </Badge>
  );
}
