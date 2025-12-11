import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Filter, Eye, EyeOff } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  ratingDistributionPercentage: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface Review {
  id: string;
  orderDate: string;
  deliveredAt: string;
  reviewerLabel: string;
  rating: number;
  reviewText: string | null;
  images: string[];
  isHidden: boolean;
  isFlagged: boolean;
  createdAt: string;
}

interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export default function Reviews() {
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const { data: stats, isLoading: statsLoading } = useQuery<ReviewStats>({
    queryKey: ["/api/restaurant/reviews/stats"],
    retry: 1,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<ReviewsResponse>({
    queryKey: [
      "/api/restaurant/reviews",
      {
        page: currentPage,
        limit,
        rating: selectedRating !== "all" ? selectedRating : undefined,
        includeHidden,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", limit.toString());
      if (selectedRating !== "all") {
        params.append("rating", selectedRating);
      }
      if (includeHidden) {
        params.append("includeHidden", "true");
      }
      
      const response = await fetch(`/api/restaurant/reviews?${params.toString()}`, {
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

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1" data-testid={`rating-stars-${rating}`}>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Customer Reviews</h1>
        <p className="text-muted-foreground">View feedback from your customers</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-6 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold" data-testid="text-total-reviews">
                      {stats?.totalReviews || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Reviews</p>
                  </div>
                  <Star className="h-8 w-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold" data-testid="text-average-rating">
                      {stats?.averageRating?.toFixed(1) || "0.0"}
                    </p>
                    <p className="text-sm text-muted-foreground">Average Rating</p>
                  </div>
                  {stats && renderStars(Math.round(stats.averageRating))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium mb-4">Rating Distribution</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={rating} className="flex items-center gap-3">
                      <span className="text-sm w-8 text-right">{rating}★</span>
                      <Progress
                        value={stats?.ratingDistributionPercentage[rating as keyof typeof stats.ratingDistributionPercentage] || 0}
                        className="flex-1"
                        data-testid={`progress-rating-${rating}`}
                      />
                      <span className="text-sm w-12 text-muted-foreground">
                        {stats?.ratingDistribution[rating as keyof typeof stats.ratingDistribution] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>All Reviews</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedRating} onValueChange={(value) => {
                setSelectedRating(value);
                setCurrentPage(1);
              }}>
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

              <Button
                variant={includeHidden ? "default" : "outline"}
                onClick={() => {
                  setIncludeHidden(!includeHidden);
                  setCurrentPage(1);
                }}
                data-testid="button-toggle-hidden"
              >
                {includeHidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                {includeHidden ? "Showing Hidden" : "Hide Hidden"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {reviewsLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                {selectedRating !== "all" || includeHidden
                  ? "No reviews match your filters"
                  : "Customer reviews will appear here after delivery"}
              </p>
            </div>
          ) : (
            <>
              {reviews.map((review) => (
                <Card key={review.id} className={review.isHidden ? "opacity-60" : ""} data-testid={`review-card-${review.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-medium" data-testid={`text-reviewer-${review.id}`}>
                            {review.reviewerLabel}
                          </p>
                          {renderStars(review.rating)}
                          {review.isHidden && (
                            <Badge variant="secondary" data-testid={`badge-hidden-${review.id}`}>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hidden
                            </Badge>
                          )}
                          {review.isFlagged && (
                            <Badge variant="destructive" data-testid={`badge-flagged-${review.id}`}>
                              Flagged
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    {review.reviewText && (
                      <p className="text-sm mb-4" data-testid={`text-review-${review.id}`}>
                        {review.reviewText}
                      </p>
                    )}

                    {review.images && review.images.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {review.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Review image ${idx + 1}`}
                            className="w-full aspect-square object-cover rounded-lg"
                            data-testid={`image-review-${review.id}-${idx}`}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
                    {pagination.totalCount} reviews
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
    </div>
  );
}
