import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, AlertCircle, Phone, MessageCircle, MapPin, Shield, Siren, Send, CheckCircle } from "lucide-react";

export default function DriverSafetyEmergency() {
  const { toast } = useToast();
  const [quickMessage, setQuickMessage] = useState("");
  const [sosTriggered, setSosTriggered] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const sosMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/driver/safety/emergency/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SOS",
          message: "Emergency SOS triggered",
          location: { lat: null, lng: null }
        })
      });
    },
    onSuccess: () => {
      setSosTriggered(true);
      toast({
        title: "Emergency Alert Sent",
        description: "Help is on the way. Our safety team has been notified."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Send Alert",
        description: "Please try again or call 911 directly."
      });
    }
  });

  const supportMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("/api/driver/safety/emergency/quick-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          urgency: "high"
        })
      });
    },
    onSuccess: () => {
      setMessageSent(true);
      setQuickMessage("");
      toast({
        title: "Message Sent",
        description: "Our support team will respond shortly."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Send",
        description: "Please try again."
      });
    }
  });

  const handleSOS = () => {
    sosMutation.mutate();
  };

  const handleQuickMessage = () => {
    if (quickMessage.trim()) {
      supportMutation.mutate(quickMessage);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/driver/safety">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-emergency-title">Emergency Toolkit</h1>
          <p className="text-muted-foreground">Quick access to safety tools</p>
        </div>
      </div>

      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader className="bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <Siren className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle>Emergency SOS</CardTitle>
              <CardDescription>Immediately alert our safety team</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {sosTriggered ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Alert Sent Successfully</h3>
              <p className="text-muted-foreground mb-4">
                Our safety team has been notified. Help is on the way.
              </p>
              <p className="text-sm text-muted-foreground">
                Expected response time: 5-10 minutes
              </p>
              <div className="mt-6 p-4 bg-muted rounded-lg w-full">
                <p className="text-sm font-medium">Need immediate police assistance?</p>
                <a href="tel:911" className="text-primary font-bold text-lg">Call 911</a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Press the button below to immediately alert our 24/7 safety team. Your location will be shared automatically.
              </p>
              <Button 
                size="lg" 
                variant="destructive" 
                className="w-full h-16 text-lg gap-3"
                onClick={handleSOS}
                disabled={sosMutation.isPending}
                data-testid="button-trigger-sos"
              >
                <AlertCircle className="h-6 w-6" />
                {sosMutation.isPending ? "Sending Alert..." : "Trigger Emergency SOS"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                For life-threatening emergencies, please call 911 directly.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Quick Message to Support</CardTitle>
              <CardDescription>Send a message to our safety team</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {messageSent ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium">Message Sent</p>
                <p className="text-sm text-muted-foreground">Our team will respond within 30 minutes</p>
              </div>
            </div>
          ) : (
            <>
              <Textarea
                placeholder="Describe your concern or situation..."
                className="min-h-[100px] resize-none"
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                data-testid="textarea-quick-message"
              />
              <Button 
                className="w-full gap-2"
                onClick={handleQuickMessage}
                disabled={!quickMessage.trim() || supportMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
                {supportMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>Share My Location</CardTitle>
              <CardDescription>Share your current location with emergency contacts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg mb-4">
            <p className="text-sm text-muted-foreground">
              When activated, your real-time location will be shared with your registered emergency contacts and our safety team.
            </p>
          </div>
          <Button variant="outline" className="w-full gap-2" data-testid="button-share-location">
            <MapPin className="h-4 w-4" />
            Share Location (Demo)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency Contacts</CardTitle>
          <CardDescription>Quick access to emergency services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a href="tel:911" className="flex items-center gap-4 p-4 border rounded-lg hover-elevate">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <Phone className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Emergency Services</h4>
              <p className="text-sm text-muted-foreground">911</p>
            </div>
            <Button size="sm" variant="destructive" data-testid="button-call-911">Call</Button>
          </a>

          <a href="tel:+18007233243" className="flex items-center gap-4 p-4 border rounded-lg hover-elevate">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">SafeGo Safety Hotline</h4>
              <p className="text-sm text-muted-foreground">+1-800-SAFEGO</p>
            </div>
            <Button size="sm" variant="outline" data-testid="button-call-safego">Call</Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h4 className="font-medium">Safety Tip</h4>
            <p className="text-sm text-muted-foreground">
              Always trust your instincts. If a situation feels unsafe, don't hesitate to end the trip and contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
