import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Phone,
  Clock,
  Globe,
  CheckCircle2,
  PhoneCall,
  Calendar,
  AlertCircle,
} from "lucide-react";

const phoneNumbers = {
  bangladesh: {
    number: "+880 1234-567890",
    display: "+880 1234-567890",
    hours: "9:00 AM - 9:00 PM (GMT+6)",
    timezone: "Bangladesh Standard Time",
  },
  usa: {
    number: "+1 (555) 123-4567",
    display: "+1 (555) 123-4567",
    hours: "9:00 AM - 9:00 PM (EST)",
    timezone: "Eastern Standard Time",
  },
};

export default function SupportPhone() {
  const { toast } = useToast();
  const [selectedRegion, setSelectedRegion] = useState<"bangladesh" | "usa">("usa");
  const [callbackForm, setCallbackForm] = useState({
    phoneNumber: "",
    preferredTime: "",
    reason: "",
  });

  const requestCallbackMutation = useMutation({
    mutationFn: async (data: typeof callbackForm) => {
      return apiRequest("/api/restaurant/support-center/callbacks", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setCallbackForm({ phoneNumber: "", preferredTime: "", reason: "" });
      toast({
        title: "Callback requested",
        description: "We'll call you at your preferred time",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to request callback",
        variant: "destructive",
      });
    },
  });

  const handleCallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callbackForm.phoneNumber || !callbackForm.preferredTime || !callbackForm.reason) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    requestCallbackMutation.mutate(callbackForm);
  };

  const currentPhone = phoneNumbers[selectedRegion];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight" data-testid="text-page-title">
            Phone Support
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Speak directly with our support specialists for personalized assistance
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Call Now Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5" />
                Call Us Now
              </CardTitle>
              <CardDescription>
                Direct line to our support team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Region Selector */}
              <div className="space-y-2">
                <Label>Select Your Region</Label>
                <Select
                  value={selectedRegion}
                  onValueChange={(value) => setSelectedRegion(value as "bangladesh" | "usa")}
                >
                  <SelectTrigger data-testid="select-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bangladesh" data-testid="option-bangladesh">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Bangladesh
                      </div>
                    </SelectItem>
                    <SelectItem value="usa" data-testid="option-usa">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        United States
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Phone Number Display */}
              <div className="space-y-4">
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                    <Phone className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold" data-testid="text-phone-number">
                      {currentPhone.display}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{currentPhone.hours}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentPhone.timezone}
                    </p>
                  </div>
                  <a href={`tel:${currentPhone.number}`}>
                    <Button size="lg" className="w-full max-w-xs" data-testid="button-call-now">
                      <PhoneCall className="h-4 w-4 mr-2" />
                      Call Now
                    </Button>
                  </a>
                </div>

                {/* Operating Hours Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Operating Hours</p>
                      <p className="text-muted-foreground">
                        Monday - Friday: 9:00 AM - 9:00 PM
                      </p>
                      <p className="text-muted-foreground">
                        Saturday - Sunday: 10:00 AM - 6:00 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Request Callback Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Request a Callback
              </CardTitle>
              <CardDescription>
                We'll call you at your preferred time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCallbackSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone-number">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={callbackForm.phoneNumber}
                    onChange={(e) =>
                      setCallbackForm({ ...callbackForm, phoneNumber: e.target.value })
                    }
                    data-testid="input-phone-number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferred-time">
                    Preferred Time <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={callbackForm.preferredTime}
                    onValueChange={(value) =>
                      setCallbackForm({ ...callbackForm, preferredTime: value })
                    }
                  >
                    <SelectTrigger id="preferred-time" data-testid="select-preferred-time">
                      <SelectValue placeholder="Select a time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning" data-testid="option-morning">Morning (9AM - 12PM)</SelectItem>
                      <SelectItem value="afternoon" data-testid="option-afternoon">Afternoon (12PM - 5PM)</SelectItem>
                      <SelectItem value="evening" data-testid="option-evening">Evening (5PM - 9PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">
                    Reason for Call <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="Briefly describe what you need help with..."
                    value={callbackForm.reason}
                    onChange={(e) =>
                      setCallbackForm({ ...callbackForm, reason: e.target.value })
                    }
                    rows={4}
                    data-testid="input-reason"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={requestCallbackMutation.isPending}
                  data-testid="button-request-callback"
                >
                  {requestCallbackMutation.isPending ? "Submitting..." : "Request Callback"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Benefits */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                <p className="font-semibold">Personal Touch</p>
                <p className="text-sm text-muted-foreground">
                  Speak directly with support specialists
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <Globe className="h-8 w-8 text-blue-600 mx-auto" />
                <p className="font-semibold">Global Support</p>
                <p className="text-sm text-muted-foreground">
                  Local phone numbers in your region
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <Clock className="h-8 w-8 text-purple-600 mx-auto" />
                <p className="font-semibold">Flexible Hours</p>
                <p className="text-sm text-muted-foreground">
                  Extended support hours Mon-Fri
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
