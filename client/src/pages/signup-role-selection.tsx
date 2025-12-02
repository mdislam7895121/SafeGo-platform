import { useState, useMemo, useEffect } from "react";
import { useLocation, Redirect, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSignup } from "@/contexts/SignupContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { 
  Car, 
  UtensilsCrossed, 
  Package, 
  Store, 
  Bus,
  Bike,
  Check,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleCapsule {
  id: string;
  labelBn: string;
  labelEn: string;
  descriptionBn: string;
  descriptionEn: string;
  icons: React.ReactNode;
  bdOnly?: boolean;
}

const ROLE_CAPSULES: RoleCapsule[] = [
  {
    id: "customer",
    labelBn: "সেবা ব্যবহার করুন",
    labelEn: "Use Services (Customer)",
    descriptionBn: "রাইড, ফুড, ডেলিভারি ব্যবহার করতে চাই",
    descriptionEn: "I want to use ride, food, and delivery services",
    icons: (
      <div className="flex items-center gap-2">
        <Car className="h-6 w-6" />
        <UtensilsCrossed className="h-6 w-6" />
        <Package className="h-6 w-6" />
      </div>
    ),
  },
  {
    id: "driver",
    labelBn: "ড্রাইভ ও ডেলিভারি করুন",
    labelEn: "Drive & Deliver (Driver)",
    descriptionBn: "রাইড শেয়ার ও ফুড/পার্সেল ডেলিভারি করতে চাই",
    descriptionEn: "I want to do ride-sharing and food/parcel delivery",
    icons: (
      <div className="flex items-center gap-2">
        <Car className="h-6 w-6" />
        <Bike className="h-6 w-6" />
      </div>
    ),
  },
  {
    id: "restaurant",
    labelBn: "রেস্টুরেন্ট পরিচালনা করুন",
    labelEn: "Manage Restaurant",
    descriptionBn: "নিজের রেস্টুরেন্ট SafeGo-তে চালাতে চাই",
    descriptionEn: "I want to run my restaurant on SafeGo",
    icons: <UtensilsCrossed className="h-6 w-6" />,
  },
  {
    id: "shop_partner",
    labelBn: "ই-স্টোর / দোকানদার",
    labelEn: "eStore / Shop Partner",
    descriptionBn: "ছোট দোকান / ই-স্টোর SafeGo-তে চালাতে চাই",
    descriptionEn: "I want to run my small shop on SafeGo",
    icons: <Store className="h-6 w-6" />,
    bdOnly: true,
  },
  {
    id: "ticket_operator",
    labelBn: "টিকিট ও রেন্টাল অপারেটর",
    labelEn: "Ticket & Rental Operator",
    descriptionBn: "বাস টিকিট ও গাড়ি রেন্টাল পরিচালনা করতে চাই",
    descriptionEn: "I want to manage bus tickets and car rentals",
    icons: <Bus className="h-6 w-6" />,
    bdOnly: true,
  },
];

export default function SignupRoleSelection() {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { pendingSignup, clearPendingSignup } = useSignup();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const countryCode = pendingSignup?.countryCode || "US";
  const isBD = countryCode === "BD";

  const availableRoles = useMemo(() => {
    return ROLE_CAPSULES.filter(r => !r.bdOnly || isBD);
  }, [isBD]);

  useEffect(() => {
    if (!authLoading && user) {
      const path = getPostLoginPath(user);
      setLocation(path);
    }
  }, [user, authLoading, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-auth" />
      </div>
    );
  }

  if (user) {
    return <Redirect to={getPostLoginPath(user)} />;
  }

  if (!pendingSignup) {
    return <Redirect to="/signup" />;
  }

  const handleContinue = async () => {
    if (!selectedRole) {
      toast({
        title: isBD ? "দয়া করে একটি অপশন নির্বাচন করুন" : "Please select an option",
        description: isBD ? "এগিয়ে যেতে একটি রোল বেছে নিন" : "Choose a role to continue",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: pendingSignup.email,
          password: pendingSignup.password,
          role: selectedRole,
          countryCode: pendingSignup.countryCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Signup failed");
      }

      clearPendingSignup();

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: pendingSignup.email,
          password: pendingSignup.password,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error("Account created but login failed. Please try logging in.");
      }

      const { token, user: loggedInUser } = await loginResponse.json();

      localStorage.setItem("safego_token", token);
      localStorage.setItem("safego_user", JSON.stringify(loggedInUser));

      toast({
        title: isBD ? "অ্যাকাউন্ট তৈরি হয়েছে!" : "Account created!",
        description: isBD 
          ? "SafeGo-তে স্বাগতম। প্রোফাইল সম্পূর্ণ করুন।" 
          : "Welcome to SafeGo. Complete your profile to get started.",
      });

      const redirectPath = getPostLoginPath(loggedInUser);
      window.location.href = redirectPath;

    } catch (error: any) {
      toast({
        title: isBD ? "সাইনআপ ব্যর্থ হয়েছে" : "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    clearPendingSignup();
    setLocation("/signup");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">SafeGo</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 md:p-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-title">
              {isBD ? "আপনি কোন ভাবে SafeGo ব্যবহার করতে চান?" : "How do you want to use SafeGo?"}
            </h1>
            <p className="text-muted-foreground" data-testid="text-subtitle">
              {isBD ? "একটি অপশন নির্বাচন করুন" : "Select one option to continue"}
            </p>
          </div>

          <div className="grid gap-3 md:gap-4">
            {availableRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "relative flex items-start gap-4 p-4 md:p-5 rounded-2xl border-2 text-left transition-all",
                  "hover-elevate active-elevate-2",
                  selectedRole === role.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                )}
                data-testid={`capsule-role-${role.id}`}
              >
                <div className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-xl shrink-0",
                  selectedRole === role.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {role.icons}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base md:text-lg">
                      {isBD ? role.labelBn : role.labelEn}
                    </span>
                    {role.bdOnly && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        BD
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isBD ? role.descriptionBn : role.descriptionEn}
                  </p>
                </div>
                {selectedRole === role.id && (
                  <div className="absolute top-4 right-4 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="pt-4">
            <Button
              onClick={handleContinue}
              disabled={!selectedRole || isLoading}
              className="w-full h-12 text-base"
              data-testid="button-continue"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isBD ? "অপেক্ষা করুন..." : "Please wait..."}
                </>
              ) : (
                isBD ? "এগিয়ে যান" : "Continue"
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {isBD 
              ? "সাইনআপ করে আপনি SafeGo-এর শর্তাবলী মেনে নিচ্ছেন।" 
              : "By signing up, you agree to SafeGo's Terms of Service."}
          </p>
        </div>
      </main>
    </div>
  );
}
