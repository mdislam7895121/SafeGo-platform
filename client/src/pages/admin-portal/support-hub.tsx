import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  ArrowRight,
  Globe,
} from "lucide-react";

export default function SupportHub() {
  const supportChannels = [
    {
      id: "live-chat",
      title: "Live Chat",
      description: "Get instant help from our support team",
      icon: MessageSquare,
      availability: "Available 24/7",
      responseTime: "Instant responses",
      link: "/admin/support/live-chat",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      badge: "Fastest",
      testId: "channel-live-chat"
    },
    {
      id: "phone",
      title: "Phone Support",
      description: "Speak directly with our support specialists",
      icon: Phone,
      availability: "Mon-Fri, 9AM-9PM",
      responseTime: "Call us anytime",
      link: "/admin/support/phone",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      badge: "Personal",
      testId: "channel-phone"
    },
    {
      id: "email",
      title: "Email Support",
      description: "Create a ticket for detailed assistance",
      icon: Mail,
      availability: "Available 24/7",
      responseTime: "Within 24 hours",
      link: "/admin/support/contact",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      badge: "Detailed",
      testId: "channel-email"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight" data-testid="text-page-title">
            How can we help you?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choose your preferred way to get support. Our team is ready to assist you with any questions or issues.
          </p>
        </div>

        {/* Support Channels */}
        <div className="grid gap-6 md:grid-cols-3">
          {supportChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Link key={channel.id} href={channel.link}>
                <Card 
                  className="hover-elevate active-elevate-2 cursor-pointer h-full transition-all relative overflow-hidden group"
                  data-testid={channel.testId}
                >
                  <div className={`absolute top-0 right-0 ${channel.bgColor} px-3 py-1 rounded-bl-lg`}>
                    <span className={`text-xs font-semibold ${channel.color}`}>
                      {channel.badge}
                    </span>
                  </div>
                  
                  <CardHeader className="space-y-4 pt-8">
                    <div className={`w-14 h-14 ${channel.bgColor} rounded-2xl flex items-center justify-center`}>
                      <Icon className={`h-7 w-7 ${channel.color}`} />
                    </div>
                    
                    <div className="space-y-2">
                      <CardTitle className="text-2xl">{channel.title}</CardTitle>
                      <CardDescription className="text-base">
                        {channel.description}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{channel.availability}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{channel.responseTime}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-between group-hover:translate-x-1 transition-transform"
                        data-testid={`button-${channel.id}`}
                      >
                        <span>Get Started</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and helpful resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/admin/support/help">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-help-center">
                  <Globe className="h-4 w-4" />
                  Browse Help Center
                </Button>
              </Link>
              <Link href="/admin/support/status">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-system-status">
                  <CheckCircle2 className="h-4 w-4" />
                  Check System Status
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Support Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-green-600">99.9%</p>
                <p className="text-sm text-muted-foreground">Uptime</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-blue-600">&lt;2min</p>
                <p className="text-sm text-muted-foreground">Avg. Chat Response</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-purple-600">24/7</p>
                <p className="text-sm text-muted-foreground">Support Available</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
