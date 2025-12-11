import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  User,
  Store,
  Phone,
  Mail,
  MapPin,
  Camera,
  Loader2,
  Check,
  Shield,
  FileText,
} from "lucide-react";
import { t_bn } from "@/lib/bangla";
import { useEffect } from "react";

const profileSchema = z.object({
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  emergencyContactName: z.string().min(2, "জরুরি যোগাযোগের নাম লিখুন"),
  emergencyContactPhone: z.string().min(10, "জরুরি যোগাযোগ নম্বর লিখুন"),
});

export default function ShopPartnerProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery<{ profile: any }>({
    queryKey: ["/api/shop-partner/profile"],
  });

  const profile = profileData?.profile;

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      ownerName: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        ownerName: profile.ownerName || "",
        emergencyContactName: profile.emergencyContactName || "",
        emergencyContactPhone: profile.emergencyContactPhone || "",
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
        description: "প্রোফাইল আপডেট হয়েছে।",
      });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "প্রোফাইল আপডেট ব্যর্থ হয়েছে।",
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
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={profile?.shopLogo} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {profile?.shopName?.charAt(0) || "D"}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold">{profile?.shopName}</h2>
            <p className="text-muted-foreground">{profile?.ownerName}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant={
                  profile?.verificationStatus === "approved"
                    ? "default"
                    : profile?.verificationStatus === "pending"
                    ? "secondary"
                    : "destructive"
                }
              >
                {profile?.verificationStatus === "approved"
                  ? "যাচাইকৃত"
                  : profile?.verificationStatus === "pending"
                  ? "অপেক্ষমান"
                  : "প্রত্যাখ্যাত"}
              </Badge>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">ফোন</p>
                <p className="font-medium">{(user as any)?.phone || "যোগ করা হয়নি"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">ইমেইল</p>
                <p className="font-medium">{user?.email || "যোগ করা হয়নি"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">দোকানের ঠিকানা</p>
                <p className="font-medium">{profile?.shopAddress || "যোগ করা হয়নি"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <User className="h-6 w-6 text-primary" />
            ব্যক্তিগত তথ্য
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">মালিকের নাম</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-12 text-base"
                        data-testid="input-owner-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">জরুরি যোগাযোগের নাম</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-12 text-base"
                        data-testid="input-emergency-name"
                      />
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
                    <FormLabel className="text-base">জরুরি যোগাযোগ নম্বর</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        className="h-12 text-base"
                        data-testid="input-emergency-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg"
                disabled={updateMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    {t_bn("সেভ করুন")}
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            কাগজপত্র
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span>জাতীয় পরিচয়পত্র (NID)</span>
            </div>
            <Badge variant={profile?.nidFrontImage ? "default" : "secondary"}>
              {profile?.nidFrontImage ? "জমা দেওয়া হয়েছে" : "জমা দিন"}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span>ট্রেড লাইসেন্স</span>
            </div>
            <Badge variant={profile?.tradeLicenseImage ? "default" : "secondary"}>
              {profile?.tradeLicenseImage ? "জমা দেওয়া হয়েছে" : "ঐচ্ছিক"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
