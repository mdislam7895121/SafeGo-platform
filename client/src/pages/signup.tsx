import { useState, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { Car, Package, UtensilsCrossed, Loader2, Globe, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

interface PasswordStrength {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

function validatePassword(password: string): PasswordStrength {
  return {
    isValid: password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password),
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isBD = countryCode === "BD";
  const passwordStrength = validatePassword(password);

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
        title: isBD ? "তথ্য অসম্পূর্ণ" : "Missing information",
        description: isBD ? "আপনার দেশ নির্বাচন করুন" : "Please select your country",
        variant: "destructive",
      });
      return;
    }

    if (!email || !password || !confirmPassword) {
      toast({
        title: isBD ? "তথ্য অসম্পূর্ণ" : "Missing information",
        description: isBD ? "সকল ফিল্ড পূরণ করুন" : "Please fill in all fields",
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

    if (!passwordStrength.isValid) {
      toast({
        title: isBD ? "দুর্বল পাসওয়ার্ড" : "Weak password",
        description: isBD 
          ? "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর, একটি বড় হাতের অক্ষর, একটি ছোট হাতের অক্ষর এবং একটি সংখ্যা থাকতে হবে" 
          : "Password must be at least 8 characters with uppercase, lowercase, and a number",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: isBD ? "পাসওয়ার্ড মিলছে না" : "Passwords don't match",
        description: isBD ? "উভয় পাসওয়ার্ড একই হতে হবে" : "Both passwords must be the same",
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
          email,
          password,
          confirmPassword,
          role: "customer",
          countryCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || "Signup failed";
        
        if (errorMessage.includes("already exists")) {
          throw new Error(isBD 
            ? "এই ইমেইল দিয়ে SafeGo অ্যাকাউন্ট আছে। অনুগ্রহ করে সাইন ইন করুন।" 
            : "You already have a SafeGo account with this email. Please sign in instead.");
        }
        throw new Error(errorMessage);
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!loginResponse.ok) {
        toast({
          title: isBD ? "অ্যাকাউন্ট তৈরি হয়েছে!" : "Account created!",
          description: isBD 
            ? "অ্যাকাউন্ট তৈরি হয়েছে। অনুগ্রহ করে সাইন ইন করুন।"
            : "Account created successfully. Please sign in.",
        });
        setLocation("/login");
        return;
      }

      const { token, user: loggedInUser } = await loginResponse.json();

      localStorage.setItem("safego_token", token);
      localStorage.setItem("safego_user", JSON.stringify(loggedInUser));

      toast({
        title: isBD ? "স্বাগতম!" : "Welcome!",
        description: isBD 
          ? "SafeGo-তে স্বাগতম। আপনার অ্যাকাউন্ট তৈরি হয়েছে।" 
          : "Welcome to SafeGo. Your account has been created.",
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
              {isBD ? "রাইড, ফুড ও ডেলিভারি সেবা ব্যবহার করতে সাইন আপ করুন" : "Sign up to use ride, food, and delivery services"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {isBD ? "দেশ" : "Country"} *
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
                <Label htmlFor="email">{isBD ? "ইমেইল" : "Email"} *</Label>
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
                <Label htmlFor="password">{isBD ? "পাসওয়ার্ড" : "Password"} *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isBD ? "শক্তিশালী পাসওয়ার্ড তৈরি করুন" : "Create a strong password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {password && (
                  <div className="space-y-1 text-xs">
                    <div className={`flex items-center gap-1 ${passwordStrength.hasMinLength ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasMinLength ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {isBD ? "কমপক্ষে ৮ অক্ষর" : "At least 8 characters"}
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.hasUppercase ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasUppercase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {isBD ? "একটি বড় হাতের অক্ষর (A-Z)" : "One uppercase letter (A-Z)"}
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.hasLowercase ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasLowercase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {isBD ? "একটি ছোট হাতের অক্ষর (a-z)" : "One lowercase letter (a-z)"}
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.hasNumber ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasNumber ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {isBD ? "একটি সংখ্যা (0-9)" : "One number (0-9)"}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{isBD ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm Password"} *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={isBD ? "পাসওয়ার্ড পুনরায় লিখুন" : "Re-enter your password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                    data-testid="input-confirm-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {isBD ? "পাসওয়ার্ড মিলছে না" : "Passwords don't match"}
                  </p>
                )}
                {confirmPassword && password === confirmPassword && confirmPassword.length > 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {isBD ? "পাসওয়ার্ড মিলেছে" : "Passwords match"}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading || !countryCode || !passwordStrength.isValid || password !== confirmPassword}
                data-testid="button-signup"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isBD ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "Creating account..."}
                  </>
                ) : (
                  isBD ? "অ্যাকাউন্ট তৈরি করুন" : "Create Account"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {isBD 
                  ? "সাইন আপ করে আপনি SafeGo-এর শর্তাবলী মেনে নিচ্ছেন।" 
                  : "By signing up, you agree to SafeGo's Terms of Service."}
              </p>
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
