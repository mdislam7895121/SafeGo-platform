import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { apiRequest } from "@/lib/queryClient";
import {
  Store,
  MapPin,
  Camera,
  Truck,
  Package,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from "lucide-react";

const shopTypes = [
  { value: "grocery", label: "মুদিখানা", icon: "🛒" },
  { value: "mobile", label: "মোবাইল দোকান", icon: "📱" },
  { value: "cosmetics", label: "কসমেটিক্স", icon: "💄" },
  { value: "stationery", label: "স্টেশনারি", icon: "📚" },
  { value: "pharmacy", label: "ফার্মেসি", icon: "💊" },
  { value: "electronics", label: "ইলেকট্রনিক্স", icon: "🔌" },
  { value: "clothing", label: "পোশাক", icon: "👕" },
  { value: "food", label: "খাবার", icon: "🍽️" },
  { value: "hardware", label: "হার্ডওয়্যার", icon: "🔧" },
  { value: "other", label: "অন্যান্য", icon: "📦" },
];

const productCategories = [
  { value: "grocery", label: "মুদি সামগ্রী" },
  { value: "snacks", label: "স্ন্যাকস" },
  { value: "beverages", label: "পানীয়" },
  { value: "personal_care", label: "ব্যক্তিগত যত্ন" },
  { value: "household", label: "গৃহস্থালি" },
  { value: "electronics", label: "ইলেকট্রনিক্স" },
  { value: "clothing", label: "পোশাক" },
  { value: "medicine", label: "ওষুধ" },
  { value: "stationery", label: "স্টেশনারি" },
  { value: "other", label: "অন্যান্য" },
];

const step1Schema = z.object({
  shopName: z.string().min(2, "দোকানের নাম লিখুন"),
  shopType: z.string().min(1, "দোকানের ধরণ নির্বাচন করুন"),
  shopAddress: z.string().min(5, "দোকানের ঠিকানা লিখুন"),
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  phone: z.string().min(10, "সঠিক ফোন নম্বর লিখুন"),
});

const step2Schema = z.object({
  deliveryEnabled: z.boolean(),
  deliveryRadius: z.number().min(1).max(20),
  preparationTime: z.number().min(5).max(120),
});

const step3Schema = z.object({
  productName: z.string().min(2, "পণ্যের নাম লিখুন"),
  price: z.number().min(1, "সঠিক দাম লিখুন"),
  category: z.string().min(1, "ক্যাটাগরি নির্বাচন করুন"),
});

export default function ShopPartnerOnboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [shopData, setShopData] = useState<any>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const step1Form = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      shopName: "",
      shopType: "",
      shopAddress: "",
      ownerName: "",
      phone: "",
    },
  });

  const step2Form = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      deliveryEnabled: true,
      deliveryRadius: 5,
      preparationTime: 20,
    },
  });

  const step3Form = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      productName: "",
      price: 0,
      category: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/shop-partner/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/profile"] });
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/shop-partner/products", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/products"] });
      toast({
        title: "সফল!",
        description: "আপনার দোকান সেটআপ সম্পন্ন হয়েছে।",
      });
      navigate("/shop-partner");
    },
  });

  const handleStep1Submit = async (data: any) => {
    setShopData({ ...shopData, ...data });
    setStep(2);
  };

  const handleStep2Submit = async (data: any) => {
    const fullData = { ...shopData, ...data, countryCode: "BD" };
    try {
      await registerMutation.mutateAsync(fullData);
      setShopData(fullData);
      setStep(3);
    } catch (error: any) {
      toast({
        title: "ত্রুটি",
        description: error.message || "দোকান নিবন্ধন ব্যর্থ হয়েছে।",
        variant: "destructive",
      });
    }
  };

  const handleStep3Submit = async (data: any) => {
    try {
      await addProductMutation.mutateAsync(data);
    } catch (error: any) {
      toast({
        title: "ত্রুটি",
        description: error.message || "পণ্য যোগ করতে ব্যর্থ।",
        variant: "destructive",
      });
    }
  };

  const handleSkipProduct = () => {
    navigate("/shop-partner");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <Store className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">দোকান সেটআপ</h1>
          <p className="text-muted-foreground">
            মাত্র ৩ টি সহজ ধাপে আপনার দোকান চালু করুন
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center ${s < 3 ? "flex-1" : ""}`}
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  s < step
                    ? "bg-green-500 text-white"
                    : s === step
                    ? "bg-primary text-primary-foreground scale-110"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    s < step ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Store className="h-6 w-6 text-primary" />
                দোকানের তথ্য
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-5">
                  <FormField
                    control={step1Form.control}
                    name="ownerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">মালিকের নাম</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="আপনার নাম লিখুন"
                            className="h-12 text-base"
                            data-testid="input-owner-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">ফোন নম্বর</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            placeholder="০১XXXXXXXXX"
                            className="h-12 text-base"
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="shopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">দোকানের নাম</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="যেমন: রহিম স্টোর"
                            className="h-12 text-base"
                            data-testid="input-shop-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="shopType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">দোকানের ধরণ</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {shopTypes.map((type) => (
                            <Button
                              key={type.value}
                              type="button"
                              variant={field.value === type.value ? "default" : "outline"}
                              className="h-14 justify-start gap-3 text-base"
                              onClick={() => field.onChange(type.value)}
                              data-testid={`button-type-${type.value}`}
                            >
                              <span className="text-xl">{type.icon}</span>
                              {type.label}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="shopAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">দোকানের ঠিকানা</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="সম্পূর্ণ ঠিকানা লিখুন"
                            className="min-h-20 text-base resize-none"
                            data-testid="input-shop-address"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          গ্রাহকরা এই ঠিকানায় আপনার দোকান খুঁজে পাবেন
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label className="text-base mb-3 block">দোকানের লোগো (ঐচ্ছিক)</Label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <div className="h-20 w-20 rounded-xl overflow-hidden border-2 border-dashed">
                          <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-20 w-20 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/50">
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setLogoPreview(e.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        data-testid="button-upload-logo"
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        ছবি তুলুন
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 text-lg mt-6"
                    data-testid="button-next-step1"
                  >
                    পরবর্তী
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Truck className="h-6 w-6 text-primary" />
                প্রয়োজনীয় সেটিংস
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-6">
                  <FormField
                    control={step2Form.control}
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
                    control={step2Form.control}
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
                              className="h-16 text-xl font-bold"
                              onClick={() => field.onChange(km)}
                              data-testid={`button-radius-${km}`}
                            >
                              {km} কি.মি.
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          এই দূরত্বের মধ্যে থাকা গ্রাহকরা অর্ডার করতে পারবেন
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
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
                              className="h-16 text-xl font-bold"
                              onClick={() => field.onChange(min)}
                              data-testid={`button-prep-${min}`}
                            >
                              {min} মিনিট
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          অর্ডার আসলে কত সময়ে প্রস্তুত করতে পারবেন
                        </p>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-14 flex-1"
                      onClick={() => setStep(1)}
                      data-testid="button-back-step2"
                    >
                      <ChevronLeft className="h-5 w-5 mr-2" />
                      পিছনে
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="h-14 flex-1"
                      disabled={registerMutation.isPending}
                      data-testid="button-next-step2"
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          পরবর্তী
                          <ChevronRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Package className="h-6 w-6 text-primary" />
                প্রথম পণ্য যোগ করুন
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-5">
                  <FormField
                    control={step3Form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">পণ্যের নাম</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="যেমন: চিনি ১ কেজি"
                            className="h-12 text-base"
                            data-testid="input-product-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3Form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">দাম (৳)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                              ৳
                            </span>
                            <Input
                              {...field}
                              type="number"
                              placeholder="0"
                              className="h-14 text-2xl font-bold pl-10"
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              data-testid="input-product-price"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3Form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">ক্যাটাগরি</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base" data-testid="select-category">
                              <SelectValue placeholder="ক্যাটাগরি নির্বাচন করুন" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productCategories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value} className="text-base">
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label className="text-base mb-3 block">পণ্যের ছবি</Label>
                    <div className="flex items-center gap-4">
                      {productImagePreview ? (
                        <div className="h-24 w-24 rounded-xl overflow-hidden border-2 border-dashed">
                          <img src={productImagePreview} alt="Product" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-24 w-24 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/50">
                          <Camera className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14 text-base"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.capture = "environment";
                          input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setProductImagePreview(e.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        data-testid="button-upload-product-image"
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        ছবি তুলুন
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-lg"
                      disabled={addProductMutation.isPending}
                      data-testid="button-save-product"
                    >
                      {addProductMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-5 w-5 mr-2" />
                          সেভ করুন
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="w-full h-12"
                      onClick={handleSkipProduct}
                      data-testid="button-skip-product"
                    >
                      এখন না, পরে যোগ করব
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
