import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Save,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

const itemSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
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
    categoryId: "",
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

  // Pre-populate form when item loads
  useEffect(() => {
    if (itemData?.item) {
      const item = itemData.item;
      setFormData({
        categoryId: item.categoryId || "",
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

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/restaurant/menu/categories"],
  });

  const categories = categoriesData?.categories || [];

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

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Category <span className="text-destructive">*</span>
                </label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.categoryId && (
                  <p className="text-sm text-destructive">{formErrors.categoryId}</p>
                )}
              </div>

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
