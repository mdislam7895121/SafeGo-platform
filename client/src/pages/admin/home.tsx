import { Link } from "wouter";
import { Shield, Users, Car, UtensilsCrossed, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

interface AdminStats {
  totalUsers: number;
  totalDrivers: number;
  activeDrivers: number;
  restaurants: number;
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
        <div className="grid grid-cols-3 gap-4">
          <Card>
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

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <Car className="h-8 w-8 text-green-600 mb-2" />
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

          <Card>
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
        </div>

        {/* Admin Sections */}
        <h2 className="text-lg font-semibold">Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adminSections.map((section) => (
            <Link key={section.name} href={section.href}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-${section.name.toLowerCase().replace(' ', '-')}`}>
                <CardContent className="p-6">
                  <div className={`h-12 w-12 rounded-2xl ${section.bgColor} flex items-center justify-center mb-4`}>
                    <section.icon className={`h-6 w-6 ${section.color}`} />
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
  );
}
