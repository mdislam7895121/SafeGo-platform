import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Star,
  TrendingUp,
  Trophy,
  Target,
  Car,
  UtensilsCrossed,
  Package,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  MessageSquare,
  Info,
  Award,
  BarChart3,
  Clock,
  Percent,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type TimeRange = "7d" | "30d" | "all";
type ServiceType = "RIDE" | "FOOD" | "PARCEL";

interface PerformanceSummary {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  inProgressTrips: number;
  averageRating: number | null;
  totalRatings: number;
  cancellationRate: number;
  completionRate: number;
  totalEarnings?: number;
  totalCommission?: number;
  netEarnings?: number;
}

interface RatingBreakdown {
  star5: number;
  star4: number;
  star3: number;
  star2: number;
  star1: number;
  total: number;
  average: number | null;
}

interface ServiceBreakdown {
  serviceType: ServiceType;
  totalTrips: number;
  completedTrips: number;
  averageRating: number | null;
  totalRatings: number;
  totalEarnings: number;
}

interface DriverReview {
  id: string;
  serviceType: ServiceType;
  rating: number;
  comment: string | null;
  createdAt: string;
  tripCode: string;
}

interface PerformanceThresholds {
  minimumRating: number;
  maximumCancellationRate: number;
  qualityRatingMinimum: number;
  priorityAccessRating: number;
}

const rangeLabels: Record<TimeRange, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "all": "All Time",
};

const serviceTypeConfig: Record<ServiceType, { icon: typeof Car; label: string; color: string }> = {
  RIDE: { icon: Car, label: "Rides", color: "bg-blue-500" },
  FOOD: { icon: UtensilsCrossed, label: "Food Delivery", color: "bg-orange-500" },
  PARCEL: { icon: Package, label: "Parcel Delivery", color: "bg-purple-500" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function StarRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${
            star <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

function RatingBar({ label, count, total, percentage }: { label: string; count: number; total: number; percentage: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1">
        <Progress value={percentage} className="h-2" />
      </div>
      <span className="w-12 text-sm text-muted-foreground text-right">{count}</span>
    </div>
  );
}

export default function DriverPerformance() {
  const [range, setRange] = useState<TimeRange>("30d");
  const [reviewsPage, setReviewsPage] = useState(1);

  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery<{
    summary: PerformanceSummary;
    range: TimeRange;
    rangeLabel: string;
    kycApproved: boolean;
    kycStatus: string;
    thresholds: PerformanceThresholds;
  }>({
    queryKey: ["/api/driver/performance/summary", range],
  });

  const { data: ratingsData, isLoading: ratingsLoading } = useQuery<{
    breakdown: RatingBreakdown;
    range: TimeRange;
    rangeLabel: string;
  }>({
    queryKey: ["/api/driver/performance/ratings", range],
  });

  const { data: serviceData, isLoading: serviceLoading } = useQuery<{
    breakdown: ServiceBreakdown[];
    range: TimeRange;
    rangeLabel: string;
    kycApproved: boolean;
  }>({
    queryKey: ["/api/driver/performance/service-breakdown", range],
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<{
    reviews: DriverReview[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
    range: TimeRange;
    rangeLabel: string;
  }>({
    queryKey: ["/api/driver/performance/reviews", range, reviewsPage],
  });

  const isLoading = summaryLoading || ratingsLoading || serviceLoading;
  const isKycApproved = summaryData?.kycApproved ?? false;

  if (summaryError) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Unable to load performance data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-performance-title">
            Performance & Ratings
          </h1>
          <p className="text-muted-foreground">
            Track your driving quality and customer feedback
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <SelectTrigger className="w-[160px]" data-testid="select-range">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isKycApproved && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-700 dark:text-yellow-400">Verification Required</AlertTitle>
          <AlertDescription className="text-yellow-600 dark:text-yellow-300">
            Complete your verification to view earnings details.{" "}
            <Link href="/driver/documents" className="underline font-medium">
              Complete Verification
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summaryData?.summary.totalTrips === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No trips yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Complete your first trip to start tracking your performance metrics and customer ratings.
            </p>
            <Link href="/driver/getting-started">
              <Button data-testid="button-get-started">Get Started</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-overall-rating">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" data-testid="text-average-rating">
                    {summaryData?.summary.averageRating?.toFixed(1) ?? "N/A"}
                  </span>
                  {summaryData?.summary.averageRating && (
                    <StarRating rating={summaryData.summary.averageRating} size="sm" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {summaryData?.summary.totalRatings ?? 0} ratings
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-trips">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-total-trips">
                  {summaryData?.summary.totalTrips ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryData?.summary.completedTrips ?? 0} completed
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-completion-rate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-completion-rate">
                  {summaryData?.summary.completionRate ?? 0}%
                </div>
                <Progress 
                  value={summaryData?.summary.completionRate ?? 0} 
                  className="h-2 mt-2" 
                />
              </CardContent>
            </Card>

            <Card data-testid="card-cancellation-rate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Cancellation Rate</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-cancellation-rate">
                  {summaryData?.summary.cancellationRate ?? 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryData?.summary.cancelledTrips ?? 0} cancelled trips
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="ratings" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ratings" data-testid="tab-ratings">Ratings</TabsTrigger>
              <TabsTrigger value="services" data-testid="tab-services">By Service</TabsTrigger>
              <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="ratings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Rating Breakdown
                  </CardTitle>
                  <CardDescription>
                    Distribution of your ratings for {rangeLabels[range].toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ratingsData?.breakdown.total === 0 ? (
                    <div className="text-center py-8">
                      <ThumbsUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h4 className="font-medium mb-2">No ratings yet</h4>
                      <p className="text-sm text-muted-foreground">
                        Complete more trips to receive customer feedback
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold">
                            {ratingsData?.breakdown.average?.toFixed(1) ?? "N/A"}
                          </div>
                          <StarRating rating={ratingsData?.breakdown.average ?? 0} size="md" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {ratingsData?.breakdown.total ?? 0} ratings
                          </p>
                        </div>
                        <div className="flex-1 space-y-2">
                          <RatingBar
                            label="5"
                            count={ratingsData?.breakdown.star5 ?? 0}
                            total={ratingsData?.breakdown.total ?? 1}
                            percentage={((ratingsData?.breakdown.star5 ?? 0) / (ratingsData?.breakdown.total || 1)) * 100}
                          />
                          <RatingBar
                            label="4"
                            count={ratingsData?.breakdown.star4 ?? 0}
                            total={ratingsData?.breakdown.total ?? 1}
                            percentage={((ratingsData?.breakdown.star4 ?? 0) / (ratingsData?.breakdown.total || 1)) * 100}
                          />
                          <RatingBar
                            label="3"
                            count={ratingsData?.breakdown.star3 ?? 0}
                            total={ratingsData?.breakdown.total ?? 1}
                            percentage={((ratingsData?.breakdown.star3 ?? 0) / (ratingsData?.breakdown.total || 1)) * 100}
                          />
                          <RatingBar
                            label="2"
                            count={ratingsData?.breakdown.star2 ?? 0}
                            total={ratingsData?.breakdown.total ?? 1}
                            percentage={((ratingsData?.breakdown.star2 ?? 0) / (ratingsData?.breakdown.total || 1)) * 100}
                          />
                          <RatingBar
                            label="1"
                            count={ratingsData?.breakdown.star1 ?? 0}
                            total={ratingsData?.breakdown.total ?? 1}
                            percentage={((ratingsData?.breakdown.star1 ?? 0) / (ratingsData?.breakdown.total || 1)) * 100}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Quality Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Award className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Priority Access</p>
                        <p className="text-xs text-muted-foreground">
                          Maintain a {summaryData?.thresholds.priorityAccessRating ?? 4.8}+ rating for priority trip access
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Target className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Minimum Rating</p>
                        <p className="text-xs text-muted-foreground">
                          Keep above {summaryData?.thresholds.minimumRating ?? 4.5} to stay active
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Percent className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Cancellation Limit</p>
                        <p className="text-xs text-muted-foreground">
                          Keep cancellations below {summaryData?.thresholds.maximumCancellationRate ?? 10}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Trophy className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Quality Bonus</p>
                        <p className="text-xs text-muted-foreground">
                          {summaryData?.thresholds.qualityRatingMinimum ?? 4.7}+ rating may qualify for bonuses
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="services" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {serviceData?.breakdown.map((service) => {
                  const config = serviceTypeConfig[service.serviceType];
                  const Icon = config.icon;
                  return (
                    <Card key={service.serviceType} data-testid={`card-service-${service.serviceType.toLowerCase()}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <CardTitle className="text-base">{config.label}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Trips</span>
                          <span className="font-semibold">{service.totalTrips}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Completed</span>
                          <span className="font-semibold">{service.completedTrips}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Rating</span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">
                              {service.averageRating?.toFixed(1) ?? "N/A"}
                            </span>
                            {service.averageRating && (
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            )}
                          </div>
                        </div>
                        {isKycApproved && (
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Earnings</span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(service.totalEarnings)}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {(!serviceData?.breakdown || serviceData.breakdown.every(s => s.totalTrips === 0)) && (
                <Card className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      No service data available for this period
                    </p>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Customer Reviews
                  </CardTitle>
                  <CardDescription>
                    Recent feedback from your customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : reviewsData?.reviews.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h4 className="font-medium mb-2">No reviews yet</h4>
                      <p className="text-sm text-muted-foreground">
                        Customer feedback will appear here after completed trips
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviewsData?.reviews.map((review) => {
                        const serviceConfig = serviceTypeConfig[review.serviceType];
                        const ServiceIcon = serviceConfig.icon;
                        return (
                          <div
                            key={review.id}
                            className="flex gap-4 p-4 rounded-lg border"
                            data-testid={`review-${review.id}`}
                          >
                            <div className={`p-2 rounded-full ${serviceConfig.color} h-fit`}>
                              <ServiceIcon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <StarRating rating={review.rating} size="sm" />
                                  <Badge variant="outline" className="text-xs">
                                    {review.tripCode}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(review.createdAt), "MMM d, yyyy")}
                                </span>
                              </div>
                              {review.comment ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                  "{review.comment}"
                                </p>
                              ) : (
                                <p className="mt-2 text-sm text-muted-foreground italic">
                                  No comment provided
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {reviewsData?.pagination.hasMore && (
                        <div className="flex justify-center pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setReviewsPage(p => p + 1)}
                            data-testid="button-load-more-reviews"
                          >
                            Load More Reviews
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
