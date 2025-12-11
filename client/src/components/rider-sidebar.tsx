import { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Car,
  UtensilsCrossed,
  Package,
  Wallet,
  HelpCircle,
  Settings,
  User,
  LogOut,
  Star,
  MapPin,
  History,
  Gift,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@/hooks/use-logout";

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    label: "Services",
    items: [
      {
        title: "Home",
        icon: Home,
        href: "/rider/home",
      },
      {
        title: "Rides",
        icon: Car,
        href: "/rider/trips",
      },
      {
        title: "Food Orders",
        icon: UtensilsCrossed,
        href: "/rider/orders",
      },
      {
        title: "Parcels",
        icon: Package,
        href: "/rider/parcels",
      },
    ],
  },
  {
    label: "Payments",
    items: [
      {
        title: "Wallet",
        icon: Wallet,
        href: "/rider/wallet",
      },
      {
        title: "Payment Methods",
        icon: CreditCard,
        href: "/rider/wallet/methods",
      },
      {
        title: "Promotions",
        icon: Gift,
        href: "/rider/promotions",
      },
    ],
  },
  {
    label: "Activity",
    items: [
      {
        title: "Trip History",
        icon: History,
        href: "/rider/history",
      },
      {
        title: "Favorites",
        icon: Star,
        href: "/rider/favorites",
      },
      {
        title: "Saved Places",
        icon: MapPin,
        href: "/rider/places",
      },
    ],
  },
  {
    label: "Help & Settings",
    items: [
      {
        title: "Support",
        icon: MessageSquare,
        href: "/rider/support",
      },
      {
        title: "Help Center",
        icon: HelpCircle,
        href: "/rider/help",
      },
      {
        title: "Account",
        icon: User,
        href: "/rider/account",
      },
      {
        title: "Settings",
        icon: Settings,
        href: "/rider/settings",
      },
    ],
  },
];

export function RiderSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { performLogout } = useLogout();
  const { setOpenMobile, isMobile } = useSidebar();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const { data: riderData } = useQuery({
    queryKey: ["/api/customer/profile"],
  });

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    handleNavigation();
    performLogout();
  };

  const profile = riderData as any;
  const riderName = profile?.fullName || profile?.firstName 
    ? `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
    : user?.email?.split('@')[0] || 'Rider';
  
  const initials = riderName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'R';

  const isActive = (href: string) => {
    if (href === '/rider/home') {
      return location === href || location === '/rider';
    }
    if (href === '/rider/account') {
      return location === href || location.startsWith('/rider/account/');
    }
    return location === href || location.startsWith(href + '/');
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/rider/account" onClick={handleNavigation} data-testid="link-rider-profile-header">
          <div className="flex items-center gap-3 p-2 cursor-pointer hover-elevate rounded-lg">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profile?.profilePhotoUrl} alt={riderName} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate" data-testid="text-rider-name">
                {riderName}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email}
              </p>
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
                          data-testid={`link-rider-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <div className="flex items-center gap-3 w-full text-sm font-medium">
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            <span className="flex-1 truncate">{item.title}</span>
                            {item.badge && (
                              <Badge 
                                variant="secondary" 
                                className="ml-auto flex-shrink-0 bg-primary/20 text-primary border-primary/30 text-xs px-1.5 py-0"
                              >
                                {item.badge}
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
          onClick={handleLogoutClick}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg hover-elevate active-elevate-2 text-muted-foreground hover:text-foreground"
          data-testid="button-rider-logout"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Log Out</span>
        </button>
      </SidebarFooter>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent data-testid="sidebar-logout-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Log Out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of your SafeGo account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-sidebar-logout-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogoutConfirm}
              data-testid="button-sidebar-logout-confirm"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
