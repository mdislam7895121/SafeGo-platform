import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Phone,
  Mail,
  HelpCircle,
  FileText,
  ChevronRight,
  Shield,
  AlertTriangle,
  Car,
  UtensilsCrossed,
  Package,
} from "lucide-react";

const supportCategories = [
  {
    id: "ride",
    title: "Ride Issues",
    description: "Problems with your ride or driver",
    icon: Car,
    href: "/rider/support/rides",
  },
  {
    id: "food",
    title: "Food Order Issues",
    description: "Issues with your food delivery",
    icon: UtensilsCrossed,
    href: "/rider/support/food",
  },
  {
    id: "parcel",
    title: "Parcel Issues",
    description: "Problems with package delivery",
    icon: Package,
    href: "/rider/support/parcels",
  },
  {
    id: "payment",
    title: "Payment & Refunds",
    description: "Billing and payment issues",
    icon: FileText,
    href: "/rider/support/payments",
  },
  {
    id: "account",
    title: "Account Help",
    description: "Account settings and access",
    icon: HelpCircle,
    href: "/rider/support/account",
  },
  {
    id: "safety",
    title: "Safety Concern",
    description: "Report a safety issue",
    icon: Shield,
    href: "/rider/support/safety",
  },
];

const quickActions = [
  {
    id: "chat",
    title: "Live Chat",
    description: "Chat with support now",
    icon: MessageSquare,
    href: "/rider/support/chat",
    primary: true,
  },
  {
    id: "phone",
    title: "Call Us",
    description: "Speak to an agent",
    icon: Phone,
    href: "/rider/support/call",
  },
  {
    id: "email",
    title: "Email Support",
    description: "Get help via email",
    icon: Mail,
    href: "/rider/support/email",
  },
];

export default function RiderSupport() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-support-title">
          Support
        </h1>
        <p className="text-muted-foreground">
          How can we help you today?
        </p>
      </div>

      <Card className="border-orange-500/50 bg-orange-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-700 dark:text-orange-400">
                Need urgent help?
              </p>
              <p className="text-sm text-muted-foreground">
                For emergencies, please call local emergency services or use our in-app emergency button during your trip.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link key={action.id} href={action.href}>
            <Card 
              className={`hover-elevate cursor-pointer h-full ${
                action.primary ? "border-primary bg-primary/5" : ""
              }`}
              data-testid={`support-action-${action.id}`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  action.primary 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                }`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What do you need help with?</CardTitle>
          <CardDescription>
            Select a category to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {supportCategories.map((category) => (
              <Link key={category.id} href={category.href}>
                <button
                  className="w-full flex items-center justify-between p-4 hover-elevate text-left"
                  data-testid={`support-category-${category.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <category.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{category.title}</p>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Popular Help Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              "How to request a refund",
              "Change my delivery address",
              "Report a missing item",
              "Update payment method",
              "Cancel my order",
              "Contact my driver",
            ].map((topic, i) => (
              <Link key={i} href={`/rider/help?q=${encodeURIComponent(topic)}`}>
                <Button variant="ghost" className="w-full justify-start h-auto py-2" data-testid={`link-help-topic-${i}`}>
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                  {topic}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
