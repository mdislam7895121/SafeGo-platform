import { useEffect } from "react";
import { Link } from "wouter";
import { Shield, Users, Car, UtensilsCrossed, DollarSign, UserX, Clock, AlertTriangle, UserCheck, Package, PackageCheck, PackageX, TruckIcon, FileText, ScrollText, Bell, Settings, MessageCircle, Wallet, HandCoins, BarChart3, TrendingUp, Activity, ShieldAlert, Gauge, Gift, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatCard, ManagementCard } from "@/components/ui/stat-card";
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
      name: "Notification Center",
      icon: Bell,
      href: "/admin/notifications",
      description: "System alerts and important notifications",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      badge: unreadCount?.count ? unreadCount.count : undefined,
    },
    {
      name: "KYC Approvals",
      icon: Shield,
      href: "/admin/kyc",
      description: "Review and approve user verification requests",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
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
        <Card className="max-w-md border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Unable to Verify Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't verify your permissions to access the admin dashboard. This may be due to a temporary network issue.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} data-testid="button-retry">
                Retry
              </Button>
              <Button variant="outline" onClick={logout} data-testid="button-logout">
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
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
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm opacity-90">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/notifications">
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground relative"
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
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
              data-testid="button-logout"
            >
              Logout
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">SafeGo Platform Management</p>
                <p className="text-sm text-muted-foreground">Control and monitor the entire platform</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Platform Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <h2 className="text-lg font-semibold mb-4">Driver Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <h2 className="text-lg font-semibold mb-4">Parcel Delivery Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <h2 className="text-lg font-semibold mb-4">Management</h2>
          
          {/* Error Banner for Capabilities Fetch Failure */}
          {hasCapabilitiesError && (
            <Card className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">Unable to load permissions</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      All management cards are shown below, but some may require specific permissions to access. 
                      Please refresh the page or contact support if this issue persists.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {isLoadingCapabilities ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-[14px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <Skeleton className="h-14 w-14 rounded-xl" />
                  </div>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
