import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  Banknote,
  User,
  Phone,
  MapPin,
  ArrowRight,
  Calendar,
  Clock,
  Bus,
  Armchair,
  Loader2,
  CheckCircle2,
  Shield,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUS_TYPES,
  formatCurrencyBangla,
  formatTimeBangla,
  type BusTypeId,
  type SeatLayoutId,
} from "@/lib/bd-ticket-types";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

interface TripInfo {
  tripId: string;
  coachName: string;
  operatorName: string;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  seats: string[];
  fare: number;
  total: number;
  layout: SeatLayoutId;
  busType: BusTypeId;
}

interface PassengerInfo {
  name: string;
  phone: string;
  nid?: string;
}

const passengerSchema = z.object({
  name: z.string().min(3, "নাম কমপক্ষে ৩ অক্ষরের হতে হবে"),
  phone: z.string().regex(/^01[3-9]\d{8}$/, "সঠিক মোবাইল নম্বর দিন"),
  nid: z.string().optional(),
});

const checkoutSchema = z.object({
  passengers: z.array(passengerSchema).min(1),
  paymentMethod: z.enum(["bkash", "nagad", "card", "cash"]),
  contactPhone: z.string().regex(/^01[3-9]\d{8}$/, "সঠিক মোবাইল নম্বর দিন"),
  contactEmail: z.string().email("সঠিক ইমেইল দিন").optional().or(z.literal("")),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const PAYMENT_METHODS = [
  { id: "bkash", label: "বিকাশ", icon: Smartphone, color: "bg-pink-500" },
  { id: "nagad", label: "নগদ", icon: Smartphone, color: "bg-orange-500" },
  { id: "card", label: "কার্ড", icon: CreditCard, color: "bg-blue-500" },
  { id: "cash", label: "ক্যাশ অন ডেলিভারি", icon: Banknote, color: "bg-green-500" },
] as const;

export default function TicketCheckoutPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"passengers" | "payment" | "confirm">("passengers");

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      passengers: [],
      paymentMethod: "bkash",
      contactPhone: "",
      contactEmail: "",
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const seatsParam = params.get("seats")?.split(",") || [];
    
    if (seatsParam.length === 0) {
      toast({
        title: "ত্রুটি",
        description: "কোন সিট নির্বাচন করা হয়নি",
        variant: "destructive",
      });
      setLocation("/bd/ticket-search");
      return;
    }

    const info: TripInfo = {
      tripId: params.get("tripId") || "",
      coachName: params.get("coach") || "অজানা",
      operatorName: params.get("operator") || "অজানা",
      originCity: params.get("origin") || "ঢাকা",
      destinationCity: params.get("destination") || "চট্টগ্রাম",
      departureTime: params.get("departure") || "06:00",
      arrivalTime: params.get("arrival") || "12:00",
      date: params.get("date") || format(new Date(), "yyyy-MM-dd"),
      seats: seatsParam,
      fare: parseInt(params.get("fare") || "1000"),
      total: parseInt(params.get("total") || "0"),
      layout: (params.get("layout") as SeatLayoutId) || "2x2",
      busType: (params.get("busType") as BusTypeId) || "ac",
    };

    if (info.total === 0) {
      info.total = info.fare * info.seats.length;
    }

    setTripInfo(info);

    const defaultPassengers = seatsParam.map(() => ({
      name: "",
      phone: "",
      nid: "",
    }));
    form.setValue("passengers", defaultPassengers);
  }, [searchString, form, toast, setLocation]);

  const formatDateBangla = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE, d MMMM yyyy", { locale: bn });
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = async (data: CheckoutFormData) => {
    if (!tripInfo) return;

    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const passengersWithSeats = data.passengers.map((p, i) => ({
      name: p.name,
      phone: p.phone,
      seat: tripInfo.seats[i] || `S${i + 1}`,
    }));

    const queryParams = new URLSearchParams({
      bookingId: `BK${Date.now()}`,
      coach: tripInfo.coachName,
      origin: tripInfo.originCity,
      destination: tripInfo.destinationCity,
      departure: tripInfo.departureTime,
      arrival: tripInfo.arrivalTime,
      date: tripInfo.date,
      seats: tripInfo.seats.join(","),
      fare: String(tripInfo.fare),
      total: String(tripInfo.total),
      passengers: encodeURIComponent(JSON.stringify(passengersWithSeats)),
    });

    toast({
      title: "বুকিং সফল!",
      description: "আপনার টিকিট বুক করা হয়েছে। SMS এ কনফার্মেশন পাঠানো হবে।",
    });

    setLocation(`/bd/booking-success?${queryParams.toString()}`);
    setIsSubmitting(false);
  };

  const handleBack = () => {
    if (step === "payment") {
      setStep("passengers");
    } else if (step === "confirm") {
      setStep("payment");
    } else {
      window.history.back();
    }
  };

  const handleNextStep = () => {
    if (step === "passengers") {
      const passengers = form.getValues("passengers");
      const hasValidPassengers = passengers.every(
        (p) => p.name.length >= 3 && /^01[3-9]\d{8}$/.test(p.phone)
      );
      if (!hasValidPassengers) {
        toast({
          title: "তথ্য অসম্পূর্ণ",
          description: "সকল যাত্রীর নাম ও সঠিক মোবাইল নম্বর দিন",
          variant: "destructive",
        });
        return;
      }
      setStep("payment");
    } else if (step === "payment") {
      const contactPhone = form.getValues("contactPhone");
      if (!/^01[3-9]\d{8}$/.test(contactPhone)) {
        toast({
          title: "মোবাইল নম্বর প্রয়োজন",
          description: "সঠিক যোগাযোগ নম্বর দিন",
          variant: "destructive",
        });
        return;
      }
      setStep("confirm");
    }
  };

  const busTypeLabel = BUS_TYPES.find((bt) => bt.id === tripInfo?.busType)?.label || tripInfo?.busType;
  const serviceFee = tripInfo ? Math.round(tripInfo.total * 0.02) : 0;
  const grandTotal = tripInfo ? tripInfo.total + serviceFee : 0;

  if (!tripInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">তথ্য লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">চেকআউট</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={step === "passengers" ? "text-primary font-medium" : ""}>
                যাত্রী তথ্য
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className={step === "payment" ? "text-primary font-medium" : ""}>
                পেমেন্ট
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className={step === "confirm" ? "text-primary font-medium" : ""}>
                নিশ্চিত
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6 pb-32">
        <Card data-testid="card-trip-summary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span data-testid="text-route">
                    {tripInfo.originCity} <ArrowRight className="inline h-3 w-3" /> {tripInfo.destinationCity}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateBangla(tripInfo.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeBangla(tripInfo.departureTime)}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" data-testid="badge-bus-type">
                {busTypeLabel}
              </Badge>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-muted-foreground" />
                <span>{tripInfo.coachName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Armchair className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-seats">
                  সিট: {tripInfo.seats.join(", ")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {step === "passengers" && (
              <Card data-testid="card-passengers">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    যাত্রী তথ্য
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {tripInfo.seats.map((seat, index) => (
                    <div key={seat} className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">যাত্রী {index + 1}</Label>
                        <Badge variant="outline" data-testid={`badge-seat-${seat}`}>
                          সিট: {seat}
                        </Badge>
                      </div>

                      <FormField
                        control={form.control}
                        name={`passengers.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>নাম *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="যাত্রীর পূর্ণ নাম"
                                className="h-12"
                                data-testid={`input-passenger-name-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`passengers.${index}.phone`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>মোবাইল *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="01XXXXXXXXX"
                                className="h-12"
                                data-testid={`input-passenger-phone-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {step === "payment" && (
              <Card data-testid="card-payment">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    পেমেন্ট তথ্য
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>যোগাযোগ নম্বর *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="01XXXXXXXXX"
                            className="h-12"
                            data-testid="input-contact-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>পেমেন্ট পদ্ধতি</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-2 gap-3"
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <Label
                                key={method.id}
                                htmlFor={`payment-${method.id}`}
                                className={cn(
                                  "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                                  field.value === method.id
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover-elevate"
                                )}
                              >
                                <RadioGroupItem
                                  value={method.id}
                                  id={`payment-${method.id}`}
                                  data-testid={`radio-payment-${method.id}`}
                                />
                                <div className={cn("p-2 rounded-full text-white", method.color)}>
                                  <method.icon className="h-4 w-4" />
                                </div>
                                <span className="font-medium">{method.label}</span>
                              </Label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {step === "confirm" && (
              <div className="space-y-4">
                <Card data-testid="card-confirm-passengers">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">যাত্রী তথ্য</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {form.getValues("passengers").map((passenger, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium">{passenger.name}</p>
                          <p className="text-sm text-muted-foreground">{passenger.phone}</p>
                        </div>
                        <Badge variant="outline">সিট: {tripInfo.seats[index]}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card data-testid="card-payment-summary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">পেমেন্ট সারাংশ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>টিকিট মূল্য ({tripInfo.seats.length}টি সিট)</span>
                      <span>{formatCurrencyBangla(tripInfo.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>সার্ভিস চার্জ</span>
                      <span>{formatCurrencyBangla(serviceFee)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>সর্বমোট</span>
                      <span className="text-primary text-lg" data-testid="text-grand-total">
                        {formatCurrencyBangla(grandTotal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Shield className="h-4 w-4" />
                      <span>আপনার পেমেন্ট সুরক্ষিত</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </form>
        </Form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4">
        <div className="container mx-auto max-w-2xl flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">সর্বমোট</p>
            <p className="text-xl font-bold text-primary" data-testid="text-footer-total">
              {formatCurrencyBangla(grandTotal)}
            </p>
          </div>
          {step !== "confirm" ? (
            <Button
              type="button"
              size="lg"
              className="h-12 px-8"
              onClick={handleNextStep}
              data-testid="button-next"
            >
              পরবর্তী
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              className="h-12 px-8"
              disabled={isSubmitting}
              onClick={form.handleSubmit(handleSubmit)}
              data-testid="button-confirm-booking"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  বুকিং নিশ্চিত করুন
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
