import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Copy,
  Car,
  Users,
  Loader2,
} from "lucide-react";

const vehicleSchema = z.object({
  vehicleType: z.enum(["car", "micro", "tourist_bus", "suv", "sedan"]),
  brand: z.string().min(2, "ব্র্যান্ড লিখুন"),
  model: z.string().min(1, "মডেল লিখুন"),
  registrationNumber: z.string().min(3, "রেজিস্ট্রেশন নম্বর লিখুন"),
  passengerCapacity: z.number().min(1, "যাত্রী ধারণক্ষমতা লিখুন"),
  pricePerDay: z.number().min(1, "প্রতিদিনের ভাড়া লিখুন"),
  pricePerHour: z.number().optional(),
});

type VehicleData = z.infer<typeof vehicleSchema>;

interface RentalVehicle {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  registrationNumber: string;
  passengerCapacity: number;
  pricePerDay: number;
  pricePerHour?: number;
  isActive: boolean;
  isAvailable: boolean;
  images?: string[];
  _count?: { bookings: number };
}

const vehicleTypeLabels: Record<string, string> = {
  car: "কার",
  micro: "মাইক্রো",
  tourist_bus: "ট্যুরিস্ট বাস",
  suv: "এসইউভি",
  sedan: "সেডান",
};

export default function TicketOperatorRentals() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ vehicles: RentalVehicle[] }>({
    queryKey: ["/api/ticket-operator/vehicles"],
  });

  const form = useForm<VehicleData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleType: "car",
      brand: "",
      model: "",
      registrationNumber: "",
      passengerCapacity: 4,
      pricePerDay: 0,
      pricePerHour: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VehicleData) => {
      return apiRequest("/api/ticket-operator/vehicles", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/vehicles"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "সফল!",
        description: "নতুন গাড়ি যোগ করা হয়েছে",
      });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "গাড়ি যোগ করা যায়নি",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/ticket-operator/vehicles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/vehicles"] });
    },
  });

  const handleSubmit = (data: VehicleData) => {
    createMutation.mutate(data);
  };

  const handleDuplicate = (vehicle: RentalVehicle) => {
    form.reset({
      vehicleType: vehicle.vehicleType as any,
      brand: vehicle.brand,
      model: vehicle.model,
      registrationNumber: "",
      passengerCapacity: vehicle.passengerCapacity,
      pricePerDay: vehicle.pricePerDay,
      pricePerHour: vehicle.pricePerHour || 0,
    });
    setIsDialogOpen(true);
  };

  const filteredVehicles = data?.vehicles?.filter(
    (vehicle) =>
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <h1 className="text-2xl font-bold" data-testid="text-page-title">রেন্টাল গাড়ি</h1>
            <p className="text-muted-foreground">আপনার গাড়ি পরিচালনা করুন</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-12" data-testid="button-add-vehicle">
                <Plus className="h-5 w-5 mr-2" />
                গাড়ি যোগ করুন
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>নতুন গাড়ি যোগ করুন</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>গাড়ির ধরণ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-type">
                              <SelectValue placeholder="গাড়ির ধরণ নির্বাচন করুন" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ব্র্যান্ড</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Toyota" 
                              className="h-12"
                              data-testid="input-brand"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>মডেল</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Hiace" 
                              className="h-12"
                              data-testid="input-model"
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
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>রেজিস্ট্রেশন নম্বর</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ঢাকা মেট্রো ১২-৩৪৫৬" 
                            className="h-12"
                            data-testid="input-registration"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="passengerCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>যাত্রী ধারণক্ষমতা</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="৪" 
                            className="h-12"
                            data-testid="input-capacity"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="pricePerDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>প্রতিদিন ভাড়া (৳)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="৫০০০" 
                              className="h-12"
                              data-testid="input-price-day"
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
                      name="pricePerHour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>প্রতি ঘণ্টা (ঐচ্ছিক)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="৫০০" 
                              className="h-12"
                              data-testid="input-price-hour"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
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
                      "গাড়ি যোগ করুন"
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
            placeholder="গাড়ি খুঁজুন..."
            className="pl-10 h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        {filteredVehicles?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">কোনো গাড়ি নেই</h3>
              <p className="text-sm text-muted-foreground mb-4">
                নতুন গাড়ি যোগ করে শুরু করুন
              </p>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first">
                <Plus className="h-4 w-4 mr-2" />
                গাড়ি যোগ করুন
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredVehicles?.map((vehicle) => (
              <Card key={vehicle.id} data-testid={`card-vehicle-${vehicle.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-primary" />
                        <h3 className="font-bold" data-testid={`text-vehicle-${vehicle.id}`}>
                          {vehicle.brand} {vehicle.model}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={vehicle.isActive ? "default" : "secondary"}>
                          {vehicle.isActive ? "চালু" : "বন্ধ"}
                        </Badge>
                        <Badge variant={vehicle.isAvailable ? "outline" : "destructive"}>
                          {vehicle.isAvailable ? "ফ্রি" : "বুকড"}
                        </Badge>
                        <Badge variant="outline">
                          {vehicleTypeLabels[vehicle.vehicleType] || vehicle.vehicleType}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {vehicle.passengerCapacity} জন
                        </span>
                        <span>{vehicle.registrationNumber}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-primary">
                          ৳{vehicle.pricePerDay.toLocaleString("bn-BD")}/দিন
                        </span>
                        {vehicle.pricePerHour && (
                          <span className="text-sm text-muted-foreground">
                            ৳{vehicle.pricePerHour.toLocaleString("bn-BD")}/ঘণ্টা
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={vehicle.isActive}
                        onCheckedChange={(checked) => 
                          toggleMutation.mutate({ id: vehicle.id, isActive: checked })
                        }
                        data-testid={`switch-status-${vehicle.id}`}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleDuplicate(vehicle)}
                        data-testid={`button-duplicate-${vehicle.id}`}
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
