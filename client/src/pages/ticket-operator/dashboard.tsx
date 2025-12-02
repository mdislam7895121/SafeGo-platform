import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wallet, 
  Ticket, 
  Car, 
  Calendar,
  Star,
  TrendingUp,
  Clock,
  Users
} from "lucide-react";

interface DashboardData {
  dashboard: {
    operatorName: string;
    operatorType: string;
    walletBalance: number;
    negativeBalance: number;
    pendingPayout: number;
    averageRating: number;
    totalBookings: number;
    tickets: {
      todaysBookings: number;
      pendingBookings: number;
      recentBookings: any[];
    };
    rentals: {
      todaysBookings: number;
      pendingBookings: number;
      recentBookings: any[];
      availableVehicles: number;
    };
  };
}

export default function TicketOperatorDashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/ticket-operator/dashboard"],
  });

  const dashboard = data?.dashboard;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "মোট আয়",
      value: `৳${(dashboard?.walletBalance || 0).toLocaleString("bn-BD")}`,
      icon: Wallet,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      testId: "stat-balance"
    },
    {
      label: "মোট বুকিং",
      value: (dashboard?.totalBookings || 0).toLocaleString("bn-BD"),
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      testId: "stat-bookings"
    },
    {
      label: "পেন্ডিং পেআউট",
      value: `৳${(dashboard?.pendingPayout || 0).toLocaleString("bn-BD")}`,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      testId: "stat-pending"
    },
    {
      label: "গড় রেটিং",
      value: (dashboard?.averageRating || 0).toFixed(1),
      icon: Star,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
      testId: "stat-rating"
    },
  ];

  return (
    <div>
      <div className="space-y-6 pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-welcome">
            স্বাগতম, {dashboard?.operatorName}
          </h1>
          <p className="text-muted-foreground">
            আজকের সামারি দেখুন
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.testId} className={stat.bgColor}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-lg font-bold ${stat.color}`} data-testid={stat.testId}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                টিকিট বুকিং
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary" data-testid="text-today-tickets">
                    {(dashboard?.tickets?.todaysBookings || 0).toLocaleString("bn-BD")}
                  </p>
                  <p className="text-xs text-muted-foreground">আজকের বুকিং</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-pending-tickets">
                    {(dashboard?.tickets?.pendingBookings || 0).toLocaleString("bn-BD")}
                  </p>
                  <p className="text-xs text-muted-foreground">পেন্ডিং</p>
                </div>
              </div>

              {dashboard?.tickets?.recentBookings?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">কোনো সাম্প্রতিক বুকিং নেই</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dashboard?.tickets?.recentBookings?.slice(0, 3).map((booking: any) => (
                    <div 
                      key={booking.id} 
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                      data-testid={`booking-ticket-${booking.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{booking.listing?.routeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.customer?.fullName}
                        </p>
                      </div>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                        {booking.status === "booked" ? "নতুন" : 
                         booking.status === "confirmed" ? "নিশ্চিত" : booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-5 w-5" />
                রেন্টাল বুকিং
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary" data-testid="text-today-rentals">
                    {(dashboard?.rentals?.todaysBookings || 0).toLocaleString("bn-BD")}
                  </p>
                  <p className="text-xs text-muted-foreground">আজকের বুকিং</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-available-vehicles">
                    {(dashboard?.rentals?.availableVehicles || 0).toLocaleString("bn-BD")}
                  </p>
                  <p className="text-xs text-muted-foreground">ফ্রি গাড়ি</p>
                </div>
              </div>

              {dashboard?.rentals?.recentBookings?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">কোনো সাম্প্রতিক বুকিং নেই</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dashboard?.rentals?.recentBookings?.slice(0, 3).map((booking: any) => (
                    <div 
                      key={booking.id} 
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                      data-testid={`booking-rental-${booking.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {booking.vehicle?.brand} {booking.vehicle?.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.customer?.fullName}
                        </p>
                      </div>
                      <Badge variant={booking.status === "accepted" ? "default" : "secondary"}>
                        {booking.status === "requested" ? "নতুন" : 
                         booking.status === "accepted" ? "গ্রহণ" : booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
