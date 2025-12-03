import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSignup } from "@/contexts/SignupContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { Car, Package, UtensilsCrossed, Loader2, Globe } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { setPendingSignup } = useSignup();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isBD = countryCode === "BD";

  useEffect(() => {
    if (!authLoading && user) {
      setLocation(getPostLoginPath(user));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!countryCode) {
      toast({
        title: "Missing information",
        description: "Please select your country",
        variant: "destructive",
      });
      return;
    }

    if (!email || !password) {
      toast({
        title: isBD ? "তথ্য অসম্পূর্ণ" : "Missing information",
        description: isBD ? "ইমেইল এবং পাসওয়ার্ড দিন" : "Please enter email and password",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: isBD ? "পাসওয়ার্ড ছোট" : "Password too short",
        description: isBD ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে" : "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: isBD ? "ভুল ইমেইল" : "Invalid email",
        description: isBD ? "সঠিক ইমেইল ঠিকানা দিন" : "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setPendingSignup({
      email,
      password,
      countryCode,
    });

    setLocation("/signup/choose-role");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex gap-1">
              <Car className="h-8 w-8 text-primary" />
              <UtensilsCrossed className="h-8 w-8 text-primary" />
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">SafeGo</h1>
          <p className="text-muted-foreground mt-2">
            {isBD ? "গ্লোবাল সুপার-অ্যাপ প্ল্যাটফর্মে যোগ দিন" : "Join the global super-app platform"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isBD ? "অ্যাকাউন্ট তৈরি করুন" : "Create account"}</CardTitle>
            <CardDescription>
              {isBD ? "SafeGo সেবা ব্যবহার করতে সাইন আপ করুন" : "Sign up to start using SafeGo services"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {isBD ? "দেশ" : "Country"}
                </Label>
                <Select 
                  value={countryCode} 
                  onValueChange={setCountryCode} 
                  required
                >
                  <SelectTrigger id="country" className="h-12" data-testid="select-country">
                    <SelectValue placeholder={isBD ? "আপনার দেশ নির্বাচন করুন" : "Select your country"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BD" data-testid="select-country-bd">
                      <span className="flex items-center gap-2">
                        🇧🇩 Bangladesh / বাংলাদেশ
                      </span>
                    </SelectItem>
                    <SelectItem value="US" data-testid="select-country-us">
                      <span className="flex items-center gap-2">
                        🇺🇸 United States
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{isBD ? "ইমেইল" : "Email"}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={isBD ? "আপনার ইমেইল" : "you@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{isBD ? "পাসওয়ার্ড" : "Password"}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={isBD ? "শক্তিশালী পাসওয়ার্ড তৈরি করুন" : "Create a strong password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12"
                  data-testid="input-password"
                />
                <p className="text-xs text-muted-foreground">
                  {isBD ? "কমপক্ষে ৬ অক্ষর" : "At least 6 characters"}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading || !countryCode}
                data-testid="button-signup"
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
            </form>

            <div className="mt-6 text-center text-sm">
              {isBD ? "ইতিমধ্যে অ্যাকাউন্ট আছে?" : "Already have an account?"}{" "}
              <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
                {isBD ? "সাইন ইন করুন" : "Sign in"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
