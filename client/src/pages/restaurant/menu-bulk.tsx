import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import {
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function MenuBulkActions() {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [priceAdjustment, setPriceAdjustment] = useState<string>("");
  const [availabilityStatus, setAvailabilityStatus] = useState<string>("available");

  const { data: itemsData } = useQuery({
    queryKey: ["/api/restaurant/menu/items"],
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/restaurant/menu/categories"],
  });

  const items = itemsData?.items || [];

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/restaurant/menu/items/bulk", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu/items"] });
      toast({ title: "Success", description: "Items updated successfully" });
      setSelectedItems(new Set());
      setBulkAction("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update items",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item: any) => item.id)));
    }
  };

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleApplyBulkAction = () => {
    if (selectedItems.size === 0 || !bulkAction) {
      toast({
        title: "Error",
        description: "Select items and an action",
        variant: "destructive",
      });
      return;
    }

    const itemIds = Array.from(selectedItems);
    const updates: any = {};

    if (bulkAction === "availability") {
      updates.availabilityStatus = availabilityStatus;
    } else if (bulkAction === "price" && priceAdjustment) {
      updates.basePrice = parseFloat(priceAdjustment);
    }

    bulkUpdateMutation.mutate({ itemIds, updates });
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bulk Actions</h1>
          <p className="text-sm text-muted-foreground">
            Update multiple menu items at once
          </p>
        </div>
        <Link href="/restaurant/menu">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menu
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Action Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger data-testid="select-action-type">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="availability">Update Availability</SelectItem>
                  <SelectItem value="price">Adjust Price</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkAction === "availability" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkAction === "price" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Price</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter new price"
                  value={priceAdjustment}
                  onChange={(e) => setPriceAdjustment(e.target.value)}
                  data-testid="input-price-adjustment"
                />
              </div>
            )}

            <div className="flex items-end">
              <Button
                onClick={handleApplyBulkAction}
                disabled={selectedItems.size === 0 || !bulkAction || bulkUpdateMutation.isPending}
                className="w-full"
                data-testid="button-apply-action"
              >
                {bulkUpdateMutation.isPending ? "Applying..." : `Apply to ${selectedItems.size} items`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Items</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedItems.size === items.length && items.length > 0}
                onCheckedChange={handleSelectAll}
                data-testid="checkbox-select-all"
              />
              <span className="text-sm text-muted-foreground">Select All ({items.length})</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map((item: any) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 border rounded-lg hover-elevate ${
                  selectedItems.has(item.id) ? "ring-2 ring-primary" : ""
                }`}
                data-testid={`item-${item.id}`}
              >
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={() => handleToggleItem(item.id)}
                  data-testid={`checkbox-${item.id}`}
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.currency === "BDT" ? "৳" : "$"}{Number(item.basePrice).toFixed(2)} •{" "}
                    {item.category?.name || "No category"}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground capitalize">
                  {item.availabilityStatus?.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
