import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Eye, EyeOff, Flag } from "lucide-react";
import { format } from "date-fns";

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
}

export default function MyReviews() {
  const { data: reviews, isLoading, isError, error } = useQuery<MyReview[]>({
    queryKey: ["/api/customer/reviews/my"],
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5" data-testid={`rating-stars-${rating}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-muted text-muted"
            }`}
          />
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
      </div>

      {!reviews || reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-no-reviews">
              You haven't written any reviews yet. Complete food delivery orders to leave reviews!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} data-testid={`card-review-${review.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`text-restaurant-${review.id}`}>
                      {review.restaurantName}
                    </CardTitle>
                    <div className="flex items-center gap-3 mt-2">
                      {renderStars(review.rating)}
                      <span className="text-sm text-muted-foreground" data-testid={`text-date-${review.id}`}>
                        {format(new Date(review.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                      <img
                        key={idx}
                        src={image}
                        alt={`Review image ${idx + 1}`}
                        className="h-24 w-24 object-cover rounded-md border"
                        data-testid={`img-review-${review.id}-${idx}`}
                      />
                    ))}
                  </div>
                )}
                {review.isHidden && (
                  <p className="text-sm text-muted-foreground italic" data-testid={`text-hidden-notice-${review.id}`}>
                    This review has been hidden by administrators and is not visible to restaurants or other customers.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
