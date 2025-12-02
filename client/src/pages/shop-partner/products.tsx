import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Copy,
  Image,
  MoreVertical,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ShopPartnerProducts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClientHook = useQueryClient();

  const { data, isLoading } = useQuery<{ products: any[] }>({
    queryKey: ["/api/shop-partner/products"],
  });

  const toggleProductMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/shop-partner/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/shop-partner/products"] });
      toast({
        title: "সফল!",
        description: "পণ্যের স্ট্যাটাস পরিবর্তন হয়েছে।",
      });
    },
  });

  const duplicateProductMutation = useMutation({
    mutationFn: async (product: any) => {
      return apiRequest("/api/shop-partner/products", {
        method: "POST",
        body: JSON.stringify({
          productName: `${product.productName} (কপি)`,
          price: product.price,
          category: product.category,
          description: product.description,
          unit: product.unit,
        }),
      });
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/shop-partner/products"] });
      toast({
        title: "সফল!",
        description: "পণ্য কপি করা হয়েছে।",
      });
    },
  });

  const products = data?.products || [];
  const filteredProducts = products.filter((p: any) =>
    p.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="পণ্য খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
            data-testid="input-search-products"
          />
        </div>
        <Link href="/shop-partner/products/new">
          <Button size="lg" className="h-12 gap-2 text-base w-full sm:w-auto" data-testid="button-add-product">
            <Plus className="h-5 w-5" />
            নতুন পণ্য যোগ করুন
          </Button>
        </Link>
      </div>

      {filteredProducts.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery ? "কোন পণ্য পাওয়া যায়নি" : "এখনও কোন পণ্য নেই"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "অন্য কিছু দিয়ে খুঁজুন"
              : "আপনার প্রথম পণ্য যোগ করুন"}
          </p>
          {!searchQuery && (
            <Link href="/shop-partner/products/new">
              <Button size="lg" className="h-12" data-testid="button-add-first-product">
                <Plus className="h-5 w-5 mr-2" />
                পণ্য যোগ করুন
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product: any) => (
            <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg truncate">
                          {product.productName}
                        </h3>
                        <p className="text-2xl font-bold text-primary">
                          ৳{Number(product.price).toLocaleString("bn-BD")}
                        </p>
                        {product.stockQuantity !== null && (
                          <p className="text-sm text-muted-foreground">
                            স্টক: {product.stockQuantity} {product.unit || "টি"}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <Switch
                            checked={product.isActive}
                            onCheckedChange={(checked) =>
                              toggleProductMutation.mutate({
                                id: product.id,
                                isActive: checked,
                              })
                            }
                            disabled={toggleProductMutation.isPending}
                            data-testid={`switch-active-${product.id}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {product.isActive ? "চালু" : "বন্ধ"}
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-menu-${product.id}`}>
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/shop-partner/products/${product.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                সম্পাদনা
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => duplicateProductMutation.mutate(product)}
                              disabled={duplicateProductMutation.isPending}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              কপি করুন
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="fixed bottom-6 right-6 md:hidden">
        <Link href="/shop-partner/products/new">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg" data-testid="fab-add-product">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
