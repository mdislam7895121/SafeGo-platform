import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "/" or "Ctrl+K" to focus search
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Check if user is already in an input/textarea
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      
      // "/" shortcut
      if (e.key === "/" && !isInputField) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      
      // "Ctrl+K" or "Cmd+K" shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleClear = () => {
    setSearchQuery("");
    onSearch?.("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClear();
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Search Icon */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      
      {/* Input Field */}
      <Input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "pl-10 h-9 bg-background w-full text-sm",
          (searchQuery || isLoading) && "pr-20"
        )}
        aria-label="Search orders, menu items, and customers"
        data-testid="restaurant-search-input"
      />

      {/* Right Side Controls */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {/* Loading Indicator */}
        {isLoading && (
          <div 
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="restaurant-search-loading"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">Searching...</span>
          </div>
        )}

        {/* Clear Button */}
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

        {/* Keyboard Shortcut Hint (desktop only, when not focused) */}
        {!searchQuery && !isLoading && (
          <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">
              /
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}
