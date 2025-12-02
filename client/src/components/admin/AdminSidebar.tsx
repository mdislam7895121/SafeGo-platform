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
  ChevronLeft,
  LogOut,
  Globe,
} from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Drivers",
    href: "/admin/drivers",
    icon: Car,
  },
  {
    title: "Restaurants",
    href: "/admin/restaurants",
    icon: UtensilsCrossed,
  },
  {
    title: "Parcels",
    href: "/admin/parcels",
    icon: Package,
  },
];

const managementNavItems = [
  {
    title: "KYC Approvals",
    href: "/admin/kyc",
    icon: Shield,
  },
  {
    title: "Wallets",
    href: "/admin/wallets",
    icon: Wallet,
  },
  {
    title: "Payouts",
    href: "/admin/payouts",
    icon: HandCoins,
  },
];

const securityNavItems = [
  {
    title: "Fraud Alerts",
    href: "/admin/fraud-alerts",
    icon: AlertTriangle,
  },
  {
    title: "Threat Center",
    href: "/admin/security-center",
    icon: ShieldAlert,
  },
  {
    title: "Activity Logs",
    href: "/admin/activity-log",
    icon: ScrollText,
  },
];

const regionalNavItems = [
  {
    title: "BD Expansion",
    href: "/admin/bd-expansion",
    icon: Globe,
  },
];

const systemNavItems = [
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  
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

  const NavItem = ({ item }: { item: { title: string; href: string; icon: any } }) => {
    const active = isActive(item.href);
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
              {mainNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Security
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {securityNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Regional
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {regionalNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
            <span className="text-[10px] text-muted-foreground leading-tight">
              Administrator
            </span>
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
