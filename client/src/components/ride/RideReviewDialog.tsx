import { useState } from "react";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DriverInfo {
  name: string;
  avatarInitials: string;
  carModel: string;
  carColor: string;
  plateNumber: string;
}

interface RideReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string | null;
  driver: DriverInfo | null;
  onSuccess?: (rating: number, tip: number | null) => void;
  onSkip?: () => void;
  isDemoMode?: boolean;
}

const TIP_OPTIONS = [
  { value: null, label: "No tip" },
  { value: 2, label: "$2" },
  { value: 4, label: "$4" },
  { value: 6, label: "$6" },
];

export function RideReviewDialog({
  open,
  onOpenChange,
  rideId,
  driver,
  onSuccess,
  onSkip,
  isDemoMode = true,
}: RideReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setComment("");
    setSelectedTip(null);
    setHasSubmitted(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating for your driver",
        variant: "destructive",
      });
      return;
    }

    if (hasSubmitted) {
      toast({
        title: "Already submitted",
        description: "You have already rated this ride",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isDemoMode && rideId) {
        await apiRequest(`/api/rides/${rideId}/rate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            comment: comment.trim() || undefined,
            raterType: "customer",
          }),
        });
      }

      setHasSubmitted(true);

      toast({
        title: "Thank you!",
        description: `You rated ${driver?.name || "your driver"} ${rating} star${rating !== 1 ? "s" : ""}`,
      });

      if (onSuccess) {
        onSuccess(rating, selectedTip);
      }

      handleOpenChange(false);
    } catch (error: any) {
      if (error.message?.includes("already rated")) {
        setHasSubmitted(true);
        toast({
          title: "Already rated",
          description: "You have already rated this ride",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to submit rating",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    handleOpenChange(false);
  };

  const getRatingLabel = (value: number): string => {
    switch (value) {
      case 1: return "Poor";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Very Good";
      case 5: return "Excellent";
      default: return "";
    }
  };

  if (!driver) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl">How was your ride?</DialogTitle>
          <DialogDescription>
            Rate your experience with {driver.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Driver info */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-2xl">
                {driver.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="font-semibold text-lg">{driver.name}</p>
              <p className="text-sm text-muted-foreground">
                {driver.carModel} · {driver.carColor}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {driver.plateNumber}
              </p>
            </div>
          </div>

          {/* Star rating */}
          <div className="space-y-2">
            <div className="flex justify-center gap-2" data-testid="rating-stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                  disabled={isSubmitting}
                  data-testid={`star-${value}`}
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${
                      (hoverRating || rating) >= value
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            {(hoverRating || rating) > 0 && (
              <p className="text-center text-sm font-medium text-muted-foreground">
                {getRatingLabel(hoverRating || rating)}
              </p>
            )}
          </div>

          {/* Comment (optional) */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Add a comment (optional)
            </Label>
            <Textarea
              id="comment"
              placeholder="Share your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-20 resize-none"
              disabled={isSubmitting}
              data-testid="input-comment"
            />
          </div>

          {/* Tip selection */}
          <div className="space-y-3">
            <Label>Add a tip for {driver.name.split(" ")[0]}</Label>
            <div className="grid grid-cols-4 gap-2">
              {TIP_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant={selectedTip === option.value ? "default" : "outline"}
                  onClick={() => setSelectedTip(option.value)}
                  disabled={isSubmitting}
                  className="text-sm"
                  data-testid={`tip-${option.value ?? "none"}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Tips go 100% to your driver
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="w-full"
            data-testid="button-submit-rating"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Rating
                {selectedTip && ` & $${selectedTip} Tip`}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="w-full text-muted-foreground"
            data-testid="button-skip-rating"
          >
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
