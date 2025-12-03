import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { apiRequest, uploadWithAuth } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bus,
  ChevronRight,
  Check,
  Loader2,
  LucideIcon,
  IdCard,
  Phone,
  LogOut,
  Clock,
  AlertCircle,
  ImageIcon,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Route,
  Camera,
  Car,
  Ticket,
} from "lucide-react";

const operatorTypes: { value: string; label: string; description: string }[] = [
  { value: "ticket", label: "টিকেট সার্ভিস", description: "বাস/কোচ/ট্রেন টিকেট বিক্রি" },
  { value: "rental", label: "রেন্টাল সার্ভিস", description: "গাড়ি ভাড়া দেওয়া" },
  { value: "both", label: "উভয়", description: "টিকেট এবং রেন্টাল দুটোই" },
];

const stage1Schema = z.object({
  operatorName: z.string().min(2, "অপারেটরের নাম কমপক্ষে ২ অক্ষরের হতে হবে"),
  operatorType: z.enum(["ticket", "rental", "both"], {
    errorMap: () => ({ message: "অপারেটর ধরণ নির্বাচন করুন" }),
  }),
  cityOrArea: z.string().min(2, "এলাকা/শহরের নাম লিখুন"),
  contactPhone: z.string().min(10, "সঠিক ফোন নম্বর লিখুন"),
});

const stage2Schema = z.object({
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  fatherName: z.string().min(2, "পিতার নাম লিখুন"),
  dateOfBirth: z.string().min(1, "জন্ম তারিখ নির্বাচন করুন"),
  presentAddress: z.string().min(5, "বর্তমান ঠিকানা লিখুন"),
  permanentAddress: z.string().min(5, "স্থায়ী ঠিকানা লিখুন"),
  nidNumber: z.string().min(10, "সঠিক জাতীয় পরিচয়পত্র নম্বর লিখুন").regex(/^[0-9]{10,17}$/, "জাতীয় পরিচয়পত্র নম্বর শুধুমাত্র সংখ্যা হতে হবে"),
  nidFrontImage: z.string().url("NID সামনের ছবি আপলোড করুন"),
  nidBackImage: z.string().url("NID পেছনের ছবি আপলোড করুন"),
  emergencyContactName: z.string().min(2, "জরুরি যোগাযোগের নাম লিখুন"),
  emergencyContactPhone: z.string().min(10, "জরুরি যোগাযোগের ফোন নম্বর লিখুন"),
  routePermitNumber: z.string().optional(),
  routePermitImage: z.string().url().optional(),
});

const stage3Schema = z.object({
  logo: z.string().url("অপারেটরের লোগো আপলোড করুন"),
  officeAddress: z.string().min(5, "অফিসের সম্পূর্ণ ঠিকানা লিখুন"),
  officePhone: z.string().min(10, "অফিসের ফোন নম্বর লিখুন"),
  officeEmail: z.string().email().optional().or(z.literal("")),
});

type Stage1Data = z.infer<typeof stage1Schema>;
type Stage2Data = z.infer<typeof stage2Schema>;
type Stage3Data = z.infer<typeof stage3Schema>;

interface OnboardingStatus {
  hasProfile: boolean;
  partnerStatus: string | null;
  verificationStatus: string | null;
  rejectionReason: string | null;
  checklist: {
    stage1Complete: boolean;
    stage2Complete: boolean;
    stage3Complete: boolean;
    ticketListingCount: number;
    rentalVehicleCount: number;
    requiredListings: number;
  };
  nextStep: string;
  profile?: {
    id: string;
    operatorName: string;
    operatorType: string;
    cityOrArea: string;
    isActive: boolean;
  };
}

function OnboardingHeader() {
  const { logout } = useAuth();
  
  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-header-title">
            SafeGo Ticket & Rental
          </h1>
          <p className="text-xs text-muted-foreground">বাংলাদেশ</p>
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

function StageIndicator({ status }: { status: OnboardingStatus | null }) {
  const stages = [
    { id: 1, label: "শুরু", icon: Bus },
    { id: 2, label: "KYC", icon: IdCard },
    { id: 3, label: "সেটআপ", icon: Route },
    { id: 4, label: "লাইভ", icon: CheckCircle2 },
  ];

  const getStageStatus = (stageId: number) => {
    if (!status) return "pending";
    const { checklist, partnerStatus } = status;
    
    if (stageId === 1) return checklist.stage1Complete ? "complete" : "current";
    if (stageId === 2) {
      if (checklist.stage2Complete) return "complete";
      if (checklist.stage1Complete && !checklist.stage2Complete) return "current";
      return "pending";
    }
    if (stageId === 3) {
      if (checklist.stage3Complete) return "complete";
      if (partnerStatus === "setup_incomplete") return "current";
      return "pending";
    }
    if (stageId === 4) {
      if (partnerStatus === "live") return "complete";
      if (partnerStatus === "ready_for_review") return "current";
      return "pending";
    }
    return "pending";
  };

  return (
    <div className="flex items-center justify-between px-4 py-6 bg-muted/30">
      {stages.map((stage, idx) => {
        const stageStatus = getStageStatus(stage.id);
        const Icon = stage.icon;
        
        return (
          <div key={stage.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-colors
                ${stageStatus === "complete" ? "bg-green-600 text-white" : ""}
                ${stageStatus === "current" ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : ""}
                ${stageStatus === "pending" ? "bg-muted text-muted-foreground" : ""}
              `}>
                {stageStatus === "complete" ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className={`text-xs mt-1 ${stageStatus === "current" ? "font-medium text-primary" : "text-muted-foreground"}`}>
                {stage.label}
              </span>
            </div>
            {idx < stages.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${
                getStageStatus(stages[idx + 1].id) !== "pending" ? "bg-green-600" : "bg-muted"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WaitingScreen({ status, title, description }: { status: OnboardingStatus; title: string; description: string }) {
  const statusConfig: Record<string, { icon: LucideIcon; iconColor: string; bgColor: string }> = {
    kyc_pending: {
      icon: Clock,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    ready_for_review: {
      icon: Clock,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    rejected: {
      icon: AlertCircle,
      iconColor: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  };

  const config = statusConfig[status.partnerStatus || "kyc_pending"] || statusConfig.kyc_pending;
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />
      <StageIndicator status={status} />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-10rem)]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${config.bgColor}`}>
              <Icon className={`h-10 w-10 ${config.iconColor}`} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold" data-testid="text-status-title">
                {title}
              </h1>
              <p className="text-muted-foreground" data-testid="text-status-description">
                {description}
              </p>
            </div>

            {status.rejectionReason && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>কারণ:</strong> {status.rejectionReason}
                </p>
              </div>
            )}

            {status.profile && (
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">অপারেটর:</span>
                  <span className="font-medium" data-testid="text-operator-name">
                    {status.profile.operatorName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">স্ট্যাটাস:</span>
                  <Badge variant={status.partnerStatus === "rejected" ? "destructive" : "secondary"}>
                    {status.partnerStatus === "kyc_pending" && "KYC অপেক্ষমান"}
                    {status.partnerStatus === "ready_for_review" && "চূড়ান্ত অনুমোদন"}
                    {status.partnerStatus === "rejected" && "প্রত্যাখ্যাত"}
                  </Badge>
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

function Stage1Form({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<Stage1Data>({
    resolver: zodResolver(stage1Schema),
    defaultValues: {
      operatorName: "",
      operatorType: undefined,
      cityOrArea: "",
      contactPhone: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: Stage1Data) => {
      return apiRequest("/api/ticket-operator/stages/1", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/onboarding-status"] });
      toast({
        title: "অভিনন্দন!",
        description: "প্রথম ধাপ সম্পন্ন হয়েছে। এবার KYC তথ্য দিন।",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Stage1Data) => {
    mutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>অপারেটর হিসেবে যুক্ত হন</CardTitle>
            <CardDescription>শুধু ৪টি তথ্য দিয়ে শুরু করুন</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="operatorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>অপারেটর/কোম্পানির নাম</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="যেমন: গ্রীন লাইন পরিবহন" 
                      {...field} 
                      data-testid="input-operator-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="operatorType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>সেবার ধরণ</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-operator-type">
                        <SelectValue placeholder="ধরণ নির্বাচন করুন" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {operatorTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cityOrArea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>প্রধান এলাকা / শহর</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="যেমন: ঢাকা" 
                      {...field} 
                      data-testid="input-city-area"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>মোবাইল নম্বর</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel"
                      placeholder="01XXXXXXXXX" 
                      {...field} 
                      data-testid="input-contact-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-base"
              disabled={mutation.isPending}
              data-testid="button-submit-stage1"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  জমা হচ্ছে...
                </>
              ) : (
                <>
                  পরবর্তী ধাপে যান
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function Stage2Form({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nidFrontUploading, setNidFrontUploading] = useState(false);
  const [nidBackUploading, setNidBackUploading] = useState(false);
  const [permitUploading, setPermitUploading] = useState(false);

  const form = useForm<Stage2Data>({
    resolver: zodResolver(stage2Schema),
    defaultValues: {
      ownerName: "",
      fatherName: "",
      dateOfBirth: "",
      presentAddress: "",
      permanentAddress: "",
      nidNumber: "",
      nidFrontImage: "",
      nidBackImage: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      routePermitNumber: "",
      routePermitImage: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: Stage2Data) => {
      return apiRequest("/api/ticket-operator/stages/2", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/onboarding-status"] });
      toast({
        title: "সফল!",
        description: "KYC তথ্য জমা হয়েছে। অনুমোদনের জন্য অপেক্ষা করুন।",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async (file: File, type: "nid_front" | "nid_back" | "route_permit") => {
    const setUploading = type === "nid_front" ? setNidFrontUploading : type === "nid_back" ? setNidBackUploading : setPermitUploading;
    const fieldName = type === "nid_front" ? "nidFrontImage" : type === "nid_back" ? "nidBackImage" : "routePermitImage";

    if (!file.type.startsWith("image/")) {
      toast({
        title: "ত্রুটি",
        description: "শুধুমাত্র ছবি আপলোড করতে পারবেন।",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await uploadWithAuth(`/api/ticket-operator/upload-image?type=${type}`, formData);
      form.setValue(fieldName as any, data.url);
      
      toast({
        title: "সফল!",
        description: "ছবি আপলোড হয়েছে",
      });
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes("token")) {
        toast({
          title: "সেশন শেষ",
          description: "আপনার সেশন শেষ হয়ে গেছে। পুনরায় লগইন করুন।",
          variant: "destructive",
        });
        window.location.href = "/login?returnTo=/ticket-operator/onboarding";
        return;
      }
      toast({
        title: "ত্রুটি",
        description: error.message || "আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (data: Stage2Data) => {
    mutation.mutate(data);
  };

  const nidFrontValue = form.watch("nidFrontImage");
  const nidBackValue = form.watch("nidBackImage");
  const permitValue = form.watch("routePermitImage");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <IdCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>পরিচয় যাচাই (KYC)</CardTitle>
            <CardDescription>নিরাপদ পরিচয় নিশ্চিতকরণ</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>মালিকের নাম</FormLabel>
                    <FormControl>
                      <Input placeholder="NID অনুযায়ী" {...field} data-testid="input-owner-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fatherName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>পিতার নাম</FormLabel>
                    <FormControl>
                      <Input placeholder="NID অনুযায়ী" {...field} data-testid="input-father-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>জন্ম তারিখ</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-dob" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nidNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>জাতীয় পরিচয়পত্র নম্বর</FormLabel>
                    <FormControl>
                      <Input placeholder="১০-১৭ সংখ্যা" {...field} data-testid="input-nid" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="presentAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>বর্তমান ঠিকানা</FormLabel>
                  <FormControl>
                    <Textarea placeholder="সম্পূর্ণ ঠিকানা লিখুন" {...field} data-testid="input-present-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permanentAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>স্থায়ী ঠিকানা</FormLabel>
                  <FormControl>
                    <Textarea placeholder="সম্পূর্ণ ঠিকানা লিখুন" {...field} data-testid="input-permanent-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="font-medium text-sm">জাতীয় পরিচয়পত্রের ছবি</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">সামনের দিক</label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {nidFrontValue ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                        <p className="text-sm text-green-600">আপলোড সম্পন্ন</p>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, "nid_front");
                          }}
                          disabled={nidFrontUploading}
                        />
                        {nidFrontUploading ? (
                          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                        ) : (
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                        )}
                        <p className="text-sm mt-2">ক্লিক করুন</p>
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">পেছনের দিক</label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {nidBackValue ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                        <p className="text-sm text-green-600">আপলোড সম্পন্ন</p>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, "nid_back");
                          }}
                          disabled={nidBackUploading}
                        />
                        {nidBackUploading ? (
                          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                        ) : (
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                        )}
                        <p className="text-sm mt-2">ক্লিক করুন</p>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">রুট পারমিট (ঐচ্ছিক)</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="routePermitNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>পারমিট নম্বর</FormLabel>
                      <FormControl>
                        <Input placeholder="যদি থাকে" {...field} data-testid="input-permit-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">পারমিট ছবি</label>
                  <div className="border-2 border-dashed rounded-lg p-3 text-center">
                    {permitValue ? (
                      <CheckCircle2 className="h-6 w-6 mx-auto text-green-600" />
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, "route_permit");
                          }}
                          disabled={permitUploading}
                        />
                        {permitUploading ? (
                          <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                        )}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">জরুরি যোগাযোগ</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>নাম</FormLabel>
                      <FormControl>
                        <Input placeholder="পরিবারের সদস্যের নাম" {...field} data-testid="input-emergency-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ফোন</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="01XXXXXXXXX" {...field} data-testid="input-emergency-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base"
              disabled={mutation.isPending}
              data-testid="button-submit-stage2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  জমা হচ্ছে...
                </>
              ) : (
                <>
                  KYC জমা দিন
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function Stage3Setup({ status, onComplete }: { status: OnboardingStatus; onComplete: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [logoUploading, setLogoUploading] = useState(false);

  const form = useForm<Stage3Data>({
    resolver: zodResolver(stage3Schema),
    defaultValues: {
      logo: "",
      officeAddress: "",
      officePhone: "",
      officeEmail: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: Stage3Data) => {
      return apiRequest("/api/ticket-operator/stages/3", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-operator/onboarding-status"] });
      toast({
        title: "সফল!",
        description: "সেটআপ সম্পন্ন! চূড়ান্ত অনুমোদনের জন্য অপেক্ষা করুন।",
      });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "ত্রুটি",
        description: "শুধুমাত্র ছবি আপলোড করতে পারবেন।",
        variant: "destructive",
      });
      return;
    }

    setLogoUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await uploadWithAuth(`/api/ticket-operator/upload-image?type=logo`, formData);
      form.setValue("logo", data.url);
      
      toast({
        title: "সফল!",
        description: "লোগো আপলোড হয়েছে",
      });
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes("token")) {
        toast({
          title: "সেশন শেষ",
          description: "আপনার সেশন শেষ হয়ে গেছে। পুনরায় লগইন করুন।",
          variant: "destructive",
        });
        window.location.href = "/login?returnTo=/ticket-operator/onboarding";
        return;
      }
      toast({
        title: "ত্রুটি",
        description: error.message || "আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const onSubmit = (data: Stage3Data) => {
    mutation.mutate(data);
  };

  const logoValue = form.watch("logo");
  const operatorType = status.profile?.operatorType;
  const ticketCount = status.checklist.ticketListingCount || 0;
  const vehicleCount = status.checklist.rentalVehicleCount || 0;
  const requiredListings = status.checklist.requiredListings || 1;
  
  const hasListings = operatorType === "ticket" ? ticketCount >= requiredListings : 
                      operatorType === "rental" ? vehicleCount >= requiredListings :
                      (ticketCount >= 1 || vehicleCount >= 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Route className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>ব্যবসা সেটআপ</CardTitle>
              <CardDescription>অপারেটর সম্পন্ন করতে নিচের বিষয়গুলো করুন</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {(operatorType === "ticket" || operatorType === "both") && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ticketCount >= 1 ? "bg-green-100 dark:bg-green-900" : "bg-orange-100 dark:bg-orange-900"}`}>
                    {ticketCount >= 1 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Ticket className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">টিকেট রুট যোগ করুন</p>
                    <p className="text-sm text-muted-foreground">
                      {ticketCount}/{requiredListings} রুট যোগ হয়েছে
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate("/ticket-operator/tickets")}
                  data-testid="button-add-tickets"
                >
                  রুট যোগ করুন
                </Button>
              </div>
            )}

            {(operatorType === "rental" || operatorType === "both") && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${vehicleCount >= 1 ? "bg-green-100 dark:bg-green-900" : "bg-orange-100 dark:bg-orange-900"}`}>
                    {vehicleCount >= 1 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Car className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">রেন্টাল গাড়ি যোগ করুন</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicleCount}/{requiredListings} গাড়ি যোগ হয়েছে
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate("/ticket-operator/rentals")}
                  data-testid="button-add-rentals"
                >
                  গাড়ি যোগ করুন
                </Button>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">অপারেটরের লোগো *</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  {logoValue ? (
                    <div className="space-y-2">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                      <p className="text-sm text-green-600">আপলোড সম্পন্ন</p>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        disabled={logoUploading}
                      />
                      {logoUploading ? (
                        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                      ) : (
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                      )}
                      <p className="text-sm mt-2">লোগো আপলোড করুন</p>
                    </label>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="officeAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>অফিসের ঠিকানা</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="সম্পূর্ণ ঠিকানা লিখুন" 
                        {...field} 
                        data-testid="input-office-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="officePhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>অফিস ফোন</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="01XXXXXXXXX" {...field} data-testid="input-office-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="officeEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ইমেইল (ঐচ্ছিক)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-office-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base"
                disabled={mutation.isPending || !hasListings || !logoValue}
                data-testid="button-submit-stage3"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    জমা হচ্ছে...
                  </>
                ) : (
                  <>
                    সেটআপ সম্পন্ন করুন
                    <CheckCircle2 className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {!hasListings && (
                <p className="text-sm text-center text-orange-600">
                  {operatorType === "ticket" && "সম্পন্ন করতে কমপক্ষে ১টি টিকেট রুট যোগ করুন"}
                  {operatorType === "rental" && "সম্পন্ন করতে কমপক্ষে ১টি রেন্টাল গাড়ি যোগ করুন"}
                  {operatorType === "both" && "সম্পন্ন করতে কমপক্ষে ১টি রুট বা গাড়ি যোগ করুন"}
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TicketOperatorStagedOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading, refetch } = useQuery<OnboardingStatus>({
    queryKey: ["/api/ticket-operator/onboarding-status"],
    enabled: !!user && (user.role === "customer" || user.role === "pending_ticket_operator" || user.role === "ticket_operator"),
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-status" />
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <div className="p-4">
          <Stage1Form onSuccess={() => refetch()} />
        </div>
      </div>
    );
  }

  if (status.partnerStatus === "live") {
    return <Redirect to="/ticket-operator/dashboard" />;
  }

  if (status.partnerStatus === "kyc_pending") {
    return (
      <WaitingScreen 
        status={status} 
        title="KYC অনুমোদনের অপেক্ষায়" 
        description="আপনার পরিচয় যাচাই করা হচ্ছে। সাধারণত ২৪-৪৮ ঘণ্টা সময় লাগে।" 
      />
    );
  }

  if (status.partnerStatus === "ready_for_review") {
    return (
      <WaitingScreen 
        status={status} 
        title="চূড়ান্ত অনুমোদনের অপেক্ষায়" 
        description="আপনার অপারেটর পর্যালোচনা করা হচ্ছে। শীঘ্রই লাইভ হবে!" 
      />
    );
  }

  if (status.partnerStatus === "rejected") {
    return (
      <WaitingScreen 
        status={status} 
        title="আবেদন প্রত্যাখ্যাত" 
        description="দুঃখিত, আপনার আবেদন প্রত্যাখ্যান করা হয়েছে। নতুন করে আবেদন করতে পারবেন।" 
      />
    );
  }

  const { nextStep } = status;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />
      <StageIndicator status={status} />
      <div className="p-4 max-w-lg mx-auto">
        {nextStep === "stage1" && !status.hasProfile && (
          <Stage1Form onSuccess={() => refetch()} />
        )}
        
        {nextStep === "stage2" && (
          <Stage2Form onSuccess={() => refetch()} />
        )}
        
        {(nextStep === "stage3" || status.partnerStatus === "setup_incomplete") && (
          <Stage3Setup status={status} onComplete={() => refetch()} />
        )}
      </div>
    </div>
  );
}
