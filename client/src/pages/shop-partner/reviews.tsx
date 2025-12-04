import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Star, MessageSquare, ThumbsUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

interface Review {
  id: string;
  orderId: string;
  orderNumber: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer: {
    name: string;
    avatar: string | null;
  };
}

interface ReviewsData {
  reviews: Review[];
  total: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
}

export default function ShopPartnerReviews() {
  const { data, isLoading } = useQuery<ReviewsData>({
    queryKey: ["/api/shop-partner/reviews"],
  });

  const ratingDistribution = data?.ratingDistribution || {};
  const totalReviews = data?.total || 0;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">রিভিউ এবং রেটিং</h1>
        <Badge variant="secondary" className="px-3 py-1">
          {totalReviews} টি রিভিউ
        </Badge>
      </div>

      <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-average-rating">
                {(data?.averageRating || 0).toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(data?.averageRating || 0)
                        ? "fill-amber-500 text-amber-500"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {totalReviews} টি রিভিউ থেকে
              </p>
            </div>

            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingDistribution[rating] || 0;
                const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-2">
                    <span className="w-6 text-sm text-muted-foreground">{rating}</span>
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <Progress value={percent} className="flex-1 h-2" />
                    <span className="w-8 text-sm text-muted-foreground text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            সাম্প্রতিক রিভিউ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.reviews && data.reviews.length > 0 ? (
            <div className="space-y-4">
              {data.reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 rounded-lg bg-muted/50"
                  data-testid={`review-item-${review.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {review.customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{review.customer.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(review.createdAt), "dd MMM yyyy", { locale: bn })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      "{review.comment}"
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      অর্ডার #{review.orderNumber}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ThumbsUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">এখনও কোন রিভিউ পাওয়া যায়নি।</p>
              <p className="text-sm text-muted-foreground mt-1">
                অর্ডার সম্পন্ন হলে কাস্টমাররা রিভিউ দিতে পারবে।
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
