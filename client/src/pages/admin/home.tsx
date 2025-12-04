import { useEffect } from "react";
import { Link } from "wouter";
import { Shield, Users, Car, UtensilsCrossed, DollarSign, UserX, Clock, AlertTriangle, UserCheck, Package, PackageCheck, PackageX, TruckIcon, FileText, ScrollText, Bell, Settings, MessageCircle, Wallet, HandCoins, BarChart3, TrendingUp, Activity, ShieldAlert, Gauge, Gift, Target, LayoutGrid, Truck, Cog, UserPlus, Store, Sparkles, Calculator, RefreshCw } from "lucide-react";
import { SystemAlert } from "@/components/ui/system-alert";
import { WelcomeMessage } from "@/components/ui/welcome-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatCard, ManagementCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminCapabilities } from "@/lib/queryClient";

interface AdminStats {
  totalUsers: number;
  totalDrivers: number;
  activeDrivers: number;
  pendingDrivers: number;
  pendingCustomers: number;
  pendingRestaurants: number;
  suspendedDrivers: number;
  blockedDrivers: number;
  totalCustomers: number;
  restaurants: number;
  openComplaints: number;
}

interface ParcelStats {
  totalParcels: number;
  activeParcels: number;
  deliveredToday: number;
  cancelledParcels: number;
}

export default function AdminHome() {
  const { user, token, logout } = useAuth();

  // Fetch admin statistics
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch parcel statistics
  const { data: parcelStats, isLoading: isLoadingParcels } = useQuery<ParcelStats>({
    queryKey: ["/api/admin/stats/parcels"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch unread notification count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/notifications/unread-count"],
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  // Fetch unread support messages count
  const { data: supportConversations } = useQuery({
    queryKey: ["/api/support/admin/conversations"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  }) as { data: Array<{ id: string; messages: Array<{ read: boolean; senderType: string }> }> };

  const unreadSupportMessages = supportConversations?.reduce((count, conv) => {
    return count + (conv.messages?.filter((msg) => !msg.read && msg.senderType === "user").length || 0);
  }, 0) || 0;

  // Fetch admin capabilities for RBAC with custom error handling
  const { data: capabilitiesData, error: capabilitiesError, isPending: isLoadingCapabilities } = useQuery<{ capabilities: string[] }>({
    queryKey: ["/api/admin/capabilities", token],
    queryFn: () => fetchAdminCapabilities(token),
    retry: false, // Don't retry on auth failures
    enabled: !!token, // Only run query if token exists
  });
  
  // Handle 401 errors by auto-logging out (using useEffect to avoid setState during render)
  useEffect(() => {
    if (capabilitiesError && (capabilitiesError as any)?.status === 401) {
      console.error("❌ Admin capabilities fetch failed (401) - auto-logging out");
      logout();
    }
  }, [capabilitiesError, logout]);
  
  // Use empty array as fallback only, but track if it's an error state
  const capabilities = capabilitiesData?.capabilities || [];
  const hasCapabilitiesError = !isLoadingCapabilities && capabilitiesError && (capabilitiesError as any)?.status !== 401;
  
  // Debug logging for capabilities
  if (capabilitiesData) {
    console.log("✅ Admin capabilities loaded:", capabilities);
    console.log(`📊 Total admin sections: 15, Capability-protected sections: 6`);
  } else if (isLoadingCapabilities) {
    console.log("⏳ Loading admin capabilities...");
  } else if (capabilitiesError) {
    console.error("❌ Failed to load capabilities:", capabilitiesError);
  }

  const adminSections = [
    {
      name: "Onboarding Overview",
      icon: UserPlus,
      href: "/admin/onboarding-overview",
      description: "Review and approve all partner applications",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
      badge: stats?.pendingDrivers ? (stats.pendingDrivers + (stats.pendingRestaurants || 0)) : undefined,
    },
    {
      name: "Notification Center",
      icon: Bell,
      href: "/admin/notifications",
      description: "System alerts and important notifications",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      badge: unreadCount?.count ? unreadCount.count : undefined,
    },
    {
      name: "People & KYC Center",
      icon: Users,
      href: "/admin/people-kyc",
      description: "Unified user management across all roles with KYC status",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      name: "Safety & Risk Center",
      icon: ShieldAlert,
      href: "/admin/safety",
      description: "Monitor and manage safety incidents and risk cases",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
    {
      name: "KYC Approvals",
      icon: Shield,
      href: "/admin/kyc",
      description: "Review and approve user verification requests",
      color: "text-sky-600",
      bgColor: "bg-sky-50 dark:bg-sky-950",
    },
    {
      name: "Document Center",
      icon: FileText,
      href: "/admin/documents",
      description: "Review all driver, customer, and restaurant documents",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      name: "Driver Management",
      icon: Car,
      href: "/admin/drivers",
      description: "View, suspend, and manage all drivers",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      name: "Customer Management",
      icon: Users,
      href: "/admin/customers",
      description: "View, block, and manage all customers",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
    },
    {
      name: "Shop Partners",
      icon: Store,
      href: "/admin/shop-partners",
      description: "Manage Bangladesh shop partner accounts",
      color: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950",
    },
    {
      name: "Ticket Operators",
      icon: Sparkles,
      href: "/admin/ticket-operators",
      description: "Manage Bangladesh transportation operators",
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950",
    },
    {
      name: "Complaints",
      icon: AlertTriangle,
      href: "/admin/complaints",
      description: "Review and resolve driver complaints",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      badge: stats?.openComplaints ? stats.openComplaints : undefined,
    },
    {
      name: "Wallets",
      icon: Wallet,
      href: "/admin/wallets",
      description: "View all driver and restaurant wallets with balances",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
      permission: "VIEW_WALLET_SUMMARY",
    },
    {
      name: "Payouts",
      icon: HandCoins,
      href: "/admin/payouts",
      description: "Review and approve pending payout requests",
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-950",
      permission: "MANAGE_PAYOUTS",
    },
    {
      name: "Referral Bonus Management",
      icon: Gift,
      href: "/admin/referral-settings",
      description: "Manage referral bonus amounts and promotional campaigns",
      color: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950",
    },
    {
      name: "Opportunity Bonuses",
      icon: Target,
      href: "/admin/opportunity-bonuses",
      description: "Manage ride incentives, boost zones, and promotional payouts",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
    },
    {
      name: "Driver Promotions",
      icon: Gift,
      href: "/admin/driver-promotions",
      description: "Create and manage driver incentives, quests, and bonus campaigns",
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950",
    },
    {
      name: "Earnings Analytics",
      icon: BarChart3,
      href: "/admin/earnings",
      description: "Global earnings, commission, and payout analytics dashboard",
      color: "text-fuchsia-600",
      bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950",
      permission: "VIEW_EARNINGS_DASHBOARD",
    },
    {
      name: "Analytics Dashboard",
      icon: TrendingUp,
      href: "/admin/analytics",
      description: "Comprehensive platform analytics for drivers, customers, restaurants, revenue, and risk",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      permission: "VIEW_ANALYTICS_DASHBOARD",
    },
    {
      name: "Performance Dashboard",
      icon: Gauge,
      href: "/admin/performance",
      description: "Real-time telemetry, system metrics, and stability monitoring",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
      permission: "VIEW_PERFORMANCE_DASHBOARD",
    },
    {
      name: "Wallet Settlement",
      icon: DollarSign,
      href: "/admin/settlement",
      description: "Manage driver and restaurant wallet settlements",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      name: "System Monitoring",
      icon: Activity,
      href: "/admin/monitoring",
      description: "Real-time security monitoring and system health",
      color: "text-rose-600",
      bgColor: "bg-rose-50 dark:bg-rose-950",
      permission: "VIEW_DASHBOARD",
    },
    {
      name: "Security Threat Center",
      icon: ShieldAlert,
      href: "/admin/security-center",
      description: "Advanced threat detection and real-time incident response",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      permission: "VIEW_DASHBOARD",
    },
    {
      name: "Operations Dashboard",
      icon: Gauge,
      href: "/admin/operations",
      description: "Real-time monitoring of rides, orders, parcels, and drivers",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      permission: "VIEW_REALTIME_MONITORING",
    },
    {
      name: "Revenue Analytics",
      icon: DollarSign,
      href: "/admin/revenue-analytics",
      description: "Financial performance, earnings breakdown, and top performers",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      permission: "VIEW_REVENUE_ANALYTICS",
    },
    {
      name: "Fraud Alerts",
      icon: AlertTriangle,
      href: "/admin/fraud-alerts",
      description: "Monitor and resolve fraud detection alerts",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      permission: "VIEW_FRAUD_ALERTS",
    },
    {
      name: "Activity Log",
      icon: ScrollText,
      href: "/admin/activity-log",
      description: "Security audit trail of all admin actions",
      color: "text-slate-600",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      name: "Support Chat",
      icon: MessageCircle,
      href: "/admin/support-chat",
      description: "Real-time support conversations with users",
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950",
      badge: unreadSupportMessages > 0 ? unreadSupportMessages : undefined,
      permission: "VIEW_SUPPORT_CONVERSATIONS",
    },
    {
      name: "Global Settings",
      icon: Settings,
      href: "/admin/settings",
      description: "Configure platform-wide settings and policies",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
    },
    {
      name: "Feature Flags",
      icon: Cog,
      href: "/admin/feature-flags",
      description: "Control feature rollouts and A/B testing",
      color: "text-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-950",
      permission: "MANAGE_SETTINGS",
    },
  ];

  // Loading state
  if (isLoadingCapabilities) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Capability error: hide all privileged UI and show only error banner with retry
  if (hasCapabilitiesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <SystemAlert
            variant="warning"
            title="Unable to Verify Permissions"
            action={
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => window.location.reload()} data-testid="button-retry" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" onClick={logout} data-testid="button-logout">
                  Logout
                </Button>
              </div>
            }
          >
            We couldn't verify your permissions to access the admin dashboard. This may be due to a temporary network issue.
          </SystemAlert>
        </div>
      </div>
    );
  }

  // Filter sections based on admin permissions (capabilities loaded successfully)
  const filteredSections = adminSections.filter((section) => {
    if (!section.permission) return true;
    return capabilities.includes(section.permission);
  });

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 sm:px-6 md:px-8 py-5 sm:py-6 rounded-b-2xl sm:rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Admin Dashboard</h1>
            <p className="text-xs sm:text-sm opacity-90 truncate">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/admin/notifications">
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground relative h-10 w-10 sm:h-9 sm:w-9"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount && unreadCount.count > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white border-2 border-primary"
                  >
                    {unreadCount.count > 9 ? "9+" : unreadCount.count}
                  </Badge>
                )}
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={logout}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground h-10 sm:h-9 px-3 sm:px-4 text-sm"
              data-testid="button-logout"
            >
              <span className="hidden xs:inline">Logout</span>
              <span className="xs:hidden">Exit</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate">SafeGo Platform Management</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Control and monitor the entire platform</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Message for New Admins */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6">
        <WelcomeMessage
          title="Welcome to SafeGo Admin!"
          message="You have full access to manage drivers, restaurants, customers, and platform settings. Use the quick actions below to get started or explore the management sections."
          ctaText="View Getting Started Guide"
          ctaHref="/admin/settings"
          variant="gradient"
          storageKey="admin_dashboard"
        />
      </div>

      {/* Quick Actions */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Quick Actions</h2>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link href="/admin/drivers?action=add">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              data-testid="button-quick-add-driver"
            >
              <UserPlus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Add Driver</span>
            </Button>
          </Link>
          <Link href="/admin/restaurants?action=add">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              data-testid="button-quick-add-restaurant"
            >
              <Store className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span>Add Restaurant</span>
            </Button>
          </Link>
          <Link href="/admin/promotions?action=create">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              data-testid="button-quick-create-promotion"
            >
              <Sparkles className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              <span>Create Promotion</span>
            </Button>
          </Link>
          <Link href="/admin/settings?tab=pricing">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              data-testid="button-quick-adjust-pricing"
            >
              <Calculator className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span>Adjust Pricing</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-10 sm:space-y-14">
        {/* Quick Stats */}
        <div>
          <SectionHeader 
            title="Platform Overview" 
            icon={LayoutGrid}
            iconColor="text-blue-600"
            testId="section-platform-overview"
          />
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
            <Link href="/admin/users">
              <StatCard
                icon={Users}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-50 dark:bg-blue-950/50"
                value={stats?.totalUsers ?? 0}
                label="Total Users"
                isLoading={isLoading}
                testId="card-total-users"
              />
            </Link>

            <Link href="/admin/drivers">
              <StatCard
                icon={Car}
                iconColor="text-purple-600"
                iconBgColor="bg-purple-50 dark:bg-purple-950/50"
                value={stats?.totalDrivers ?? 0}
                label="Total Drivers"
                isLoading={isLoading}
                testId="card-total-drivers"
              />
            </Link>

            <Link href="/admin/drivers?status=active">
              <StatCard
                icon={UserCheck}
                iconColor="text-green-600"
                iconBgColor="bg-green-50 dark:bg-green-950/50"
                value={stats?.activeDrivers ?? 0}
                label="Active Drivers"
                isLoading={isLoading}
                testId="card-active-drivers"
              />
            </Link>

            <Link href="/admin/customers">
              <StatCard
                icon={Users}
                iconColor="text-cyan-600"
                iconBgColor="bg-cyan-50 dark:bg-cyan-950/50"
                value={stats?.totalCustomers ?? 0}
                label="Customers"
                isLoading={isLoading}
                testId="card-customers"
              />
            </Link>

            <Link href="/admin/restaurants">
              <StatCard
                icon={UtensilsCrossed}
                iconColor="text-orange-600"
                iconBgColor="bg-orange-50 dark:bg-orange-950/50"
                value={stats?.restaurants ?? 0}
                label="Restaurants"
                isLoading={isLoading}
                testId="card-restaurants"
              />
            </Link>
          </div>
        </div>

        {/* Driver Stats */}
        <div>
          <SectionHeader 
            title="Driver Statistics" 
            icon={Car}
            iconColor="text-purple-600"
            testId="section-driver-statistics"
          />
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            <Link href="/admin/kyc">
              <StatCard
                icon={Clock}
                iconColor="text-yellow-600"
                iconBgColor="bg-yellow-50 dark:bg-yellow-950/50"
                value={(stats?.pendingDrivers ?? 0) + (stats?.pendingCustomers ?? 0) + (stats?.pendingRestaurants ?? 0)}
                label="Pending KYC"
                isLoading={isLoading}
                testId="card-pending-kyc"
              />
            </Link>

            <Link href="/admin/drivers?status=suspended">
              <StatCard
                icon={Shield}
                iconColor="text-orange-600"
                iconBgColor="bg-orange-50 dark:bg-orange-950/50"
                value={stats?.suspendedDrivers ?? 0}
                label="Suspended"
                isLoading={isLoading}
                testId="card-suspended"
              />
            </Link>

            <Link href="/admin/drivers?status=blocked">
              <StatCard
                icon={UserX}
                iconColor="text-red-600"
                iconBgColor="bg-red-50 dark:bg-red-950/50"
                value={stats?.blockedDrivers ?? 0}
                label="Blocked"
                isLoading={isLoading}
                testId="card-blocked"
              />
            </Link>

            <Link href="/admin/complaints">
              <StatCard
                icon={AlertTriangle}
                iconColor="text-red-600"
                iconBgColor="bg-red-50 dark:bg-red-950/50"
                value={stats?.openComplaints ?? 0}
                label="Open Complaints"
                isLoading={isLoading}
                testId="card-open-complaints"
              />
            </Link>
          </div>
        </div>

        {/* Parcel Statistics */}
        <div>
          <SectionHeader 
            title="Parcel Delivery Statistics" 
            icon={Truck}
            iconColor="text-indigo-600"
            testId="section-parcel-statistics"
          />
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            <Link href="/admin/parcels">
              <StatCard
                icon={Package}
                iconColor="text-indigo-600"
                iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
                value={parcelStats?.totalParcels ?? 0}
                label="Total Parcels"
                isLoading={isLoadingParcels}
                testId="card-total-parcels"
              />
            </Link>

            <Link href="/admin/parcels?status=active">
              <StatCard
                icon={TruckIcon}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-50 dark:bg-blue-950/50"
                value={parcelStats?.activeParcels ?? 0}
                label="Active Parcels"
                isLoading={isLoadingParcels}
                testId="card-active-parcels"
              />
            </Link>

            <Link href="/admin/parcels?status=delivered">
              <StatCard
                icon={PackageCheck}
                iconColor="text-green-600"
                iconBgColor="bg-green-50 dark:bg-green-950/50"
                value={parcelStats?.deliveredToday ?? 0}
                label="Delivered Today"
                isLoading={isLoadingParcels}
                testId="card-delivered-today"
              />
            </Link>

            <Link href="/admin/parcels?status=cancelled">
              <StatCard
                icon={PackageX}
                iconColor="text-red-600"
                iconBgColor="bg-red-50 dark:bg-red-950/50"
                value={parcelStats?.cancelledParcels ?? 0}
                label="Cancelled"
                isLoading={isLoadingParcels}
                testId="card-cancelled-parcels"
              />
            </Link>
          </div>
        </div>

        {/* Admin Sections */}
        <div>
          <SectionHeader 
            title="Management" 
            icon={Cog}
            iconColor="text-slate-600"
            description="Quick access to all admin tools and settings"
            testId="section-management"
          />
          
          {/* Error Banner for Capabilities Fetch Failure */}
          {hasCapabilitiesError && (
            <SystemAlert
              variant="warning"
              title="Unable to load permissions"
              dismissible
              className="mb-4"
              action={
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.reload()}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              }
            >
              All management cards are shown below, but some may require specific permissions to access.
              Please refresh the page or contact support if this issue persists.
            </SystemAlert>
          )}
          
          {isLoadingCapabilities ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-[14px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl" />
                  </div>
                  <Skeleton className="h-5 sm:h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
              {filteredSections.map((section) => (
                <Link key={section.name} href={section.href}>
                  <ManagementCard
                    icon={section.icon}
                    iconColor={section.color}
                    iconBgColor={section.bgColor}
                    title={section.name}
                    description={section.description}
                    badge={section.badge}
                    testId={`card-${section.name.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
