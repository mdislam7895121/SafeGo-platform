import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Package,
  ShoppingCart,
  Wallet,
  Settings,
  LogOut,
  Bell,
  HelpCircle,
  User,
  Star,
} from "lucide-react";

interface ShopPartnerLayoutProps {
  children: ReactNode;
}

const menuItems = [
  {
    title: "আমার দোকান",
    url: "/shop-partner",
    icon: Store,
    label: "dashboard",
  },
  {
    title: "পণ্য তালিকা",
    url: "/shop-partner/products",
    icon: Package,
    label: "products",
  },
  {
    title: "অর্ডার",
    url: "/shop-partner/orders",
    icon: ShoppingCart,
    label: "orders",
  },
  {
    title: "আয় ও ওয়ালেট",
    url: "/shop-partner/wallet",
    icon: Wallet,
    label: "wallet",
  },
  {
    title: "রিভিউ",
    url: "/shop-partner/reviews",
    icon: Star,
    label: "reviews",
  },
  {
    title: "নোটিফিকেশন",
    url: "/shop-partner/notifications",
    icon: Bell,
    label: "notifications",
  },
  {
    title: "প্রোফাইল",
    url: "/shop-partner/profile",
    icon: User,
    label: "profile",
  },
  {
    title: "সেটিংস",
    url: "/shop-partner/settings",
    icon: Settings,
    label: "settings",
  },
  {
    title: "সাহায্য",
    url: "/shop-partner/help",
    icon: HelpCircle,
    label: "help",
  },
];

export function ShopPartnerLayout({ children }: ShopPartnerLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: shopProfileData, isLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
    enabled: !!user,
  });
  const shopProfile = shopProfileData?.profile;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <Sidebar className="border-r">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Store className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-foreground">সেফগো</span>
                <span className="text-xs text-muted-foreground">দোকান পার্টনার</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            {isLoading ? (
              <div className="px-3 py-2">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : shopProfile ? (
              <div className="mx-3 mb-4 p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={shopProfile.logoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {shopProfile.shopName?.charAt(0) || "D"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {shopProfile.shopName || "আপনার দোকান"}
                    </p>
                    <Badge
                      variant={
                        shopProfile.verificationStatus === "approved"
                          ? "default"
                          : shopProfile.verificationStatus === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {shopProfile.verificationStatus === "approved"
                        ? "অনুমোদিত"
                        : shopProfile.verificationStatus === "pending"
                        ? "অপেক্ষমান"
                        : "প্রত্যাখ্যাত"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : null}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs text-muted-foreground px-3">
                মেনু
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const isActive = location === item.url || 
                      (item.url !== "/shop-partner" && location.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="h-11"
                        >
                          <Link href={item.url} data-testid={`nav-${item.label}`}>
                            <item.icon className="h-5 w-5" />
                            <span className="text-base">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
              <span>লগ আউট</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-semibold hidden sm:block">
                {menuItems.find((item) => 
                  location === item.url || 
                  (item.url !== "/shop-partner" && location.startsWith(item.url))
                )?.title || "আমার দোকান"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/shop-partner/notifications">
                <Button variant="ghost" size="icon" data-testid="button-notifications">
                  <Bell className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
