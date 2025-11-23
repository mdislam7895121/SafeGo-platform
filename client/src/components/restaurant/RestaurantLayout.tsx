import { useState, useEffect } from "react";
import { RestaurantSidebar } from "./RestaurantSidebar";
import { RestaurantTopNav } from "./RestaurantTopNav";
import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@/config/restaurant-nav";

interface RestaurantLayoutProps {
  children: React.ReactNode;
  userRole?: UserRole;
}

export function RestaurantLayout({ children, userRole = "OWNER" }: RestaurantLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);

  // Fetch restaurant data for top nav
  const { data: restaurantData } = useQuery({
    queryKey: ["/api/restaurant/home"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const profile = (restaurantData as any)?.profile;
  const restaurantName = profile?.restaurantName || "SafeGo Restaurant";

  // Detect desktop vs mobile/tablet
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <RestaurantSidebar 
        userRole={userRole} 
        onCollapsedChange={setSidebarCollapsed}
      />
      <RestaurantTopNav
        restaurantName={restaurantName}
        isOpen={isOpen}
        onToggleStatus={setIsOpen}
        sidebarCollapsed={sidebarCollapsed}
        isDesktop={isDesktop}
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
