import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronLeft,
  Search,
  CarFront,
  Users,
  Star,
  Calendar,
  MapPin,
  Filter,
  AlertTriangle,
} from "lucide-react";

interface RentalVehicle {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  passengerCapacity: number;
  luggageCapacity?: number;
  pricePerDay: number;
  pricePerHour?: number | null;
  images?: string[] | null;
  features?: string[] | null;
  isAvailable: boolean;
  currentLocation?: string;
  operator: {
    id: string;
    operatorName: string;
    logo?: string | null;
    averageRating: number;
    officeAddress?: string;
    officePhone?: string;
  };
}

const rentalTypeLabels: Record<string, string> = {
  car: "কার",
  micro: "মাইক্রো",
  tourist_bus: "ট্যুরিস্ট বাস",
  suv: "এসইউভি",
  sedan: "সেডান",
  pickup: "পিকআপ",
  van: "ভ্যান",
};

const vehicleTypeFilters = [
  { value: "all", label: "সব গাড়ি" },
  { value: "car", label: "কার" },
  { value: "sedan", label: "সেডান" },
  { value: "suv", label: "এসইউভি" },
  { value: "micro", label: "মাইক্রো" },
  { value: "tourist_bus", label: "ট্যুরিস্ট বাস" },
];

export default function BDRentalsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  useEffect(() => {
    if (user && user.countryCode !== "BD") {
      setLocation("/customer");
    }
  }, [user, setLocation]);

  const { data: rentalData, isLoading, error } = useQuery<{ vehicles: RentalVehicle[] }>({
    queryKey: ["/api/bd/rentals", selectedType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType && selectedType !== "all") {
        params.set("vehicleType", selectedType);
      }
      const response = await fetch(`/api/bd/rentals?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch rentals");
      }
      return response.json();
    },
  });

  const filteredVehicles = rentalData?.vehicles?.filter(
    (vehicle) =>
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.operator.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vehicle.currentLocation && vehicle.currentLocation.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold" data-testid="text-title">
              গাড়ি রেন্টাল
            </h1>
            <p className="text-xs text-muted-foreground">বাংলাদেশ</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="গাড়ি বা সার্ভিস খুঁজুন..."
            className="pl-10 h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {vehicleTypeFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedType === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(filter.value)}
              className="gap-1"
              data-testid={`button-filter-${filter.value}`}
            >
              {filter.value === "all" && <Filter className="h-3 w-3" />}
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CarFront className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">তথ্য লোড করতে সমস্যা হয়েছে</h3>
                <p className="text-sm text-muted-foreground">
                  অনুগ্রহ করে আবার চেষ্টা করুন
                </p>
              </CardContent>
            </Card>
          ) : filteredVehicles.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CarFront className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {searchQuery ? "কোনো গাড়ি পাওয়া যায়নি" : "এখনো কোনো রেন্টাল গাড়ি যোগ করা হয়নি"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "অন্য গাড়ি বা ধরন খুঁজে দেখুন" : "শীঘ্রই আসছে।"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredVehicles.map((vehicle) => (
              <Card key={vehicle.id} data-testid={`card-rental-${vehicle.id}`} className="overflow-hidden hover-elevate">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted relative">
                    {vehicle.images && vehicle.images.length > 0 && vehicle.images[0] ? (
                      <img 
                        src={vehicle.images[0]} 
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <CarFront className="h-16 w-16 text-primary/40" />
                      </div>
                    )}
                    {!vehicle.isAvailable && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive">অপ্রাপ্ত</Badge>
                      </div>
                    )}
                    <Badge 
                      variant="secondary" 
                      className="absolute top-2 right-2"
                    >
                      {rentalTypeLabels[vehicle.vehicleType] || vehicle.vehicleType}
                    </Badge>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-lg" data-testid={`text-vehicle-${vehicle.id}`}>
                          {vehicle.brand} {vehicle.model}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {vehicle.operator.operatorName}
                        </p>
                      </div>
                      {vehicle.operator.averageRating > 0 && (
                        <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                          <Star className="h-4 w-4 fill-green-600 text-green-600" />
                          <span className="font-bold text-green-700 dark:text-green-400">
                            {vehicle.operator.averageRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {vehicle.passengerCapacity} জন
                      </span>
                      {vehicle.currentLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {vehicle.currentLocation}
                        </span>
                      )}
                    </div>

                    {vehicle.features && vehicle.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {vehicle.features.slice(0, 4).map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {vehicle.features.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{vehicle.features.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-primary">
                            ৳{vehicle.pricePerDay.toLocaleString("bn-BD")}
                          </span>
                          <span className="text-sm text-muted-foreground">/দিন</span>
                        </div>
                        {vehicle.pricePerHour && (
                          <span className="text-xs text-muted-foreground">
                            ৳{vehicle.pricePerHour.toLocaleString("bn-BD")}/ঘণ্টা থেকে
                          </span>
                        )}
                      </div>
                      <Link href={`/customer/bd-rental/${vehicle.id}`}>
                        <Button 
                          disabled={!vehicle.isAvailable}
                          data-testid={`button-rent-${vehicle.id}`}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          বুক করুন
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {!isLoading && filteredVehicles.length > 0 && (
          <div className="text-center pt-4 pb-8">
            <p className="text-sm text-muted-foreground">
              {filteredVehicles.length}টি গাড়ি পাওয়া গেছে
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
