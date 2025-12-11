import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bus,
  MapPin,
  Clock,
  Wallet,
  CalendarDays,
  Armchair,
  ArrowRight,
  Calculator,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import { RouteAutocomplete, PopularRoutes } from "./RouteAutocomplete";
import { SeatPlanEngine, SeatLayoutSelector } from "./SeatPlanEngine";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { getRouteDetails } from "@/lib/bd-routes";
import {
  BUS_TYPES,
  SEAT_LAYOUTS,
  PAYMENT_MODES,
  type BusTypeId,
  type SeatLayoutId,
  type PaymentModeId,
  type SeatState,
  type ScheduleTypeId,
  calculateFare,
  calculateCommission,
  getTotalSeats,
  formatCurrencyBangla,
  SAFEGO_COMMISSION_RATE,
} from "@/lib/bd-ticket-types";

const ticketFormSchema = z.object({
  coachName: z.string().min(2, "কোচের নাম লিখুন"),
  originCity: z.string().min(2, "শুরুর শহর নির্বাচন করুন"),
  destinationCity: z.string().min(2, "গন্তব্য শহর নির্বাচন করুন"),
  busType: z.string().min(1, "বাসের ধরন নির্বাচন করুন"),
  seatLayout: z.string().min(1, "সিট প্ল্যান নির্বাচন করুন"),
  baseFare: z.number().min(50, "সর্বনিম্ন ভাড়া ৫০ টাকা"),
  paymentMode: z.string().min(1, "পেমেন্ট মোড নির্বাচন করুন"),
});

type TicketFormData = z.infer<typeof ticketFormSchema>;

interface ScheduleConfig {
  type: ScheduleTypeId;
  startDate: Date;
  endDate?: Date;
  departureTime: string;
  arrivalTime: string;
  selectedDays: string[];
  repeatCount?: number;
}

interface TicketCreationFormProps {
  onSubmit: (data: any) => Promise<void>;
  isSubmitting?: boolean;
  initialData?: Partial<TicketFormData>;
  onCancel?: () => void;
}

export function TicketCreationForm({
  onSubmit,
  isSubmitting = false,
  initialData,
  onCancel,
}: TicketCreationFormProps) {
  const { toast } = useToast();
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    type: "single",
    startDate: new Date(),
    departureTime: "08:00",
    arrivalTime: "14:00",
    selectedDays: [],
  });
  const [seats, setSeats] = useState<SeatState[]>([]);
  const [calculatedFare, setCalculatedFare] = useState(0);
  const [commission, setCommission] = useState(0);
  const [operatorEarnings, setOperatorEarnings] = useState(0);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      coachName: initialData?.coachName || "",
      originCity: initialData?.originCity || "",
      destinationCity: initialData?.destinationCity || "",
      busType: initialData?.busType || "non_ac",
      seatLayout: initialData?.seatLayout || "2x2",
      baseFare: initialData?.baseFare || 500,
      paymentMode: initialData?.paymentMode || "both",
    },
  });

  const watchedBusType = form.watch("busType") as BusTypeId;
  const watchedBaseFare = form.watch("baseFare");
  const watchedSeatLayout = form.watch("seatLayout") as SeatLayoutId;

  useEffect(() => {
    const fare = calculateFare(watchedBaseFare || 0, watchedBusType);
    const comm = calculateCommission(fare);
    setCalculatedFare(fare);
    setCommission(comm);
    setOperatorEarnings(fare - comm);
  }, [watchedBaseFare, watchedBusType]);

  const handleFormSubmit = async (data: TicketFormData) => {
    const routeDetails = getRouteDetails(data.originCity, data.destinationCity);
    
    const fullData = {
      ...data,
      routeName: `${data.originCity} - ${data.destinationCity}`,
      schedule: scheduleConfig,
      seats,
      calculatedFare,
      commission,
      operatorEarnings,
      totalSeats: getTotalSeats(data.seatLayout as SeatLayoutId),
      routeDetails,
    };

    try {
      await onSubmit(fullData);
      toast({
        title: "সফল!",
        description: "টিকিট সফলভাবে তৈরি হয়েছে",
      });
    } catch (error: any) {
      toast({
        title: "ত্রুটি",
        description: error.message || "টিকিট তৈরি করা যায়নি",
        variant: "destructive",
      });
    }
  };

  const busTypeConfig = BUS_TYPES.find((bt) => bt.id === watchedBusType);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <Accordion type="multiple" defaultValue={["route", "coach", "schedule", "fare"]} className="space-y-4">
          <AccordionItem value="route" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="font-medium">রুট নির্বাচন</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="originCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>কোথা থেকে?</FormLabel>
                      <FormControl>
                        <RouteAutocomplete
                          type="origin"
                          value={field.value}
                          onChange={field.onChange}
                          testIdPrefix="create"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destinationCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>কোথায় যাবেন?</FormLabel>
                      <FormControl>
                        <RouteAutocomplete
                          type="destination"
                          value={field.value}
                          onChange={field.onChange}
                          originValue={form.watch("originCity")}
                          testIdPrefix="create"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <PopularRoutes
                onSelect={(from, to) => {
                  form.setValue("originCity", from);
                  form.setValue("destinationCity", to);
                }}
              />

              {form.watch("originCity") && form.watch("destinationCity") && (
                <div className="p-3 bg-primary/10 rounded-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {form.watch("originCity")} <ArrowRight className="h-4 w-4 inline mx-1" /> {form.watch("destinationCity")}
                  </span>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="coach" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Bus className="h-5 w-5 text-primary" />
                <span className="font-medium">কোচ ও সিট তথ্য</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              <FormField
                control={form.control}
                name="coachName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>কোচের নাম</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="যেমন: গ্রীনলাইন এক্সপ্রেস"
                        className="h-12"
                        data-testid="input-coach-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="busType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>বাসের ধরন</FormLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {BUS_TYPES.map((type) => (
                        <Button
                          key={type.id}
                          type="button"
                          variant={field.value === type.id ? "default" : "outline"}
                          className={cn(
                            "h-auto py-3 flex flex-col gap-1",
                            field.value === type.id && "ring-2 ring-primary"
                          )}
                          onClick={() => field.onChange(type.id)}
                          data-testid={`bus-type-${type.id}`}
                        >
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs opacity-70">
                            ×{type.fareMultiplier.toFixed(1)}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seatLayout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>সিট প্ল্যান</FormLabel>
                    <SeatLayoutSelector
                      value={field.value as SeatLayoutId}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SeatPlanEngine
                layout={watchedSeatLayout}
                baseFare={watchedBaseFare || 0}
                busType={watchedBusType}
                seats={seats}
                onSeatsChange={setSeats}
                mode="edit"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="schedule" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <span className="font-medium">সময়সূচী</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <ScheduleBuilder
                value={scheduleConfig}
                onChange={setScheduleConfig}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="fare" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="font-medium">ভাড়া ও পেমেন্ট</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="baseFare"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>বেস ভাড়া (নন-এসি)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            ৳
                          </span>
                          <Input
                            type="number"
                            min={50}
                            className="h-12 pl-8"
                            data-testid="input-base-fare"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {busTypeConfig && busTypeConfig.id !== "non_ac" && (
                          <span className="flex items-center gap-1">
                            <Calculator className="h-3 w-3" />
                            {busTypeConfig.label} গুণক: ×{busTypeConfig.fareMultiplier}
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>পেমেন্ট মোড</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-12" data-testid="select-payment-mode">
                          <SelectValue placeholder="পেমেন্ট মোড নির্বাচন করুন" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_MODES.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    ভাড়া হিসাব
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">বেস ভাড়া:</span>
                      <span>{formatCurrencyBangla(watchedBaseFare || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">গুণক ({busTypeConfig?.label}):</span>
                      <span>×{busTypeConfig?.fareMultiplier || 1}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>চূড়ান্ত ভাড়া:</span>
                      <span className="text-primary">{formatCurrencyBangla(calculatedFare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">মোট সিট:</span>
                      <span>{getTotalSeats(watchedSeatLayout)}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        SafeGo কমিশন ({(SAFEGO_COMMISSION_RATE * 100).toFixed(0)}%):
                      </span>
                      <span className="text-destructive">-{formatCurrencyBangla(commission)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>আপনার আয় (প্রতি সিট):</span>
                      <span className="text-green-600">{formatCurrencyBangla(operatorEarnings)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>সম্ভাব্য মোট আয় (সব সিট বিক্রি):</span>
                      <span>{formatCurrencyBangla(operatorEarnings * getTotalSeats(watchedSeatLayout))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={onCancel}
              data-testid="button-cancel"
            >
              বাতিল
            </Button>
          )}
          <Button
            type="submit"
            className="h-12 flex-1"
            disabled={isSubmitting}
            data-testid="button-create-ticket"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                প্রসেসিং...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                টিকিট তৈরি করুন
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
