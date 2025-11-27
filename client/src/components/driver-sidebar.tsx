import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Wallet,
  User,
  Star,
  MapPin,
  LogOut,
  LayoutDashboard,
  Target,
  HelpCircle,
  GraduationCap,
  Sparkles,
  FileText,
  Car,
  MessageSquare,
  History,
  BarChart3,
  Trophy,
  Shield,
  BadgeCheck,
  Gift,
  Navigation,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Driver Sidebar Menu Structure
 * =============================
 * Organized into 5 clear sections for better driver UX:
 * 
 * A. Core Driving - Primary driving functions (dashboard, trips, earnings)
 * B. Account & Vehicle - Profile management and vehicle info
 * C. Growth & Rewards - Points, bonuses, referrals
 * D. Learn & Support - Training, safety, and help resources
 * E. Session - Logout action (in footer)
 * 
 * Routes remain unchanged; only navigation organization is updated.
 */

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  isNew?: boolean;
  isPro?: boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    label: "Core",
    items: [
      {
        title: "Dashboard",
        icon: LayoutDashboard,
        href: "/driver/dashboard",
      },
      {
        title: "Go Online",
        icon: Target,
        href: "/driver/trip-requests",
        isNew: true,
      },
      {
        title: "Active Trip",
        icon: Navigation,
        href: "/driver/trip/active",
      },
      {
        title: "Trip History",
        icon: History,
        href: "/driver/trips",
      },
      {
        title: "Wallet",
        icon: Wallet,
        href: "/driver/wallet",
      },
      {
        title: "Incentives",
        icon: Trophy,
        href: "/driver/incentives",
      },
      {
        title: "Trust Score",
        icon: BadgeCheck,
        href: "/driver/trust-score",
        isNew: true,
      },
      {
        title: "Performance",
        icon: BarChart3,
        href: "/driver/performance",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Account",
        icon: User,
        href: "/driver/account",
      },
      {
        title: "Documents",
        icon: FileText,
        href: "/driver/documents",
      },
      {
        title: "Vehicle",
        icon: Car,
        href: "/driver/vehicle",
      },
    ],
  },
  {
    label: "Rewards",
    items: [
      {
        title: "SafeGo Points",
        icon: Star,
        href: "/driver/points",
        isPro: true,
      },
      {
        title: "Opportunity",
        icon: Target,
        href: "/driver/promotions",
      },
      {
        title: "Refer a Friend",
        icon: Gift,
        href: "/driver/refer",
      },
    ],
  },
  {
    label: "Support",
    items: [
      {
        title: "Getting Started",
        icon: Sparkles,
        href: "/driver/getting-started",
        isNew: true,
      },
      {
        title: "Training Videos",
        icon: GraduationCap,
        href: "/driver/tutorials",
      },
      {
        title: "Safety Center",
        icon: Shield,
        href: "/driver/safety",
      },
      {
        title: "Support",
        icon: MessageSquare,
        href: "/driver/support",
      },
      {
        title: "Help Center",
        icon: HelpCircle,
        href: "/driver/support/help",
      },
    ],
  },
];

export function DriverSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = () => {
    handleNavigation();
    logout();
  };

  const profile = (driverData as any)?.profile;
  const stats = (driverData as any)?.stats;

  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || user?.email?.split('@')[0] || 'Driver';
  
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const cityName = profile?.usaCity || (profile?.countryCode === 'BD' ? 'Dhaka' : 'New York');
  const countryCode = profile?.countryCode || 'US';
  const rating = Number(stats?.rating || 4.8);

  const isActive = (href: string) => {
    if (href === '/driver/account') {
      return location === href || 
             location.startsWith('/driver/account/') || 
             location === '/driver/profile' ||
             location.startsWith('/driver/profile/');
    }
    return location === href || location.startsWith(href + '/');
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/driver/profile" onClick={handleNavigation} data-testid="link-driver-profile-header">
          <div className="flex items-center gap-3 p-2 cursor-pointer hover-elevate rounded-lg">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profile?.profilePhotoUrl} alt={driverName} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate" data-testid="text-driver-name">
                {driverName}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  <span data-testid="text-driver-rating">{rating.toFixed(1)}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate" data-testid="text-driver-location">
                    {cityName}, {countryCode}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {menuSections.map((section) => (
          <SidebarGroup key={section.label} className="py-2">
            <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active} 
                        className="px-3 py-2.5 w-full"
                      >
                        <Link 
                          href={item.href} 
                          onClick={handleNavigation} 
                          data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <div className="flex items-center gap-3 w-full text-sm font-medium">
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            <span className="flex-1 truncate">{item.title}</span>
                            {item.isNew && (
                              <Badge 
                                variant="secondary" 
                                className="ml-auto flex-shrink-0 bg-primary/20 text-primary border-primary/30 text-xs px-1.5 py-0"
                              >
                                New
                              </Badge>
                            )}
                            {item.isPro && (
                              <Badge 
                                variant="secondary" 
                                className="ml-auto flex-shrink-0 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0"
                              >
                                Pro
                              </Badge>
                            )}
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg hover-elevate active-elevate-2 text-muted-foreground hover:text-foreground"
          data-testid="button-logout-sidebar"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Log Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
