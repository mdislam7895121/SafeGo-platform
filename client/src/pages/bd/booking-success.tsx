import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import {
  CheckCircle2,
  Download,
  Share2,
  MessageCircle,
  Bus,
  Calendar,
  Clock,
  MapPin,
  Armchair,
  User,
  Phone,
  QrCode,
  ArrowRight,
  Home,
  Ticket,
} from "lucide-react";
import { formatCurrencyBangla, formatTimeBangla } from "@/lib/bd-ticket-types";

interface BookingDetails {
  bookingId: string;
  coachName: string;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  seats: string[];
  fare: number;
  totalPaid: number;
  passengers: Array<{ name: string; phone: string; seat: string }>;
  pnr: string;
}

export default function BookingSuccessPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [isAnimating, setIsAnimating] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const bookingId = params.get("bookingId") || `BK${Date.now()}`;
    const coachName = params.get("coach") || "গ্রীনলাইন এক্সপ্রেস";
    const origin = params.get("origin") || "ঢাকা";
    const destination = params.get("destination") || "চট্টগ্রাম";
    const departure = params.get("departure") || "06:00";
    const arrival = params.get("arrival") || "12:00";
    const dateParam = params.get("date") || format(new Date(), "yyyy-MM-dd");
    const seatsParam = params.get("seats")?.split(",") || ["A1"];
    const fareParam = parseInt(params.get("fare") || "1200");
    const totalParam = parseInt(params.get("total") || String(fareParam * seatsParam.length * 1.02));
    const passengersParam = params.get("passengers");
    
    let passengers: Array<{ name: string; phone: string; seat: string }> = [];
    if (passengersParam) {
      try {
        passengers = JSON.parse(decodeURIComponent(passengersParam));
      } catch {
        passengers = seatsParam.map((seat, i) => ({
          name: `যাত্রী ${i + 1}`,
          phone: "01XXXXXXXXX",
          seat,
        }));
      }
    } else {
      passengers = seatsParam.map((seat, i) => ({
        name: `যাত্রী ${i + 1}`,
        phone: "01XXXXXXXXX",
        seat,
      }));
    }

    setBookingDetails({
      bookingId,
      coachName,
      originCity: origin,
      destinationCity: destination,
      departureTime: departure,
      arrivalTime: arrival,
      date: dateParam,
      seats: seatsParam,
      fare: fareParam,
      totalPaid: totalParam,
      passengers,
      pnr: `PNR${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    });

    const timer = setTimeout(() => setIsAnimating(false), 1500);
    return () => clearTimeout(timer);
  }, [searchString]);

  const formatDateBangla = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE, d MMMM yyyy", { locale: bn });
    } catch {
      return dateStr;
    }
  };

  if (!bookingDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div
            className={cn(
              "inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4 transition-transform",
              isAnimating && "animate-bounce"
            )}
          >
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-success-title">
            বুকিং সফল!
          </h1>
          <p className="text-muted-foreground">
            আপনার টিকিট বুক করা হয়েছে
          </p>
        </div>

        <Card className="mb-4 overflow-hidden">
          <div className="bg-primary text-primary-foreground p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">বুকিং আইডি</p>
                <p className="font-bold">{bookingDetails.bookingId}</p>
              </div>
              <Badge variant="secondary" className="bg-white/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                কনফার্মড
              </Badge>
            </div>
          </div>

          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Bus className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-bold">{bookingDetails.coachName}</h3>
                <p className="text-sm text-muted-foreground">PNR: {bookingDetails.pnr}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="font-bold text-lg">
                  {formatTimeBangla(bookingDetails.departureTime)}
                </p>
                <p className="text-sm text-muted-foreground">{bookingDetails.originCity}</p>
              </div>
              <div className="flex-1 flex flex-col items-center px-4">
                <div className="w-full h-px bg-border relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg">
                  {formatTimeBangla(bookingDetails.arrivalTime)}
                </p>
                <p className="text-sm text-muted-foreground">{bookingDetails.destinationCity}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDateBangla(bookingDetails.date)}</span>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                যাত্রী তথ্য
              </h4>
              {bookingDetails.passengers.map((passenger, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      <Armchair className="h-3 w-3 mr-1" />
                      {passenger.seat}
                    </Badge>
                    <div>
                      <p className="font-medium">{passenger.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {passenger.phone}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">মোট পরিশোধিত</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrencyBangla(bookingDetails.totalPaid)}
              </span>
            </div>

            <div className="flex items-center justify-center p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <QrCode className="h-24 w-24 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">বোর্ডিংয়ে QR স্ক্যান করুন</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Button variant="outline" className="flex flex-col h-auto py-3" data-testid="button-download">
            <Download className="h-5 w-5 mb-1" />
            <span className="text-xs">ডাউনলোড</span>
          </Button>
          <Button variant="outline" className="flex flex-col h-auto py-3" data-testid="button-share">
            <Share2 className="h-5 w-5 mb-1" />
            <span className="text-xs">শেয়ার</span>
          </Button>
          <Button variant="outline" className="flex flex-col h-auto py-3" data-testid="button-whatsapp">
            <MessageCircle className="h-5 w-5 mb-1" />
            <span className="text-xs">WhatsApp</span>
          </Button>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg mb-6">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            গুরুত্বপূর্ণ তথ্য
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• আপনার মোবাইলে SMS এ টিকিট পাঠানো হয়েছে</li>
            <li>• বোর্ডিংয়ের ১৫ মিনিট আগে কাউন্টারে যান</li>
            <li>• জাতীয় পরিচয়পত্র/পাসপোর্ট সাথে রাখুন</li>
            <li>• ২৪ ঘণ্টা আগে বাতিল করলে ফুল রিফান্ড</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => setLocation("/")}
            data-testid="button-home"
          >
            <Home className="h-4 w-4 mr-2" />
            হোম
          </Button>
          <Button
            className="flex-1 h-12"
            onClick={() => setLocation("/bd/ticket-search")}
            data-testid="button-book-another"
          >
            <Ticket className="h-4 w-4 mr-2" />
            আরেকটি বুক করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
