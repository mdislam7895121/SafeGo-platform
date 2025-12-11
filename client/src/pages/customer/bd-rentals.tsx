import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { CustomerBackButton } from "@/components/customer/CustomerBackButton";
import {
  Search,
  CarFront,
  Users,
  Star,
  Calendar,
  MapPin,
  Filter,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

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

const fallbackDemoVehicles: RentalVehicle[] = [
  {
    id: "demo-car-1",
    vehicleType: "sedan",
    brand: "Toyota",
    model: "Corolla",
    year: 2022,
    color: "সাদা",
    passengerCapacity: 4,
    luggageCapacity: 3,
    pricePerDay: 3500,
    pricePerHour: 500,
    features: ["এসি", "ব্লুটুথ", "চার্জার"],
    isAvailable: true,
    currentLocation: "গুলশান, ঢাকা",
    operator: {
      id: "demo-op-1",
      operatorName: "সাফারি রেন্ট-এ-কার",
      averageRating: 4.5,
      officeAddress: "গুলশান-২, ঢাকা",
      officePhone: "+8801700000001",
    },
  },
  {
    id: "demo-car-2",
    vehicleType: "suv",
    brand: "Toyota",
    model: "Land Cruiser Prado",
    year: 2021,
    color: "কালো",
    passengerCapacity: 7,
    luggageCapacity: 5,
    pricePerDay: 12000,
    pricePerHour: 1500,
    features: ["এসি", "৪x৪", "লেদার সিট", "সানরুফ"],
    isAvailable: true,
    currentLocation: "বনানী, ঢাকা",
    operator: {
      id: "demo-op-2",
      operatorName: "প্রিমিয়াম মোটরস",
      averageRating: 4.8,
      officeAddress: "বনানী ১১, ঢাকা",
      officePhone: "+8801700000002",
    },
  },
  {
    id: "demo-car-3",
    vehicleType: "micro",
    brand: "Toyota",
    model: "Noah",
    year: 2020,
    color: "সিলভার",
    passengerCapacity: 8,
    luggageCapacity: 4,
    pricePerDay: 5000,
    pricePerHour: 700,
    features: ["এসি", "স্লাইডিং ডোর", "পাওয়ার উইন্ডো"],
    isAvailable: true,
    currentLocation: "মিরপুর, ঢাকা",
    operator: {
      id: "demo-op-3",
      operatorName: "ফ্যামিলি ট্রাভেলস",
      averageRating: 4.3,
      officeAddress: "মিরপুর ১০, ঢাকা",
      officePhone: "+8801700000003",
    },
  },
  {
    id: "demo-car-4",
    vehicleType: "tourist_bus",
    brand: "Hino",
    model: "RK8J",
    year: 2019,
    color: "সাদা/নীল",
    passengerCapacity: 35,
    luggageCapacity: 20,
    pricePerDay: 25000,
    features: ["এসি", "রিক্লাইনিং সিট", "টিভি", "ওয়াই-ফাই"],
    isAvailable: true,
    currentLocation: "মহাখালী, ঢাকা",
    operator: {
      id: "demo-op-4",
      operatorName: "ট্যুর এক্সপ্রেস",
      averageRating: 4.6,
      officeAddress: "মহাখালী, ঢাকা",
      officePhone: "+8801700000004",
    },
  },
  {
    id: "demo-car-5",
    vehicleType: "car",
    brand: "Honda",
    model: "Civic",
    year: 2023,
    color: "লাল",
    passengerCapacity: 4,
    luggageCapacity: 3,
    pricePerDay: 4500,
    pricePerHour: 600,
    features: ["এসি", "অটোমেটিক", "রিয়ার ক্যামেরা"],
    isAvailable: true,
    currentLocation: "ধানমন্ডি, ঢাকা",
    operator: {
      id: "demo-op-5",
      operatorName: "সিটি ড্রাইভ",
      averageRating: 4.4,
      officeAddress: "ধানমন্ডি ২৭, ঢাকা",
      officePhone: "+8801700000005",
    },
  },
  {
    id: "demo-car-6",
    vehicleType: "sedan",
    brand: "Nissan",
    model: "Sunny",
    year: 2021,
    color: "ধূসর",
    passengerCapacity: 4,
    luggageCapacity: 3,
    pricePerDay: 2800,
    pricePerHour: 400,
    features: ["এসি", "সেন্ট্রাল লক"],
    isAvailable: false,
    currentLocation: "উত্তরা, ঢাকা",
    operator: {
      id: "demo-op-1",
      operatorName: "সাফারি রেন্ট-এ-কার",
      averageRating: 4.5,
      officeAddress: "গুলশান-২, ঢাকা",
      officePhone: "+8801700000001",
    },
  },
];

export default function BDRentalsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [useFallback, setUseFallback] = useState(false);

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
      return apiRequest(`/api/bd/rentals?${params.toString()}`);
    },
    retry: false,
  });

  useEffect(() => {
    if (error) {
      console.log("[BD-Rentals] API error, using fallback demo data");
      setUseFallback(true);
    } else if (rentalData?.vehicles && rentalData.vehicles.length > 0) {
      setUseFallback(false);
    }
  }, [error, rentalData]);

  const apiVehicles = rentalData?.vehicles || [];
  const displayVehicles = useFallback || apiVehicles.length === 0 ? fallbackDemoVehicles : apiVehicles;

  const typeFilteredVehicles = selectedType === "all"
    ? displayVehicles
    : displayVehicles.filter(v => v.vehicleType === selectedType);

  const filteredVehicles = typeFilteredVehicles.filter(
    (vehicle) =>
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.operator.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vehicle.currentLocation && vehicle.currentLocation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <CustomerBackButton
            fallbackRoute="/customer"
            fallbackTab="rental"
            label="ফিরে যান"
          />
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
            <>
              {useFallback && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-2">
                  <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                    ডেমো গাড়ি দেখানো হচ্ছে। লগইন করুন আসল গাড়ি দেখতে।
                  </p>
                </div>
              )}
              {filteredVehicles.map((vehicle) => (
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
                              {formatCurrency(vehicle.pricePerDay, "BDT")}
                            </span>
                            <span className="text-sm text-muted-foreground">/দিন</span>
                          </div>
                          {vehicle.pricePerHour && (
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(vehicle.pricePerHour, "BDT")}/ঘণ্টা থেকে
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
              ))}
            </>
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
