import { Trash2, Clock, AlertTriangle, CheckCircle, Shield, Download } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import GlobalFooter from "@/components/landing/GlobalFooter";

export default function DataDeletionPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [confirmations, setConfirmations] = useState({
    understand: false,
    permanent: false,
    consent: false,
  });

  const allConfirmed = Object.values(confirmations).every(Boolean);

  const handleSubmit = () => {
    if (!allConfirmed) return;
    
    toast({
      title: "Deletion Request Submitted",
      description: "You will receive a confirmation email shortly. Your account will be deleted within 72 hours.",
    });
    setStep(3);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">SafeGo</span>
              </div>
            </Link>
            <Link href="/">
              <Button variant="ghost">Back to Home</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <Trash2 className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Data Deletion Request
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Request deletion of your SafeGo account and all associated data
            </p>
          </div>

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Before You Continue</CardTitle>
                <CardDescription>
                  Please understand what happens when you delete your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>This action is permanent.</strong> Once your account is deleted, we cannot recover your data.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">What will be deleted:</h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Your profile information and preferences
                      </li>
                      <li className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Trip and order history
                      </li>
                      <li className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Saved payment methods
                      </li>
                      <li className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Wallet balance and credits (non-refundable)
                      </li>
                      <li className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Loyalty points and rewards
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">What we retain (for legal compliance):</h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        Financial transaction records (7 years)
                      </li>
                      <li className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        Safety incident reports (as required by law)
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      Want to keep your data? <Link href="/privacy" className="underline font-medium">Request a data export</Link> before deleting your account.
                    </div>
                  </div>
                </div>

                <Button onClick={() => setStep(2)} className="w-full" data-testid="button-continue-deletion">
                  I Understand, Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Confirm Deletion</CardTitle>
                <CardDescription>
                  Enter your email and confirm the deletion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Account Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-deletion-email"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="understand"
                      checked={confirmations.understand}
                      onCheckedChange={(checked) => 
                        setConfirmations({ ...confirmations, understand: !!checked })
                      }
                      data-testid="checkbox-understand"
                    />
                    <Label htmlFor="understand" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                      I understand that my account and all data will be permanently deleted
                    </Label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="permanent"
                      checked={confirmations.permanent}
                      onCheckedChange={(checked) => 
                        setConfirmations({ ...confirmations, permanent: !!checked })
                      }
                      data-testid="checkbox-permanent"
                    />
                    <Label htmlFor="permanent" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                      I understand this action cannot be undone after 72 hours
                    </Label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={confirmations.consent}
                      onCheckedChange={(checked) => 
                        setConfirmations({ ...confirmations, consent: !!checked })
                      }
                      data-testid="checkbox-consent"
                    />
                    <Label htmlFor="consent" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                      I consent to the deletion of my SafeGo account
                    </Label>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>Your account will be deleted within 72 hours of confirmation</span>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Go Back
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleSubmit} 
                    disabled={!allConfirmed || !email}
                    className="flex-1"
                    data-testid="button-confirm-deletion"
                  >
                    Delete My Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="text-center">
              <CardContent className="py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Request Submitted
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  We've received your deletion request. A confirmation email has been sent to <strong>{email}</strong>.
                  Your account will be deleted within 72 hours.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Changed your mind?</strong> You can cancel this request by logging into your account within the next 72 hours.
                  </p>
                </div>
                <Link href="/">
                  <Button>Return to Home</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
