import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  Send,
  Ticket,
  ArrowLeft,
  Clock,
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface SupportCategory {
  value: string;
  label: string;
  description: string;
  icon: string;
  subcategories: { value: string; label: string }[];
}

const categoryIcons: Record<string, typeof FileText> = {
  account_documents: FileText,
  trip_issues: Car,
  payment_earnings: DollarSign,
  incentives_promotions: Gift,
  safety_emergency: Shield,
  app_technical: Smartphone,
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export default function DriverSupportContact() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    subcategory: "",
    priority: "normal",
    description: "",
  });

  const { data: categoriesData } = useQuery<{ categories: SupportCategory[] }>({
    queryKey: ["/api/driver/support-center/support-categories"],
  });

  const { data: ticketsData, isLoading: isLoadingTickets } = useQuery<{ tickets: any[] }>({
    queryKey: ["/api/driver/support-center/tickets"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/driver/support-center/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/support-center/tickets"] });
      setFormData({ subject: "", category: "", subcategory: "", priority: "normal", description: "" });
      toast({
        title: "Ticket created",
        description: `Your support ticket ${data.ticket?.ticketCode || ''} has been submitted successfully.`,
      });
      if (data.ticket?.id) {
        setLocation(`/driver/support-ticket/${data.ticket.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create support ticket",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.category || !formData.description) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createTicketMutation.mutate(formData);
  };

  const categories = categoriesData?.categories || [];
  const selectedCategory = categories.find(c => c.value === formData.category);
  const subcategories = selectedCategory?.subcategories || [];
  const tickets = ticketsData?.tickets || [];
  const activeTickets = tickets.filter(t => t.status !== "closed" && t.status !== "resolved");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/driver/support">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Create Support Ticket</h1>
            <p className="text-muted-foreground mt-1">
              Describe your issue and our team will respond within 24 hours
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                New Support Request
              </CardTitle>
              <CardDescription>
                Fill out the form below with details about your issue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of your issue"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    data-testid="input-ticket-subject"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: "" })}
                    >
                      <SelectTrigger id="category" data-testid="select-ticket-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="account_documents">Account & Documents</SelectItem>
                        <SelectItem value="trip_issues">Trip Issues</SelectItem>
                        <SelectItem value="payment_earnings">Payment & Earnings</SelectItem>
                        <SelectItem value="incentives_promotions">Incentives & Promotions</SelectItem>
                        <SelectItem value="safety_emergency">Safety & Emergency</SelectItem>
                        <SelectItem value="app_technical">App & Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select
                      value={formData.subcategory}
                      onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                      disabled={!formData.category || subcategories.length === 0}
                    >
                      <SelectTrigger id="subcategory" data-testid="select-ticket-subcategory">
                        <SelectValue placeholder={formData.category ? "Select subcategory" : "Select category first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.value} value={sub.value}>
                            {sub.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger id="priority" data-testid="select-ticket-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - General question</SelectItem>
                      <SelectItem value="normal">Normal - Issue affecting work</SelectItem>
                      <SelectItem value="high">High - Urgent issue</SelectItem>
                      <SelectItem value="urgent">Urgent - Critical problem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide detailed information about your issue. Include any relevant trip IDs, dates, or screenshots..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    data-testid="textarea-ticket-description"
                  />
                  <p className="text-xs text-muted-foreground">
                    The more details you provide, the faster we can help resolve your issue.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createTicketMutation.isPending}
                  data-testid="button-submit-ticket"
                >
                  {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                  Need Faster Help?
                </CardTitle>
                <CardDescription>
                  Chat with our support team in real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Get instant responses from our 24/7 support team
                </p>
                <Link href="/driver/support/live-chat">
                  <Button className="w-full" data-testid="button-start-chat">
                    Start Live Chat
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Driver Support Line</p>
                  <p className="text-sm text-muted-foreground">1-800-SAFEGO-D</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">drivers@safego.com</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium">Emergency Line</p>
                  <p className="text-sm text-muted-foreground">Available 24/7 for safety concerns</p>
                </div>
              </CardContent>
            </Card>

            {activeTickets.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Active Tickets</CardTitle>
                    <Badge variant="secondary">{activeTickets.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeTickets.slice(0, 3).map((ticket: any) => {
                    const CategoryIcon = categoryIcons[ticket.category] || HelpCircle;
                    const status = statusConfig[ticket.status] || statusConfig.open;
                    return (
                      <Link key={ticket.id} href={`/driver/support-ticket/${ticket.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer" data-testid={`card-active-ticket-${ticket.id}`}>
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ticket.subject}</p>
                            <p className="text-xs text-muted-foreground">{ticket.ticketCode}</p>
                          </div>
                          <Badge className={status.color} variant="outline">
                            {status.label}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                  {activeTickets.length > 3 && (
                    <Link href="/driver/support-tickets">
                      <Button variant="ghost" className="w-full text-sm" size="sm" data-testid="button-view-all-tickets">
                        View all tickets
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {tickets.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Recent Tickets
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Track the status of your support requests
                  </CardDescription>
                </div>
                <Link href="/driver/support-tickets">
                  <Button variant="outline" size="sm" data-testid="button-all-tickets">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket: any) => {
                  const CategoryIcon = categoryIcons[ticket.category] || HelpCircle;
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
                                    {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                                  </span>
                                  {ticket._count?.messages > 0 && (
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
