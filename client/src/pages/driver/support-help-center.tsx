import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
  ChevronRight,
  Send,
  Ticket,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Upload,
  X,
} from "lucide-react";

interface SupportCategory {
  value: string;
  label: string;
  description: string;
  icon: string;
  subcategories: { value: string; label: string }[];
}

const iconMap: Record<string, typeof FileText> = {
  FileText,
  Car,
  DollarSign,
  Gift,
  Shield,
  Smartphone,
};

export default function DriverSupportHelpCenter() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"categories" | "form">("categories");
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);
  const [formData, setFormData] = useState({
    subject: "",
    subcategory: "",
    tripId: "",
    description: "",
    priority: "normal",
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{ categories: SupportCategory[] }>({
    queryKey: ["/api/driver/support-center/support-categories"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/driver/support-center/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/support-center/tickets"] });
      toast({
        title: "Ticket Created",
        description: `Your support request ${response.ticket?.ticketCode || ""} has been submitted.`,
      });
      setLocation("/driver/support-tickets");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create support ticket",
        variant: "destructive",
      });
    },
  });

  const handleCategorySelect = (category: SupportCategory) => {
    setSelectedCategory(category);
    setStep("form");
    setFormData({ ...formData, subject: "", subcategory: "", description: "" });
  };

  const handleBack = () => {
    setStep("categories");
    setSelectedCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !formData.subject || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createTicketMutation.mutate({
      subject: formData.subject,
      category: selectedCategory.value,
      subcategory: formData.subcategory || null,
      tripId: formData.tripId || null,
      description: formData.description,
      priority: formData.priority,
    });
  };

  const categories = categoriesData?.categories || [];

  if (categoriesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-64" />
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {step === "categories" && (
          <>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
                Help Center
              </h1>
              <p className="text-muted-foreground mt-2">
                What do you need help with?
              </p>
            </div>

            <div className="grid gap-3">
              {categories.map((category) => {
                const IconComponent = iconMap[category.icon] || FileText;
                return (
                  <Card
                    key={category.value}
                    className="hover-elevate cursor-pointer transition-all"
                    onClick={() => handleCategorySelect(category)}
                    data-testid={`card-category-${category.value}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-primary/10">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base">{category.label}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {category.description}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Separator className="my-6" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                className="hover-elevate cursor-pointer"
                onClick={() => setLocation("/driver/support-tickets")}
                data-testid="card-view-tickets"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">View My Tickets</p>
                    <p className="text-sm text-muted-foreground">Check ticket status</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="hover-elevate cursor-pointer"
                onClick={() => setLocation("/driver/support-hub")}
                data-testid="card-support-hub"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Live Support</p>
                    <p className="text-sm text-muted-foreground">Chat or call us</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {step === "form" && selectedCategory && (
          <>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-category-title">
                  {selectedCategory.label}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory.description}
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create Support Ticket</CardTitle>
                <CardDescription>
                  Please provide details about your issue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {selectedCategory.subcategories.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="subcategory">Issue Type</Label>
                      <Select
                        value={formData.subcategory}
                        onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                      >
                        <SelectTrigger id="subcategory" data-testid="select-subcategory">
                          <SelectValue placeholder="Select issue type" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCategory.subcategories.map((sub) => (
                            <SelectItem key={sub.value} value={sub.value}>
                              {sub.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Brief summary of your issue"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      data-testid="input-subject"
                    />
                  </div>

                  {(selectedCategory.value === "trip_issues" || selectedCategory.value === "payment_earnings") && (
                    <div className="space-y-2">
                      <Label htmlFor="tripId">Trip/Order ID (Optional)</Label>
                      <Input
                        id="tripId"
                        placeholder="Enter trip or order ID if applicable"
                        value={formData.tripId}
                        onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                        data-testid="input-trip-id"
                      />
                      <p className="text-xs text-muted-foreground">
                        Find this in your trip history or earnings breakdown
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger id="priority" data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gray-400" />
                            Low - General question
                          </div>
                        </SelectItem>
                        <SelectItem value="normal">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            Normal - Standard issue
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                            High - Affecting earnings
                          </div>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                            Urgent - Critical issue
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Please describe your issue in detail. Include any relevant information that can help us assist you faster."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={6}
                      data-testid="textarea-description"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1"
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createTicketMutation.isPending || !formData.subject || !formData.description}
                      data-testid="button-submit"
                    >
                      {createTicketMutation.isPending ? (
                        <>Submitting...</>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit Ticket
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {selectedCategory.value === "safety_emergency" && (
              <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900 dark:text-red-100">
                        Emergency?
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        If you are in immediate danger, please call emergency services (911) immediately.
                        Our support team will respond to safety tickets as a priority.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
