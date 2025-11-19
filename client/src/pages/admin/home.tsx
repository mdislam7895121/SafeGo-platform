import { Link } from "wouter";
import { Shield, Users, Car, UtensilsCrossed, DollarSign, UserX, Clock, AlertTriangle, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

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

export default function AdminHome() {
  const { user, logout } = useAuth();

  // Fetch admin statistics
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const adminSections = [
    {
      name: "KYC Approvals",
      icon: Shield,
      href: "/admin/kyc",
      description: "Review and approve user verification requests",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
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
      name: "Wallet Settlement",
      icon: DollarSign,
      href: "/admin/settlement",
      description: "Manage driver and restaurant wallet settlements",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm opacity-90">{user?.email}</p>
          </div>
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
          <h2 className="text-lg font-semibold mb-3">Platform Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/users">
              <Card className="hover-elevate cursor-pointer" data-testid="card-total-users">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Users className="h-8 w-8 text-blue-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-total-users">
                        {stats?.totalUsers ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/drivers">
              <Card className="hover-elevate cursor-pointer" data-testid="card-total-drivers">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Car className="h-8 w-8 text-purple-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-total-drivers">
                        {stats?.totalDrivers ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Total Drivers</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/drivers?status=active">
              <Card className="hover-elevate cursor-pointer" data-testid="card-active-drivers">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <UserCheck className="h-8 w-8 text-green-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-active-drivers">
                        {stats?.activeDrivers ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Active Drivers</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/customers">
              <Card className="hover-elevate cursor-pointer" data-testid="card-customers">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Users className="h-8 w-8 text-cyan-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-customers">
                        {stats?.totalCustomers ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Customers</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/restaurants">
              <Card className="hover-elevate cursor-pointer" data-testid="card-restaurants">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <UtensilsCrossed className="h-8 w-8 text-orange-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-restaurants">
                        {stats?.restaurants ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Restaurants</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Driver Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Driver Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/kyc">
              <Card className="hover-elevate cursor-pointer" data-testid="card-pending-kyc">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Clock className="h-8 w-8 text-yellow-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-pending-drivers">
                        {(stats?.pendingDrivers ?? 0) + (stats?.pendingCustomers ?? 0) + (stats?.pendingRestaurants ?? 0)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Pending KYC</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/drivers?status=suspended">
              <Card className="hover-elevate cursor-pointer" data-testid="card-suspended">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <Shield className="h-8 w-8 text-orange-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-suspended-drivers">
                        {stats?.suspendedDrivers ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Suspended</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/drivers?status=blocked">
              <Card className="hover-elevate cursor-pointer" data-testid="card-blocked">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <UserX className="h-8 w-8 text-red-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-blocked-drivers">
                        {stats?.blockedDrivers ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Blocked</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/complaints">
              <Card className="hover-elevate cursor-pointer" data-testid="card-open-complaints">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <AlertTriangle className="h-8 w-8 text-red-600 mb-2" />
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="stat-open-complaints">
                        {stats?.openComplaints ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Open Complaints</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Admin Sections */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminSections.map((section) => (
              <Link key={section.name} href={section.href}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-${section.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-2xl ${section.bgColor} flex items-center justify-center`}>
                        <section.icon className={`h-6 w-6 ${section.color}`} />
                      </div>
                      {section.badge !== undefined && section.badge > 0 && (
                        <Badge variant="destructive" data-testid={`badge-${section.name.toLowerCase().replace(/\s+/g, '-')}`}>
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{section.name}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
