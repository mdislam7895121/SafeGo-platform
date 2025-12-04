import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  User, 
  Car, 
  UtensilsCrossed, 
  Package,
  CreditCard,
  X,
  Filter
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SearchResult {
  id: string;
  _type: string;
  _score: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  address?: string;
  role?: string;
  createdAt?: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
}

const typeIcons: Record<string, any> = {
  user: User,
  driver: Car,
  restaurant: UtensilsCrossed,
  ride: Car,
  order: Package,
  transaction: CreditCard,
};

const typeColors: Record<string, string> = {
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  driver: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  ride: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  order: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  transaction: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
};

export default function EnterpriseSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data: searchResults, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: ["/api/admin/phase3a/search", { q: submittedQuery, type: searchType }],
    enabled: submittedQuery.length >= 2,
  });

  const { data: suggestions } = useQuery<{ suggestions: { text: string; type: string }[] }>({
    queryKey: ["/api/admin/phase3a/search/suggestions", { q: searchQuery }],
    enabled: searchQuery.length >= 2 && searchQuery !== submittedQuery,
  });

  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      setSubmittedQuery(searchQuery);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Enterprise Search</h1>
          <p className="text-muted-foreground">Search across all entities with fuzzy matching</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Global Search
          </CardTitle>
          <CardDescription>Search users, drivers, restaurants, rides, orders, and transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                data-testid="input-search"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => {
                    setSearchQuery("");
                    setSubmittedQuery("");
                  }}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="w-40" data-testid="select-search-type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="drivers">Drivers</SelectItem>
                <SelectItem value="restaurants">Restaurants</SelectItem>
                <SelectItem value="rides">Rides</SelectItem>
                <SelectItem value="orders">Orders</SelectItem>
                <SelectItem value="transactions">Transactions</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={searchQuery.length < 2} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {suggestions && suggestions.suggestions.length > 0 && searchQuery !== submittedQuery && (
            <div className="border rounded-md p-2 bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.suggestions.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSearchQuery(s.text);
                      setSubmittedQuery(s.text);
                    }}
                  >
                    {s.text}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(isLoading || isFetching) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {searchResults && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Results ({searchResults.totalCount})</CardTitle>
            <CardDescription>Showing results for "{searchResults.query}"</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {searchResults.results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found for "{searchResults.query}"
                  </div>
                ) : (
                  searchResults.results.map((result) => {
                    const Icon = typeIcons[result._type] || User;
                    const colorClass = typeColors[result._type] || typeColors.user;
                    
                    return (
                      <div
                        key={`${result._type}-${result.id}`}
                        className="flex items-center gap-4 p-4 border rounded-lg hover-elevate cursor-pointer"
                        data-testid={`result-${result._type}-${result.id}`}
                      >
                        <div className={`p-2 rounded-full ${colorClass}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">
                            {result.name || result.email || `${result.firstName || ""} ${result.lastName || ""}`.trim() || result.id}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.email && <span>{result.email}</span>}
                            {result.address && <span>{result.address}</span>}
                            {result.role && <span className="ml-2">Role: {result.role}</span>}
                          </div>
                        </div>
                        <Badge className={colorClass}>{result._type}</Badge>
                        <Badge variant="outline">{(result._score * 100).toFixed(0)}% match</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
