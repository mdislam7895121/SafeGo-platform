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
import { Car, Package, UtensilsCrossed, Loader2 } from "lucide-react";

interface RoleOption {
  value: string;
  label: string;
  bdOnly?: boolean;
}

const ALL_ROLES: RoleOption[] = [
  { value: "customer", label: "Use services (Customer)" },
  { value: "driver", label: "Drive & deliver (Driver)" },
  { value: "restaurant", label: "Manage restaurant (Restaurant)" },
  { value: "shop_partner", label: "দোকানদার (Shop Partner)", bdOnly: true },
  { value: "ticket_operator", label: "টিকিট ও রেন্টাল অপারেটর (Ticket Operator)", bdOnly: true },
  { value: "admin", label: "Manage platform (Admin)" },
];

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [useCapsuleFlow, setUseCapsuleFlow] = useState(true);
  const { user, signup, isLoading: authLoading } = useAuth();
  const { setPendingSignup } = useSignup();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const availableRoles = useMemo(() => {
    return ALL_ROLES.filter(r => !r.bdOnly || countryCode === "BD");
  }, [countryCode]);

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

  const handleSubmitCapsuleFlow = async (e: React.FormEvent) => {
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
        title: "Missing information",
        description: "Please enter email and password",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
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

  const handleSubmitClassicFlow = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!role || !countryCode) {
      toast({
        title: "Missing information",
        description: "Please select both role and country",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await signup(email, password, role, countryCode);
      toast({
        title: "Account created!",
        description: "Welcome to SafeGo. Complete your profile to get started.",
      });
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = useCapsuleFlow ? handleSubmitCapsuleFlow : handleSubmitClassicFlow;

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
          <p className="text-muted-foreground mt-2">Join the global super-app platform</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>Sign up to start using SafeGo services</CardDescription>
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
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select 
                  value={countryCode} 
                  onValueChange={(v) => {
                    setCountryCode(v);
                    const bdOnlyRole = ALL_ROLES.find(r => r.value === role && r.bdOnly);
                    if (bdOnlyRole && v !== "BD") {
                      setRole("");
                    }
                  }} 
                  required
                >
                  <SelectTrigger id="country" data-testid="select-country">
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BD" data-testid="select-country-bd">Bangladesh</SelectItem>
                    <SelectItem value="US" data-testid="select-country-us">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!useCapsuleFlow && (
                <div className="space-y-2">
                  <Label htmlFor="role">I want to</Label>
                  <Select 
                    value={role} 
                    onValueChange={(v) => {
                      if (availableRoles.find(r => r.value === v)) {
                        setRole(v);
                      }
                    }} 
                    required
                  >
                    <SelectTrigger id="role" data-testid="select-role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem 
                          key={r.value} 
                          value={r.value}
                          data-testid={`select-role-${r.value}`}
                        >
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-signup"
              >
                {isLoading ? "Creating account..." : useCapsuleFlow ? "Continue" : "Create account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
