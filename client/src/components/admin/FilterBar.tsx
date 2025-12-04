import { ReactNode, useState } from "react";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  id: string;
  label: string;
  type: "select" | "multi-select" | "date-range" | "search";
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (filterId: string, value: any) => void;
  onClear: () => void;
  searchPlaceholder?: string;
  className?: string;
  children?: ReactNode;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  searchPlaceholder = "Search...",
  className,
  children,
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFiltersCount = Object.entries(values).filter(
    ([key, value]) =>
      value !== undefined &&
      value !== "" &&
      value !== null &&
      (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  const searchFilter = filters.find((f) => f.type === "search");
  const selectFilters = filters.filter((f) => f.type === "select");
  const multiSelectFilters = filters.filter((f) => f.type === "multi-select");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row gap-3">
        {searchFilter && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchFilter.placeholder || searchPlaceholder}
              value={values[searchFilter.id] || ""}
              onChange={(e) => onChange(searchFilter.id, e.target.value)}
              className="pl-9 h-9"
              data-testid={`filter-${searchFilter.id}`}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {selectFilters.slice(0, 3).map((filter) => (
            <Select
              key={filter.id}
              value={values[filter.id] || ""}
              onValueChange={(value) => onChange(filter.id, value)}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-[120px]"
                data-testid={`filter-${filter.id}`}
              >
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {(selectFilters.length > 3 || multiSelectFilters.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setShowAdvanced(!showAdvanced)}
              data-testid="button-advanced-filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          )}

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onClear}
              data-testid="button-clear-filters"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}

          {children}
        </div>
      </div>

      {showAdvanced && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border">
          {selectFilters.slice(3).map((filter) => (
            <Select
              key={filter.id}
              value={values[filter.id] || ""}
              onValueChange={(value) => onChange(filter.id, value)}
            >
              <SelectTrigger
                className="h-8 w-auto min-w-[120px]"
                data-testid={`filter-${filter.id}`}
              >
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {multiSelectFilters.map((filter) => (
            <DropdownMenu key={filter.id}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  data-testid={`filter-${filter.id}`}
                >
                  {filter.label}
                  {values[filter.id]?.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {values[filter.id].length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filter.options?.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={values[filter.id]?.includes(option.value)}
                    onCheckedChange={(checked) => {
                      const current = values[filter.id] || [];
                      onChange(
                        filter.id,
                        checked
                          ? [...current, option.value]
                          : current.filter((v: string) => v !== option.value)
                      );
                    }}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      )}
    </div>
  );
}

interface QuickFilter {
  id: string;
  label: string;
  count?: number;
}

interface QuickFilterBarProps {
  filters: QuickFilter[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  className?: string;
}

export function QuickFilterBar({
  filters,
  activeFilter,
  onFilterChange,
  className,
}: QuickFilterBarProps) {
  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto pb-1", className)}>
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <Button
            key={filter.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "h-8 shrink-0",
              isActive && "font-medium"
            )}
            data-testid={`quick-filter-${filter.id}`}
          >
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <Badge
                variant={isActive ? "default" : "secondary"}
                className="ml-1.5 h-5 px-1.5 text-[10px]"
              >
                {filter.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
