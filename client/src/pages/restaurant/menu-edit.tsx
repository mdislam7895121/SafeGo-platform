import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Save,
  X,
  AlertCircle,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { MENU_CATEGORIES, getMainCategories, getSubCategories } from "@/config/menuCategoryConfig";

const itemSchema = z.object({
  primaryCategory: z.string().min(1, "Main category is required"),
  subCategories: z.array(z.string()).optional(),
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

export default function EditMenuItem() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/restaurant/menu-edit/:id");
  const itemId = params?.id;
  
  const [formData, setFormData] = useState<ItemFormData>({
    primaryCategory: "",
    subCategories: [],
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
  const [customMainCategory, setCustomMainCategory] = useState("");
  
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  const [subCategorySearch, setSubCategorySearch] = useState("");
  const [customSubCategory, setCustomSubCategory] = useState("");
  
  // Available subcategories based on selected main category
  const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);

  // Fetch existing item data
  const { data: itemData, isLoading: itemLoading } = useQuery({
    queryKey: ["/api/restaurant/menu/items", itemId],
    queryFn: async () => {
      const response = await apiRequest(`/api/restaurant/menu/items/${itemId}`, {
        method: "GET",
      });
      return response;
    },
    enabled: !!itemId,
  });

  // Pre-populate form when item loads (with backwards compatibility)
  useEffect(() => {
    if (itemData?.item) {
      const item = itemData.item;
      
      // Backwards compatibility: map old category system to new
      let primaryCategory = item.primaryCategory || "";
      let subCategories = item.subCategories || [];
      
      // If primaryCategory is empty but we have old categoryId, try to map it
      if (!primaryCategory && item.category) {
        // Use the category name as primary category
        primaryCategory = item.category.name || "";
      }
      
      setFormData({
        primaryCategory,
        subCategories,
        name: item.name || "",
        shortDescription: item.shortDescription || "",
        longDescription: item.longDescription || "",
        basePrice: parseFloat(item.basePrice) || 0,
        currency: item.currency || "USD",
        preparationTimeMinutes: item.preparationTimeMinutes || 15,
        itemImageUrl: item.itemImageUrl || "",
        isVegetarian: item.isVegetarian || false,
        isVegan: item.isVegan || false,
        isHalal: item.isHalal || false,
        isSpicy: item.isSpicy || false,
        dietaryTags: item.dietaryTags || [],
      });
    }
  }, [itemData]);
  
  // Update available subcategories when main category changes
  useEffect(() => {
    if (formData.primaryCategory) {
      const subs = getSubCategories(formData.primaryCategory);
      setAvailableSubCategories(subs);
    } else {
      setAvailableSubCategories([]);
    }
  }, [formData.primaryCategory]);
  
  // Show warning if no subcategory selected
  useEffect(() => {
    setShowWarning(formData.primaryCategory !== "" && (!formData.subCategories || formData.subCategories.length === 0));
  }, [formData.primaryCategory, formData.subCategories]);

  const updateItemMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      return await apiRequest(`/api/restaurant/menu/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items"] });
      toast({ title: "Success", description: "Menu item updated successfully" });
      setLocation("/restaurant/menu");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
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
    updateItemMutation.mutate(formData);
  };
  
  // Filter main categories based on search
  const filteredMainCategories = getMainCategories().filter(cat => 
    cat.toLowerCase().includes(mainCategorySearch.toLowerCase())
  );
  
  // Filter subcategories based on search
  const filteredSubCategories = availableSubCategories.filter(sub =>
    sub.toLowerCase().includes(subCategorySearch.toLowerCase())
  );
  
  // Handle adding custom main category
  const handleAddCustomMainCategory = () => {
    if (customMainCategory.trim()) {
      setFormData({ ...formData, primaryCategory: customMainCategory.trim() });
      setCustomMainCategory("");
      setMainCategoryOpen(false);
    }
  };
  
  // Handle adding custom subcategory
  const handleAddCustomSubCategory = () => {
    if (customSubCategory.trim() && formData.subCategories) {
      setFormData({ 
        ...formData, 
        subCategories: [...formData.subCategories, customSubCategory.trim()] 
      });
      setCustomSubCategory("");
    }
  };
  
  // Toggle subcategory selection
  const toggleSubCategory = (subCat: string) => {
    if (!formData.subCategories) {
      setFormData({ ...formData, subCategories: [subCat] });
    } else if (formData.subCategories.includes(subCat)) {
      setFormData({ 
        ...formData, 
        subCategories: formData.subCategories.filter(s => s !== subCat) 
      });
    } else {
      setFormData({ 
        ...formData, 
        subCategories: [...formData.subCategories, subCat] 
      });
    }
  };
  
  // Remove subcategory chip
  const removeSubCategory = (subCat: string) => {
    if (formData.subCategories) {
      setFormData({ 
        ...formData, 
        subCategories: formData.subCategories.filter(s => s !== subCat) 
      });
    }
  };

  if (itemLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading menu item...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Menu Item</h1>
          <p className="text-sm text-muted-foreground">
            Update the details of your menu item
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

              {/* Main Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Main Category <span className="text-destructive">*</span>
                </label>
                <Popover open={mainCategoryOpen} onOpenChange={setMainCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={mainCategoryOpen}
                      className="w-full justify-between"
                      data-testid="button-main-category"
                    >
                      {formData.primaryCategory || "Select main category..."}
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
                          <div className="p-2 space-y-2">
                            <p className="text-sm text-muted-foreground">No matching categories</p>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter custom category"
                                value={customMainCategory}
                                onChange={(e) => setCustomMainCategory(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddCustomMainCategory();
                                  }
                                }}
                                data-testid="input-custom-main-category"
                              />
                              <Button 
                                size="sm" 
                                onClick={handleAddCustomMainCategory}
                                data-testid="button-add-custom-main-category"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredMainCategories.map((cat) => (
                            <CommandItem
                              key={cat}
                              value={cat}
                              onSelect={() => {
                                setFormData({ ...formData, primaryCategory: cat, subCategories: [] });
                                setMainCategoryOpen(false);
                                setMainCategorySearch("");
                              }}
                              data-testid={`option-main-category-${cat}`}
                            >
                              {cat}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formErrors.primaryCategory && (
                  <p className="text-sm text-destructive">{formErrors.primaryCategory}</p>
                )}
              </div>

              {/* Subcategory Selection */}
              {formData.primaryCategory && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Subcategories {!showWarning && "(Recommended)"}
                  </label>
                  
                  <Popover open={subCategoryOpen} onOpenChange={setSubCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={subCategoryOpen}
                        className="w-full justify-between"
                        data-testid="button-subcategories"
                      >
                        {formData.subCategories && formData.subCategories.length > 0
                          ? `${formData.subCategories.length} selected`
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
                            <div className="p-2 space-y-2">
                              <p className="text-sm text-muted-foreground">No matching subcategories</p>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Enter custom subcategory"
                                  value={customSubCategory}
                                  onChange={(e) => setCustomSubCategory(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddCustomSubCategory();
                                    }
                                  }}
                                  data-testid="input-custom-subcategory"
                                />
                                <Button 
                                  size="sm" 
                                  onClick={handleAddCustomSubCategory}
                                  data-testid="button-add-custom-subcategory"
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredSubCategories.map((sub) => (
                              <CommandItem
                                key={sub}
                                value={sub}
                                onSelect={() => toggleSubCategory(sub)}
                                data-testid={`option-subcategory-${sub}`}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={formData.subCategories?.includes(sub) || false}
                                    onCheckedChange={() => toggleSubCategory(sub)}
                                  />
                                  <span>{sub}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Selected subcategories as chips */}
                  {formData.subCategories && formData.subCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.subCategories.map((sub) => (
                        <Badge 
                          key={sub} 
                          variant="secondary"
                          className="gap-1"
                          data-testid={`badge-subcategory-${sub}`}
                        >
                          {sub}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeSubCategory(sub)}
                            data-testid={`button-remove-subcategory-${sub}`}
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
                disabled={updateItemMutation.isPending || itemLoading}
                className="w-full"
                data-testid="button-update-item"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateItemMutation.isPending ? "Saving..." : "Save Changes"}
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
