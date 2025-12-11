import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Package,
  CreditCard,
  UtensilsCrossed,
  FileText,
  Settings,
  HelpCircle,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  Eye,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: typeof Package;
  color: string;
}

const categories: Category[] = [
  { id: "orders", name: "Orders", icon: Package, color: "text-blue-600" },
  { id: "payouts", name: "Payouts", icon: CreditCard, color: "text-green-600" },
  { id: "menu_pricing", name: "Menu & Pricing", icon: UtensilsCrossed, color: "text-orange-600" },
  { id: "account_kyc", name: "Account & KYC", icon: FileText, color: "text-purple-600" },
  { id: "technical", name: "Technical Issues", icon: Settings, color: "text-red-600" },
  { id: "other", name: "Other", icon: HelpCircle, color: "text-gray-600" },
];

const quickGuides = [
  { icon: Clock, title: "Quick Start Guide", description: "Get started with SafeGo Eats in 5 minutes", time: "5 min read" },
  { icon: CheckCircle2, title: "Best Practices", description: "Tips to maximize your restaurant performance", time: "10 min read" },
  { icon: AlertCircle, title: "Common Issues", description: "Solutions to frequently encountered problems", time: "7 min read" },
];

export default function SupportHelp() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: articlesData, isLoading } = useQuery<{ articles: any[] }>({
    queryKey: ["/api/admin/support-center/articles"],
  });

  const articles = articlesData?.articles || [];

  const filteredArticles = articles.filter(article => {
    const matchesSearch = searchQuery === "" || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || categoryId.replace('_', ' ');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight" data-testid="text-page-title">Help Center</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Find answers to common questions and learn how to make the most of SafeGo Eats
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" data-testid="icon-search" />
              <Input
                placeholder="Search for help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
                data-testid="input-search-articles"
              />
            </div>
          </div>
        </div>

        {/* Quick Guides */}
        <div className="grid gap-4 md:grid-cols-3">
          {quickGuides.map((guide, index) => (
            <Card key={index} className="hover-elevate cursor-pointer" data-testid={`card-quick-guide-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <guide.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold">{guide.title}</h3>
                    <p className="text-sm text-muted-foreground">{guide.description}</p>
                    <p className="text-xs text-muted-foreground">{guide.time}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Browse by Category</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const categoryArticleCount = articles.filter(a => a.category === category.id).length;
              return (
                <Card
                  key={category.id}
                  className={`hover-elevate cursor-pointer transition-all ${
                    selectedCategory === category.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                  data-testid={`card-category-${category.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg bg-muted ${category.color}`}>
                        <category.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">{categoryArticleCount} articles</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Articles List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {selectedCategory 
                ? `${getCategoryName(selectedCategory)} Articles`
                : searchQuery 
                ? 'Search Results'
                : 'All Articles'}
            </h2>
            {selectedCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(null)}
                data-testid="button-clear-category"
              >
                Clear filter
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "Try adjusting your search or browse by category"
                    : "No articles available in this category yet"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredArticles.map((article) => (
                <Link key={article.id} href={`/admin/support/articles/${article.id}`}>
                  <Card
                    className="hover-elevate cursor-pointer"
                    data-testid={`card-article-${article.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{article.title}</h3>
                            {article.viewCount > 100 && (
                              <Badge variant="secondary" className="text-xs">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{getCategoryName(article.category)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Eye className="h-4 w-4" />
                            <span>{article.viewCount || 0}</span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Need More Help */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Need more help?</CardTitle>
            <CardDescription>
              Can't find what you're looking for? Our support team is here to help.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/admin/support">
                <Button variant="default" data-testid="button-contact-support">
                  Contact Support
                </Button>
              </Link>
              <Link href="/admin/support/status">
                <Button variant="outline" data-testid="button-system-status">
                  Check System Status
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
