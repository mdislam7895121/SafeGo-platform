import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatCurrency";
import { ArrowLeft, AlertCircle } from "lucide-react";

type Service = {
  id: string;
  type: string;
  label: string;
  date: string;
};

export default function CreateSupportTicket() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [serviceType, setServiceType] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [issueCategory, setIssueCategory] = useState<string>("");
  const [issueDescription, setIssueDescription] = useState<string>("");
  
  // Fetch recent orders/rides/deliveries
  const { data: foodOrders = [] } = useQuery<Service[]>({
    queryKey: ["/api/customer/food/orders"],
    enabled: serviceType === "food_order",
    select: (data: any) => {
      if (!Array.isArray(data.orders)) return [];
      return data.orders.slice(0, 10).map((order: any) => ({
        id: order.id,
        type: "food_order",
        label: `Food Order from ${order.restaurant?.restaurantName || "Unknown"} - ${formatCurrency(Number(order.totalAmount) || 0, "USD")}`,
        date: order.createdAt
      }));
    }
  });

  const { data: rides = [] } = useQuery<Service[]>({
    queryKey: ["/api/customer/rides"],
    enabled: serviceType === "ride",
    select: (data: any) => {
      if (!Array.isArray(data.rides)) return [];
      return data.rides.slice(0, 10).map((ride: any) => ({
        id: ride.id,
        type: "ride",
        label: `Ride on ${new Date(ride.createdAt).toLocaleDateString()} - ${formatCurrency(Number(ride.totalFare) || 0, "USD")}`,
        date: ride.createdAt
      }));
    }
  });

  const { data: deliveries = [] } = useQuery<Service[]>({
    queryKey: ["/api/customer/deliveries"],
    enabled: serviceType === "delivery",
    select: (data: any) => {
      if (!Array.isArray(data.deliveries)) return [];
      return data.deliveries.slice(0, 10).map((delivery: any) => ({
        id: delivery.id,
        type: "delivery",
        label: `Parcel to ${delivery.dropoffAddress || "Unknown"} - ${formatCurrency(Number(delivery.totalFare) || 0, "USD")}`,
        date: delivery.createdAt
      }));
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/customer/support/tickets", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Support ticket created",
        description: `Ticket ${data.ticket.ticketCode} has been created successfully`
      });
      navigate(`/customer/support-tickets/${data.ticket.id}`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create ticket",
        description: error.message || "Please try again"
      });
    }
  });

  const handleSubmit = () => {
    if (!serviceType || !serviceId || !issueCategory || !issueDescription.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields"
      });
      return;
    }

    createTicketMutation.mutate({
      serviceType,
      serviceId,
      issueCategory,
      issueDescription: issueDescription.trim(),
      priority: "medium"
    });
  };

  const getServicesForType = () => {
    switch (serviceType) {
      case "food_order":
        return foodOrders;
      case "ride":
        return rides;
      case "delivery":
        return deliveries;
      default:
        return [];
    }
  };

  const issueCategoryOptions: Record<string, { label: string; value: string }[]> = {
    food_order: [
      { label: "Wrong Items", value: "wrong_items" },
      { label: "Missing Items", value: "missing_items" },
      { label: "Food Quality Issue", value: "food_quality" },
      { label: "Late Delivery", value: "late_delivery" },
      { label: "Incorrect Charge", value: "incorrect_charge" },
      { label: "Other", value: "other" }
    ],
    ride: [
      { label: "Driver Behavior", value: "driver_behavior" },
      { label: "Wrong Route", value: "wrong_route" },
      { label: "Overcharge", value: "overcharge" },
      { label: "Safety Concern", value: "safety_concern" },
      { label: "Other", value: "other" }
    ],
    delivery: [
      { label: "Package Damaged", value: "package_damaged" },
      { label: "Package Lost", value: "package_lost" },
      { label: "Late Delivery", value: "late_delivery" },
      { label: "Wrong Address", value: "wrong_address" },
      { label: "Other", value: "other" }
    ]
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/customer/my-support-tickets")}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to My Tickets
      </Button>

      <Card>
        <CardHeader>
          <CardTitle data-testid="text-page-title">Report an Issue</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tell us what went wrong and we'll help resolve it
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="service-type">What type of service had an issue? *</Label>
            <Select value={serviceType} onValueChange={(value) => {
              setServiceType(value);
              setServiceId("");
              setIssueCategory("");
            }}>
              <SelectTrigger id="service-type" data-testid="select-service-type">
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food_order">Food Order</SelectItem>
                <SelectItem value="ride">Ride</SelectItem>
                <SelectItem value="delivery">Parcel Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Selection */}
          {serviceType && (
            <div className="space-y-2">
              <Label htmlFor="service">Which specific {serviceType.replace("_", " ")}? *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger id="service" data-testid="select-service">
                  <SelectValue placeholder={`Select ${serviceType.replace("_", " ")}`} />
                </SelectTrigger>
                <SelectContent>
                  {getServicesForType().length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No recent {serviceType.replace("_", " ")}s found
                    </div>
                  ) : (
                    getServicesForType().map((service) => (
                      <SelectItem key={service.id} value={service.id} data-testid={`option-service-${service.id}`}>
                        {service.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Issue Category */}
          {serviceType && (
            <div className="space-y-2">
              <Label htmlFor="category">What's the problem? *</Label>
              <Select value={issueCategory} onValueChange={setIssueCategory}>
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue placeholder="Select issue category" />
                </SelectTrigger>
                <SelectContent>
                  {(issueCategoryOptions[serviceType] || []).map((option) => (
                    <SelectItem key={option.value} value={option.value} data-testid={`option-category-${option.value}`}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Please describe the issue in detail *</Label>
            <Textarea
              id="description"
              placeholder="Tell us what happened, when it happened, and any other relevant details..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={6}
              data-testid="textarea-description"
            />
            <p className="text-xs text-muted-foreground">
              Be as specific as possible to help us resolve your issue faster
            </p>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>We'll review your issue within 24 hours</li>
                <li>The restaurant or our support team may reach out for more details</li>
                <li>You'll receive updates via notifications</li>
                <li>Most issues are resolved within 2-3 business days</li>
              </ul>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/customer/my-support-tickets")}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!serviceType || !serviceId || !issueCategory || !issueDescription.trim() || createTicketMutation.isPending}
              className="flex-1"
              data-testid="button-submit"
            >
              {createTicketMutation.isPending ? "Creating..." : "Submit Issue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
