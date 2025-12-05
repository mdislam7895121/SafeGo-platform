import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Search,
  User,
  Car,
  Utensils,
  MessageSquareWarning,
  CreditCard,
  AlertTriangle,
  FileWarning,
  Clock,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  meta: Record<string, any>;
}

interface SearchResponse {
  query: string;
  totalResults: number;
  results: {
    users: SearchResult[];
    drivers: SearchResult[];
    restaurants: SearchResult[];
    rides: SearchResult[];
    payments: SearchResult[];
    complaints: SearchResult[];
    violations: SearchResult[];
    incidents: SearchResult[];
  };
  groupedCount: Record<string, number>;
}

const SEARCH_TYPES = [
  { value: "all", label: "All", icon: Search },
  { value: "users", label: "Users", icon: User },
  { value: "drivers", label: "Drivers", icon: Car },
  { value: "restaurants", label: "Restaurants", icon: Utensils },
  { value: "complaints", label: "Complaints", icon: MessageSquareWarning },
];

export default function GlobalSearch() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchType, setSearchType] = useState("all");

  const debounce = useCallback((fn: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }, []);

  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSetQuery(value);
  };

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: [`/api/admin/phase4/search?q=${encodeURIComponent(debouncedQuery)}&type=${searchType}`],
    enabled: debouncedQuery.length >= 2,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "user":
        return <User className="h-4 w-4 text-blue-500" />;
      case "driver":
        return <Car className="h-4 w-4 text-green-500" />;
      case "restaurant":
        return <Utensils className="h-4 w-4 text-orange-500" />;
      case "complaint":
        return <MessageSquareWarning className="h-4 w-4 text-red-500" />;
      case "payment":
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      case "violation":
        return <FileWarning className="h-4 w-4 text-yellow-500" />;
      case "incident":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | undefined, testId?: string) => {
    if (!status) return null;
    const tid = testId || "badge-result-status";
    switch (status) {
      case "active":
      case "approved":
        return <Badge className="bg-green-500" data-testid={tid}>{status}</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500" data-testid={tid}>{status}</Badge>;
      case "suspended":
      case "rejected":
        return <Badge variant="destructive" data-testid={tid}>{status}</Badge>;
      default:
        return <Badge variant="outline" data-testid={tid}>{status}</Badge>;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case "user":
        navigate(`/admin/users`);
        break;
      case "driver":
        navigate(`/admin/drivers/${result.id}`);
        break;
      case "restaurant":
        navigate(`/admin/restaurants/${result.id}`);
        break;
      case "complaint":
        navigate(`/admin/complaint-resolution`);
        break;
      default:
        break;
    }
  };

  const allResults = data
    ? [
        ...data.results.users,
        ...data.results.drivers,
        ...data.results.restaurants,
        ...data.results.complaints,
        ...data.results.violations,
      ]
    : [];

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Global Admin Search</h1>
            <p className="text-sm opacity-90">Search across all platform entities</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search users, drivers, restaurants, complaints, violations..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-10 text-lg h-12"
                data-testid="input-global-search"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedQuery("");
                  }}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {SEARCH_TYPES.map((type) => (
                <Button
                  key={type.value}
                  variant={searchType === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType(type.value)}
                  data-testid={`button-type-${type.value}`}
                >
                  <type.icon className="h-4 w-4 mr-1" />
                  {type.label}
                  {data?.groupedCount?.[type.value] !== undefined && searchType === "all" && (
                    <Badge variant="secondary" className="ml-1">
                      {data.groupedCount[type.value]}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {debouncedQuery.length < 2 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Enter at least 2 characters to search</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && debouncedQuery.length >= 2 && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {data && debouncedQuery.length >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Search Results</span>
                <Badge variant="outline">{data.totalResults} results</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.totalResults === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No results found for "{debouncedQuery}"</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {(searchType === "all" ? allResults : data.results[searchType as keyof typeof data.results] || []).map(
                      (result) => (
                        <Card
                          key={`${result.type}-${result.id}`}
                          className="hover-elevate cursor-pointer"
                          onClick={() => handleResultClick(result)}
                          data-testid={`card-result-${result.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-muted">{getTypeIcon(result.type)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium" data-testid={`text-result-title-${result.id}`}>{result.title}</p>
                                  <Badge variant="outline" className="text-xs capitalize" data-testid={`badge-result-type-${result.id}`}>
                                    {result.type}
                                  </Badge>
                                  {getStatusBadge(result.meta?.status, `badge-result-status-${result.id}`)}
                                </div>
                                <p className="text-sm text-muted-foreground" data-testid={`text-result-subtitle-${result.id}`}>{result.subtitle}</p>
                                {result.meta?.role && (
                                  <p className="text-xs text-muted-foreground mt-1" data-testid={`text-result-role-${result.id}`}>Role: {result.meta.role}</p>
                                )}
                                {result.meta?.severity && (
                                  <p className="text-xs text-muted-foreground mt-1" data-testid={`text-result-severity-${result.id}`}>Severity: {result.meta.severity}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && !data && debouncedQuery.length >= 2 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Unable to perform search. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
