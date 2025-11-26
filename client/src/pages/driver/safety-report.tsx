import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, FileText, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "wouter";

const reportSchema = z.object({
  category: z.enum([
    "RIDER_MISCONDUCT",
    "VEHICLE_DAMAGE",
    "PAYMENT_DISPUTE",
    "LOST_AND_FOUND",
    "HARASSMENT_THREAT",
    "UNSAFE_LOCATION",
    "OTHER"
  ], { required_error: "Please select an incident category" }),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  incidentDate: z.string().min(1, "Please select a date"),
  tripId: z.string().optional(),
  tripType: z.enum(["RIDE", "FOOD", "PARCEL"]).optional(),
  locationAddress: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

const CATEGORY_OPTIONS = [
  { value: "RIDER_MISCONDUCT", label: "Rider Misconduct", description: "Inappropriate behavior, verbal abuse, etc." },
  { value: "VEHICLE_DAMAGE", label: "Vehicle Damage", description: "Damage caused during a trip" },
  { value: "PAYMENT_DISPUTE", label: "Payment Dispute", description: "Non-financial payment issues" },
  { value: "LOST_AND_FOUND", label: "Lost & Found", description: "Items left behind by riders" },
  { value: "HARASSMENT_THREAT", label: "Harassment/Threat", description: "Threats or harassment incidents" },
  { value: "UNSAFE_LOCATION", label: "Unsafe Location Issue", description: "Dangerous pickup/dropoff locations" },
  { value: "OTHER", label: "Other", description: "Other safety concerns" }
];

export default function DriverSafetyReport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      category: undefined,
      description: "",
      incidentDate: new Date().toISOString().split('T')[0],
      tripId: "",
      tripType: undefined,
      locationAddress: ""
    }
  });

  const reportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      const response = await apiRequest("POST", "/api/driver/safety/report", data);
      return response.json();
    },
    onSuccess: () => {
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/driver/safety/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/safety/incidents"] });
      toast({
        title: "Incident Reported",
        description: "Your safety incident has been submitted successfully."
      });
      setTimeout(() => {
        navigate("/driver/safety/history");
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Submit",
        description: error.message || "Unable to report incident. Please try again."
      });
      setIsSubmitting(false);
    }
  });

  const onSubmit = async (data: ReportFormData) => {
    setIsSubmitting(true);
    reportMutation.mutate(data);
  };

  if (isSuccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Incident Reported</h2>
            <p className="text-muted-foreground mb-6">
              Your incident has been submitted successfully. Our safety team will review it shortly.
            </p>
            <Link href="/driver/safety/history">
              <Button data-testid="button-view-history">View Incident History</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/driver/safety">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-report-title">Report Safety Incident</h1>
          <p className="text-muted-foreground">File a report for any safety concerns</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Incident Details</CardTitle>
              <CardDescription>Provide as much detail as possible</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem 
                            key={option.value} 
                            value={option.value}
                            data-testid={`option-category-${option.value.toLowerCase()}`}
                          >
                            <div>
                              <div className="font-medium">{option.label}</div>
                              <div className="text-sm text-muted-foreground">{option.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="incidentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Incident *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-incident-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe what happened in detail. Include any relevant information such as time, location, and people involved..."
                        className="min-h-[150px] resize-none"
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 10 characters. Be as detailed as possible.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tripType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trip Type (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trip-type">
                          <SelectValue placeholder="Select if related to a specific trip type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RIDE">Ride</SelectItem>
                        <SelectItem value="FOOD">Food Delivery</SelectItem>
                        <SelectItem value="PARCEL">Parcel Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter the address or location where the incident occurred"
                        {...field}
                        data-testid="input-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-3">
                  <Upload className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="font-medium">Attach Evidence (Coming Soon)</h4>
                    <p className="text-sm text-muted-foreground">
                      Photo and video upload will be available in a future update
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    For immediate emergencies, please use the Emergency SOS button
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    This form is for reporting incidents after they occur.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Link href="/driver/safety" className="flex-1">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={isSubmitting}
                  data-testid="button-submit-report"
                >
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
