import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Car, Package, UtensilsCrossed, User, Clock, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerHome() {
  const { user, logout } = useAuth();

  // Fetch fresh customer data including verification status
  const { data: customerData, isLoading } = useQuery({
    queryKey: ["/api/customer/home"],
    refetchInterval: 5000, // Refresh every 5 seconds to pick up verification changes
  });

  const profile = customerData?.profile || user?.profile;

  const services = [
    {
      name: "Request Ride",
      icon: Car,
      href: "/customer/ride",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      name: "Order Food",
      icon: UtensilsCrossed,
      href: "/customer/food",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      name: "Send Parcel",
      icon: Package,
      href: "/customer/parcel",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">SafeGo</h1>
            <p className="text-sm opacity-90">{user?.countryCode === "BD" ? "🇧🇩 Bangladesh" : "🇺🇸 United States"}</p>
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

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">{profile?.email || user?.email}</p>
            {isLoading ? (
              <Skeleton className="h-6 w-32 mt-1" />
            ) : (
              <Badge variant="secondary" className="mt-1" data-testid="badge-verification">
                {profile?.isVerified ? "✓ Verified" : "Pending Verification"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* KYC Verification Alert */}
      {!isLoading && !profile?.isVerified && (
        <div className="p-6">
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <HelpCircle className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
                    {profile?.verificationStatus === "rejected" 
                      ? "Verification Rejected" 
                      : "Verification Pending"}
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                    {profile?.verificationStatus === "rejected"
                      ? "Your KYC documents were rejected. Please update your information and contact support."
                      : "Your account is under review. You'll be able to use services once verification is complete."}
                  </p>
                  <Link href="/customer/profile/kyc">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      data-testid="button-view-kyc"
                    >
                      View KYC Details
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Services Grid */}
      <div className="p-6 space-y-6">
        <h2 className="text-lg font-semibold">Services</h2>
        {profile?.isVerified ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((service) => (
              <Link key={service.name} href={service.href}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-service-${service.name.toLowerCase().replace(' ', '-')}`}>
                  <CardContent className="p-6">
                    <div className={`h-16 w-16 rounded-2xl ${service.bgColor} flex items-center justify-center mb-4`}>
                      <service.icon className={`h-8 w-8 ${service.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {service.name === "Request Ride" && "Book a ride to your destination"}
                      {service.name === "Order Food" && "Order from local restaurants"}
                      {service.name === "Send Parcel" && "Deliver packages quickly"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((service) => (
              <Card key={service.name} className="opacity-50" data-testid={`card-service-${service.name.toLowerCase().replace(' ', '-')}-disabled`}>
                <CardContent className="p-6">
                  <div className={`h-16 w-16 rounded-2xl ${service.bgColor} flex items-center justify-center mb-4`}>
                    <service.icon className={`h-8 w-8 ${service.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg">{service.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Requires verification
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    Locked
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border h-16 flex items-center justify-around px-6">
        <Link href="/customer">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-home">
            <Car className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
        </Link>
        <Link href="/customer/activity">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-activity">
            <Clock className="h-5 w-5" />
            <span className="text-xs">Activity</span>
          </Button>
        </Link>
        <Link href="/customer/support">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-support">
            <HelpCircle className="h-5 w-5" />
            <span className="text-xs">Support</span>
          </Button>
        </Link>
        <Link href="/customer/profile">
          <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto" data-testid="nav-profile">
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
