import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ShoppingCart,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TripSummaryCard, type TripDetails } from "@/components/bd-ticket/TripSummaryCard";
import { SeatMap, generateDemoSeats } from "@/components/bd-ticket/SeatMap";
import {
  BUS_TYPES,
  SEAT_LAYOUTS,
  formatCurrencyBangla,
  type SeatState,
  type BusTypeId,
  type SeatLayoutId,
} from "@/lib/bd-ticket-types";
import { format } from "date-fns";

const BD_TICKET_DEMO_MODE = true;

const DEMO_TRIPS: Record<string, TripDetails> = {
  demo1: {
    tripId: "demo1",
    operatorName: "গ্রীনলাইন পরিবহন",
    coachName: "গ্রীনলাইন এক্সপ্রেস",
    originCity: "Dhaka",
    originCityBn: "ঢাকা",
    destinationCity: "Chattogram",
    destinationCityBn: "চট্টগ্রাম",
    departureTime: "06:00",
    arrivalTime: "12:00",
    duration: "৬ ঘণ্টা",
    travelDate: format(new Date(), "yyyy-MM-dd"),
    busType: "ac",
    seatLayout: "2x2",
    farePerSeat: 1200,
    totalSeats: 40,
    availableSeats: 28,
    amenities: ["AC", "WiFi", "USB চার্জিং"],
    rating: 4.5,
  },
  demo2: {
    tripId: "demo2",
    operatorName: "শ্যামলী পরিবহন",
    coachName: "শ্যামলী সুপার",
    originCity: "Dhaka",
    originCityBn: "ঢাকা",
    destinationCity: "Chattogram",
    destinationCityBn: "চট্টগ্রাম",
    departureTime: "08:30",
    arrivalTime: "14:30",
    duration: "৬ ঘণ্টা",
    travelDate: format(new Date(), "yyyy-MM-dd"),
    busType: "ac_business",
    seatLayout: "2x1",
    farePerSeat: 1500,
    totalSeats: 30,
    availableSeats: 22,
    amenities: ["AC", "WiFi", "USB চার্জিং", "স্ন্যাকস"],
    rating: 4.8,
  },
  demo3: {
    tripId: "demo3",
    operatorName: "হানিফ এন্টারপ্রাইজ",
    coachName: "হানিফ ডিলাক্স স্লিপার",
    originCity: "Dhaka",
    originCityBn: "ঢাকা",
    destinationCity: "Sylhet",
    destinationCityBn: "সিলেট",
    departureTime: "22:00",
    arrivalTime: "06:00",
    duration: "৮ ঘণ্টা",
    travelDate: format(new Date(), "yyyy-MM-dd"),
    busType: "sleeper",
    seatLayout: "1x1_sleeper",
    farePerSeat: 2000,
    totalSeats: 20,
    availableSeats: 14,
    amenities: ["AC", "বালিশ ও কম্বল", "পর্দা"],
    rating: 4.6,
  },
  demo4: {
    tripId: "demo4",
    operatorName: "এনা পরিবহন",
    coachName: "এনা ডাবল ডেকার",
    originCity: "Dhaka",
    originCityBn: "ঢাকা",
    destinationCity: "Rajshahi",
    destinationCityBn: "রাজশাহী",
    departureTime: "07:00",
    arrivalTime: "13:00",
    duration: "৬ ঘণ্টা",
    travelDate: format(new Date(), "yyyy-MM-dd"),
    busType: "ac",
    seatLayout: "double_decker",
    farePerSeat: 900,
    totalSeats: 70,
    availableSeats: 55,
    amenities: ["AC", "WiFi"],
    rating: 4.3,
  },
};

export default function SeatSelectPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null);
  const [seats, setSeats] = useState<SeatState[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tripId = params.get("tripId") || "demo1";
    const dateParam = params.get("date");
    const originParam = params.get("origin");
    const destinationParam = params.get("destination");
    const coachParam = params.get("coach");
    const fareParam = params.get("fare");
    const layoutParam = params.get("layout") as SeatLayoutId | null;
    const busTypeParam = params.get("busType") as BusTypeId | null;

    setIsLoading(true);

    setTimeout(() => {
      if (BD_TICKET_DEMO_MODE) {
        let trip = DEMO_TRIPS[tripId] || DEMO_TRIPS.demo1;

        if (originParam) trip = { ...trip, originCityBn: originParam };
        if (destinationParam) trip = { ...trip, destinationCityBn: destinationParam };
        if (dateParam) trip = { ...trip, travelDate: dateParam };
        if (coachParam) trip = { ...trip, coachName: coachParam };
        if (fareParam) trip = { ...trip, farePerSeat: parseInt(fareParam) };
        if (layoutParam) trip = { ...trip, seatLayout: layoutParam };
        if (busTypeParam) trip = { ...trip, busType: busTypeParam };

        setTripDetails(trip);

        const demoSeats = generateDemoSeats(trip.seatLayout, trip.farePerSeat, 0.2);
        setSeats(demoSeats);
      } else {
        setTripDetails(DEMO_TRIPS.demo1);
        setSeats(generateDemoSeats("2x2", 1200, 0.15));
      }

      setIsLoading(false);
    }, 800);
  }, [searchString]);

  const handleSeatToggle = (seatId: string) => {
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((id) => id !== seatId);
      }
      if (prev.length >= 10) {
        toast({
          title: "সর্বোচ্চ সীমা",
          description: "একবারে সর্বোচ্চ ১০টি সিট নির্বাচন করা যাবে",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, seatId];
    });
  };

  const totalFare = useMemo(() => {
    if (!tripDetails) return 0;
    return selectedSeats.length * tripDetails.farePerSeat;
  }, [selectedSeats, tripDetails]);

  const handleCheckout = () => {
    if (!tripDetails || selectedSeats.length === 0) return;

    setIsSubmitting(true);

    const selectedSeatNumbers = selectedSeats
      .map((id) => seats.find((s) => s.id === id)?.seatNumber)
      .filter(Boolean)
      .join(",");

    const queryParams = new URLSearchParams({
      tripId: tripDetails.tripId,
      coach: tripDetails.coachName,
      operator: tripDetails.operatorName,
      origin: tripDetails.originCityBn,
      destination: tripDetails.destinationCityBn,
      departure: tripDetails.departureTime,
      arrival: tripDetails.arrivalTime,
      seats: selectedSeatNumbers,
      fare: String(tripDetails.farePerSeat),
      date: tripDetails.travelDate,
      total: String(totalFare),
      layout: tripDetails.seatLayout,
      busType: tripDetails.busType,
    });

    setTimeout(() => {
      setLocation(`/tickets/bd/checkout?${queryParams.toString()}`);
    }, 500);
  };

  const handleBack = () => {
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">ট্রিপ তথ্য লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!tripDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">ট্রিপ পাওয়া যায়নি</h2>
            <p className="text-muted-foreground text-sm">
              অনুগ্রহ করে আবার চেষ্টা করুন অথবা অন্য ট্রিপ খুঁজুন।
            </p>
            <Button onClick={() => setLocation("/bd/ticket-search")} data-testid="button-search-again">
              টিকিট খুঁজুন
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg flex-1 text-center">সিট নির্বাচন</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <TripSummaryCard
          trip={tripDetails}
          selectedSeatsCount={selectedSeats.length}
          totalFare={totalFare}
        />

        <SeatMap
          seatLayout={tripDetails.seatLayout}
          seats={seats}
          selectedSeats={selectedSeats}
          onSeatSelect={handleSeatToggle}
          farePerSeat={tripDetails.farePerSeat}
          maxSeats={10}
        />

        <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t -mx-4 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              {selectedSeats.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {selectedSeats.length}টি সিট নির্বাচিত
                  </p>
                  <p className="text-xl font-bold text-primary" data-testid="text-checkout-total">
                    {formatCurrencyBangla(totalFare)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  অনুগ্রহ করে সিট নির্বাচন করুন
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="h-12 px-8 gap-2"
              disabled={selectedSeats.length === 0 || isSubmitting}
              onClick={handleCheckout}
              data-testid="button-checkout"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  চেকআউটে যান
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
