import { useState, useEffect } from "react";
import { RestaurantSidebar } from "./RestaurantSidebar";
import { RestaurantTopNav } from "./RestaurantTopNav";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { UserRole } from "@/config/restaurant-nav";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface RestaurantLayoutProps {
  children: React.ReactNode;
  userRole?: UserRole;
}

export function RestaurantLayout({ children, userRole = "OWNER" }: RestaurantLayoutProps) {
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  // Initialize isDesktop using matchMedia to avoid layout flash
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 1024px)').matches;
    }
    return true;
  });

  // Fetch restaurant data for top nav
  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ["/api/restaurant/home"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const profile = (restaurantData as any)?.profile;
  const restaurantName = profile?.restaurantName || "SafeGo Restaurant";
  const restaurantId = profile?.id;
  const actualOwnerRole = profile?.ownerRole || "OWNER"; // Default to OWNER for backward compatibility

  // Detect desktop vs mobile/tablet (must be before any conditional returns)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };
    
    // Check initial state
    handleChange(mediaQuery);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // RBAC: If this layout requires OWNER role, verify the user is actually an OWNER
  useEffect(() => {
    if (!isLoading && profile && userRole === "OWNER" && actualOwnerRole === "STAFF") {
      // STAFF user trying to access OWNER-only route, redirect to dashboard
      setLocation("/restaurant/dashboard");
    }
  }, [isLoading, profile, userRole, actualOwnerRole, setLocation]);

  // Show loading state while fetching profile
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If STAFF user trying to access OWNER-only content, show access denied
  if (userRole === "OWNER" && actualOwnerRole === "STAFF") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground">
              This page is only accessible to restaurant owners. Staff members do not have permission to access this
              feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <RestaurantSidebar 
        userRole={userRole} 
        onCollapsedChange={setSidebarCollapsed}
      />
      <RestaurantTopNav
        restaurantName={restaurantName}
        restaurantId={restaurantId}
        isOpen={isOpen}
        onToggleStatus={setIsOpen}
        sidebarCollapsed={sidebarCollapsed}
        isDesktop={isDesktop}
        userRole={userRole}
      />
      
      <main
        className="transition-all duration-300 pt-16"
        style={{
          marginLeft: isDesktop ? (sidebarCollapsed ? "4rem" : "16rem") : "0"
        }}
      >
        {children}
      </main>
    </div>
  );
}
