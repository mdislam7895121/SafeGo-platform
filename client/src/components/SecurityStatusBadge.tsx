import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, Ban } from "lucide-react";

export type SecurityStatus = "verified" | "partially_verified" | "unverified" | "flagged" | "suspended";

interface SecurityStatusBadgeProps {
  status: SecurityStatus;
  className?: string;
}

export function SecurityStatusBadge({ status, className = "" }: SecurityStatusBadgeProps) {
  const config = {
    verified: {
      label: "Verified",
      icon: ShieldCheck,
      className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-200 dark:border-green-800",
    },
    partially_verified: {
      label: "Partially Verified",
      icon: Shield,
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
    },
    unverified: {
      label: "Unverified",
      icon: ShieldX,
      className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-700",
    },
    flagged: {
      label: "Flagged",
      icon: ShieldAlert,
      className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-800",
    },
    suspended: {
      label: "Suspended",
      icon: Ban,
      className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800",
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-1.5 ${statusClassName} ${className}`}
      data-testid={`badge-security-${status}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{label}</span>
    </Badge>
  );
}

export function getSecurityStatus(profile: {
  isVerified?: boolean;
  verificationStatus?: string;
  isBlocked?: boolean;
  isSuspended?: boolean;
  securityStatus?: string;
}): SecurityStatus {
  // Check for suspended/blocked status first
  if (profile.isSuspended || profile.isBlocked) {
    return "suspended";
  }

  // Check for flagged status
  if (profile.securityStatus === "needs_review" || profile.securityStatus === "under_observation") {
    return "flagged";
  }

  // Check verification status
  if (profile.isVerified || profile.verificationStatus === "approved") {
    return "verified";
  }

  if (profile.verificationStatus === "pending") {
    return "partially_verified";
  }

  return "unverified";
}
