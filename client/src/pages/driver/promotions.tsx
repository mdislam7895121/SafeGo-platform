import { Gift, TrendingUp, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

const promotions = [
  {
    id: 1,
    title: "Weekend Surge Bonus",
    description: "Earn 1.5x on all rides this Saturday and Sunday",
    reward: "+50% per ride",
    expiresAt: "2024-11-24",
    icon: TrendingUp,
    type: "active",
  },
  {
    id: 2,
    title: "Morning Rush Hour",
    description: "Complete 3 rides between 7-9 AM for a bonus",
    reward: "$15 bonus",
    expiresAt: "2024-11-22",
    icon: Clock,
    type: "active",
  },
  {
    id: 3,
    title: "Airport Zone Premium",
    description: "Higher rates for airport pickups",
    reward: "+$5 per trip",
    expiresAt: "2024-11-30",
    icon: MapPin,
    type: "active",
  },
];

export default function DriverPromotions() {
  const { data: driverData } = useQuery({
    queryKey: ["/api/driver/home"],
  });

  const profile = (driverData as any)?.profile;
  const currency = profile?.countryCode === "BD" ? "৳" : "$";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Promotions</h1>
        </div>
        <p className="text-sm opacity-90">Active bonuses and special offers</p>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {promotions.map((promo) => (
          <Card key={promo.id} className="border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
                    <promo.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{promo.title}</CardTitle>
                    <CardDescription className="mt-1">{promo.description}</CardDescription>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0 ml-2">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reward</p>
                  <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">{promo.reward}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <p className="text-sm font-medium">{new Date(promo.expiresAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {promotions.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Active Promotions</h3>
              <p className="text-sm text-muted-foreground">
                Check back later for new bonuses and special offers
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
