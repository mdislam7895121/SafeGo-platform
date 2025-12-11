import { useState } from "react";
import { Link } from "wouter";
import { MessageSquare, AlertCircle, CheckCircle, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import GlobalFooter from "@/components/landing/GlobalFooter";

const ISSUE_TYPES = [
  { value: "ride", label: "Ride Issue" },
  { value: "food", label: "Food Delivery Issue" },
  { value: "parcel", label: "Parcel Delivery Issue" },
  { value: "payment", label: "Payment Problem" },
  { value: "account", label: "Account Issue" },
  { value: "safety", label: "Safety Concern" },
  { value: "driver", label: "Driver/Partner Issue" },
  { value: "app", label: "App Technical Issue" },
  { value: "other", label: "Other" },
];

export default function SupportPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    issueType: "",
    orderId: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setSubmitted(true);
    toast({
      title: "Report Submitted",
      description: "We've received your issue report and will respond within 24 hours.",
    });
  };

  if (submitted) {
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
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Report Submitted Successfully
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for reaching out. Our support team will review your report and respond within 24 hours.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
              <Clock className="h-4 w-4" />
              <span>Expected response time: 24 hours</span>
            </div>
            <Link href="/">
              <Button>Return to Home</Button>
            </Link>
          </div>
        </main>

        <GlobalFooter />
      </div>
    );
  }

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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <MessageSquare className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Report an Issue
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Having trouble? Let us know and we'll help resolve it.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Issue Details</CardTitle>
              <CardDescription>
                Please provide as much detail as possible to help us resolve your issue quickly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="input-support-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="input-support-email"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <Input
                      id="phone"
                      placeholder="+1 234 567 8900"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="input-support-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orderId">Order/Trip ID (Optional)</Label>
                    <Input
                      id="orderId"
                      placeholder="e.g., ORD-123456"
                      value={formData.orderId}
                      onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                      data-testid="input-support-order-id"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issueType">Issue Type</Label>
                  <Select
                    value={formData.issueType}
                    onValueChange={(value) => setFormData({ ...formData, issueType: value })}
                    required
                  >
                    <SelectTrigger data-testid="select-issue-type">
                      <SelectValue placeholder="Select issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Please describe your issue in detail..."
                    className="min-h-[120px]"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    data-testid="textarea-support-description"
                  />
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>Safety issues?</strong> If this is an urgent safety concern, please use the 
                      in-app SOS button or call emergency services directly.
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                  data-testid="button-submit-support"
                >
                  {isSubmitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Report
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
