import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Store, Truck, Clock, Camera, Loader2, Check } from "lucide-react";

const settingsSchema = z.object({
  shopName: z.string().min(2, "দোকানের নাম লিখুন"),
  shopAddress: z.string().min(5, "দোকানের ঠিকানা লিখুন"),
  deliveryEnabled: z.boolean(),
  deliveryRadius: z.number().min(1).max(20),
  preparationTime: z.number().min(5).max(120),
});

export default function ShopPartnerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
  });
  const profile = profileData?.profile;

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      shopName: "",
      shopAddress: "",
      deliveryEnabled: true,
      deliveryRadius: 5,
      preparationTime: 20,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        shopName: profile.shopName || "",
        shopAddress: profile.shopAddress || "",
        deliveryEnabled: profile.deliveryEnabled ?? true,
        deliveryRadius: profile.deliveryRadius || 5,
        preparationTime: profile.preparationTime || 20,
      });
    }
  }, [profile, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/shop-partner/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/profile"] });
      toast({
        title: "সফল!",
        description: "সেটিংস আপডেট হয়েছে।",
      });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "সেটিংস আপডেট ব্যর্থ হয়েছে।",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Store className="h-6 w-6 text-primary" />
                দোকানের তথ্য
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="shopName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">দোকানের নাম</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-12 text-base"
                        data-testid="input-shop-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shopAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">দোকানের ঠিকানা</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-20 text-base resize-none"
                        data-testid="input-shop-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label className="text-base mb-3 block">দোকানের লোগো</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                    {profile?.logoUrl ? (
                      <img
                        src={profile.logoUrl}
                        alt="Logo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Store className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    data-testid="button-change-logo"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    লোগো পরিবর্তন
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Truck className="h-6 w-6 text-primary" />
                ডেলিভারি সেটিংস
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="deliveryEnabled"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                      <div>
                        <FormLabel className="text-base font-semibold">
                          ঘরে ডেলিভারি
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          গ্রাহকদের বাসায় পণ্য পৌঁছে দিন
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-delivery"
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryRadius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">ডেলিভারি দূরত্ব</FormLabel>
                    <div className="grid grid-cols-3 gap-3">
                      {[3, 5, 10].map((km) => (
                        <Button
                          key={km}
                          type="button"
                          variant={field.value === km ? "default" : "outline"}
                          className="h-14 text-lg font-bold"
                          onClick={() => field.onChange(km)}
                          data-testid={`button-radius-${km}`}
                        >
                          {km} কি.মি.
                        </Button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preparationTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">অর্ডার প্রস্তুতির সময়</FormLabel>
                    <div className="grid grid-cols-3 gap-3">
                      {[10, 20, 30].map((min) => (
                        <Button
                          key={min}
                          type="button"
                          variant={field.value === min ? "default" : "outline"}
                          className="h-14 text-lg font-bold"
                          onClick={() => field.onChange(min)}
                          data-testid={`button-prep-${min}`}
                        >
                          {min} মিনিট
                        </Button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg"
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                সেভ করুন
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
