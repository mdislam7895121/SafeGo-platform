import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Plus,
  X,
  AlertCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { filterCategories, highlightMatch } from "@/lib/categorySearch";
import { suggestCategory } from "@/lib/categoryAutoSuggest";

type Category = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  displayOrder: number;
};

type SubCategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  isActive: boolean;
  displayOrder: number;
};

const itemSchema = z.object({
  mainCategoryId: z.string().uuid("Main category is required"),
  subCategoryIds: z.array(z.string().uuid()).optional(),
  name: z.string().min(1, "Name is required").max(200),
  shortDescription: z.string().max(500).optional(),
  longDescription: z.string().optional(),
  basePrice: z.number().min(0, "Price must be positive"),
  currency: z.string().default("USD"),
  preparationTimeMinutes: z.number().int().min(0).optional(),
  itemImageUrl: z.string().url().optional().or(z.literal("")),
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isHalal: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  dietaryTags: z.array(z.string()).default([]),
});

type ItemFormData = z.infer<typeof itemSchema>;

export default function AddMenuItem() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [formData, setFormData] = useState<ItemFormData>({
    mainCategoryId: "",
    subCategoryIds: [],
    name: "",
    shortDescription: "",
    longDescription: "",
    basePrice: 0,
    currency: "USD",
    preparationTimeMinutes: 15,
    itemImageUrl: "",
    isVegetarian: false,
    isVegan: false,
    isHalal: false,
    isSpicy: false,
    dietaryTags: [],
  });
  
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ItemFormData, string>>>({});
  const [showWarning, setShowWarning] = useState(false);
  
  // Category selection UI state
  const [mainCategoryOpen, setMainCategoryOpen] = useState(false);
  const [mainCategorySearch, setMainCategorySearch] = useState("");
  
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  const [subCategorySearch, setSubCategorySearch] = useState("");
  
  // Smart category search state
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  
  // Auto-suggest state
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Fetch main categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/restaurant/categories"],
  });
  
  // Fetch ALL subcategories for search/auto-suggest (loads once at page load)
  const { data: allSubCategoriesData } = useQuery<{ subcategories: SubCategory[] }>({
    queryKey: ["/api/restaurant/subcategories/all"],
  });
  const allSubCategories = allSubCategoriesData?.subcategories || [];
  
  // Fetch subcategories for selected main category (for manual dropdown selection)
  const { data: subCategories = [], isLoading: subCategoriesLoading } = useQuery<SubCategory[]>({
    queryKey: ["/api/restaurant/subcategories", formData.mainCategoryId],
    enabled: !!formData.mainCategoryId,
  });
  
  // Reset subcategories when main category changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, subCategoryIds: [] }));
  }, [formData.mainCategoryId]);
  
  // Show warning if no subcategory selected
  useEffect(() => {
    setShowWarning(formData.mainCategoryId !== "" && (!formData.subCategoryIds || formData.subCategoryIds.length === 0));
  }, [formData.mainCategoryId, formData.subCategoryIds]);

  const createItemMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      return await apiRequest("/api/restaurant/menu/items", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items"] });
      toast({ title: "Success", description: "Menu item created successfully" });
      setLocation("/restaurant/menu");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const validateForm = (): boolean => {
    try {
      itemSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof ItemFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof ItemFormData] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    createItemMutation.mutate(formData);
  };
  
  // Auto-suggest category based on title and description (using ALL subcategories)
  const autoSuggestResult = suggestCategory(
    formData.name,
    formData.shortDescription || "",
    categories,
    allSubCategories
  );
  
  // Apply suggested category
  const applySuggestedCategory = () => {
    if (autoSuggestResult.category) {
      setFormData(prev => ({ ...prev, mainCategoryId: autoSuggestResult.category!.id }));
      setShowSuggestions(false);
    }
  };
  
  // Apply suggested subcategories
  const applySuggestedSubcategories = () => {
    if (autoSuggestResult.subcategories.length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        subCategoryIds: autoSuggestResult.subcategories.map(s => s.id) 
      }));
      setShowSuggestions(false);
    }
  };
  
  // Smart category search - filter based on categorySearchQuery (using ALL subcategories)
  const filteredCategoryTree = filterCategories(
    categorySearchQuery,
    categories,
    allSubCategories
  );
  
  // Filter main categories based on popover search (existing behavior)
  const filteredMainCategories = categorySearchQuery 
    ? filteredCategoryTree.map(f => f.category)
    : categories.filter(cat => 
        cat.name.toLowerCase().includes(mainCategorySearch.toLowerCase())
      );
  
  // Filter subcategories based on popover search (existing behavior)
  const filteredSubCategories = subCategories.filter(sub =>
    sub.name.toLowerCase().includes(subCategorySearch.toLowerCase())
  );
  
  // Get selected main category name for display
  const selectedCategoryName = categories.find(c => c.id === formData.mainCategoryId)?.name || "";
  
  // Get selected subcategory names for display
  const selectedSubCategoryNames = subCategories
    .filter(sub => formData.subCategoryIds?.includes(sub.id))
    .map(sub => ({ id: sub.id, name: sub.name }));
  
  // Toggle subcategory selection
  const toggleSubCategory = (subCatId: string) => {
    if (!formData.subCategoryIds) {
      setFormData({ ...formData, subCategoryIds: [subCatId] });
    } else if (formData.subCategoryIds.includes(subCatId)) {
      setFormData({ 
        ...formData, 
        subCategoryIds: formData.subCategoryIds.filter(id => id !== subCatId) 
      });
    } else {
      setFormData({ 
        ...formData, 
        subCategoryIds: [...formData.subCategoryIds, subCatId] 
      });
    }
  };
  
  // Remove subcategory chip
  const removeSubCategory = (subCatId: string) => {
    if (formData.subCategoryIds) {
      setFormData({ 
        ...formData, 
        subCategoryIds: formData.subCategoryIds.filter(id => id !== subCatId) 
      });
    }
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Add New Menu Item</h1>
          <p className="text-sm text-muted-foreground">
            Create a new item for your restaurant menu
          </p>
        </div>
        <Link href="/restaurant/menu">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menu
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g., Margherita Pizza"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-name"
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              {/* Smart Category Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Categories
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search categories and subcategories..."
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-category-search"
                  />
                  {categorySearchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setCategorySearchQuery("")}
                      data-testid="button-clear-search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {categorySearchQuery && filteredCategoryTree.length > 0 && (
                  <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      {filteredCategoryTree.length} category group{filteredCategoryTree.length !== 1 ? 's' : ''} found
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {filteredCategoryTree.map((result) => {
                        const highlight = highlightMatch(result.category.name, categorySearchQuery);
                        return (
                          <div key={result.category.id} className="space-y-1">
                            <button
                              onClick={() => {
                                setFormData(prev => ({ ...prev, mainCategoryId: result.category.id }));
                                setCategorySearchQuery("");
                              }}
                              className="text-left w-full px-2 py-1.5 rounded-sm hover-elevate text-sm font-medium"
                              data-testid={`search-result-category-${result.category.slug}`}
                            >
                              {highlight.parts.map((part, idx) => (
                                <span key={idx} className={part.highlight ? "bg-primary/20 font-semibold" : ""}>
                                  {part.text}
                                </span>
                              ))}
                            </button>
                            {result.subcategories.length > 0 && (
                              <div className="ml-4 space-y-0.5">
                                {result.subcategories.slice(0, 3).map(sub => {
                                  const subHighlight = highlightMatch(sub.name, categorySearchQuery);
                                  return (
                                    <button
                                      key={sub.id}
                                      onClick={() => {
                                        setFormData(prev => ({ 
                                          ...prev, 
                                          mainCategoryId: result.category.id,
                                          subCategoryIds: [sub.id]
                                        }));
                                        setCategorySearchQuery("");
                                      }}
                                      className="text-left w-full px-2 py-1 rounded-sm hover-elevate text-xs text-muted-foreground"
                                      data-testid={`search-result-subcategory-${sub.slug}`}
                                    >
                                      {subHighlight.parts.map((part, idx) => (
                                        <span key={idx} className={part.highlight ? "bg-primary/20 font-semibold" : ""}>
                                          {part.text}
                                        </span>
                                      ))}
                                    </button>
                                  );
                                })}
                                {result.subcategories.length > 3 && (
                                  <p className="text-xs text-muted-foreground ml-2">
                                    +{result.subcategories.length - 3} more
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {categorySearchQuery && filteredCategoryTree.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No categories or subcategories match "{categorySearchQuery}"
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Auto-Suggest Section */}
              {formData.name && autoSuggestResult.confidence !== 'none' && showSuggestions && !formData.mainCategoryId && (
                <Alert className="border-primary/50 bg-primary/5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Suggested Category</p>
                      {autoSuggestResult.category && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={applySuggestedCategory}
                          className="mr-2"
                          data-testid="button-apply-suggested-category"
                        >
                          {autoSuggestResult.category.name}
                        </Button>
                      )}
                      {autoSuggestResult.subcategories.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Suggested Subcategories:</p>
                          <div className="flex flex-wrap gap-2">
                            {autoSuggestResult.subcategories.map(sub => (
                              <Badge
                                key={sub.id}
                                variant="secondary"
                                className="cursor-pointer hover-elevate"
                                onClick={() => {
                                  if (autoSuggestResult.category) {
                                    setFormData(prev => ({
                                      ...prev,
                                      mainCategoryId: autoSuggestResult.category!.id,
                                      subCategoryIds: [sub.id]
                                    }));
                                    setShowSuggestions(false);
                                  }
                                }}
                                data-testid={`badge-suggested-subcategory-${sub.slug}`}
                              >
                                {sub.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Click to apply suggestion, or choose manually below
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Main Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Main Category <span className="text-destructive">*</span>
                </label>
                {categoriesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Popover open={mainCategoryOpen} onOpenChange={setMainCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={mainCategoryOpen}
                        className="w-full justify-between"
                        data-testid="button-main-category"
                      >
                        {selectedCategoryName || "Select main category..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search categories..." 
                          value={mainCategorySearch}
                          onValueChange={setMainCategorySearch}
                          data-testid="input-search-main-category"
                        />
                        <CommandList>
                          <CommandEmpty>
                            <p className="p-2 text-sm text-muted-foreground">No matching categories</p>
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredMainCategories.map((cat) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setFormData({ ...formData, mainCategoryId: cat.id });
                                  setMainCategoryOpen(false);
                                  setMainCategorySearch("");
                                }}
                                data-testid={`option-main-category-${cat.slug}`}
                              >
                                {cat.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
                {formErrors.mainCategoryId && (
                  <p className="text-sm text-destructive">{formErrors.mainCategoryId}</p>
                )}
              </div>

              {/* Subcategory Selection */}
              {formData.mainCategoryId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Subcategories {!showWarning && "(Recommended)"}
                  </label>
                  
                  {subCategoriesLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Popover open={subCategoryOpen} onOpenChange={setSubCategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={subCategoryOpen}
                          className="w-full justify-between"
                          data-testid="button-subcategories"
                        >
                          {formData.subCategoryIds && formData.subCategoryIds.length > 0
                            ? `${formData.subCategoryIds.length} selected`
                            : "Select subcategories..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search subcategories..." 
                            value={subCategorySearch}
                            onValueChange={setSubCategorySearch}
                            data-testid="input-search-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <p className="p-2 text-sm text-muted-foreground">No matching subcategories</p>
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredSubCategories.map((sub) => (
                                <CommandItem
                                  key={sub.id}
                                  value={sub.name}
                                  onSelect={() => toggleSubCategory(sub.id)}
                                  data-testid={`option-subcategory-${sub.slug}`}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <Checkbox
                                      checked={formData.subCategoryIds?.includes(sub.id) || false}
                                      onCheckedChange={() => toggleSubCategory(sub.id)}
                                    />
                                    <span>{sub.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  
                  {/* Selected subcategories as chips */}
                  {selectedSubCategoryNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSubCategoryNames.map((sub) => (
                        <Badge 
                          key={sub.id} 
                          variant="secondary"
                          className="gap-1"
                          data-testid={`badge-subcategory-${sub.name}`}
                        >
                          {sub.name}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeSubCategory(sub.id)}
                            data-testid={`button-remove-subcategory-${sub.name}`}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {showWarning && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No subcategories selected. It's recommended to add at least one subcategory to help customers find your item.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Short Description</label>
                <Textarea
                  placeholder="Brief description (shown in listings)"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  rows={2}
                  data-testid="input-short-description"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Full Description</label>
                <Textarea
                  placeholder="Detailed description (shown on item page)"
                  value={formData.longDescription}
                  onChange={(e) => setFormData({ ...formData, longDescription: e.target.value })}
                  rows={4}
                  data-testid="input-long-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Price <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.basePrice || ""}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                    data-testid="input-price"
                  />
                  {formErrors.basePrice && (
                    <p className="text-sm text-destructive">{formErrors.basePrice}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Prep Time (minutes)</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.preparationTimeMinutes || ""}
                    onChange={(e) => setFormData({ ...formData, preparationTimeMinutes: parseInt(e.target.value) || 0 })}
                    data-testid="input-prep-time"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dietary Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Dietary Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vegetarian"
                  checked={formData.isVegetarian}
                  onCheckedChange={(checked) => setFormData({ ...formData, isVegetarian: !!checked })}
                  data-testid="checkbox-vegetarian"
                />
                <label htmlFor="vegetarian" className="text-sm font-medium cursor-pointer">
                  Vegetarian
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vegan"
                  checked={formData.isVegan}
                  onCheckedChange={(checked) => setFormData({ ...formData, isVegan: !!checked })}
                  data-testid="checkbox-vegan"
                />
                <label htmlFor="vegan" className="text-sm font-medium cursor-pointer">
                  Vegan
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="halal"
                  checked={formData.isHalal}
                  onCheckedChange={(checked) => setFormData({ ...formData, isHalal: !!checked })}
                  data-testid="checkbox-halal"
                />
                <label htmlFor="halal" className="text-sm font-medium cursor-pointer">
                  Halal
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="spicy"
                  checked={formData.isSpicy}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSpicy: !!checked })}
                  data-testid="checkbox-spicy"
                />
                <label htmlFor="spicy" className="text-sm font-medium cursor-pointer">
                  Spicy
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Image */}
          <Card>
            <CardHeader>
              <CardTitle>Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                type="url"
                placeholder="Image URL"
                value={formData.itemImageUrl}
                onChange={(e) => setFormData({ ...formData, itemImageUrl: e.target.value })}
                data-testid="input-image-url"
              />
              {formErrors.itemImageUrl && (
                <p className="text-sm text-destructive">{formErrors.itemImageUrl}</p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button
                onClick={handleSubmit}
                disabled={createItemMutation.isPending}
                className="w-full"
                data-testid="button-create-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                {createItemMutation.isPending ? "Creating..." : "Create Menu Item"}
              </Button>
              <Link href="/restaurant/menu">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
