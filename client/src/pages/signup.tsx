import { useState, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { Car, Package, UtensilsCrossed, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

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
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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

    if (!email || !password || !confirmPassword) {
      toast({
        title: "তথ্য অসম্পূর্ণ",
        description: "সকল প্রয়োজনীয় ফিল্ড পূরণ করুন",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "ভুল ইমেইল",
        description: "সঠিক ইমেইল ঠিকানা দিন",
        variant: "destructive",
      });
      return;
    }

    if (!passwordStrength.isValid) {
      toast({
        title: "দুর্বল পাসওয়ার্ড",
        description: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর, একটি বড় হাতের অক্ষর, একটি ছোট হাতের অক্ষর এবং একটি সংখ্যা থাকতে হবে",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "পাসওয়ার্ড মিলছে না",
        description: "উভয় পাসওয়ার্ড একই হতে হবে",
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
          fullName: fullName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        if (error.code === "EMAIL_IN_USE") {
          throw new Error(error.message || "এই ইমেইল দিয়ে আগে থেকেই একাউন্ট আছে।");
        }
        
        throw new Error(error.message || error.error || "সাইনআপ ব্যর্থ হয়েছে");
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
          title: "অ্যাকাউন্ট তৈরি হয়েছে!",
          description: "অ্যাকাউন্ট তৈরি হয়েছে। অনুগ্রহ করে সাইন ইন করুন।",
        });
        setLocation("/login");
        return;
      }

      const { token, user: loggedInUser } = await loginResponse.json();

      localStorage.setItem("safego_token", token);
      localStorage.setItem("safego_user", JSON.stringify(loggedInUser));

      toast({
        title: "স্বাগতম!",
        description: "SafeGo-তে স্বাগতম। আপনার অ্যাকাউন্ট তৈরি হয়েছে।",
      });

      const redirectPath = getPostLoginPath(loggedInUser);
      window.location.href = redirectPath;

    } catch (error: any) {
      toast({
        title: "সাইনআপ ব্যর্থ হয়েছে",
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
            গ্লোবাল সুপার-অ্যাপ প্ল্যাটফর্মে যোগ দিন
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>অ্যাকাউন্ট তৈরি করুন</CardTitle>
            <CardDescription>
              রাইড, ফুড ও ডেলিভারি সেবা ব্যবহার করতে সাইন আপ করুন
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">ইমেইল *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="আপনার ইমেইল"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">পুরো নাম (ঐচ্ছিক)</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="আপনার পুরো নাম"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12"
                  data-testid="input-fullname"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">পাসওয়ার্ড *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="শক্তিশালী পাসওয়ার্ড তৈরি করুন"
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
                      কমপক্ষে ৮ অক্ষর
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.hasUppercase ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasUppercase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      একটি বড় হাতের অক্ষর (A-Z)
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.hasLowercase ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasLowercase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      একটি ছোট হাতের অক্ষর (a-z)
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.hasNumber ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordStrength.hasNumber ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      একটি সংখ্যা (0-9)
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">পাসওয়ার্ড নিশ্চিত করুন *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="পাসওয়ার্ড পুনরায় লিখুন"
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
                    পাসওয়ার্ড মিলছে না
                  </p>
                )}
                {confirmPassword && password === confirmPassword && confirmPassword.length > 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    পাসওয়ার্ড মিলেছে
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading || !passwordStrength.isValid || password !== confirmPassword}
                data-testid="button-signup"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    অ্যাকাউন্ট তৈরি হচ্ছে...
                  </>
                ) : (
                  "অ্যাকাউন্ট তৈরি করুন"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                সাইন আপ করে আপনি SafeGo-এর শর্তাবলী মেনে নিচ্ছেন।
              </p>
            </form>

            <div className="mt-6 text-center text-sm">
              ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
                সাইন ইন করুন
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
