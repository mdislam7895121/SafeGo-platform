import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Wallet,
  Settings,
  Star,
  MapPin,
  LogOut,
  LayoutDashboard,
  Target,
  HelpCircle,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/driver/dashboard",
  },
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
    title: "Refer a Friend",
    icon: Users,
    href: "/driver/refer",
  },
  {
    title: "Opportunity",
    icon: Target,
    href: "/driver/promotions",
  },
  {
    title: "SafeGo Points",
    icon: Star,
    href: "/driver/points",
  },
  {
    title: "Wallet",
    icon: Wallet,
    href: "/driver/wallet",
  },
  {
    title: "Account Settings",
    icon: Settings,
    href: "/driver/account",
  },
  {
    title: "Help Center",
    icon: HelpCircle,
    href: "/driver/support-help-center",
  },
];

export function DriverSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const stats = (driverData as any)?.stats;

  // Extract driver name
  const driverName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.fullName || user?.email?.split('@')[0] || 'Driver';
  
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const cityName = profile?.usaCity || (profile?.countryCode === 'BD' ? 'Dhaka' : 'New York');
  const countryCode = profile?.countryCode || 'US';
  const rating = Number(stats?.rating || 4.8);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/driver/profile">
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

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + '/');
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} className="px-4 py-3 w-full">
                      <Link href={item.href} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="flex items-center gap-3 w-full text-sm font-medium">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className="flex-1">{item.title}</span>
                          {(item as any).isNew && (
                            <Badge variant="secondary" className="ml-auto bg-primary/20 text-primary border-primary/30">
                              New
                            </Badge>
                          )}
                          {item.title === "SafeGo Points" && (
                            <Badge variant="secondary" className="ml-auto bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg hover-elevate active-elevate-2 text-muted-foreground hover:text-foreground"
          data-testid="button-logout-sidebar"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Log Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
