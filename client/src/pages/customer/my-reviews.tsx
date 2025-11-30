import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Star,
  EyeOff,
  Flag,
  MoreVertical,
  Pencil,
  Trash2,
  MessageSquare,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Store,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MyReview {
  id: string;
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  rating: number;
  reviewText: string | null;
  images: string[];
  isHidden: boolean;
  adminFlagged: boolean;
  createdAt: string;
  restaurantReplyText?: string | null;
  restaurantRepliedAt?: string | null;
}

interface ReviewsResponse {
  reviews: MyReview[];
}

function canEditReview(createdAt: string): boolean {
  const hours = differenceInHours(new Date(), new Date(createdAt));
  return hours < 24;
}

function getTimeRemaining(createdAt: string): string {
  const createdDate = new Date(createdAt);
  const deadline = new Date(createdDate.getTime() + 24 * 60 * 60 * 1000);
  return formatDistanceToNow(deadline, { addSuffix: false });
}

export default function MyReviews() {
  const { toast } = useToast();
  const [editingReview, setEditingReview] = useState<MyReview | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editHoverRating, setEditHoverRating] = useState(0);
  const [editText, setEditText] = useState("");
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data, isLoading, isError, error } = useQuery<ReviewsResponse>({
    queryKey: ["/api/customer/reviews/my"],
  });

  const reviews = data?.reviews || [];

  const updateReviewMutation = useMutation({
    mutationFn: async ({
      reviewId,
      rating,
      reviewText,
    }: {
      reviewId: string;
      rating: number;
      reviewText: string;
    }) => {
      return await apiRequest(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        body: JSON.stringify({ rating, reviewText: reviewText || null }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/reviews/my"] });
      setEditingReview(null);
      toast({
        title: "Review updated",
        description: "Your review has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update review",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return await apiRequest(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/reviews/my"] });
      setDeleteReviewId(null);
      toast({
        title: "Review deleted",
        description: "Your review has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete review",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (review: MyReview) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditText(review.reviewText || "");
  };

  const handleEditSubmit = () => {
    if (!editingReview || editRating === 0) return;
    updateReviewMutation.mutate({
      reviewId: editingReview.id,
      rating: editRating,
      reviewText: editText.trim(),
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteReviewId) return;
    deleteReviewMutation.mutate(deleteReviewId);
  };

  const openLightbox = (images: string[], startIndex: number) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
  };

  const closeLightbox = () => {
    setLightboxImages([]);
    setLightboxIndex(0);
  };

  const renderStars = (rating: number, size: "sm" | "md" = "sm") => {
    const sizeClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";
    return (
      <div className="flex gap-0.5" data-testid={`rating-stars-${rating}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-muted text-muted"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderEditableStars = () => {
    return (
      <div className="flex gap-2" data-testid="edit-rating-stars">
        {[1, 2, 3, 4, 5].map((value) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEditRating(value)}
            onMouseEnter={() => setEditHoverRating(value)}
            onMouseLeave={() => setEditHoverRating(0)}
            className="no-default-hover-elevate"
            data-testid={`edit-star-${value}`}
          >
            <Star
              className={`h-6 w-6 ${
                (editHoverRating || editRating) >= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </Button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Reviews</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" data-testid="heading-my-reviews">
            My Reviews
          </h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive" data-testid="text-error">
              Failed to load reviews. Please try again later.
            </p>
            {error && (
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="heading-my-reviews">
          My Reviews
        </h1>
        {reviews.length > 0 && (
          <Badge variant="secondary" data-testid="badge-review-count">
            {reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-reviews">
              You haven't written any reviews yet. Complete food delivery orders to leave reviews!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const canEdit = canEditReview(review.createdAt);
            const timeRemaining = canEdit ? getTimeRemaining(review.createdAt) : null;

            return (
              <Card key={review.id} data-testid={`card-review-${review.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg" data-testid={`text-restaurant-${review.id}`}>
                        {review.restaurantName}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {renderStars(review.rating)}
                        <span className="text-sm text-muted-foreground" data-testid={`text-date-${review.id}`}>
                          {format(new Date(review.createdAt), "MMM d, yyyy")}
                        </span>
                        {canEdit && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-editable-${review.id}`}>
                            <Clock className="h-3 w-3 mr-1" />
                            {timeRemaining} left to edit
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.isHidden && (
                        <Badge variant="secondary" data-testid={`badge-hidden-${review.id}`}>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                      {review.adminFlagged && (
                        <Badge variant="destructive" data-testid={`badge-flagged-${review.id}`}>
                          <Flag className="h-3 w-3 mr-1" />
                          Flagged
                        </Badge>
                      )}
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-review-menu-${review.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditClick(review)}
                              data-testid={`button-edit-review-${review.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Review
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteReviewId(review.id)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-delete-review-${review.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Review
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {review.reviewText && (
                    <p className="text-sm" data-testid={`text-review-${review.id}`}>
                      {review.reviewText}
                    </p>
                  )}
                  
                  {review.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {review.images.map((image, idx) => (
                        <button
                          key={idx}
                          onClick={() => openLightbox(review.images, idx)}
                          className="relative group"
                          data-testid={`button-image-${review.id}-${idx}`}
                        >
                          <img
                            src={image}
                            alt={`Review image ${idx + 1}`}
                            className="h-24 w-24 object-cover rounded-md border transition-opacity group-hover:opacity-80"
                            data-testid={`img-review-${review.id}-${idx}`}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/50 rounded-full p-2">
                              <ChevronRight className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {review.restaurantReplyText && (
                    <div className="bg-muted/50 rounded-lg p-4 mt-4" data-testid={`reply-container-${review.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Store className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Response from {review.restaurantName}</span>
                        {review.restaurantRepliedAt && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(review.restaurantRepliedAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-reply-${review.id}`}>
                        {review.restaurantReplyText}
                      </p>
                    </div>
                  )}

                  {review.isHidden && (
                    <p className="text-sm text-muted-foreground italic" data-testid={`text-hidden-notice-${review.id}`}>
                      This review has been hidden by administrators and is not visible to restaurants or other customers.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingReview} onOpenChange={(open) => !open && setEditingReview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Your Review</DialogTitle>
            <DialogDescription>
              Update your review for {editingReview?.restaurantName}. You can edit within 24 hours of posting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Your rating</Label>
              {renderEditableStars()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-review-text">Your review</Label>
              <Textarea
                id="edit-review-text"
                placeholder="Tell us about your experience..."
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-24 resize-none"
                data-testid="input-edit-review-text"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingReview(null)}
              disabled={updateReviewMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={updateReviewMutation.isPending || editRating === 0}
              data-testid="button-save-edit"
            >
              {updateReviewMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteReviewId} onOpenChange={(open) => !open && setDeleteReviewId(null)}>
        <AlertDialogContent data-testid="delete-review-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your review will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReviewMutation.isPending} data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteReviewMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteReviewMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          data-testid="image-lightbox"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeLightbox}
            data-testid="button-close-lightbox"
          >
            <X className="h-6 w-6" />
          </Button>

          {lightboxImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev === 0 ? lightboxImages.length - 1 : prev - 1));
                }}
                data-testid="button-lightbox-prev"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev === lightboxImages.length - 1 ? 0 : prev + 1));
                }}
                data-testid="button-lightbox-next"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          <img
            src={lightboxImages[lightboxIndex]}
            alt={`Review image ${lightboxIndex + 1}`}
            className="max-h-[80vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
            data-testid="lightbox-image"
          />

          {lightboxImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" data-testid="lightbox-dots">
              {lightboxImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full ${
                    idx === lightboxIndex ? "bg-white" : "bg-white/50"
                  }`}
                  data-testid={`lightbox-dot-${idx}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
