import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  ArrowRight,
  Book,
  Ticket,
  AlertCircle,
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
  ChevronRight,
  Plus,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SupportTicket {
  id: string;
  ticketCode: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

const categoryIcons: Record<string, typeof FileText> = {
  account_documents: FileText,
  trip_issues: Car,
  payment_earnings: DollarSign,
  incentives_promotions: Gift,
  safety_emergency: Shield,
  app_technical: Smartphone,
};

const categoryLabels: Record<string, string> = {
  account_documents: "Account & Documents",
  trip_issues: "Trip Issues",
  payment_earnings: "Payment & Earnings",
  incentives_promotions: "Incentives & Promotions",
  safety_emergency: "Safety & Emergency",
  app_technical: "App & Technical",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export default function DriverSupportHub() {
  const { data: ticketsData, isLoading } = useQuery<{
    tickets: SupportTicket[];
    total: number;
  }>({
    queryKey: ["/api/driver/support-center/tickets"],
  });

  const tickets = ticketsData?.tickets || [];
  const openTickets = tickets.filter(t => t.status === "open" || t.status === "in_progress");
  const resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");

  const supportChannels = [
    {
      id: "live-chat",
      title: "Live Chat",
      description: "Get instant help from our support team",
      icon: MessageSquare,
      availability: "Available 24/7",
      responseTime: "Instant responses",
      link: "/driver/support/live-chat",
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
      availability: "Mon-Sun, 6AM-12AM",
      responseTime: "Average wait: 2 min",
      link: "/driver/support/phone",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      badge: "Personal",
      testId: "channel-phone"
    },
    {
      id: "ticket",
      title: "Submit Ticket",
      description: "Create a detailed support request",
      icon: Mail,
      availability: "Available 24/7",
      responseTime: "Within 24 hours",
      link: "/driver/support/contact",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      badge: "Detailed",
      testId: "channel-ticket"
    },
  ];

  const quickActions = [
    { label: "Help Center", icon: Book, link: "/driver/support/help", testId: "action-help" },
    { label: "My Tickets", icon: Ticket, link: "/driver/support-tickets", testId: "action-tickets" },
    { label: "System Status", icon: CheckCircle2, link: "/driver/support/status", testId: "action-status" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight" data-testid="text-page-title">
            How can we help you?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choose your preferred way to get support. Our team is ready to assist you with any questions or issues.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-blue-600" data-testid="stat-open-tickets">{openTickets.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Open Tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-green-600" data-testid="stat-resolved-tickets">{resolvedTickets.length}</p>
                )}
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-purple-600">&lt;2min</p>
                <p className="text-sm text-muted-foreground">Avg. Chat Response</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-orange-600">24/7</p>
                <p className="text-sm text-muted-foreground">Support Available</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {supportChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Link key={channel.id} href={channel.link}>
                <Card 
                  className="hover-elevate active-elevate-2 cursor-pointer h-full transition-all relative overflow-visible group"
                  data-testid={channel.testId}
                >
                  <div className={`absolute top-0 right-0 ${channel.bgColor} px-3 py-1 rounded-bl-lg rounded-tr-md`}>
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
                        className="w-full justify-between"
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

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and helpful resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.testId} href={action.link}>
                    <Button variant="outline" className="w-full justify-start gap-2" data-testid={`button-${action.testId}`}>
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {openTickets.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    Active Support Tickets
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Tickets awaiting response or in progress
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/driver/support/contact">
                    <Button size="sm" data-testid="button-new-ticket">
                      <Plus className="h-4 w-4 mr-1" />
                      New Ticket
                    </Button>
                  </Link>
                  <Link href="/driver/support-tickets">
                    <Button variant="outline" size="sm" data-testid="button-view-all">
                      View All
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {openTickets.slice(0, 5).map((ticket) => {
                    const CategoryIcon = categoryIcons[ticket.category] || FileText;
                    const status = statusConfig[ticket.status] || statusConfig.open;
                    return (
                      <Link key={ticket.id} href={`/driver/support-ticket/${ticket.id}`}>
                        <Card className="hover-elevate cursor-pointer" data-testid={`card-ticket-${ticket.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 rounded-lg bg-muted">
                                  <CategoryIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className="font-semibold truncate">{ticket.subject}</h4>
                                    <Badge className={status.color} variant="outline">
                                      {status.label}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                    <span className="truncate">{ticket.ticketCode}</span>
                                    <span className="flex items-center gap-1 shrink-0">
                                      <Clock className="h-3 w-3" />
                                      {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                                    </span>
                                    {ticket._count?.messages && ticket._count.messages > 0 && (
                                      <span className="flex items-center gap-1 shrink-0">
                                        <MessageSquare className="h-3 w-3" />
                                        {ticket._count.messages} messages
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Safety Concerns?</h3>
                  <p className="text-sm text-muted-foreground">
                    Report any safety incidents or emergencies immediately
                  </p>
                </div>
              </div>
              <Link href="/driver/support/contact">
                <Button variant="default" data-testid="button-report-safety">
                  Report Safety Issue
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
