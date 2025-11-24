import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";

export default function SupportArticle() {
  const { id } = useParams();

  const { data: articleData, isLoading } = useQuery<{ article: any }>({
    queryKey: ["/api/driver/support-center/articles", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-12 w-3/4 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const article = articleData?.article;

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Article not found</h2>
              <p className="text-muted-foreground mb-6">
                The help article you're looking for doesn't exist or has been removed.
              </p>
              <Link href="/driver/support/help">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Help Center
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/driver/support/help" className="hover:text-foreground">
            Help Center
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="capitalize">{article.category.replace('_', ' ')}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground truncate">{article.title}</span>
        </div>

        {/* Article Header */}
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <Badge variant="secondary" className="mb-3">
                {article.category.replace('_', ' ').split(' ').map((word: string) => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-article-title">
                {article.title}
              </h1>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                <span>{article.viewCount || 0} views</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Updated {format(new Date(article.updatedAt || article.createdAt), "MMM d, yyyy")}</span>
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div 
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
              data-testid="article-content"
            />
          </CardContent>
        </Card>

        {/* Was this helpful? */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">Was this article helpful?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" data-testid="button-helpful-yes">
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Yes
                </Button>
                <Button variant="outline" size="sm" data-testid="button-helpful-no">
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  No
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Related Articles */}
        {article.relatedArticles && article.relatedArticles.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Related Articles</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {article.relatedArticles.map((related: any) => (
                <Link key={related.id} href={`/driver/support/articles/${related.id}`}>
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg hover-elevate cursor-pointer"
                    data-testid={`related-article-${related.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{related.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {related.category.replace('_', ' ')}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Still need help? */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold mb-1">Still need help?</h3>
                <p className="text-sm text-muted-foreground">
                  Our support team is here to assist you
                </p>
              </div>
              <Link href="/driver/support">
                <Button data-testid="button-contact-support">
                  Contact Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back to Help Center */}
        <div className="pt-4">
          <Link href="/driver/support/help">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Help Center
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
