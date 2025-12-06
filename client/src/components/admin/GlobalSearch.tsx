import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Users,
  Car,
  UtensilsCrossed,
  Package,
  ShoppingBag,
  X,
  Command,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SearchCategory = "all" | "users" | "drivers" | "restaurants" | "parcels" | "orders";
type ResultType = Exclude<SearchCategory, "all">;

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
}

const categoryConfig: Record<Exclude<SearchCategory, "all">, { icon: any; label: string; color: string }> = {
  users: { icon: Users, label: "Users", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  drivers: { icon: Car, label: "Drivers", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  restaurants: { icon: UtensilsCrossed, label: "Restaurants", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  parcels: { icon: Package, label: "Parcels", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  orders: { icon: ShoppingBag, label: "Orders", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
};

const mockResults: SearchResult[] = [
  { id: "1", type: "users", title: "John Smith", subtitle: "john.smith@email.com", href: "/admin/users/1" },
  { id: "2", type: "users", title: "Sarah Johnson", subtitle: "sarah.j@email.com", href: "/admin/users/2" },
  { id: "3", type: "drivers", title: "Michael Brown", subtitle: "Active Driver - Toyota Camry", href: "/admin/drivers/1" },
  { id: "4", type: "drivers", title: "David Wilson", subtitle: "Active Driver - Honda Accord", href: "/admin/drivers/2" },
  { id: "5", type: "restaurants", title: "Pizza Palace", subtitle: "Italian - Downtown", href: "/admin/restaurants/1" },
  { id: "6", type: "restaurants", title: "Burger Haven", subtitle: "American - Midtown", href: "/admin/restaurants/2" },
  { id: "7", type: "parcels", title: "PKG-2024-001", subtitle: "In Transit - Express Delivery", href: "/admin/parcels/1" },
  { id: "8", type: "parcels", title: "PKG-2024-002", subtitle: "Delivered - Standard", href: "/admin/parcels/2" },
  { id: "9", type: "orders", title: "ORD-5847", subtitle: "Completed - $45.99", href: "/admin/orders/1" },
  { id: "10", type: "orders", title: "ORD-5848", subtitle: "In Progress - $32.50", href: "/admin/orders/2" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();

  const filteredResults = mockResults.filter((result) => {
    const matchesQuery = 
      result.title.toLowerCase().includes(query.toLowerCase()) ||
      result.subtitle.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || result.type === category;
    return matchesQuery && matchesCategory;
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, category]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setCategory("all");
    setLocation(result.href);
  };

  const handleResultKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      handleSelect(filteredResults[selectedIndex]);
    }
  };

  const categories: SearchCategory[] = ["all", "users", "drivers", "restaurants", "parcels", "orders"];

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-8 w-full justify-start gap-2 rounded-md bg-muted/40 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground border-border/50 shadow-none"
        data-testid="button-global-search"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline-flex truncate">Search everything...</span>
        <span className="sm:hidden">Search</span>
        <kbd className="pointer-events-none absolute right-2 hidden h-4 select-none items-center gap-0.5 rounded border bg-background/80 px-1 font-mono text-[9px] font-medium opacity-80 sm:flex">
          <span className="text-[9px]">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" onKeyDown={handleResultKeyDown}>
          <DialogHeader className="sr-only">
            <DialogTitle>Global Search</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center border-b px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search users, drivers, restaurants, parcels, orders..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 bg-transparent px-3 py-4 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
              autoFocus
              data-testid="input-global-search"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setQuery("")}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30">
            {categories.map((cat) => {
              if (cat === "all") {
                return (
                  <Button
                    key={cat}
                    variant={category === cat ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 text-xs capitalize",
                      category === cat && "bg-primary/10 text-primary"
                    )}
                    onClick={() => setCategory(cat)}
                    data-testid={`button-filter-${cat}`}
                  >
                    All
                  </Button>
                );
              }
              const config = categoryConfig[cat];
              return (
                <Button
                  key={cat}
                  variant={category === cat ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs capitalize",
                    category === cat && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setCategory(cat)}
                  data-testid={`button-filter-${cat}`}
                >
                  <config.icon className="h-3 w-3 mr-1" />
                  {config.label}
                </Button>
              );
            })}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs mt-1">Try a different search term or category</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredResults.map((result, index) => {
                  const config = categoryConfig[result.type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        index === selectedIndex
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/50"
                      )}
                      data-testid={`search-result-${result.type}-${result.id}`}
                    >
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-medium capitalize">
                        {config.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">↓</kbd>
                <span className="ml-1">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                <span className="ml-1">Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
                <span className="ml-1">Close</span>
              </span>
            </div>
            <span>{filteredResults.length} results</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
