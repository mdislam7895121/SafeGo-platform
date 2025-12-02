import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  Search,
  CarFront,
  Users,
  Star,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";

interface RentalVehicle {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  passengerCapacity: number;
  pricePerDay: number;
  pricePerHour?: number;
  images?: string[];
  features?: string[];
  isAvailable: boolean;
  operator: {
    id: string;
    operatorName: string;
    logo?: string;
    averageRating: number;
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

export default function BDRentalsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: rentalData, isLoading } = useQuery<{ vehicles: RentalVehicle[] }>({
    queryKey: ["/api/bd-tickets/vehicles"],
  });

  const filteredVehicles = rentalData?.vehicles?.filter(
    (vehicle) =>
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vehicleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.operator.operatorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Badge variant="outline" className="cursor-pointer hover-elevate">
            <CarFront className="h-3 w-3 mr-1" />
            সব গাড়ি
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover-elevate">
            কার
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover-elevate">
            মাইক্রো
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover-elevate">
            এসইউভি
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover-elevate">
            ট্যুরিস্ট বাস
          </Badge>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))
          ) : filteredVehicles?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CarFront className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">কোনো গাড়ি পাওয়া যায়নি</h3>
                <p className="text-sm text-muted-foreground">
                  অন্য গাড়ি বা ধরন খুঁজে দেখুন
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredVehicles?.map((vehicle) => (
              <Card key={vehicle.id} data-testid={`card-rental-${vehicle.id}`} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted relative">
                    {vehicle.images?.[0] ? (
                      <img 
                        src={vehicle.images[0]} 
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CarFront className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    {!vehicle.isAvailable && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive">অপ্রাপ্ত</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg" data-testid={`text-vehicle-${vehicle.id}`}>
                          {vehicle.brand} {vehicle.model}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {vehicle.operator.operatorName}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {rentalTypeLabels[vehicle.vehicleType] || vehicle.vehicleType}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {vehicle.passengerCapacity} জন
                      </span>
                      {vehicle.operator.averageRating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          {vehicle.operator.averageRating.toFixed(1)}
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
                      <Button 
                        disabled={!vehicle.isAvailable}
                        data-testid={`button-rent-${vehicle.id}`}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        বুক করুন
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {!isLoading && (!filteredVehicles || filteredVehicles.length === 0) && (
          <div className="text-center pt-8">
            <p className="text-sm text-muted-foreground mb-4">
              আপনি কি একটি রেন্টাল গাড়ি খুঁজছেন?
            </p>
            <Link href="/customer/bd-tickets">
              <Button variant="outline" data-testid="button-view-tickets">
                টিকিট দেখুন
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
