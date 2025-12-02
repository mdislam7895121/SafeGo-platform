import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  MapPin,
  ArrowRight,
  Calendar,
  Clock,
  Bus,
  Users,
  Wifi,
  Snowflake,
  Plug,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUS_TYPES,
  SEAT_LAYOUTS,
  formatCurrencyBangla,
  formatTimeBangla,
  type BusTypeId,
  type SeatLayoutId,
} from "@/lib/bd-ticket-types";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

export interface TripDetails {
  tripId: string;
  operatorName: string;
  operatorLogo?: string;
  coachName: string;
  originCity: string;
  originCityBn: string;
  destinationCity: string;
  destinationCityBn: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  travelDate: string;
  busType: BusTypeId;
  seatLayout: SeatLayoutId;
  farePerSeat: number;
  totalSeats: number;
  availableSeats: number;
  amenities?: string[];
  rating?: number;
  busImage?: string;
}

interface TripSummaryCardProps {
  trip: TripDetails;
  selectedSeatsCount?: number;
  totalFare?: number;
  className?: string;
}

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  wifi: Wifi,
  ac: Snowflake,
  usb: Plug,
  snacks: Coffee,
};

export function TripSummaryCard({
  trip,
  selectedSeatsCount = 0,
  totalFare,
  className,
}: TripSummaryCardProps) {
  const busTypeConfig = BUS_TYPES.find((bt) => bt.id === trip.busType);
  const seatLayoutConfig = SEAT_LAYOUTS.find((sl) => sl.id === trip.seatLayout);

  const formatDateBangla = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE, d MMMM yyyy", { locale: bn });
    } catch {
      return dateStr;
    }
  };

  const busImageUrl = trip.busImage || `https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=200&fit=crop`;

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="card-trip-summary">
      <div className="relative h-32 md:h-40 overflow-hidden">
        <img
          src={busImageUrl}
          alt={trip.coachName}
          className="w-full h-full object-cover"
          data-testid="img-bus"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10 border-2 border-white">
              {trip.operatorLogo ? (
                <AvatarImage src={trip.operatorLogo} alt={trip.operatorName} />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {trip.operatorName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="text-white">
              <p className="font-semibold text-sm" data-testid="text-operator-name">
                {trip.operatorName}
              </p>
              <p className="text-xs opacity-90" data-testid="text-coach-name">
                {trip.coachName}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                trip.busType === "ac" && "bg-blue-500 text-white",
                trip.busType === "ac_business" && "bg-purple-500 text-white",
                trip.busType === "vip" && "bg-amber-500 text-white",
                trip.busType === "sleeper" && "bg-indigo-500 text-white",
                trip.busType === "non_ac" && "bg-gray-500 text-white"
              )}
              data-testid="badge-bus-type"
            >
              {busTypeConfig?.label || trip.busType}
            </Badge>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>যাত্রাপথ:</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <span data-testid="text-origin">{trip.originCityBn}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-destination">{trip.destinationCityBn}</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary" data-testid="text-fare">
                {formatCurrencyBangla(trip.farePerSeat)}
              </p>
              <p className="text-xs text-muted-foreground">প্রতি সিট</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2" data-testid="info-date">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">তারিখ:</p>
              <p className="font-medium" data-testid="text-travel-date">
                {formatDateBangla(trip.travelDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="info-time">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">সময়:</p>
              <p className="font-medium" data-testid="text-time">
                {formatTimeBangla(trip.departureTime)} - {formatTimeBangla(trip.arrivalTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="info-layout">
            <Bus className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">সিট লেআউট</p>
              <p className="font-medium" data-testid="text-seat-layout">
                {seatLayoutConfig?.label || trip.seatLayout}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="info-seats">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">খালি সিট</p>
              <p className="font-medium" data-testid="text-available-seats">
                <span className="text-primary">{trip.availableSeats}</span>/{trip.totalSeats}টি
              </p>
            </div>
          </div>
        </div>

        {trip.amenities && trip.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trip.amenities.map((amenity, index) => {
              const amenityKey = amenity.toLowerCase().replace(/\s+/g, "");
              const IconComponent = AMENITY_ICONS[amenityKey] || Bus;
              return (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs gap-1"
                  data-testid={`badge-amenity-${index}`}
                >
                  <IconComponent className="h-3 w-3" />
                  {amenity}
                </Badge>
              );
            })}
          </div>
        )}

        {selectedSeatsCount > 0 && (
          <div className="pt-3 border-t flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                নির্বাচিত সিট: <span className="font-semibold text-foreground">{selectedSeatsCount}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">মোট ভাড়া</p>
              <p className="text-xl font-bold text-primary" data-testid="text-total-fare">
                {formatCurrencyBangla(totalFare || trip.farePerSeat * selectedSeatsCount)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
