import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Edit,
  Copy,
  Bus,
  Train,
  MapPin,
  Clock,
  Users,
  Loader2,
  ArrowLeftRight,
  ArrowRight,
} from "lucide-react";
import {
  RouteAutocomplete,
  PopularRoutes,
  CreateReverseRouteButton,
} from "@/components/bd/RouteAutocomplete";
import { getRouteDetails } from "@/lib/bd-routes";
import { searchBanglaWithFuzzy } from "@/lib/bangla-fuzzy";

const ticketSchema = z.object({
  routeName: z.string().min(2, "রুটের নাম লিখুন"),
  vehicleType: z.enum(["bus", "coach", "ac_bus", "train"]),
  originCity: z.string().min(2, "শুরুর শহর লিখুন"),
  destinationCity: z.string().min(2, "গন্তব্য শহর লিখুন"),
  departureTime: z.string().min(1, "ছাড়ার সময় লিখুন"),
  arrivalTime: z.string().min(1, "পৌঁছানোর সময় লিখুন"),
  basePrice: z.number().min(1, "সঠিক ভাড়া লিখুন"),
  totalSeats: z.number().min(1, "আসন সংখ্যা লিখুন"),
});

type TicketData = z.infer<typeof ticketSchema>;

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
  isActive: boolean;
  _count?: { bookings: number };
}

const vehicleTypeLabels: Record<string, string> = {
  bus: "বাস",
  coach: "কোচ",
  ac_bus: "এসি বাস",
  train: "ট্রেন",
};

export default function TicketOperatorTickets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketListing | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ listings: TicketListing[] }>({
    queryKey: ["/api/ticket-operator/tickets"],
  });

  const form = useForm<TicketData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      routeName: "",
      vehicleType: "bus",
      originCity: "",
      destinationCity: "",
      departureTime: "",
      arrivalTime: "",
      basePrice: 0,
      totalSeats: 40,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TicketData) => {
      return apiRequest("/api/ticket-operator/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/tickets"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "সফল!",
        description: "নতুন টিকিট যোগ করা হয়েছে",
      });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "টিকিট যোগ করা যায়নি",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/ticket-operator/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/tickets"] });
    },
  });

  const handleSubmit = (data: TicketData) => {
    createMutation.mutate(data);
  };

  const handleDuplicate = (ticket: TicketListing) => {
    form.reset({
      routeName: `${ticket.routeName} (কপি)`,
      vehicleType: ticket.vehicleType as any,
      originCity: ticket.originCity,
      destinationCity: ticket.destinationCity,
      departureTime: ticket.departureTime,
      arrivalTime: ticket.arrivalTime,
      basePrice: ticket.basePrice,
      totalSeats: ticket.totalSeats,
    });
    setIsDialogOpen(true);
  };

  const filteredTickets = searchQuery.trim()
    ? searchBanglaWithFuzzy(
        data?.listings || [],
        searchQuery,
        (ticket) => [ticket.routeName, ticket.originCity, ticket.destinationCity],
        0.4
      )
    : data?.listings;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">টিকিট ম্যানেজমেন্ট</h1>
            <p className="text-muted-foreground">আপনার রুট ও টিকিট পরিচালনা করুন</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-12" data-testid="button-add-ticket">
                <Plus className="h-5 w-5 mr-2" />
                টিকিট যোগ করুন
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>নতুন টিকিট যোগ করুন</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="routeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>রুটের নাম</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ঢাকা - চট্টগ্রাম এক্সপ্রেস" 
                            className="h-12"
                            data-testid="input-route-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name="originCity"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>শুরু (কোথা থেকে?)</FormLabel>
                            <FormControl>
                              <RouteAutocomplete
                                type="origin"
                                value={field.value}
                                onChange={(value) => {
                                  field.onChange(value);
                                  const dest = form.getValues("destinationCity");
                                  if (value && dest) {
                                    const routeInfo = getRouteDetails(value, dest);
                                    if (routeInfo) {
                                      form.setValue("routeName", `${routeInfo.fromBn} - ${routeInfo.toBn}`);
                                    }
                                  }
                                }}
                                testIdPrefix="ticket"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 mb-0.5"
                        onClick={() => {
                          const origin = form.getValues("originCity");
                          const dest = form.getValues("destinationCity");
                          form.setValue("originCity", dest);
                          form.setValue("destinationCity", origin);
                          if (dest && origin) {
                            form.setValue("routeName", `${dest} - ${origin}`);
                          }
                        }}
                        data-testid="button-swap-cities"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>

                      <FormField
                        control={form.control}
                        name="destinationCity"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>গন্তব্য (কোথায় যাবেন?)</FormLabel>
                            <FormControl>
                              <RouteAutocomplete
                                type="destination"
                                value={field.value}
                                onChange={(value) => {
                                  field.onChange(value);
                                  const origin = form.getValues("originCity");
                                  if (origin && value) {
                                    const routeInfo = getRouteDetails(origin, value);
                                    if (routeInfo) {
                                      form.setValue("routeName", `${routeInfo.fromBn} - ${routeInfo.toBn}`);
                                    }
                                  }
                                }}
                                originValue={form.watch("originCity")}
                                testIdPrefix="ticket"
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
                        form.setValue("routeName", `${from} - ${to}`);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departureTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ছাড়ার সময়</FormLabel>
                          <FormControl>
                            <Input 
                              type="time"
                              className="h-12"
                              data-testid="input-departure"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="arrivalTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>পৌঁছানোর সময়</FormLabel>
                          <FormControl>
                            <Input 
                              type="time"
                              className="h-12"
                              data-testid="input-arrival"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="basePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ভাড়া (৳)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="৫০০" 
                              className="h-12"
                              data-testid="input-price"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="totalSeats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>আসন সংখ্যা</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="৪০" 
                              className="h-12"
                              data-testid="input-seats"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12"
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "টিকিট যোগ করুন"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="রুট খুঁজুন..."
            className="pl-10 h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        {filteredTickets?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">কোনো টিকিট নেই</h3>
              <p className="text-sm text-muted-foreground mb-4">
                নতুন টিকিট যোগ করে শুরু করুন
              </p>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first">
                <Plus className="h-4 w-4 mr-2" />
                টিকিট যোগ করুন
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets?.map((ticket) => (
              <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold" data-testid={`text-route-${ticket.id}`}>
                          {ticket.routeName}
                        </h3>
                        <Badge variant={ticket.isActive ? "default" : "secondary"}>
                          {ticket.isActive ? "চালু" : "বন্ধ"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {ticket.originCity} → {ticket.destinationCity}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {ticket.departureTime} - {ticket.arrivalTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {ticket.availableSeats}/{ticket.totalSeats} আসন
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-primary">
                          ৳{ticket.basePrice.toLocaleString("bn-BD")}
                        </span>
                        <Badge variant="outline">
                          {vehicleTypeLabels[ticket.vehicleType] || ticket.vehicleType}
                        </Badge>
                        {ticket._count?.bookings && ticket._count.bookings > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {ticket._count.bookings} বুকিং
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ticket.isActive}
                        onCheckedChange={(checked) => 
                          toggleMutation.mutate({ id: ticket.id, isActive: checked })
                        }
                        data-testid={`switch-status-${ticket.id}`}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => {
                          form.reset({
                            routeName: `${ticket.destinationCity} - ${ticket.originCity}`,
                            vehicleType: ticket.vehicleType as any,
                            originCity: ticket.destinationCity,
                            destinationCity: ticket.originCity,
                            departureTime: ticket.departureTime,
                            arrivalTime: ticket.arrivalTime,
                            basePrice: ticket.basePrice,
                            totalSeats: ticket.totalSeats,
                          });
                          setIsDialogOpen(true);
                        }}
                        title="রিভার্স রুট তৈরি করুন"
                        data-testid={`button-reverse-${ticket.id}`}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleDuplicate(ticket)}
                        data-testid={`button-duplicate-${ticket.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
