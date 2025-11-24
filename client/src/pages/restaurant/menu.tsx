import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Filter,
  ChevronDown,
  Edit,
  Trash2,
  Image as ImageIcon,
  Check,
  X,
  UtensilsCrossed,
  Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function RestaurantMenu() {
  const { toast } = useToast();
  
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Performance: Show 20 items per page

  // Debounce search query for performance (500+ items)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch menu categories
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/restaurant/menu/categories"],
  });

  // Fetch menu items
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/restaurant/menu/items"],
  });

  const categories = categoriesData?.categories || [];
  const allItems = itemsData?.items || [];

  // Filtered and paginated items
  const filteredItems = useMemo(() => {
    let filtered = allItems;

    // Search filter (using debounced query for performance)
    if (debouncedSearchQuery) {
      filtered = filtered.filter((item: any) =>
        item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((item: any) => item.categoryId === selectedCategory);
    }

    // Availability filter
    if (availabilityFilter !== "all") {
      filtered = filtered.filter((item: any) => item.availabilityStatus === availabilityFilter);
    }

    return filtered;
  }, [allItems, debouncedSearchQuery, selectedCategory, availabilityFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mutations
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ itemId, availabilityStatus }: { itemId: string; availabilityStatus: string }) => {
      return await apiRequest(`/api/restaurant/menu/items/${itemId}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ availabilityStatus }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items"] });
      toast({
        title: "Success",
        description: "Item availability updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const bulkToggleAvailabilityMutation = useMutation({
    mutationFn: async ({ itemIds, availabilityStatus }: { itemIds: string[]; availabilityStatus: string }) => {
      const promises = itemIds.map((id) =>
        apiRequest(`/api/restaurant/menu/items/${id}/availability`, {
          method: "PATCH",
          body: JSON.stringify({ availabilityStatus }),
          headers: { "Content-Type": "application/json" },
        })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items"] });
      setSelectedItems(new Set());
      toast({
        title: "Success",
        description: "Items updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update items",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map((item: any) => item.id)));
    }
  };

  const handleBulkMakeAvailable = () => {
    bulkToggleAvailabilityMutation.mutate({
      itemIds: Array.from(selectedItems),
      availabilityStatus: "available",
    });
  };

  const handleBulkMakeUnavailable = () => {
    bulkToggleAvailabilityMutation.mutate({
      itemIds: Array.from(selectedItems),
      availabilityStatus: "unavailable",
    });
  };

  return (
    <div className="space-y-6">
        {/* Search and Filters - Stable 24px spacing from header */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page
                  }}
                  className="pl-9"
                  data-testid="input-search-menu"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={(value) => {
                setSelectedCategory(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Availability Filter */}
              <Select value={availabilityFilter} onValueChange={(value) => {
                setAvailabilityFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger data-testid="select-availability">
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{selectedItems.size} items selected</p>
                  <p className="text-sm text-muted-foreground">Apply bulk actions to selected items</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkMakeAvailable}
                    disabled={bulkToggleAvailabilityMutation.isPending}
                    data-testid="button-bulk-available"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Make Available
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkMakeUnavailable}
                    disabled={bulkToggleAvailabilityMutation.isPending}
                    data-testid="button-bulk-unavailable"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Make Unavailable
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedItems(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Menu Items Grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Menu Items
                {filteredItems.length > 0 && (
                  <Badge variant="secondary">{filteredItems.length}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.size === paginatedItems.length && paginatedItems.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-64 w-full" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <UtensilsCrossed className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                <p className="text-lg font-medium mb-2">No menu items yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {allItems.length === 0
                    ? "Start by adding your first menu item"
                    : "No items match your search or filters"}
                </p>
                {allItems.length === 0 && (
                  <Button data-testid="button-add-first-item">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Item
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedItems.map((item: any) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 space-y-3 hover-elevate transition-all ${
                        selectedItems.has(item.id) ? "ring-2 ring-primary" : ""
                      }`}
                      data-testid={`menu-item-${item.id}`}
                    >
                      {/* Checkbox */}
                      <div className="flex items-start justify-between">
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => handleSelectItem(item.id)}
                          data-testid={`checkbox-item-${item.id}`}
                        />
                        <Badge variant={item.availabilityStatus === "available" ? "default" : "secondary"}>
                          {item.availabilityStatus === "available" ? "Available" : 
                           item.availabilityStatus === "out_of_stock" ? "Out of Stock" : "Unavailable"}
                        </Badge>
                      </div>

                      {/* Image Placeholder */}
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        {item.itemImageUrl ? (
                          <img
                            src={item.itemImageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="h-12 w-12 text-muted-foreground opacity-20" />
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="space-y-2">
                        <div>
                          <h3 className="font-semibold text-base line-clamp-1">{item.name}</h3>
                          {item.shortDescription && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {item.shortDescription}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-primary">
                            {item.currency === "BDT" ? "৳" : "$"}{Number(item.basePrice).toFixed(2)}
                          </p>
                          {item.category && (
                            <Badge variant="outline" className="text-xs">
                              {item.category.name}
                            </Badge>
                          )}
                        </div>

                        {/* Dietary Tags */}
                        {item.dietaryTags && item.dietaryTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.dietaryTags.slice(0, 3).map((tag: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Availability</span>
                          <Switch
                            checked={item.availabilityStatus === "available"}
                            onCheckedChange={(checked) =>
                              toggleAvailabilityMutation.mutate({
                                itemId: item.id,
                                availabilityStatus: checked ? "available" : "unavailable",
                              })
                            }
                            disabled={toggleAvailabilityMutation.isPending}
                            data-testid={`switch-availability-${item.id}`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" data-testid={`button-edit-${item.id}`}>
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-delete-${item.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            size="sm"
                            variant={currentPage === page ? "default" : "outline"}
                            onClick={() => setCurrentPage(page)}
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && <span className="px-2">...</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                    <span className="text-sm text-muted-foreground ml-2">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Performance Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Filter className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Performance Optimizations</p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• Pagination: Showing {itemsPerPage} items per page for optimal performance</li>
                  <li>• Lazy loading: Images load only when visible</li>
                  <li>• Client-side filtering: Instant search and filter results</li>
                  <li>• Bulk operations: Efficient batch updates for multiple items</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
