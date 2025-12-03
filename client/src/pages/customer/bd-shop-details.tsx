import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Store,
  Search,
  MapPin,
  Clock,
  Star,
  ChevronLeft,
  Plus,
  Minus,
  ShoppingCart,
  Image,
  Trash2,
} from "lucide-react";

const shopTypeLabels: Record<string, string> = {
  grocery: "মুদিখানা",
  mobile: "মোবাইল দোকান",
  cosmetics: "কসমেটিক্স",
  stationery: "স্টেশনারি",
  pharmacy: "ফার্মেসি",
  electronics: "ইলেকট্রনিক্স",
  clothing: "পোশাক",
  food: "খাবার",
  hardware: "হার্ডওয়্যার",
  other: "অন্যান্য",
};

const categoryLabels: Record<string, string> = {
  grocery: "মুদি সামগ্রী",
  snacks: "স্ন্যাকস",
  beverages: "পানীয়",
  personal_care: "ব্যক্তিগত যত্ন",
  household: "গৃহস্থালি",
  electronics: "ইলেকট্রনিক্স",
  clothing: "পোশাক",
  medicine: "ওষুধ",
  stationery: "স্টেশনারি",
  other: "অন্যান্য",
};

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  stockQuantity?: number;
  hasUnlimitedStock?: boolean;
}

export default function BDShopDetails() {
  const [, params] = useRoute("/customer/bd-shop/:id");
  const shopId = params?.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopData, isLoading: shopLoading } = useQuery<{ shop: any }>({
    queryKey: ["/api/bd/shops", shopId],
    enabled: !!shopId,
  });

  const shop = shopData?.shop;
  const products = shop?.products || [];
  const categories = Array.from(new Set(products.map((p: any) => p.category as string))) as string[];

  const filteredProducts = products.filter((p: any) => {
    const name = p.name || p.productName || "";
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const isActive = p.isActive !== false && p.inStock !== false;
    return matchesSearch && matchesCategory && isActive;
  });

  const addToCart = (product: any) => {
    const productName = product.name || product.productName;
    const productPrice = product.discountPrice || product.price;
    const stockQty = product.stockQuantity ?? 0;
    const hasUnlimited = product.hasUnlimitedStock ?? false;
    const maxQty = hasUnlimited ? 99 : stockQty;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (!hasUnlimited && newQty > maxQty) {
          toast({
            title: "স্টক সীমা",
            description: `সর্বোচ্চ ${maxQty}টি যোগ করা যায়`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: newQty }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName,
          price: Number(productPrice),
          quantity: 1,
          imageUrl: product.images?.[0] || product.imageUrl,
          stockQuantity: stockQty,
          hasUnlimitedStock: hasUnlimited,
        },
      ];
    });
    toast({
      title: "কার্টে যোগ হয়েছে",
      description: productName,
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return { ...item, quantity: 0 };
          const maxQty = item.hasUnlimitedStock ? 99 : (item.stockQuantity ?? 0);
          if (!item.hasUnlimitedStock && newQty > maxQty) {
            return { ...item, quantity: maxQty };
          }
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getItemQuantity = (productId: string) => {
    return cart.find((item) => item.productId === productId)?.quantity || 0;
  };

  const placeOrderMutation = useMutation({
    mutationFn: async (deliveryAddress: string) => {
      return apiRequest("/api/bd/orders", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          deliveryAddress,
          paymentMethod: "cash",
        }),
      });
    },
    onSuccess: () => {
      setCart([]);
      setIsCartOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bd/orders"] });
      toast({
        title: "অর্ডার সফল!",
        description: "আপনার অর্ডার দেওয়া হয়েছে।",
      });
    },
    onError: (error: any) => {
      toast({
        title: "ত্রুটি",
        description: error.message || "অর্ডার দিতে ব্যর্থ।",
        variant: "destructive",
      });
    },
  });

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">দোকান পাওয়া যায়নি</h2>
          <Link href="/customer/bd-shops">
            <Button className="mt-4">দোকান তালিকায় ফিরুন</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative h-48 bg-gradient-to-b from-primary/20 to-background">
        {shop.coverUrl && (
          <img
            src={shop.coverUrl}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />

        <header className="absolute top-0 left-0 right-0 p-4 flex items-center gap-3">
          <Link href="/customer/bd-shops">
            <Button
              variant="secondary"
              size="icon"
              className="bg-background/80 backdrop-blur"
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        </header>

        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
          <div className="h-20 w-20 rounded-xl bg-background shadow-lg overflow-hidden flex-shrink-0">
            {shop.logoUrl ? (
              <img
                src={shop.logoUrl}
                alt={shop.shopName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-primary/10">
                <Store className="h-10 w-10 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{shop.shopName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {shopTypeLabels[shop.shopType] || shop.shopType}
              </Badge>
              {shop.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span className="font-medium">{shop.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{shop.shopAddress}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{shop.preparationTime || 20} মিনিট</span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="এই দোকানে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
            data-testid="input-search-products"
          />
        </div>

        {categories.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="whitespace-nowrap"
              >
                সব পণ্য
              </Button>
              {categories.map((cat: string) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="whitespace-nowrap"
                >
                  {categoryLabels[cat] || cat}
                </Button>
              ))}
            </div>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">কোন পণ্য পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map((product: any) => {
              const quantity = getItemQuantity(product.id);
              const productName = product.name || product.productName;
              const productImage = product.images?.[0] || product.imageUrl;
              const productPrice = product.discountPrice || product.price;
              const originalPrice = product.price;
              const hasDiscount = product.discountPrice && product.discountPrice < product.price;
              const inStock = product.inStock !== false;
              const hasUnlimited = product.hasUnlimitedStock ?? false;
              const stockQty = product.stockQuantity ?? 0;
              const lowStock = !hasUnlimited && stockQty > 0 && stockQty <= 10;
              
              return (
                <Card
                  key={product.id}
                  className={`overflow-hidden ${!inStock ? 'opacity-60' : ''}`}
                  data-testid={`card-product-${product.id}`}
                >
                  <Link href={`/customer/bd-product/${product.id}`}>
                    <div className="aspect-square bg-muted relative">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Image className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {quantity > 0 && (
                        <Badge className="absolute top-2 right-2" data-testid={`badge-quantity-${product.id}`}>
                          {quantity}
                        </Badge>
                      )}
                      {!inStock && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Badge variant="destructive">স্টকে নেই</Badge>
                        </div>
                      )}
                      {inStock && lowStock && (
                        <Badge 
                          variant="secondary" 
                          className="absolute top-2 left-2 bg-amber-500/90 text-white"
                        >
                          মাত্র {stockQty}টি
                        </Badge>
                      )}
                      {product.isFeatured && (
                        <Badge 
                          variant="secondary" 
                          className="absolute bottom-2 left-2 bg-primary/90 text-primary-foreground"
                        >
                          জনপ্রিয়
                        </Badge>
                      )}
                    </div>
                  </Link>
                  <CardContent className="p-3">
                    <Link href={`/customer/bd-product/${product.id}`}>
                      <h3 className="font-medium text-sm line-clamp-2 min-h-10 hover:text-primary transition-colors">
                        {productName}
                      </h3>
                    </Link>
                    <div className="flex flex-col gap-1 mt-2">
                      <div className="flex items-baseline gap-2">
                        <p className="text-lg font-bold text-primary">
                          ৳{Number(productPrice).toLocaleString("bn-BD")}
                        </p>
                        {hasDiscount && (
                          <p className="text-xs text-muted-foreground line-through">
                            ৳{Number(originalPrice).toLocaleString("bn-BD")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        {product.unit && (
                          <span className="text-xs text-muted-foreground">/{product.unit}</span>
                        )}
                        {!inStock ? (
                          <Badge variant="outline" className="text-xs">স্টকে নেই</Badge>
                        ) : quantity === 0 ? (
                          <Button
                            size="icon"
                            className="h-9 w-9 rounded-full"
                            onClick={() => addToCart(product)}
                            data-testid={`button-add-${product.id}`}
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-full"
                              onClick={() => updateQuantity(product.id, -1)}
                              data-testid={`button-decrease-${product.id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-6 text-center font-bold" data-testid={`text-quantity-${product.id}`}>
                              {quantity}
                            </span>
                            <Button
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => updateQuantity(product.id, 1)}
                              disabled={!hasUnlimited && quantity >= stockQty}
                              data-testid={`button-increase-${product.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {cartItemCount > 0 && (
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
              <Button
                size="lg"
                className="w-full h-14 text-lg justify-between"
                data-testid="button-view-cart"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span>কার্ট দেখুন ({cartItemCount})</span>
                </div>
                <span className="font-bold">
                  ৳{cartTotal.toLocaleString("bn-BD")}
                </span>
              </Button>
            </div>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle className="text-xl">আপনার কার্ট</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 overflow-y-auto max-h-[50vh]">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Image className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.productName}</p>
                    <p className="text-primary font-bold">
                      ৳{(item.price * item.quantity).toLocaleString("bn-BD")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.productId, -1)}
                      data-testid={`button-cart-decrease-${item.productId}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-bold" data-testid={`text-cart-quantity-${item.productId}`}>
                      {item.quantity}
                    </span>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.productId, 1)}
                      data-testid={`button-cart-increase-${item.productId}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeFromCart(item.productId)}
                      data-testid={`button-cart-remove-${item.productId}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  ডেলিভারি ঠিকানা
                </label>
                <Input
                  placeholder="আপনার সম্পূর্ণ ঠিকানা লিখুন..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="h-12"
                  data-testid="input-delivery-address"
                />
              </div>
              <div className="flex justify-between py-2 border-t">
                <span>সাবটোটাল</span>
                <span>৳{cartTotal.toLocaleString("bn-BD")}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>ডেলিভারি ফি</span>
                <span>৳৫০</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>সার্ভিস ফি (৫%)</span>
                <span>৳{Math.round(cartTotal * 0.05).toLocaleString("bn-BD")}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>মোট</span>
                <span className="text-primary">
                  ৳{(cartTotal + 50 + Math.round(cartTotal * 0.05)).toLocaleString("bn-BD")}
                </span>
              </div>
              <Button
                size="lg"
                className="w-full h-14 text-lg"
                onClick={() => placeOrderMutation.mutate(deliveryAddress)}
                disabled={placeOrderMutation.isPending || !deliveryAddress.trim()}
                data-testid="button-place-order"
              >
                {placeOrderMutation.isPending ? (
                  "অর্ডার হচ্ছে..."
                ) : (
                  "অর্ডার দিন"
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
