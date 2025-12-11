import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { Car, Package, UtensilsCrossed, Shield, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Show loading while auth state is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-auth" />
      </div>
    );
  }

  // If already logged in, redirect to appropriate dashboard
  if (user) {
    return <Redirect to={getPostLoginPath(user)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      // Redirect is handled by AuthContext.login()
    } catch (error: any) {
      // Show error in Bangla for BD users, English fallback
      const errorMessage = error.message === "Invalid credentials" 
        ? "ভুল ইমেইল অথবা পাসওয়ার্ড। আবার চেষ্টা করুন।"
        : error.message || "লগইন ব্যর্থ হয়েছে";
      toast({
        title: "লগইন ব্যর্থ",
        description: errorMessage,
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
          <p className="text-muted-foreground mt-2">Your global super-app platform</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your SafeGo account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12"
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm mb-3">Don't have an account?</p>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={() => setLocation("/signup")}
                data-testid="button-goto-signup"
              >
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            <span>Ride & Deliver</span>
          </div>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            <span>Food Orders</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Parcel Delivery</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Secure Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
}
