import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Car } from "lucide-react";
import { VEHICLE_CATEGORIES, type VehicleCategoryId } from "@shared/vehicleCategories";

interface DriverInfo {
  name: string;
  avatarInitials: string;
  carModel: string;
  carColor: string;
  plateNumber: string;
  rating: number;
}

interface PostTripRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverInfo: DriverInfo | null;
  vehicleCategory: VehicleCategoryId;
  onSubmit: (rating: number, feedback: string) => void;
  initialRating?: number;
  initialFeedback?: string;
  hasAlreadyRated?: boolean;
}

export function PostTripRatingDialog({
  open,
  onOpenChange,
  driverInfo,
  vehicleCategory,
  onSubmit,
  initialRating = 0,
  initialFeedback = "",
  hasAlreadyRated = false,
}: PostTripRatingDialogProps) {
  const [rating, setRating] = useState(initialRating);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const maxFeedbackLength = 200;
  const categoryInfo = VEHICLE_CATEGORIES[vehicleCategory];

  useEffect(() => {
    if (open && !hasAlreadyRated) {
      setRating(initialRating);
      setFeedback(initialFeedback);
      setHoveredRating(0);
      setIsSubmitting(false);
    }
  }, [open, hasAlreadyRated, initialRating, initialFeedback]);

  const handleSubmit = () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    onSubmit(rating, feedback.trim());
  };

  const getRatingLabel = (stars: number): string => {
    switch (stars) {
      case 1: return "Poor";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Great";
      case 5: return "Excellent";
      default: return "";
    }
  };

  const effectiveRating = hasAlreadyRated ? initialRating : rating;
  const effectiveFeedback = hasAlreadyRated ? initialFeedback : feedback;
  const displayRatingValue = hoveredRating || effectiveRating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md p-0 gap-0 rounded-2xl overflow-hidden"
        data-testid="dialog-rating"
      >
        <div className={`p-6 pb-12 text-center ${
          hasAlreadyRated 
            ? "bg-gradient-to-br from-green-600 to-green-500 text-white"
            : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
        }`}>
          <DialogHeader>
            <DialogTitle className={`text-xl ${hasAlreadyRated ? "text-white" : "text-primary-foreground"}`}>
              {hasAlreadyRated ? "Rating Submitted" : "How was your trip?"}
            </DialogTitle>
          </DialogHeader>
          <p className={`text-sm mt-1 ${hasAlreadyRated ? "text-white/80" : "text-primary-foreground/80"}`}>
            {hasAlreadyRated 
              ? "Thanks for your feedback!" 
              : `Rate your experience with ${driverInfo?.name.split(" ")[0] || "your driver"}`
            }
          </p>
        </div>

        <div className="px-6 pb-6 -mt-8 space-y-5">
          <div className="bg-card rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                  {driverInfo?.avatarInitials || "DR"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg truncate" data-testid="text-driver-name">
                    {driverInfo?.name || "Driver"}
                  </h3>
                  {hasAlreadyRated && (
                    <Badge variant="secondary" className="text-xs" data-testid="badge-rated-dialog">
                      Rated
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Car className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate" data-testid="text-vehicle-info">
                    {driverInfo?.carColor} {driverInfo?.carModel}
                  </span>
                </div>
                <Badge variant="secondary" className="mt-1.5" data-testid="badge-category">
                  {categoryInfo?.displayName || vehicleCategory}
                </Badge>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3">
            <div 
              className="flex justify-center gap-2"
              role={hasAlreadyRated ? "presentation" : "radiogroup"}
              aria-label="Rating"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                hasAlreadyRated ? (
                  <div
                    key={star}
                    className="p-1"
                    data-testid={`star-display-${star}`}
                  >
                    <Star
                      className={`h-10 w-10 ${
                        star <= effectiveRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </div>
                ) : (
                  <button
                    key={star}
                    type="button"
                    className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    aria-pressed={rating === star}
                    data-testid={`button-star-${star}`}
                  >
                    <Star
                      className={`h-10 w-10 transition-colors ${
                        star <= displayRatingValue
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                )
              ))}
            </div>
            
            {displayRatingValue > 0 && (
              <p 
                className="text-sm font-medium text-muted-foreground animate-in fade-in duration-200"
                data-testid="text-rating-label"
              >
                {getRatingLabel(displayRatingValue)}
              </p>
            )}
          </div>

          {hasAlreadyRated ? (
            effectiveFeedback && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Your feedback</p>
                <p className="text-sm bg-muted p-3 rounded-lg" data-testid="text-submitted-feedback">
                  {effectiveFeedback}
                </p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <label 
                htmlFor="feedback" 
                className="text-sm font-medium text-muted-foreground"
              >
                Share your feedback (optional)
              </label>
              <Textarea
                id="feedback"
                placeholder="Tell us about your experience..."
                value={feedback}
                onChange={(e) => {
                  if (e.target.value.length <= maxFeedbackLength) {
                    setFeedback(e.target.value);
                  }
                }}
                className="resize-none h-20"
                data-testid="input-feedback"
              />
              <p className="text-xs text-muted-foreground text-right" data-testid="text-char-count">
                {feedback.length}/{maxFeedbackLength}
              </p>
            </div>
          )}

          {hasAlreadyRated ? (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
              size="lg"
              data-testid="button-close-rating"
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                className="w-full"
                size="lg"
                data-testid="button-submit-rating"
              >
                {isSubmitting ? "Submitting..." : "Submit Rating"}
              </Button>
              
              {rating === 0 && (
                <p className="text-xs text-center text-muted-foreground" data-testid="text-rating-required">
                  Please select a rating to continue
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
