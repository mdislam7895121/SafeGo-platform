import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link, Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Building2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Ticket,
  Car,
  Bus,
  Train,
  LucideIcon,
  LogOut,
  Clock,
  FileCheck,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const operatorTypes: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "ticket", label: "শুধু টিকিট", icon: Ticket },
  { value: "rental", label: "শুধু রেন্টাল", icon: Car },
  { value: "both", label: "টিকিট ও রেন্টাল", icon: Bus },
];

const vehicleTypes: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "bus", label: "বাস", icon: Bus },
  { value: "coach", label: "কোচ", icon: Bus },
  { value: "ac_bus", label: "এসি বাস", icon: Bus },
  { value: "train", label: "ট্রেন", icon: Train },
];

const rentalVehicleTypes: { value: string; label: string }[] = [
  { value: "car", label: "কার" },
  { value: "micro", label: "মাইক্রো" },
  { value: "tourist_bus", label: "ট্যুরিস্ট বাস" },
  { value: "suv", label: "এসইউভি" },
  { value: "sedan", label: "সেডান" },
];

const step1Schema = z.object({
  operatorName: z.string().min(2, "অপারেটরের নাম লিখুন"),
  operatorType: z.enum(["ticket", "rental", "both"]),
  officeAddress: z.string().min(5, "অফিসের ঠিকানা লিখুন"),
  officePhone: z.string().min(10, "সঠিক ফোন নম্বর লিখুন"),
  officeEmail: z.string().email("সঠিক ইমেইল লিখুন").optional().or(z.literal("")),
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  fatherName: z.string().min(2, "পিতার নাম লিখুন"),
  dateOfBirth: z.string().min(1, "জন্ম তারিখ লিখুন"),
  presentAddress: z.string().min(5, "বর্তমান ঠিকানা লিখুন"),
  permanentAddress: z.string().min(5, "স্থায়ী ঠিকানা লিখুন"),
  nidNumber: z.string().min(10, "সঠিক এনআইডি নম্বর লিখুন"),
  emergencyContactName: z.string().min(2, "জরুরি যোগাযোগের নাম লিখুন"),
  emergencyContactPhone: z.string().min(10, "জরুরি যোগাযোগের ফোন লিখুন"),
});

const step2Schema = z.object({
  routeName: z.string().min(2, "রুটের নাম লিখুন"),
  vehicleType: z.enum(["bus", "coach", "ac_bus", "train"]),
  originCity: z.string().min(2, "শুরুর শহর লিখুন"),
  destinationCity: z.string().min(2, "গন্তব্য শহর লিখুন"),
  departureTime: z.string().min(1, "ছাড়ার সময় লিখুন"),
  arrivalTime: z.string().min(1, "পৌঁছানোর সময় লিখুন"),
  basePrice: z.number().min(1, "সঠিক ভাড়া লিখুন"),
  totalSeats: z.number().min(1, "আসন সংখ্যা লিখুন"),
});

const step3Schema = z.object({
  vehicleType: z.enum(["car", "micro", "tourist_bus", "suv", "sedan"]),
  brand: z.string().min(2, "ব্র্যান্ড লিখুন"),
  model: z.string().min(1, "মডেল লিখুন"),
  registrationNumber: z.string().min(3, "রেজিস্ট্রেশন নম্বর লিখুন"),
  passengerCapacity: z.number().min(1, "যাত্রী ধারণক্ষমতা লিখুন"),
  pricePerDay: z.number().min(1, "প্রতিদিনের ভাড়া লিখুন"),
  pricePerHour: z.number().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

function OnboardingHeader() {
  const { logout } = useAuth();
  
  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-header-title">
            টিকিট ও রেন্টাল অপারেটর
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

function PendingReviewScreen({ operator }: { operator: any }) {
  const status = operator?.verificationStatus;
  
  const statusConfig = {
    pending: {
      icon: Clock,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      title: "আবেদন পর্যালোচনাধীন",
      description: "আপনার আবেদন সফলভাবে জমা হয়েছে। আমরা শীঘ্রই আপনার আবেদন পর্যালোচনা করব। সাধারণত ২৪-৪৮ ঘণ্টার মধ্যে সম্পন্ন হয়।",
    },
    under_review: {
      icon: FileCheck,
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
      description: operator?.rejectionReason || "আপনার আবেদন প্রত্যাখ্যান করা হয়েছে।",
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

            {operator && (
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">অপারেটর নাম:</span>
                  <span className="font-medium" data-testid="text-operator-name">
                    {operator.operatorName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ধরণ:</span>
                  <span className="font-medium" data-testid="text-operator-type">
                    {operator.operatorType === "ticket" ? "টিকিট" : 
                     operator.operatorType === "rental" ? "রেন্টাল" : "টিকিট ও রেন্টাল"}
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

            <div className="space-y-3">
              <Link href="/">
                <Button variant="outline" className="w-full h-12 text-base" data-testid="button-home">
                  হোমে ফিরে যান
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function TicketOperatorOnboarding() {
  const [step, setStep] = useState(1);
  const [operatorData, setOperatorData] = useState<Step1Data | null>(null);
  const [ticketData, setTicketData] = useState<Step2Data | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: profileData, isLoading: profileLoading } = useQuery<{ operator: any }>({
    queryKey: ["/api/ticket-operator/profile"],
    enabled: !!user && user.role === "ticket_operator",
    retry: false,
  });

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      operatorName: "",
      operatorType: "both",
      officeAddress: "",
      officePhone: "",
      officeEmail: "",
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

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
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

  const registerMutation = useMutation({
    mutationFn: async (data: Step1Data) => {
      return apiRequest("/api/ticket-operator/register", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          description: `${data.operatorName} - টিকিট ও রেন্টাল সার্ভিস`,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/profile"] });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: Step2Data) => {
      return apiRequest("/api/ticket-operator/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: Step3Data) => {
      return apiRequest("/api/ticket-operator/vehicles", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-profile" />
        </div>
      </div>
    );
  }

  const operator = profileData?.operator;
  const hasProfile = !!operator;
  const status = operator?.verificationStatus;

  if (hasProfile && status === "approved") {
    return <Redirect to="/ticket-operator/dashboard" />;
  }

  if (hasProfile && (status === "pending" || status === "under_review" || status === "rejected")) {
    return <PendingReviewScreen operator={operator} />;
  }

  const handleStep1Submit = async (data: Step1Data) => {
    try {
      await registerMutation.mutateAsync(data);
      setOperatorData(data);
      
      if (data.operatorType === "rental") {
        setStep(3);
      } else {
        setStep(2);
      }
      
      toast({
        title: "সফল!",
        description: "অপারেটর তথ্য সংরক্ষিত হয়েছে",
      });
    } catch (error: any) {
      toast({
        title: "ত্রুটি",
        description: error.message || "রেজিস্ট্রেশন ব্যর্থ হয়েছে",
        variant: "destructive",
      });
    }
  };

  const handleStep2Submit = async (data: Step2Data) => {
    setTicketData(data);
    
    if (operatorData?.operatorType === "both") {
      setStep(3);
    } else {
      await handleComplete();
    }
  };

  const handleStep3Submit = async (data: Step3Data) => {
    await handleComplete();
  };

  const handleComplete = async () => {
    toast({
      title: "আবেদন জমা হয়েছে!",
      description: "আপনার আবেদন পর্যালোচনার জন্য পাঠানো হয়েছে",
    });
    
    queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/profile"] });
    navigate("/ticket-operator/setup");
  };

  const handleSkipTicket = () => {
    if (operatorData?.operatorType === "both") {
      setStep(3);
    } else {
      handleComplete();
    }
  };

  const handleSkipRental = () => {
    handleComplete();
  };

  const totalSteps = operatorData?.operatorType === "both" ? 3 : 
                     operatorData?.operatorType === "ticket" ? 2 : 2;

  const isPending = registerMutation.isPending || createTicketMutation.isPending || createVehicleMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />
      <div className="p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold" data-testid="text-title">
              টিকিট ও রেন্টাল অপারেটর সেটআপ
            </h1>
            <p className="text-muted-foreground">
              আপনার ব্যবসা SafeGo-তে যোগ করুন
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3].slice(0, totalSteps || 3).map((s) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
                data-testid={`step-indicator-${s}`}
              />
            ))}
          </div>

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  ধাপ ১: অপারেটরের তথ্য
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...step1Form}>
                  <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
                    <FormField
                      control={step1Form.control}
                      name="operatorType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>অপারেটরের ধরণ</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            {operatorTypes.map((type) => (
                              <Button
                                key={type.value}
                                type="button"
                                variant={field.value === type.value ? "default" : "outline"}
                                className="h-14 flex-col gap-1"
                                onClick={() => field.onChange(type.value)}
                                data-testid={`button-type-${type.value}`}
                              >
                                <type.icon className="h-5 w-5" />
                                <span className="text-xs">{type.label}</span>
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step1Form.control}
                        name="operatorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>অপারেটরের নাম</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="যেমন: গ্রীন লাইন পরিবহন" 
                                className="h-12"
                                data-testid="input-operator-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={step1Form.control}
                        name="ownerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>মালিকের নাম</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="আপনার পূর্ণ নাম" 
                                className="h-12"
                                data-testid="input-owner-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step1Form.control}
                        name="fatherName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>পিতার নাম</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="পিতার পূর্ণ নাম" 
                                className="h-12"
                                data-testid="input-father-name"
                                {...field} 
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
                            <FormLabel>জন্ম তারিখ</FormLabel>
                            <FormControl>
                              <Input 
                                type="date"
                                className="h-12"
                                data-testid="input-dob"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={step1Form.control}
                      name="officeAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>অফিসের ঠিকানা</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="সম্পূর্ণ অফিস ঠিকানা" 
                              className="min-h-[80px]"
                              data-testid="input-office-address"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step1Form.control}
                        name="officePhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>অফিস ফোন</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="০১XXXXXXXXX" 
                                className="h-12"
                                data-testid="input-office-phone"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={step1Form.control}
                        name="officeEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>অফিস ইমেইল (ঐচ্ছিক)</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="email@example.com" 
                                className="h-12"
                                data-testid="input-office-email"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={step1Form.control}
                      name="presentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>বর্তমান ঠিকানা</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="আপনার বর্তমান ঠিকানা" 
                              className="min-h-[80px]"
                              data-testid="input-present-address"
                              {...field} 
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
                          <FormLabel>স্থায়ী ঠিকানা</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="আপনার স্থায়ী ঠিকানা" 
                              className="min-h-[80px]"
                              data-testid="input-permanent-address"
                              {...field} 
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
                          <FormLabel>এনআইডি নম্বর</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="জাতীয় পরিচয়পত্র নম্বর" 
                              className="h-12"
                              data-testid="input-nid"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step1Form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>জরুরি যোগাযোগ (নাম)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="জরুরি যোগাযোগের নাম" 
                                className="h-12"
                                data-testid="input-emergency-name"
                                {...field} 
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
                            <FormLabel>জরুরি যোগাযোগ (ফোন)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="০১XXXXXXXXX" 
                                className="h-12"
                                data-testid="input-emergency-phone"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-14 text-lg"
                      disabled={isPending}
                      data-testid="button-next-step1"
                    >
                      {isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          পরবর্তী ধাপ
                          <ChevronRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  ধাপ ২: টিকিট সেটআপ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...step2Form}>
                  <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-4">
                    <FormField
                      control={step2Form.control}
                      name="vehicleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>গাড়ির ধরণ</FormLabel>
                          <div className="grid grid-cols-4 gap-2">
                            {vehicleTypes.map((type) => (
                              <Button
                                key={type.value}
                                type="button"
                                variant={field.value === type.value ? "default" : "outline"}
                                className="h-14 flex-col gap-1"
                                onClick={() => field.onChange(type.value)}
                                data-testid={`button-vehicle-${type.value}`}
                              >
                                <type.icon className="h-5 w-5" />
                                <span className="text-xs">{type.label}</span>
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step2Form.control}
                      name="routeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>রুটের নাম</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="যেমন: ঢাকা-চট্টগ্রাম এক্সপ্রেস" 
                              className="h-12"
                              data-testid="input-route-name"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step2Form.control}
                        name="originCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>শুরুর শহর</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="যেমন: ঢাকা" 
                                className="h-12"
                                data-testid="input-origin"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={step2Form.control}
                        name="destinationCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>গন্তব্য শহর</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="যেমন: চট্টগ্রাম" 
                                className="h-12"
                                data-testid="input-destination"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step2Form.control}
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
                        control={step2Form.control}
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

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step2Form.control}
                        name="basePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ভাড়া (টাকা)</FormLabel>
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
                        control={step2Form.control}
                        name="totalSeats"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>মোট আসন</FormLabel>
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

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12"
                        onClick={() => setStep(1)}
                        data-testid="button-back-step2"
                      >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        পিছনে
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 h-12"
                        disabled={isPending}
                        data-testid="button-next-step2"
                      >
                        {isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : operatorData?.operatorType === "both" ? (
                          <>
                            পরবর্তী ধাপ
                            <ChevronRight className="h-5 w-5 ml-2" />
                          </>
                        ) : (
                          "সম্পন্ন করুন"
                        )}
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={handleSkipTicket}
                      data-testid="button-skip-ticket"
                    >
                      পরে যোগ করব
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  ধাপ ৩: রেন্টাল গাড়ি সেটআপ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...step3Form}>
                  <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-4">
                    <FormField
                      control={step3Form.control}
                      name="vehicleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>গাড়ির ধরণ</FormLabel>
                          <div className="grid grid-cols-5 gap-2">
                            {rentalVehicleTypes.map((type) => (
                              <Button
                                key={type.value}
                                type="button"
                                variant={field.value === type.value ? "default" : "outline"}
                                className="h-12"
                                onClick={() => field.onChange(type.value)}
                                data-testid={`button-rental-${type.value}`}
                              >
                                <span className="text-xs">{type.label}</span>
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={step3Form.control}
                        name="brand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ব্র্যান্ড</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="যেমন: Toyota" 
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
                        control={step3Form.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>মডেল</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="যেমন: Hiace" 
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
                      control={step3Form.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>রেজিস্ট্রেশন নম্বর</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="যেমন: ঢাকা মেট্রো গ-১২৩৪" 
                              className="h-12"
                              data-testid="input-registration"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-3 gap-4">
                      <FormField
                        control={step3Form.control}
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

                      <FormField
                        control={step3Form.control}
                        name="pricePerDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>প্রতিদিন ভাড়া (টাকা)</FormLabel>
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
                        control={step3Form.control}
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

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12"
                        onClick={() => operatorData?.operatorType === "both" ? setStep(2) : setStep(1)}
                        data-testid="button-back-step3"
                      >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        পিছনে
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 h-12"
                        disabled={isPending}
                        data-testid="button-complete"
                      >
                        {isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "সম্পন্ন করুন"
                        )}
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={handleSkipRental}
                      data-testid="button-skip-rental"
                    >
                      পরে যোগ করব
                    </Button>
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
