import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  Car,
  UtensilsCrossed,
  Package,
  Shield,
  Wallet,
  HandCoins,
  AlertTriangle,
  ShieldAlert,
  ScrollText,
  Settings,
  LogOut,
  Globe,
  UserCog,
  Flag,
  Scale,
  Search,
  Download,
  Fingerprint,
  Monitor,
  Power,
  FileWarning,
  Activity,
  Database,
  Bell,
  CreditCard,
  FileText,
  BrainCircuit,
  Gauge,
  Star,
  FileCheck,
  DollarSign,
  Route,
  ChevronDown,
  Rocket,
  MessageSquare,
  Store,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { SafePilotSidebarIcon } from "@/components/safepilot/SafePilotLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCapabilities, hasNavAccess } from "@/hooks/useAdminCapabilities";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  navKey?: string;
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    navKey: "dashboard",
  },
  {
    title: "People & KYC",
    href: "/admin/people-kyc",
    icon: UserCog,
    navKey: "peopleKyc",
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    navKey: "dashboard",
  },
  {
    title: "Drivers",
    href: "/admin/drivers",
    icon: Car,
    navKey: "dashboard",
  },
  {
    title: "Restaurants",
    href: "/admin/restaurants",
    icon: UtensilsCrossed,
    navKey: "dashboard",
  },
  {
    title: "Parcels",
    href: "/admin/parcels",
    icon: Package,
    navKey: "dashboard",
  },
];

const managementNavItems: NavItem[] = [
  {
    title: "KYC Approvals",
    href: "/admin/kyc",
    icon: Shield,
    navKey: "peopleKyc",
  },
  {
    title: "Wallets",
    href: "/admin/wallets",
    icon: Wallet,
    navKey: "wallets",
  },
  {
    title: "Payouts",
    href: "/admin/payouts",
    icon: HandCoins,
    navKey: "payouts",
  },
];

const securityNavItems: NavItem[] = [
  {
    title: "Safety Center",
    href: "/admin/safety-center",
    icon: ShieldAlert,
    navKey: "safetyCenter",
  },
  {
    title: "Fraud Alerts",
    href: "/admin/fraud-alerts",
    icon: AlertTriangle,
    navKey: "fraudAlerts",
  },
  {
    title: "Threat Center",
    href: "/admin/security-center",
    icon: Shield,
    navKey: "safetyCenter",
  },
  {
    title: "Activity Logs",
    href: "/admin/activity-log",
    icon: ScrollText,
    navKey: "auditLog",
  },
  {
    title: "Access Reviews",
    href: "/admin/access-reviews",
    icon: FileCheck,
    navKey: "safetyCenter",
  },
];

const configNavItems: NavItem[] = [
  {
    title: "Feature Flags",
    href: "/admin/feature-flags",
    icon: Flag,
    navKey: "featureFlags",
  },
  {
    title: "Global Settings",
    href: "/admin/global-settings",
    icon: Shield,
    navKey: "settings",
  },
  {
    title: "Releases & Publish",
    href: "/admin/releases",
    icon: Rocket,
    navKey: "settings",
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
    navKey: "settings",
  },
];

const regionalNavItems: NavItem[] = [
  {
    title: "BD Expansion",
    href: "/admin/bd-expansion",
    icon: Globe,
    navKey: "dashboard",
  },
];

const phase3aNavItems: NavItem[] = [
  {
    title: "Enterprise Search",
    href: "/admin/enterprise-search",
    icon: Search,
    navKey: "dashboard",
  },
  {
    title: "Export Center",
    href: "/admin/export-center",
    icon: Download,
    navKey: "dashboard",
  },
  {
    title: "Fraud Detection",
    href: "/admin/fraud-detection",
    icon: Fingerprint,
    navKey: "fraudAlerts",
  },
  {
    title: "Session Security",
    href: "/admin/session-security",
    icon: Monitor,
    navKey: "safetyCenter",
  },
  {
    title: "Emergency Controls",
    href: "/admin/emergency-controls",
    icon: Power,
    navKey: "safetyCenter",
  },
  {
    title: "Incident Response",
    href: "/admin/incident-response",
    icon: AlertTriangle,
    navKey: "safetyCenter",
  },
  {
    title: "Support Panel",
    href: "/admin/customer-support-panel",
    icon: UserCog,
    navKey: "dashboard",
  },
  {
    title: "Contact Center",
    href: "/admin/contact-center",
    icon: MessageSquare,
    navKey: "dashboard",
  },
  {
    title: "Onboarding Center",
    href: "/admin/onboarding-center",
    icon: Users,
    navKey: "dashboard",
  },
  {
    title: "Drivers Onboarding",
    href: "/admin/onboarding/drivers",
    icon: Car,
    navKey: "dashboard",
  },
  {
    title: "Restaurants Onboarding",
    href: "/admin/onboarding/restaurants",
    icon: UtensilsCrossed,
    navKey: "dashboard",
  },
  {
    title: "Shops Onboarding",
    href: "/admin/onboarding/shops",
    icon: Store,
    navKey: "dashboard",
  },
  {
    title: "Tickets Onboarding",
    href: "/admin/onboarding/tickets",
    icon: Ticket,
    navKey: "dashboard",
  },
  {
    title: "Compliance Center",
    href: "/admin/compliance-center",
    icon: FileWarning,
    navKey: "peopleKyc",
  },
  {
    title: "Data Governance",
    href: "/admin/data-governance",
    icon: Database,
    navKey: "settings",
  },
  {
    title: "Health Monitor",
    href: "/admin/health-monitor",
    icon: Activity,
    navKey: "dashboard",
  },
  {
    title: "Push Notifications",
    href: "/admin/push-notifications",
    icon: Bell,
    navKey: "dashboard",
  },
  {
    title: "Payment Verification",
    href: "/admin/payment-verification",
    icon: CreditCard,
    navKey: "payouts",
  },
  {
    title: "Policy Manager",
    href: "/admin/policy-manager",
    icon: FileText,
    navKey: "settings",
  },
  {
    title: "Backup & Recovery",
    href: "/admin/backup-recovery",
    icon: Database,
    navKey: "settings",
  },
  {
    title: "Audit Console",
    href: "/admin/audit-console",
    icon: ScrollText,
    navKey: "auditLog",
  },
  {
    title: "System Health Center",
    href: "/admin/system-health-center",
    icon: Activity,
    navKey: "dashboard",
  },
  {
    title: "Launch Readiness",
    href: "/admin/launch-readiness",
    icon: Rocket,
    navKey: "settings",
  },
];

const phase3cNavItems: NavItem[] = [
  {
    title: "Operations Center",
    href: "/admin/operations-center",
    icon: Gauge,
    navKey: "dashboard",
  },
  {
    title: "Observability",
    href: "/admin/observability",
    icon: Activity,
    navKey: "dashboard",
  },
  {
    title: "Intelligence",
    href: "/admin/intelligence",
    icon: BrainCircuit,
    navKey: "dashboard",
  },
];

const phase4NavItems: NavItem[] = [
  {
    title: "SafePilot",
    href: "/admin/safepilot",
    icon: SafePilotSidebarIcon as unknown as LucideIcon,
    navKey: "dashboard",
  },
  {
    title: "Ratings Center",
    href: "/admin/ratings-center",
    icon: Star,
    navKey: "dashboard",
  },
  {
    title: "Driver Violations",
    href: "/admin/driver-violations",
    icon: FileWarning,
    navKey: "dashboard",
  },
  {
    title: "Earnings Disputes",
    href: "/admin/earnings-disputes",
    icon: DollarSign,
    navKey: "payouts",
  },
  {
    title: "Ride Timeline",
    href: "/admin/ride-timeline",
    icon: Route,
    navKey: "dashboard",
  },
  {
    title: "Notification Rules",
    href: "/admin/notification-rules",
    icon: Bell,
    navKey: "settings",
  },
  {
    title: "Payment Integrity",
    href: "/admin/payment-integrity",
    icon: CreditCard,
    navKey: "payouts",
  },
  {
    title: "Global Search",
    href: "/admin/global-search",
    icon: Search,
    navKey: "dashboard",
  },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const { data: capabilities, isLoading: capabilitiesLoading } = useAdminCapabilities();
  
  const adminName = user?.email?.split("@")[0] || "Admin";
  const initials = adminName
    .split(/[\s._-]/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isActive = (href: string) => {
    if (href === "/admin") {
      return location === "/admin";
    }
    return location.startsWith(href);
  };

  const shouldShowItem = (item: NavItem): boolean => {
    if (!item.navKey) return true;
    if (capabilitiesLoading) return true;
    if (!capabilities) return true;
    if (capabilities.isSuperAdmin) return true;
    return hasNavAccess(capabilities, item.navKey as keyof typeof capabilities.navigation);
  };

  const NavItem = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    
    if (!shouldShowItem(item)) {
      return null;
    }

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.title}
          className={cn(
            "transition-all duration-200",
            active && "bg-primary/10 text-primary font-medium"
          )}
        >
          <Link href={item.href} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <item.icon className={cn("h-4 w-4", active && "text-primary")} />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case "SUPER_ADMIN": return "destructive";
      case "ADMIN": return "default";
      case "RISK_ADMIN": return "secondary";
      case "COMPLIANCE_ADMIN": return "secondary";
      case "FINANCE_ADMIN": return "secondary";
      default: return "outline";
    }
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      SUPER_ADMIN: "Super Admin",
      ADMIN: "Admin",
      COUNTRY_ADMIN: "Country Admin",
      CITY_ADMIN: "City Admin",
      RISK_ADMIN: "Risk Admin",
      COMPLIANCE_ADMIN: "Compliance",
      SUPPORT_ADMIN: "Support",
      FINANCE_ADMIN: "Finance",
      READONLY_ADMIN: "Read Only",
    };
    return labels[role] || role;
  };

  const renderNavGroup = (items: NavItem[]) => {
    const visibleItems = items.filter(shouldShowItem);
    if (visibleItems.length === 0) return null;
    return visibleItems.map((item) => <NavItem key={item.href} item={item} />);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm shrink-0">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className={cn(
            "flex flex-col overflow-hidden transition-all duration-200",
            state === "collapsed" && "w-0 opacity-0"
          )}>
            <span className="font-bold text-base leading-tight whitespace-nowrap">
              SafeGo
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">
              Admin Console
            </span>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavGroup(mainNavItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {renderNavGroup(managementNavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(managementNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderNavGroup(securityNavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Security
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(securityNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderNavGroup(configNavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Configuration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(configNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderNavGroup(regionalNavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Regional
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(regionalNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderNavGroup(phase3aNavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Enterprise Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(phase3aNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderNavGroup(phase3cNavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Intelligence Layer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(phase3cNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderNavGroup(phase4NavItems) && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Advanced Admin Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavGroup(phase4NavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className={cn(
          "flex items-center gap-3 mb-3",
          state === "collapsed" && "justify-center"
        )}>
          <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "flex flex-col overflow-hidden transition-all duration-200",
            state === "collapsed" && "w-0 opacity-0"
          )}>
            <span className="text-sm font-medium leading-tight truncate">
              {adminName}
            </span>
            {capabilitiesLoading ? (
              <Skeleton className="h-3 w-16 mt-1" />
            ) : capabilities ? (
              <Badge 
                variant={getRoleBadgeVariant(capabilities.role)} 
                className="text-[9px] py-0 px-1.5 mt-0.5 w-fit"
                data-testid="badge-admin-role"
              >
                {getRoleLabel(capabilities.role)}
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground leading-tight">
                Administrator
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size={state === "collapsed" ? "icon" : "sm"}
          onClick={logout}
          className={cn(
            "w-full text-destructive hover:text-destructive hover:bg-destructive/10",
            state === "collapsed" && "w-9 h-9 p-0"
          )}
          data-testid="button-sidebar-logout"
        >
          <LogOut className="h-4 w-4" />
          <span className={cn(
            "ml-2 transition-all duration-200",
            state === "collapsed" && "hidden"
          )}>
            Log Out
          </span>
        </Button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
