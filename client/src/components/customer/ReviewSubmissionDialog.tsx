import { useState } from "react";
import { Star, Upload, X } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ReviewSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  restaurantName: string;
  onSuccess?: () => void;
}

export function ReviewSubmissionDialog({
  open,
  onOpenChange,
  orderId,
  restaurantName,
  onSuccess,
}: ReviewSubmissionDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleStarClick = (value: number) => {
    setRating(value);
  };

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setReviewText("");
    setImages([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (images.length + files.length > 5) {
      toast({
        title: "Too many images",
        description: "You can upload a maximum of 5 images",
        variant: "destructive",
      });
      return;
    }

    const newImages: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        if (newImages.length === files.length) {
          setImages([...images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("/api/customer/reviews", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          rating,
          reviewText: reviewText.trim() || undefined,
          images: images.length > 0 ? images : undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      toast({
        title: "Review submitted!",
        description: "Thank you for your feedback",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/customer/reviews/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/food-orders"] });

      handleOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Failed to submit review",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Rate your order</DialogTitle>
          <DialogDescription>
            How was your experience with {restaurantName}?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Your rating</Label>
            <div className="flex gap-2" data-testid="rating-stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleStarClick(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="no-default-hover-elevate"
                  data-testid={`star-${value}`}
                >
                  <Star
                    className={`h-6 w-6 ${
                      (hoverRating || rating) >= value
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-text">Your review (optional)</Label>
            <Textarea
              id="review-text"
              placeholder="Tell us about your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="min-h-24 resize-none"
              data-testid="input-review-text"
            />
          </div>

          <div className="space-y-2">
            <Label>Add photos (optional, max 5)</Label>
            
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={img}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      data-testid={`button-remove-image-${index}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < 5 && (
              <label 
                className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover-elevate transition-colors"
                data-testid="button-upload-images"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground mt-2">
                  Upload photos
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  data-testid="input-image-upload"
                />
              </label>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || rating === 0}
              data-testid="button-submit-review"
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
