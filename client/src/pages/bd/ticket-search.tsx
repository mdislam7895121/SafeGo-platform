import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, addDays, isSameDay } from "date-fns";
import { bn } from "date-fns/locale";
import {
  Search,
  Bus,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Users,
  ArrowRight,
  ArrowLeftRight,
  Filter,
  Armchair,
  Wallet,
  Star,
  ChevronRight,
  Loader2,
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";
import { RouteAutocomplete, PopularRoutes } from "@/components/bd/RouteAutocomplete";
import { SeatPlanEngine } from "@/components/bd/SeatPlanEngine";
import {
  BUS_TYPES,
  SEAT_LAYOUTS,
  formatCurrencyBangla,
  formatTimeBangla,
  type BusTypeId,
  type SeatLayoutId,
  type SeatState,
} from "@/lib/bd-ticket-types";
import { getRouteDetails } from "@/lib/bd-routes";

interface TicketOperator {
  id: string;
  operatorName: string;
  logo: string | null;
  averageRating: number | null;
  totalRatings: number;
}

interface TicketListing {
  id: string;
  routeName: string;
  vehicleType: string;
  vehicleBrand: string | null;
  originCity: string;
  originStation: string | null;
  destinationCity: string;
  destinationStation: string | null;
  departureTime: string;
  arrivalTime: string | null;
  durationMinutes: number | null;
  basePrice: string;
  discountPrice: string | null;
  availableSeats: number;
  totalSeats: number;
  amenities: string[];
  operator: TicketOperator;
}

interface TicketSearchResponse {
  listings: TicketListing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchParams: {
    originCity: string;
    destinationCity: string;
    journeyDate: string;
    dayOfWeek: string;
  };
}

interface TicketResult {
  id: string;
  coachName: string;
  operatorName: string;
  originCity: string;
  originCityBn: string;
  destinationCity: string;
  destinationCityBn: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  busType: BusTypeId;
  seatLayout: SeatLayoutId;
  fare: number;
  totalSeats: number;
  availableSeats: number;
  rating: number;
  amenities: string[];
  seats?: SeatState[];
}

const mapListingToTicketResult = (listing: TicketListing): TicketResult => {
  const durationHours = listing.durationMinutes ? Math.floor(listing.durationMinutes / 60) : 0;
  const durationMins = listing.durationMinutes ? listing.durationMinutes % 60 : 0;
  const durationStr = durationMins > 0 ? `${durationHours} ঘণ্টা ${durationMins} মিনিট` : `${durationHours} ঘণ্টা`;
  
  const busTypeMap: Record<string, BusTypeId> = {
    "ac_bus": "ac",
    "bus": "non_ac",
    "coach": "ac_business",
    "train": "non_ac",
  };

  return {
    id: listing.id,
    coachName: listing.routeName || `${listing.originCity} - ${listing.destinationCity}`,
    operatorName: listing.operator.operatorName,
    originCity: listing.originCity,
    originCityBn: listing.originCity,
    destinationCity: listing.destinationCity,
    destinationCityBn: listing.destinationCity,
    departureTime: listing.departureTime,
    arrivalTime: listing.arrivalTime || "",
    duration: durationStr,
    busType: busTypeMap[listing.vehicleType] || "non_ac",
    seatLayout: "2x2",
    fare: parseFloat(listing.discountPrice || listing.basePrice),
    totalSeats: listing.totalSeats,
    availableSeats: listing.availableSeats,
    rating: listing.operator.averageRating || 4.0,
    amenities: listing.amenities || [],
  };
};

export default function TicketSearchPage() {
  const [, setLocation] = useLocation();
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [travelDate, setTravelDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TicketResult[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketResult | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    busType: "all",
    priceRange: "all",
    departureTime: "all",
    sortBy: "departure",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearch = async () => {
    if (!originCity || !destinationCity) return;
    
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const journeyDate = format(travelDate, "yyyy-MM-dd");
      const response: TicketSearchResponse = await apiRequest(
        `/api/tickets/search?originCity=${encodeURIComponent(originCity)}&destinationCity=${encodeURIComponent(destinationCity)}&journeyDate=${journeyDate}`
      );
      
      if (response.listings && response.listings.length > 0) {
        setResults(response.listings.map(mapListingToTicketResult));
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Ticket search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSwapCities = () => {
    const temp = originCity;
    setOriginCity(destinationCity);
    setDestinationCity(temp);
  };

  const handleSelectTicket = (ticket: TicketResult) => {
    setSelectedTicket(ticket);
    setSelectedSeats([]);
    setIsBookingOpen(true);
  };

  const handleSeatSelect = (seatId: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatId)
        ? prev.filter((id) => id !== seatId)
        : [...prev, seatId]
    );
  };

  const handleConfirmBooking = () => {
    if (!selectedTicket) return;
    
    const queryParams = new URLSearchParams({
      ticketId: selectedTicket.id,
      coach: selectedTicket.coachName,
      operator: selectedTicket.operatorName,
      origin: selectedTicket.originCityBn,
      destination: selectedTicket.destinationCityBn,
      departure: selectedTicket.departureTime,
      arrival: selectedTicket.arrivalTime,
      seats: selectedSeats.join(","),
      fare: String(selectedTicket.fare),
      date: format(travelDate, "yyyy-MM-dd"),
    });
    
    setLocation(`/bd/ticket-booking?${queryParams.toString()}`);
  };

  const formatDateBangla = (date: Date) => {
    return format(date, "EEEE, d MMMM yyyy", { locale: bn });
  };

  const getDateLabel = (date: Date) => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    if (isSameDay(date, today)) return "আজ";
    if (isSameDay(date, tomorrow)) return "আগামীকাল";
    return format(date, "d MMM", { locale: bn });
  };

  const getBusTypeLabel = (type: BusTypeId) => {
    return BUS_TYPES.find((bt) => bt.id === type)?.label || type;
  };

  const filteredResults = results.filter((ticket) => {
    if (filters.busType !== "all" && ticket.busType !== filters.busType) return false;
    
    if (filters.priceRange !== "all") {
      const [min, max] = filters.priceRange.split("-").map(Number);
      if (ticket.fare < min || (max && ticket.fare > max)) return false;
    }
    
    if (filters.departureTime !== "all") {
      const hour = parseInt(ticket.departureTime.split(":")[0]);
      switch (filters.departureTime) {
        case "morning": if (hour < 6 || hour >= 12) return false; break;
        case "afternoon": if (hour < 12 || hour >= 17) return false; break;
        case "evening": if (hour < 17 || hour >= 21) return false; break;
        case "night": if (hour < 21 && hour >= 6) return false; break;
      }
    }
    
    return true;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case "price_low": return a.fare - b.fare;
      case "price_high": return b.fare - a.fare;
      case "rating": return b.rating - a.rating;
      case "seats": return b.availableSeats - a.availableSeats;
      default: return a.departureTime.localeCompare(b.departureTime);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-1" data-testid="text-page-title">
            বাস টিকিট
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            সহজেই বাস টিকিট খুঁজুন ও বুক করুন
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4">
        <Card className="shadow-lg">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">কোথা থেকে?</Label>
                <RouteAutocomplete
                  type="origin"
                  value={originCity}
                  onChange={setOriginCity}
                  testIdPrefix="search"
                />
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 self-end mb-0.5"
                onClick={handleSwapCities}
                data-testid="button-swap-cities"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">কোথায় যাবেন?</Label>
                <RouteAutocomplete
                  type="destination"
                  value={destinationCity}
                  onChange={setDestinationCity}
                  originValue={originCity}
                  testIdPrefix="search"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                const date = addDays(new Date(), dayOffset);
                const isSelected = isSameDay(date, travelDate);
                return (
                  <Button
                    key={dayOffset}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 min-w-[70px] flex flex-col py-2 h-auto",
                      isSelected && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => setTravelDate(date)}
                    data-testid={`button-date-${dayOffset}`}
                  >
                    <span className="text-[10px] opacity-70">
                      {format(date, "EEE", { locale: bn })}
                    </span>
                    <span className="font-bold">
                      {format(date, "d", { locale: bn })}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {format(date, "MMM", { locale: bn })}
                    </span>
                  </Button>
                );
              })}
              
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[70px] flex flex-col py-2 h-auto"
                    data-testid="button-more-dates"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-[10px]">আরো</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={travelDate}
                    onSelect={(date) => {
                      if (date) {
                        setTravelDate(date);
                        setDateOpen(false);
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <PopularRoutes
              onSelect={(from, to) => {
                setOriginCity(from);
                setDestinationCity(to);
              }}
            />

            <Button
              className="w-full h-12 text-lg"
              onClick={handleSearch}
              disabled={!originCity || !destinationCity || isSearching}
              data-testid="button-search"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  খোঁজা হচ্ছে...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  টিকিট খুঁজুন
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {hasSearched && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg" data-testid="text-results-title">
                {originCity} <ArrowRight className="h-4 w-4 inline mx-1" /> {destinationCity}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatDateBangla(travelDate)} • {filteredResults.length} টি বাস পাওয়া গেছে
              </p>
            </div>
            
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-filter">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  ফিল্টার
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>ফিল্টার ও সর্ট</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  <div className="space-y-2">
                    <Label>বাসের ধরন</Label>
                    <Select
                      value={filters.busType}
                      onValueChange={(v) => setFilters({ ...filters, busType: v })}
                    >
                      <SelectTrigger data-testid="select-bus-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সব ধরন</SelectItem>
                        {BUS_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>ভাড়ার পরিসীমা</Label>
                    <Select
                      value={filters.priceRange}
                      onValueChange={(v) => setFilters({ ...filters, priceRange: v })}
                    >
                      <SelectTrigger data-testid="select-price-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সব দাম</SelectItem>
                        <SelectItem value="0-500">৳০ - ৳৫০০</SelectItem>
                        <SelectItem value="500-1000">৳৫০০ - ৳১০০০</SelectItem>
                        <SelectItem value="1000-1500">৳১০০০ - ৳১৫০০</SelectItem>
                        <SelectItem value="1500-99999">৳১৫০০+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>ছাড়ার সময়</Label>
                    <Select
                      value={filters.departureTime}
                      onValueChange={(v) => setFilters({ ...filters, departureTime: v })}
                    >
                      <SelectTrigger data-testid="select-departure-time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সব সময়</SelectItem>
                        <SelectItem value="morning">সকাল (৬টা - ১২টা)</SelectItem>
                        <SelectItem value="afternoon">দুপুর (১২টা - ৫টা)</SelectItem>
                        <SelectItem value="evening">সন্ধ্যা (৫টা - ৯টা)</SelectItem>
                        <SelectItem value="night">রাত (৯টা+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>সর্ট করুন</Label>
                    <Select
                      value={filters.sortBy}
                      onValueChange={(v) => setFilters({ ...filters, sortBy: v })}
                    >
                      <SelectTrigger data-testid="select-sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="departure">ছাড়ার সময়</SelectItem>
                        <SelectItem value="price_low">কম দাম আগে</SelectItem>
                        <SelectItem value="price_high">বেশি দাম আগে</SelectItem>
                        <SelectItem value="rating">সেরা রেটিং</SelectItem>
                        <SelectItem value="seats">বেশি আসন আগে</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setFilters({
                      busType: "all",
                      priceRange: "all",
                      departureTime: "all",
                      sortBy: "departure",
                    })}
                    data-testid="button-reset-filters"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    রিসেট করুন
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {isSearching ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="h-20 w-20 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-6 w-20 ml-auto" />
                        <Skeleton className="h-8 w-24 ml-auto" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">কোনো বাস পাওয়া যায়নি</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  অন্য তারিখ বা রুট চেষ্টা করুন
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      busType: "all",
                      priceRange: "all",
                      departureTime: "all",
                      sortBy: "departure",
                    });
                  }}
                  data-testid="button-clear-filters"
                >
                  ফিল্টার মুছুন
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((ticket) => (
                <TicketResultCard
                  key={ticket.id}
                  ticket={ticket}
                  onSelect={() => handleSelectTicket(ticket)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-primary" />
              সিট নির্বাচন করুন
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh] p-6 pt-4">
            {selectedTicket && (
              <div className="space-y-6">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">{selectedTicket.coachName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedTicket.originCityBn} <ArrowRight className="h-3 w-3 inline mx-1" /> {selectedTicket.destinationCityBn}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{formatDateBangla(travelDate)}</p>
                        <p className="font-medium">
                          {formatTimeBangla(selectedTicket.departureTime)} - {formatTimeBangla(selectedTicket.arrivalTime)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <SeatPlanEngine
                  layout={selectedTicket.seatLayout}
                  baseFare={selectedTicket.fare}
                  busType={selectedTicket.busType}
                  mode="select"
                  selectedSeats={selectedSeats}
                  onSeatSelect={handleSeatSelect}
                  maxSelectable={5}
                />

                {selectedSeats.length > 0 && (
                  <Card className="bg-primary/10 border-primary">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">
                          নির্বাচিত সিট: {selectedSeats.length}টি
                        </span>
                        <span className="font-bold text-lg text-primary">
                          {formatCurrencyBangla(selectedSeats.length * selectedTicket.fare)}
                        </span>
                      </div>
                      <Button
                        className="w-full h-12"
                        onClick={handleConfirmBooking}
                        data-testid="button-confirm-booking"
                      >
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        বুকিং নিশ্চিত করুন
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketResultCard({
  ticket,
  onSelect,
}: {
  ticket: TicketResult;
  onSelect: () => void;
}) {
  const getBusTypeLabel = (type: BusTypeId) => {
    return BUS_TYPES.find((bt) => bt.id === type)?.label || type;
  };

  const isLowSeats = ticket.availableSeats <= 5;

  return (
    <Card
      className="hover-elevate cursor-pointer transition-all"
      onClick={onSelect}
      data-testid={`card-ticket-${ticket.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold" data-testid={`text-coach-${ticket.id}`}>
                {ticket.coachName}
              </h3>
              <Badge variant="outline" className="text-xs">
                {getBusTypeLabel(ticket.busType)}
              </Badge>
              {ticket.rating >= 4.5 && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  {ticket.rating}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <p className="font-bold text-lg">{formatTimeBangla(ticket.departureTime)}</p>
                  <p className="text-xs text-muted-foreground">{ticket.originCityBn}</p>
                </div>
                <div className="flex flex-col items-center px-4">
                  <div className="w-16 h-px bg-border relative">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-card px-1">
                      {ticket.duration}
                    </div>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground mt-1" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{formatTimeBangla(ticket.arrivalTime)}</p>
                  <p className="text-xs text-muted-foreground">{ticket.destinationCityBn}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ticket.amenities.slice(0, 3).map((amenity, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {amenity}
                </Badge>
              ))}
              {ticket.amenities.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{ticket.amenities.length - 3}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 md:border-l md:pl-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {formatCurrencyBangla(ticket.fare)}
              </p>
              <p className="text-xs text-muted-foreground">প্রতি সিট</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge
                variant={isLowSeats ? "destructive" : "outline"}
                className={cn(
                  "text-xs",
                  isLowSeats && "animate-pulse"
                )}
              >
                <Armchair className="h-3 w-3 mr-1" />
                {ticket.availableSeats} সিট বাকি
              </Badge>
              <Button size="sm" data-testid={`button-select-${ticket.id}`}>
                সিট দেখুন
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
