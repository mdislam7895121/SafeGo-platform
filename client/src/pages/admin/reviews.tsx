import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Filter, Eye, EyeOff, Flag, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Review {
  id: string;
  orderId: string;
  orderDate: string;
  deliveredAt: string;
  restaurantId: string;
  restaurantName: string;
  customerId: string;
  customerEmail: string;
  rating: number;
  reviewText: string | null;
  images: string[];
  isHidden: boolean;
  hiddenByAdminId: string | null;
  hiddenAt: string | null;
  hideReason: string | null;
  isFlagged: boolean;
  flaggedByAdminId: string | null;
  flaggedAt: string | null;
  flagReason: string | null;
  createdAt: string;
}

interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type ModerationAction = "hide" | "restore" | "flag";

export default function AdminReviews() {
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [filterHidden, setFilterHidden] = useState<string>("all");
  const [filterFlagged, setFilterFlagged] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const limit = 20;

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<ReviewsResponse>({
    queryKey: [
      "/api/admin/reviews",
      {
        page: currentPage,
        limit,
        rating: selectedRating !== "all" ? selectedRating : undefined,
        isHidden: filterHidden !== "all" ? filterHidden === "hidden" : undefined,
        isFlagged: filterFlagged !== "all" ? filterFlagged === "flagged" : undefined,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", limit.toString());
      if (selectedRating !== "all") {
        params.append("rating", selectedRating);
      }
      if (filterHidden !== "all") {
        params.append("isHidden", filterHidden === "hidden" ? "true" : "false");
      }
      if (filterFlagged !== "all") {
        params.append("isFlagged", filterFlagged === "flagged" ? "true" : "false");
      }

      const response = await fetch(`/api/admin/reviews?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to fetch reviews");
      }

      return response.json();
    },
    retry: 1,
  });

  const reviews = reviewsData?.reviews || [];
  const pagination = reviewsData?.pagination;

  const openModerationDialog = (review: Review, action: ModerationAction) => {
    setSelectedReview(review);
    setModerationAction(action);
    setReason("");
  };

  const closeModerationDialog = () => {
    setSelectedReview(null);
    setModerationAction(null);
    setReason("");
  };

  const handleModeration = async () => {
    if (!selectedReview || !moderationAction) return;

    if (moderationAction !== "restore" && !reason.trim()) {
      toast({
        title: "Reason required",
        description: `Please provide a reason for ${moderationAction === "hide" ? "hiding" : "flagging"} this review`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest(`/api/admin/reviews/${selectedReview.id}/${moderationAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      toast({
        title: "Success",
        description: `Review ${
          moderationAction === "hide" ? "hidden" :
          moderationAction === "restore" ? "restored" :
          "flagged"
        } successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      closeModerationDialog();
    } catch (error: any) {
      toast({
        title: "Failed to moderate review",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Review Moderation</h1>
        <p className="text-muted-foreground">Manage customer reviews across all restaurants</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>All Reviews</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedRating}
                onValueChange={(value) => {
                  setSelectedRating(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-rating-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterHidden}
                onValueChange={(value) => {
                  setFilterHidden(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-hidden-filter">
                  <SelectValue placeholder="Hidden Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="hidden">Hidden Only</SelectItem>
                  <SelectItem value="visible">Visible Only</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterFlagged}
                onValueChange={(value) => {
                  setFilterFlagged(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-flagged-filter">
                  <SelectValue placeholder="Flagged Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="flagged">Flagged Only</SelectItem>
                  <SelectItem value="unflagged">Unflagged Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {reviewsLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-1/2 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reviews found</h3>
              <p className="text-muted-foreground">
                {selectedRating !== "all" || filterHidden !== "all" || filterFlagged !== "all"
                  ? "No reviews match your filters"
                  : "No customer reviews yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card
                    key={review.id}
                    className={review.isHidden ? "opacity-60" : ""}
                    data-testid={`review-card-${review.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-semibold" data-testid={`text-restaurant-${review.id}`}>
                              {review.restaurantName}
                            </span>
                            {renderStars(review.rating)}
                            {review.isHidden && (
                              <Badge variant="secondary" data-testid={`badge-hidden-${review.id}`}>
                                <EyeOff className="h-3 w-3 mr-1" />
                                Hidden
                              </Badge>
                            )}
                            {review.isFlagged && (
                              <Badge variant="destructive" data-testid={`badge-flagged-${review.id}`}>
                                <Flag className="h-3 w-3 mr-1" />
                                Flagged
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`text-customer-${review.id}`}>
                            Customer: {review.customerEmail}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Reviewed on {new Date(review.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!review.isHidden ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModerationDialog(review, "hide")}
                              data-testid={`button-hide-${review.id}`}
                            >
                              <EyeOff className="h-4 w-4 mr-2" />
                              Hide
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModerationDialog(review, "restore")}
                              data-testid={`button-restore-${review.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Restore
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openModerationDialog(review, "flag")}
                            data-testid={`button-flag-${review.id}`}
                          >
                            <Flag className="h-4 w-4 mr-2" />
                            Flag
                          </Button>
                        </div>
                      </div>

                      {review.reviewText && (
                        <p className="text-sm mb-4" data-testid={`text-review-${review.id}`}>
                          {review.reviewText}
                        </p>
                      )}

                      {review.images && review.images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                          {review.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Review image ${idx + 1}`}
                              className="w-full aspect-square object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}

                      {(review.hideReason || review.flagReason) && (
                        <div className="border-t pt-4 mt-4 space-y-2">
                          {review.hideReason && (
                            <div className="text-sm">
                              <span className="font-medium">Hide Reason: </span>
                              <span className="text-muted-foreground">{review.hideReason}</span>
                            </div>
                          )}
                          {review.flagReason && (
                            <div className="text-sm">
                              <span className="font-medium">Flag Reason: </span>
                              <span className="text-muted-foreground">{review.flagReason}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} reviews
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={currentPage === pagination.totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedReview && moderationAction && (
        <Dialog open={!!selectedReview} onOpenChange={(open) => !open && closeModerationDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {moderationAction === "hide" ? "Hide Review" :
                 moderationAction === "restore" ? "Restore Review" :
                 "Flag Review"}
              </DialogTitle>
              <DialogDescription>
                {moderationAction === "restore"
                  ? "This review will become visible to customers and restaurants again."
                  : `Provide a reason for ${moderationAction === "hide" ? "hiding" : "flagging"} this review.`}
              </DialogDescription>
            </DialogHeader>

            {moderationAction !== "restore" && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for moderation action..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-24"
                  data-testid="input-reason"
                />
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Review Details:</p>
              <p className="text-sm text-muted-foreground">
                Restaurant: {selectedReview.restaurantName}
              </p>
              <p className="text-sm text-muted-foreground">
                Customer: {selectedReview.customerEmail}
              </p>
              <p className="text-sm text-muted-foreground">
                Rating: {selectedReview.rating} stars
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeModerationDialog}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleModeration}
                disabled={isSubmitting || (moderationAction !== "restore" && !reason.trim())}
                data-testid="button-confirm"
              >
                {isSubmitting ? "Processing..." : 
                 moderationAction === "hide" ? "Hide Review" :
                 moderationAction === "restore" ? "Restore Review" :
                 "Flag Review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
