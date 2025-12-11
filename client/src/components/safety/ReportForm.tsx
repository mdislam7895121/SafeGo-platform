import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Flag, AlertTriangle, CheckCircle, Upload, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReportFormProps {
  targetId?: string;
  targetRole?: string;
  rideId?: string;
  orderId?: string;
  variant?: "dialog" | "inline" | "card";
  triggerText?: string;
  onSuccess?: () => void;
}

const reportCategories = [
  { value: "safety", label: "Safety Issue", description: "Dangerous driving, harassment, or physical threat" },
  { value: "fraud", label: "Fraud", description: "Payment fraud, fake accounts, or scams" },
  { value: "inappropriate_behavior", label: "Inappropriate Behavior", description: "Rude, offensive, or discriminatory conduct" },
  { value: "service_issue", label: "Service Issue", description: "Poor service quality, delays, or mistakes" },
  { value: "vehicle_issue", label: "Vehicle Issue", description: "Unsafe or unclean vehicle conditions" },
  { value: "policy_violation", label: "Policy Violation", description: "Violation of SafeGo community guidelines" },
  { value: "other", label: "Other", description: "Any other issue not listed above" },
];

const reportReasons = {
  safety: [
    "Dangerous driving",
    "Harassment",
    "Physical threat",
    "Intoxicated driver/rider",
    "Unsafe route",
    "Other safety concern",
  ],
  fraud: [
    "Payment fraud",
    "Fake account",
    "Price manipulation",
    "Refund scam",
    "Other fraud",
  ],
  inappropriate_behavior: [
    "Verbal abuse",
    "Discrimination",
    "Sexual harassment",
    "Unprofessional conduct",
    "Other inappropriate behavior",
  ],
  service_issue: [
    "Late arrival",
    "Wrong destination",
    "Cancellation issue",
    "Order incorrect",
    "Other service issue",
  ],
  vehicle_issue: [
    "Unclean vehicle",
    "Unsafe vehicle",
    "Vehicle does not match",
    "Missing safety features",
    "Other vehicle issue",
  ],
  policy_violation: [
    "Unauthorized stop",
    "Smoking",
    "Unauthorized passenger",
    "Cash demand",
    "Other policy violation",
  ],
  other: [
    "Other issue",
  ],
};

export function ReportForm({
  targetId,
  targetRole,
  rideId,
  orderId,
  variant = "dialog",
  triggerText = "Report Issue",
  onSuccess,
}: ReportFormProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const submitReportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/policy-safety/reports", {
        method: "POST",
        body: JSON.stringify({
          targetId,
          targetRole,
          rideId,
          orderId,
          category,
          reason,
          description,
        }),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Report Submitted",
        description: "Thank you for your report. We will review it shortly.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-safety/reports"] });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!category || !reason) {
      toast({
        title: "Missing Information",
        description: "Please select a category and reason for your report.",
        variant: "destructive",
      });
      return;
    }
    submitReportMutation.mutate();
  };

  const handleReset = () => {
    setCategory("");
    setReason("");
    setDescription("");
    setSubmitted(false);
  };

  const ReportFormContent = () => (
    <div className="space-y-4">
      {submitted ? (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Report Submitted</h3>
          <p className="text-muted-foreground mb-4">
            Thank you for helping keep SafeGo safe. Our team will review your report and take appropriate action.
          </p>
          <Button onClick={handleReset} variant="outline" data-testid="button-submit-another">
            Submit Another Report
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setReason(""); }}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {reportCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex flex-col">
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category && (
              <p className="text-xs text-muted-foreground">
                {reportCategories.find((c) => c.value === category)?.description}
              </p>
            )}
          </div>

          {category && (
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger data-testid="select-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {(reportReasons[category as keyof typeof reportReasons] || []).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Additional Details (optional)</Label>
            <Textarea
              placeholder="Please provide any additional details about the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              data-testid="input-description"
            />
          </div>

          {(category === "safety" || category === "fraud") && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                If you are in immediate danger, please call 911 or use the Emergency SOS button.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {rideId ? `Ride: ${rideId.slice(0, 8)}...` : orderId ? `Order: ${orderId.slice(0, 8)}...` : "General Report"}
            </Badge>
            {targetRole && (
              <Badge variant="outline">{targetRole}</Badge>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Report an Issue
          </CardTitle>
          <CardDescription>Help us maintain a safe community</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportFormContent />
          {!submitted && (
            <div className="mt-4">
              <Button
                onClick={handleSubmit}
                disabled={!category || !reason || submitReportMutation.isPending}
                className="w-full"
                data-testid="button-submit-report"
              >
                {submitReportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        <ReportFormContent />
        {!submitted && (
          <Button
            onClick={handleSubmit}
            disabled={!category || !reason || submitReportMutation.isPending}
            className="w-full"
            data-testid="button-submit-report"
          >
            {submitReportMutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-report-trigger">
          <Flag className="h-4 w-4 mr-2" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe and respectful community
          </DialogDescription>
        </DialogHeader>
        <ReportFormContent />
        {!submitted && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!category || !reason || submitReportMutation.isPending}
              data-testid="button-submit-report"
            >
              {submitReportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReportForm;
