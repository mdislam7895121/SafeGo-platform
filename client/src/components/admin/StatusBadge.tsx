import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  Ban,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";

type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "blocked"
  | "verified"
  | "unverified"
  | "warning"
  | "error"
  | "success"
  | "info"
  | "critical"
  | "low"
  | "medium"
  | "high"
  | "online"
  | "offline"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "escalated"
  | "on_hold";

interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  icon?: LucideIcon;
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  active: {
    label: "Active",
    variant: "default",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  inactive: {
    label: "Inactive",
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    icon: Pause,
  },
  pending: {
    label: "Pending",
    variant: "outline",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    variant: "default",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  suspended: {
    label: "Suspended",
    variant: "outline",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: Pause,
  },
  blocked: {
    label: "Blocked",
    variant: "destructive",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: Ban,
  },
  verified: {
    label: "Verified",
    variant: "default",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: Shield,
  },
  unverified: {
    label: "Unverified",
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  },
  warning: {
    label: "Warning",
    variant: "outline",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    icon: AlertTriangle,
  },
  error: {
    label: "Error",
    variant: "destructive",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  success: {
    label: "Success",
    variant: "default",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  info: {
    label: "Info",
    variant: "secondary",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  critical: {
    label: "Critical",
    variant: "destructive",
    className: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30",
    icon: AlertTriangle,
  },
  low: {
    label: "Low",
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  },
  medium: {
    label: "Medium",
    variant: "outline",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  high: {
    label: "High",
    variant: "outline",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: AlertTriangle,
  },
  online: {
    label: "Online",
    variant: "default",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: Play,
  },
  offline: {
    label: "Offline",
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  },
  in_progress: {
    label: "In Progress",
    variant: "outline",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    variant: "default",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    icon: XCircle,
  },
  escalated: {
    label: "Escalated",
    variant: "outline",
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    icon: AlertTriangle,
  },
  on_hold: {
    label: "On Hold",
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    icon: Pause,
  },
};

interface StatusBadgeProps {
  status: StatusType | string;
  showIcon?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  customLabel?: string;
}

export function StatusBadge({
  status,
  showIcon = false,
  size = "default",
  className,
  customLabel,
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_") as StatusType;
  const config = statusConfigs[normalizedStatus] || {
    label: status,
    variant: "secondary" as const,
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0",
    default: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border gap-1",
        config.className,
        sizeClasses[size],
        className
      )}
      data-testid={`status-badge-${normalizedStatus}`}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      {customLabel || config.label}
    </Badge>
  );
}

export function SeverityBadge({
  severity,
  showIcon = true,
  size = "default",
  className,
}: {
  severity: "low" | "medium" | "high" | "critical";
  showIcon?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <StatusBadge
      status={severity}
      showIcon={showIcon}
      size={size}
      className={className}
    />
  );
}

export function PriorityBadge({
  priority,
  showIcon = false,
  size = "default",
  className,
}: {
  priority: "low" | "medium" | "high" | "critical";
  showIcon?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const labels: Record<string, string> = {
    low: "Low Priority",
    medium: "Medium Priority",
    high: "High Priority",
    critical: "Critical",
  };

  return (
    <StatusBadge
      status={priority}
      showIcon={showIcon}
      size={size}
      className={className}
      customLabel={labels[priority]}
    />
  );
}
