import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/contexts/AuthContext";
import {
  Store,
  MapPin,
  Camera,
  Truck,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ShoppingCart,
  Smartphone,
  Sparkles,
  BookOpen,
  Pill,
  Plug,
  Shirt,
  UtensilsCrossed,
  Wrench,
  Box,
  LucideIcon,
  User,
  IdCard,
  Phone,
  LogOut,
  Clock,
  AlertCircle,
} from "lucide-react";

const STORAGE_KEY = "safego_shop_partner_onboarding";

const shopTypes: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "grocery", label: "মুদিখানা", icon: ShoppingCart },
  { value: "electronics", label: "ইলেকট্রনিক্স", icon: Plug },
  { value: "fashion", label: "পোশাক", icon: Shirt },
  { value: "pharmacy", label: "ফার্মেসি", icon: Pill },
  { value: "general_store", label: "জেনারেল স্টোর", icon: Store },
  { value: "hardware", label: "হার্ডওয়্যার", icon: Wrench },
  { value: "beauty", label: "কসমেটিক্স", icon: Sparkles },
  { value: "books", label: "স্টেশনারি", icon: BookOpen },
  { value: "sports", label: "স্পোর্টস", icon: Box },
  { value: "other", label: "অন্যান্য", icon: Box },
];

const step1Schema = z.object({
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  fatherName: z.string().min(2, "পিতার নাম লিখুন"),
  dateOfBirth: z.string().min(1, "জন্ম তারিখ নির্বাচন করুন"),
  presentAddress: z.string().min(5, "বর্তমান ঠিকানা লিখুন"),
  permanentAddress: z.string().min(5, "স্থায়ী ঠিকানা লিখুন"),
  nidNumber: z.string().min(10, "সঠিক জাতীয় পরিচয়পত্র নম্বর লিখুন"),
  emergencyContactName: z.string().min(2, "জরুরি যোগাযোগের নাম লিখুন"),
  emergencyContactPhone: z.string().min(10, "জরুরি যোগাযোগের ফোন নম্বর লিখুন"),
});

const step2Schema = z.object({
  deliveryEnabled: z.boolean(),
  deliveryRadius: z.number().min(1).max(20),
  preparationTime: z.number().min(5).max(120),
});

const step3Schema = z.object({
  shopName: z.string().min(2, "দোকানের নাম লিখুন"),
  shopType: z.string().min(1, "দোকানের ধরণ নির্বাচন করুন"),
  shopAddress: z.string().min(5, "দোকানের ঠিকানা লিখুন"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

interface OnboardingState {
  step1?: Step1Data;
  step2?: Step2Data;
  step3?: Step3Data;
  currentStep: number;
}

function loadSavedState(): OnboardingState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to load saved onboarding state");
  }
  return { currentStep: 1 };
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save onboarding state");
  }
}

function clearSavedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear onboarding state");
  }
}

function OnboardingHeader() {
  const { logout } = useAuth();
  
  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-header-title">
            দোকান পার্টনার সেটআপ
          </h1>
          <p className="text-xs text-muted-foreground">SafeGo Bangladesh</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

function PendingReviewScreen({ profile }: { profile: any }) {
  const status = profile?.verificationStatus;
  
  const statusConfig = {
    pending: {
      icon: Clock,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      title: "আবেদন পর্যালোচনাধীন",
      description: "আপনার আবেদন সফলভাবে জমা হয়েছে। আমরা শীঘ্রই আপনার আবেদন পর্যালোচনা করব। সাধারণত ২৪-৪৮ ঘণ্টার মধ্যে সম্পন্ন হয়।",
    },
    under_review: {
      icon: Clock,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      title: "পর্যালোচনা চলছে",
      description: "আপনার আবেদন এখন পর্যালোচনা করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।",
    },
    rejected: {
      icon: AlertCircle,
      iconColor: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      title: "প্রত্যাখ্যাত",
      description: profile?.rejectionReason || "আপনার আবেদন প্রত্যাখ্যান করা হয়েছে।",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-3.5rem)]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${config.bgColor}`}>
              <Icon className={`h-10 w-10 ${config.iconColor}`} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold" data-testid="text-status-title">
                {config.title}
              </h1>
              <p className="text-muted-foreground" data-testid="text-status-description">
                {config.description}
              </p>
            </div>

            {profile && (
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">দোকান নাম:</span>
                  <span className="font-medium" data-testid="text-shop-name">
                    {profile.shopName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">স্ট্যাটাস:</span>
                  <span className={`font-medium ${config.iconColor}`} data-testid="text-status">
                    {status === "pending" ? "অপেক্ষমান" :
                     status === "under_review" ? "পর্যালোচনা" : "প্রত্যাখ্যাত"}
                  </span>
                </div>
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full h-12 text-base"
              onClick={() => window.location.reload()}
              data-testid="button-refresh"
            >
              স্ট্যাটাস রিফ্রেশ করুন
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ShopPartnerOnboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const savedState = loadSavedState();
  const [step, setStep] = useState(savedState.currentStep);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(savedState.step1 || null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(savedState.step2 || null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: profileData, isLoading: profileLoading, isError, error } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
    enabled: !!user && (user.role === "shop_partner" || user.role === "pending_shop_partner"),
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30000,
  });

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: savedState.step1 || {
      ownerName: "",
      fatherName: "",
      dateOfBirth: "",
      presentAddress: "",
      permanentAddress: "",
      nidNumber: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: savedState.step2 || {
      deliveryEnabled: true,
      deliveryRadius: 5,
      preparationTime: 20,
    },
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: savedState.step3 || {
      shopName: "",
      shopType: "",
      shopAddress: "",
    },
  });

  useEffect(() => {
    const state: OnboardingState = {
      step1: step1Data || undefined,
      step2: step2Data || undefined,
      currentStep: step,
    };
    saveState(state);
  }, [step, step1Data, step2Data]);

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/shop-partner/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-partner/profile"] });
      clearSavedState();
    },
  });

  if (profileLoading && !isError) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-profile" />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorStatus = (error as any)?.status;
    if (errorStatus === 401 || errorStatus === 403) {
      console.warn("[ShopPartnerOnboarding] Auth error, redirecting to login");
      return <Redirect to="/login" />;
    }
  }

  const profile = profileData?.profile;
  const hasProfile = !isError && !!profile;
  const status = profile?.verificationStatus;

  if (hasProfile && status === "approved") {
    clearSavedState();
    return <Redirect to="/shop-partner/dashboard" />;
  }

  if (hasProfile && (status === "pending" || status === "under_review" || status === "rejected")) {
    return <PendingReviewScreen profile={profile} />;
  }

  const handleStep1Submit = async (data: Step1Data) => {
    setStep1Data(data);
    setStep(2);
    toast({
      title: "সফল!",
      description: "ব্যক্তিগত তথ্য সংরক্ষিত হয়েছে",
    });
  };

  const handleStep2Submit = async (data: Step2Data) => {
    if (!step1Data) {
      toast({
        title: "ত্রুটি",
        description: "প্রথমে ধাপ ১ সম্পূর্ণ করুন",
        variant: "destructive",
      });
      setStep(1);
      return;
    }
    setStep2Data(data);
    setStep(3);
    toast({
      title: "সফল!",
      description: "ডেলিভারি সেটিংস সংরক্ষিত হয়েছে",
    });
  };

  const handleStep3Submit = async (data: Step3Data) => {
    if (!step1Data) {
      toast({
        title: "ত্রুটি",
        description: "প্রথমে ধাপ ১ সম্পূর্ণ করুন",
        variant: "destructive",
      });
      setStep(1);
      return;
    }
    if (!step2Data) {
      toast({
        title: "ত্রুটি",
        description: "প্রথমে ধাপ ২ সম্পূর্ণ করুন",
        variant: "destructive",
      });
      setStep(2);
      return;
    }

    const fullData = {
      ...step1Data,
      ...data,
      deliveryRadiusKm: step2Data.deliveryRadius,
      openingTime: "09:00",
      closingTime: "21:00",
      countryCode: "BD",
    };

    try {
      await registerMutation.mutateAsync(fullData);
      toast({
        title: "আবেদন জমা হয়েছে!",
        description: "আপনার দোকান আবেদন পর্যালোচনার জন্য পাঠানো হয়েছে",
      });
      navigate("/shop-partner/setup");
    } catch (error: any) {
      const errorMessage = error.message || "দোকান নিবন্ধন ব্যর্থ হয়েছে";
      toast({
        title: "ত্রুটি",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleBack = (targetStep: number) => {
    setStep(targetStep);
  };

  const isPending = registerMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />
      <div className="p-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
              <Store className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-title">
              দোকান পার্টনার সেটআপ
            </h1>
            <p className="text-muted-foreground">
              মাত্র ৩টি ধাপে আপনার দোকান চালু করুন
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex items-center ${s < 3 ? "flex-1" : ""}`}>
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                    s < step
                      ? "bg-green-500 text-white"
                      : s === step
                      ? "bg-primary text-primary-foreground scale-110"
                      : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`step-indicator-${s}`}
                >
                  {s < step ? <Check className="h-5 w-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 rounded ${s < step ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <User className="h-6 w-6 text-primary" />
                  ধাপ ১: ব্যক্তিগত তথ্য ও KYC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...step1Form}>
                  <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
                    <FormField
                      control={step1Form.control}
                      name="ownerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">মালিকের নাম *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="আপনার পূর্ণ নাম"
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
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">পিতার নাম *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="পিতার পূর্ণ নাম"
                              className="h-12 text-base"
                              data-testid="input-father-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">জন্ম তারিখ *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              className="h-12 text-base"
                              data-testid="input-dob"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="nidNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base flex items-center gap-2">
                            <IdCard className="h-4 w-4" />
                            জাতীয় পরিচয়পত্র নম্বর *
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="১০-১৭ সংখ্যার NID নম্বর"
                              className="h-12 text-base"
                              data-testid="input-nid"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="presentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">বর্তমান ঠিকানা *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="সম্পূর্ণ বর্তমান ঠিকানা"
                              className="min-h-20 text-base resize-none"
                              data-testid="input-present-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="permanentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">স্থায়ী ঠিকানা *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="সম্পূর্ণ স্থায়ী ঠিকানা"
                              className="min-h-20 text-base resize-none"
                              data-testid="input-permanent-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-4">জরুরি যোগাযোগ</p>
                      
                      <div className="grid gap-4">
                        <FormField
                          control={step1Form.control}
                          name="emergencyContactName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base">জরুরি যোগাযোগের নাম *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="জরুরি যোগাযোগের নাম"
                                  className="h-12 text-base"
                                  data-testid="input-emergency-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={step1Form.control}
                          name="emergencyContactPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                জরুরি যোগাযোগের ফোন *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="tel"
                                  placeholder="০১XXXXXXXXX"
                                  className="h-12 text-base"
                                  data-testid="input-emergency-phone"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                  ধাপ ২: ডেলিভারি সেটিংস
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
                        onClick={() => handleBack(1)}
                        data-testid="button-back-step2"
                      >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        পিছনে
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        className="h-14 flex-1"
                        data-testid="button-next-step2"
                      >
                        পরবর্তী
                        <ChevronRight className="h-5 w-5 ml-2" />
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
                  <Store className="h-6 w-6 text-primary" />
                  ধাপ ৩: দোকানের তথ্য
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...step3Form}>
                  <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-5">
                    <FormField
                      control={step3Form.control}
                      name="shopName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">দোকানের নাম *</FormLabel>
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
                      control={step3Form.control}
                      name="shopType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">দোকানের ধরণ *</FormLabel>
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
                                <type.icon className="h-5 w-5" />
                                {type.label}
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step3Form.control}
                      name="shopAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">দোকানের ঠিকানা *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="সম্পূর্ণ দোকানের ঠিকানা"
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
                      <p className="text-base font-medium mb-3">দোকানের লোগো (ঐচ্ছিক)</p>
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

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-14 flex-1"
                        onClick={() => handleBack(2)}
                        data-testid="button-back-step3"
                      >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        পিছনে
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        className="h-14 flex-1"
                        disabled={isPending}
                        data-testid="button-submit"
                      >
                        {isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            আবেদন জমা দিন
                            <Check className="h-5 w-5 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
