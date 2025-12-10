import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerBackButton } from "@/components/customer/CustomerBackButton";
import {
  Search,
  Bus,
  Train,
  MapPin,
  Clock,
  Users,
  Star,
  Ticket,
  Car,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

interface TicketListing {
  id: string;
  routeName: string;
  vehicleType: string;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  arrivalTime: string;
  basePrice: number;
  discountPrice?: number;
  totalSeats: number;
  availableSeats: number;
  amenities?: string[];
  operator: {
    id: string;
    operatorName: string;
    logo?: string;
    averageRating: number;
  };
}

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
  operator: {
    id: string;
    operatorName: string;
    logo?: string;
    averageRating: number;
  };
}

const vehicleTypeLabels: Record<string, string> = {
  bus: "বাস",
  coach: "কোচ",
  ac_bus: "এসি বাস",
  train: "ট্রেন",
};

const rentalTypeLabels: Record<string, string> = {
  car: "কার",
  micro: "মাইক্রো",
  tourist_bus: "ট্যুরিস্ট বাস",
  suv: "এসইউভি",
  sedan: "সেডান",
};

export default function BDTicketsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("tickets");

  const { data: ticketData, isLoading: ticketLoading } = useQuery<{ listings: TicketListing[] }>({
    queryKey: ["/api/bd/tickets"],
  });

  const { data: rentalData, isLoading: rentalLoading } = useQuery<{ vehicles: RentalVehicle[] }>({
    queryKey: ["/api/bd/rentals"],
  });

  const filteredTickets = ticketData?.listings?.filter(
    (ticket) =>
      ticket.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.originCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.destinationCity.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVehicles = rentalData?.vehicles?.filter(
    (vehicle) =>
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.operator.operatorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <CustomerBackButton
            fallbackRoute="/customer"
            fallbackTab="tickets"
            label="ফিরে যান"
          />
          <div className="flex-1">
            <h1 className="text-lg font-bold" data-testid="text-title">
              টিকিট ও রেন্টাল
            </h1>
            <p className="text-xs text-muted-foreground">বাংলাদেশ</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="রুট বা গাড়ি খুঁজুন..."
            className="pl-10 h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 h-12">
            <TabsTrigger value="tickets" className="h-10 gap-2" data-testid="tab-tickets">
              <Ticket className="h-4 w-4" />
              টিকিট
            </TabsTrigger>
            <TabsTrigger value="rentals" className="h-10 gap-2" data-testid="tab-rentals">
              <Car className="h-4 w-4" />
              রেন্টাল
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="mt-4 space-y-3">
            {ticketLoading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))
            ) : filteredTickets?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">কোনো টিকিট পাওয়া যায়নি</h3>
                  <p className="text-sm text-muted-foreground">
                    অন্য রুট খুঁজে দেখুন
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredTickets?.map((ticket) => (
                <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold" data-testid={`text-route-${ticket.id}`}>
                          {ticket.routeName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {ticket.operator.operatorName}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {vehicleTypeLabels[ticket.vehicleType] || ticket.vehicleType}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium">{ticket.originCity}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium">{ticket.destinationCity}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {ticket.departureTime} - {ticket.arrivalTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {ticket.availableSeats} আসন ফাঁকা
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(ticket.basePrice, "BDT")}
                        </span>
                        {ticket.discountPrice && (
                          <span className="text-sm text-muted-foreground line-through ml-2">
                            {formatCurrency(ticket.discountPrice, "BDT")}
                          </span>
                        )}
                      </div>
                      <Button data-testid={`button-book-${ticket.id}`}>
                        বুক করুন
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="rentals" className="mt-4 space-y-3">
            {rentalLoading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))
            ) : filteredVehicles?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">কোনো গাড়ি পাওয়া যায়নি</h3>
                  <p className="text-sm text-muted-foreground">
                    অন্য গাড়ি খুঁজে দেখুন
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredVehicles?.map((vehicle) => (
                <Card key={vehicle.id} data-testid={`card-vehicle-${vehicle.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold" data-testid={`text-vehicle-${vehicle.id}`}>
                          {vehicle.brand} {vehicle.model}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {vehicle.operator.operatorName}
                        </p>
                      </div>
                      <Badge variant="outline">
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

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(vehicle.pricePerDay, "BDT")}
                        </span>
                        <span className="text-sm text-muted-foreground">/দিন</span>
                        {vehicle.pricePerHour && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({formatCurrency(vehicle.pricePerHour, "BDT")}/ঘণ্টা)
                          </span>
                        )}
                      </div>
                      <Button data-testid={`button-rent-${vehicle.id}`}>
                        বুক করুন
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
