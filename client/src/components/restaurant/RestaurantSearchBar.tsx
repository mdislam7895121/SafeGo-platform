import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { Search, X, Loader2, Clock, ShoppingBag, User, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface SearchResult {
  id: string;
  type: "order" | "customer" | "menu_item";
  title: string;
  subtitle?: string;
  status?: string;
  link: string;
}

interface RestaurantSearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function RestaurantSearchBar({
  placeholder = "Search orders, menu items, customers...",
  onSearch,
  isLoading = false,
  className
}: RestaurantSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const [, setLocation] = useLocation();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("restaurant-recent-searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("restaurant-recent-searches", JSON.stringify(updated));
  };

  // Keyboard shortcut: "/" or "Ctrl+K" to focus search
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      
      if (e.key === "/" && !isInputField) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setSelectedIndex(-1);
    
    // Show dropdown when typing
    if (value.trim()) {
      setShowDropdown(true);
    }
    
    // Debounce search callback
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      onSearch?.(value);
    }, 300);
  };

  const handleClear = () => {
    setSearchQuery("");
    setShowDropdown(false);
    setSelectedIndex(-1);
    onSearch?.("");
    inputRef.current?.focus();
  };

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
    saveRecentSearch(query);
    setShowDropdown(false);
  };

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(searchQuery);
    setShowDropdown(false);
    // Navigate using SPA routing
    setLocation(result.link);
  };

  // Generate ID for active descendant
  const getActiveDescendantId = () => {
    if (selectedIndex < 0) return undefined;
    if (selectedIndex < recentSearches.length) {
      return `search-option-recent-${selectedIndex}`;
    }
    const resultIndex = selectedIndex - recentSearches.length;
    return `search-option-result-${resultIndex}`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      handleClear();
      return;
    }

    if (!showDropdown) return;

    const allItems = [
      ...recentSearches.map((_, i) => ({ type: "recent" as const, index: i })),
      ...mockResults.map((_, i) => ({ type: "result" as const, index: i }))
    ];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item.type === "recent") {
        handleRecentSearchClick(recentSearches[item.index]);
      } else if (item.type === "result") {
        const result = mockResults[item.index];
        // handleResultClick already calls setLocation
        handleResultClick(result);
      }
    }
  };

  // Mock search results - in production, this would come from API
  const mockResults: SearchResult[] = searchQuery.trim() ? [
    {
      id: "ord-1",
      type: "order",
      title: "Order #12345",
      subtitle: "2 items • $45.99",
      status: "preparing",
      link: "/restaurant/orders/live"
    },
    {
      id: "cust-1",
      type: "customer",
      title: "John D.",
      subtitle: "john***@email.com • +1 ***-***-5678",
      link: "/restaurant/orders/live"
    },
    {
      id: "menu-1",
      type: "menu_item",
      title: "Chicken Burger",
      subtitle: "Burgers • $12.99",
      link: "/restaurant/menu/all-items"
    }
  ] : [];

  const orderResults = mockResults.filter(r => r.type === "order");
  const customerResults = mockResults.filter(r => r.type === "customer");
  const menuResults = mockResults.filter(r => r.type === "menu_item");

  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "order":
        return <ShoppingBag className="h-4 w-4 text-blue-500" />;
      case "customer":
        return <User className="h-4 w-4 text-purple-500" />;
      case "menu_item":
        return <Package className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      preparing: { label: "Preparing", variant: "default" },
      ready: { label: "Ready", variant: "secondary" },
      delivered: { label: "Delivered", variant: "outline" }
    };
    
    const config = variants[status] || variants.preparing;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery && setShowDropdown(true)}
          placeholder={placeholder}
          className={cn(
            "pl-10 h-9 bg-background w-full text-sm",
            (searchQuery || isLoading) && "pr-20"
          )}
          aria-label="Search orders, menu items, and customers"
          aria-expanded={showDropdown}
          aria-controls="search-dropdown"
          aria-activedescendant={showDropdown ? getActiveDescendantId() : undefined}
          data-testid="restaurant-search-input"
        />

        {/* Right Side Controls */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <div 
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              data-testid="restaurant-search-loading"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Searching...</span>
            </div>
          )}

          {searchQuery && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover-elevate active-elevate-2"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear();
                }
              }}
              aria-label="Clear search"
              data-testid="restaurant-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}

          {!searchQuery && !isLoading && (
            <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">
                /
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* Search Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          id="search-dropdown"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 max-h-[400px] overflow-y-auto"
          data-testid="restaurant-search-dropdown"
        >
          {/* Recent Searches */}
          {!searchQuery && recentSearches.length > 0 && (
            <div className="p-3 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Recent Searches
                </p>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    id={`search-option-recent-${index}`}
                    onClick={() => handleRecentSearchClick(search)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md hover-elevate active-elevate-2 text-sm",
                      selectedIndex === index && "bg-accent"
                    )}
                    aria-selected={selectedIndex === index}
                    role="option"
                    data-testid={`recent-search-${index}`}
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <>
              {/* Orders */}
              {orderResults.length > 0 && (
                <div className="p-3 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Orders
                  </p>
                  <div className="space-y-1">
                    {orderResults.map((result, idx) => {
                      const itemIndex = recentSearches.length + mockResults.indexOf(result);
                      const isSelected = selectedIndex === itemIndex;
                      const resultIndex = mockResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          id={`search-option-result-${resultIndex}`}
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            "w-full text-left p-2 rounded-md hover-elevate active-elevate-2 flex items-center gap-3",
                            isSelected && "bg-accent"
                          )}
                          aria-selected={isSelected}
                          role="option"
                          data-testid={`search-result-${result.id}`}
                        >
                          {getResultIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          {result.status && getStatusBadge(result.status)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customers */}
              {customerResults.length > 0 && (
                <div className="p-3 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Customers
                  </p>
                  <div className="space-y-1">
                    {customerResults.map((result) => {
                      const itemIndex = recentSearches.length + mockResults.indexOf(result);
                      const isSelected = selectedIndex === itemIndex;
                      const resultIndex = mockResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          id={`search-option-result-${resultIndex}`}
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            "w-full text-left p-2 rounded-md hover-elevate active-elevate-2 flex items-center gap-3",
                            isSelected && "bg-accent"
                          )}
                          aria-selected={isSelected}
                          role="option"
                          data-testid={`search-result-${result.id}`}
                        >
                          {getResultIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Menu Items */}
              {menuResults.length > 0 && (
                <div className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Menu Items
                  </p>
                  <div className="space-y-1">
                    {menuResults.map((result) => {
                      const itemIndex = recentSearches.length + mockResults.indexOf(result);
                      const isSelected = selectedIndex === itemIndex;
                      const resultIndex = mockResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          id={`search-option-result-${resultIndex}`}
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            "w-full text-left p-2 rounded-md hover-elevate active-elevate-2 flex items-center gap-3",
                            isSelected && "bg-accent"
                          )}
                          aria-selected={isSelected}
                          role="option"
                          data-testid={`search-result-${result.id}`}
                        >
                          {getResultIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {orderResults.length === 0 && customerResults.length === 0 && menuResults.length === 0 && (
                <div className="p-8 text-center">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-20" />
                  <p className="text-sm text-muted-foreground">
                    No results found. Try a different keyword.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
