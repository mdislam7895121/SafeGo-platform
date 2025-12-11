import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { bn } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  MapPin,
  Clock,
  Armchair,
  User,
  Phone,
  Mail,
  CreditCard,
  Wallet,
  Smartphone,
  CheckCircle2,
  Shield,
  Loader2,
  Info,
  Receipt,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  formatCurrencyBangla,
  formatTimeBangla,
} from "@/lib/bd-ticket-types";

const passengerSchema = z.object({
  name: z.string().min(2, "যাত্রীর নাম লিখুন"),
  phone: z.string().min(11, "সঠিক মোবাইল নম্বর লিখুন"),
  email: z.string().email("সঠিক ইমেইল লিখুন").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]),
});

const bookingSchema = z.object({
  passengers: z.array(passengerSchema),
  paymentMethod: z.enum(["bkash", "nagad", "card", "cash"]),
  termsAccepted: z.boolean().refine((v) => v === true, "শর্তাবলী গ্রহণ করুন"),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface TicketInfo {
  id: string;
  coachName: string;
  operatorName: string;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  fare: number;
  seats: string[];
}

const PAYMENT_METHODS = [
  { id: "bkash", label: "বিকাশ", icon: Smartphone, color: "bg-pink-500" },
  { id: "nagad", label: "নগদ", icon: Smartphone, color: "bg-orange-500" },
  { id: "card", label: "কার্ড", icon: CreditCard, color: "bg-blue-500" },
  { id: "cash", label: "ক্যাশ অন বোর্ড", icon: Wallet, color: "bg-green-500" },
];

export default function TicketBookingPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "payment" | "confirm">("details");
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ticketId = params.get("ticketId");
    const seats = params.get("seats")?.split(",") || [];
    const date = params.get("date") || format(new Date(), "yyyy-MM-dd");
    const coach = params.get("coach") || "গ্রীনলাইন এক্সপ্রেস";
    const operator = params.get("operator") || "গ্রীনলাইন পরিবহন";
    const origin = params.get("origin") || "ঢাকা";
    const destination = params.get("destination") || "চট্টগ্রাম";
    const departure = params.get("departure") || "06:00";
    const arrival = params.get("arrival") || "12:00";
    const fare = parseInt(params.get("fare") || "1200");

    if (ticketId && seats.length > 0) {
      setTicketInfo({
        id: ticketId,
        coachName: coach,
        operatorName: operator,
        originCity: origin,
        destinationCity: destination,
        departureTime: departure,
        arrivalTime: arrival,
        date,
        fare,
        seats,
      });
    }
  }, [searchString]);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      passengers: ticketInfo?.seats.map(() => ({
        name: "",
        phone: "",
        email: "",
        gender: "male" as const,
      })) || [{ name: "", phone: "", email: "", gender: "male" as const }],
      paymentMethod: "bkash",
      termsAccepted: false,
    },
  });

  useEffect(() => {
    if (ticketInfo) {
      form.setValue(
        "passengers",
        ticketInfo.seats.map(() => ({
          name: "",
          phone: "",
          email: "",
          gender: "male" as const,
        }))
      );
    }
  }, [ticketInfo, form]);

  const formatDateBangla = (dateStr: string) => {
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return format(date, "EEEE, d MMMM yyyy", { locale: bn });
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = async (data: BookingFormData) => {
    if (!ticketInfo) return;
    
    setIsSubmitting(true);
    
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    toast({
      title: "বুকিং সফল!",
      description: "আপনার টিকিট বুক করা হয়েছে। SMS এ কনফার্মেশন পাঠানো হবে।",
    });
    
    const passengersWithSeats = data.passengers.map((p, i) => ({
      name: p.name,
      phone: p.phone,
      seat: ticketInfo.seats[i] || `S${i + 1}`,
    }));
    
    const queryParams = new URLSearchParams({
      bookingId: `BK${Date.now()}`,
      coach: ticketInfo.coachName,
      origin: ticketInfo.originCity,
      destination: ticketInfo.destinationCity,
      departure: ticketInfo.departureTime,
      arrival: ticketInfo.arrivalTime,
      date: ticketInfo.date,
      seats: ticketInfo.seats.join(","),
      fare: String(ticketInfo.fare),
      total: String(grandTotal),
      passengers: encodeURIComponent(JSON.stringify(passengersWithSeats)),
    });
    
    setLocation(`/bd/booking-success?${queryParams.toString()}`);
    setIsSubmitting(false);
  };

  const totalFare = ticketInfo ? ticketInfo.fare * ticketInfo.seats.length : 0;
  const serviceFee = Math.round(totalFare * 0.02);
  const grandTotal = totalFare + serviceFee;

  if (!ticketInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">কোনো টিকিট নির্বাচন করা হয়নি</h3>
            <p className="text-sm text-muted-foreground mb-4">
              প্রথমে টিকিট খুঁজুন এবং সিট নির্বাচন করুন
            </p>
            <Button onClick={() => setLocation("/bd/ticket-search")} data-testid="button-back-search">
              টিকিট খুঁজুন
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setLocation("/bd/ticket-search")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold" data-testid="text-page-title">বুকিং নিশ্চিত করুন</h1>
            <p className="text-sm text-primary-foreground/80">
              যাত্রী তথ্য ও পেমেন্ট
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      যাত্রী তথ্য
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {ticketInfo.seats.map((seat, index) => (
                      <div key={index} className="space-y-4">
                        {index > 0 && <Separator />}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">সিট {seat}</Badge>
                          <span className="text-sm text-muted-foreground">
                            যাত্রী {index + 1}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>নাম</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="যাত্রীর পুরো নাম"
                                    className="h-12"
                                    data-testid={`input-name-${index}`}
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
                                <FormLabel>মোবাইল</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="01XXXXXXXXX"
                                    className="h-12"
                                    data-testid={`input-phone-${index}`}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`passengers.${index}.gender`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>লিঙ্গ</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="flex gap-4"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="male" id={`male-${index}`} />
                                    <Label htmlFor={`male-${index}`}>পুরুষ</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="female" id={`female-${index}`} />
                                    <Label htmlFor={`female-${index}`}>মহিলা</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="other" id={`other-${index}`} />
                                    <Label htmlFor={`other-${index}`}>অন্যান্য</Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      পেমেন্ট পদ্ধতি
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-3"
                            >
                              {PAYMENT_METHODS.map((method) => (
                                <Label
                                  key={method.id}
                                  htmlFor={method.id}
                                  className={cn(
                                    "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all",
                                    field.value === method.id
                                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                                      : "hover-elevate"
                                  )}
                                >
                                  <RadioGroupItem
                                    value={method.id}
                                    id={method.id}
                                    className="sr-only"
                                  />
                                  <div className={cn("p-2 rounded-full text-white", method.color)}>
                                    <method.icon className="h-5 w-5" />
                                  </div>
                                  <span className="font-medium">{method.label}</span>
                                </Label>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("paymentMethod") === "bkash" && (
                      <div className="mt-4 p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg text-sm">
                        <p className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-pink-600" />
                          বিকাশ পেমেন্ট পেজে রিডাইরেক্ট করা হবে
                        </p>
                      </div>
                    )}

                    {form.watch("paymentMethod") === "nagad" && (
                      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-sm">
                        <p className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-orange-600" />
                          নগদ পেমেন্ট পেজে রিডাইরেক্ট করা হবে
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <FormField
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-terms"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              আমি SafeGo এর{" "}
                              <a href="#" className="text-primary underline">
                                শর্তাবলী
                              </a>{" "}
                              এবং{" "}
                              <a href="#" className="text-primary underline">
                                বাতিল নীতি
                              </a>{" "}
                              পড়েছি এবং সম্মত আছি
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg"
                  disabled={isSubmitting}
                  data-testid="button-confirm-booking"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      প্রসেসিং...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      {formatCurrencyBangla(grandTotal)} পেমেন্ট করুন
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  বুকিং সারাংশ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-bold">{ticketInfo.coachName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {ticketInfo.operatorName}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="text-center">
                    <p className="font-bold">{formatTimeBangla(ticketInfo.departureTime)}</p>
                    <p className="text-xs text-muted-foreground">{ticketInfo.originCity}</p>
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="flex-1 border-t border-dashed" />
                    <Bus className="h-4 w-4 mx-2 text-muted-foreground" />
                    <div className="flex-1 border-t border-dashed" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{formatTimeBangla(ticketInfo.arrivalTime)}</p>
                    <p className="text-xs text-muted-foreground">{ticketInfo.destinationCity}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDateBangla(ticketInfo.date)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ticketInfo.seats.map((seat) => (
                    <Badge key={seat} variant="secondary">
                      <Armchair className="h-3 w-3 mr-1" />
                      সিট {seat}
                    </Badge>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      টিকিট ভাড়া ({ticketInfo.seats.length} × {formatCurrencyBangla(ticketInfo.fare)})
                    </span>
                    <span>{formatCurrencyBangla(totalFare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">সার্ভিস ফি</span>
                    <span>{formatCurrencyBangla(serviceFee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>মোট</span>
                    <span className="text-primary">{formatCurrencyBangla(grandTotal)}</span>
                  </div>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    সুরক্ষিত পেমেন্ট এবং ফ্রি ক্যান্সেলেশন ২৪ ঘণ্টা আগে
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
