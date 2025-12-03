import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  MapPin,
  Star,
  ChevronLeft,
  Plus,
  Minus,
  ShoppingCart,
  Image,
  Package,
  Info,
  LogIn,
  AlertTriangle,
} from "lucide-react";

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

interface ProductData {
  id: string;
  shopId: string;
  shopName: string;
  shopType: string;
  shopAddress: string;
  shopLogo: string | null;
  shopRating: number;
  shopIsOpen: boolean;
  name: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  price: number;
  discountPrice: number | null;
  discountPercent: number | null;
  images: string[];
  unit: string;
  weight: number | null;
  inStock: boolean;
  stockQuantity: number;
  hasUnlimitedStock: boolean;
  isFeatured: boolean;
  minOrderAmount: number | null;
  demo: boolean;
  isAuthenticated: boolean;
  isBDCustomer: boolean;
  canOrder: boolean;
}

export default function BDProductDetails() {
  const [, params] = useRoute("/customer/bd-product/:id");
  const productId = params?.id;
  const [, setLocation] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const { toast } = useToast();

  const { data: productData, isLoading } = useQuery<{ product: ProductData }>({
    queryKey: ["/api/bd/products", productId],
    enabled: !!productId,
  });

  const product = productData?.product;

  // Handle stock: hasUnlimitedStock=true means unlimited (backend sends 999999)
  // Use hasUnlimitedStock flag for display, stockQuantity for quantity controls
  const hasUnlimitedStock = product?.hasUnlimitedStock ?? false;
  const availableStock = product?.stockQuantity ?? 0;
  // Limit quantity to 99 for UX even with unlimited stock
  const maxQuantity = hasUnlimitedStock ? 99 : Math.max(availableStock, 1);

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newQty = prev + delta;
      if (newQty < 1) return 1;
      if (newQty > maxQuantity) return maxQuantity;
      return newQty;
    });
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (product.demo) {
      toast({
        title: "ডেমো পণ্য",
        description: "এটি একটি ডেমো পণ্য। প্রকৃত দোকান থেকে অর্ডার করুন।",
        variant: "destructive",
      });
      return;
    }

    if (!product.isAuthenticated) {
      toast({
        title: "লগইন প্রয়োজন",
        description: "অর্ডার দিতে আপনাকে লগইন করতে হবে।",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (!product.isBDCustomer) {
      toast({
        title: "অনুপলব্ধ",
        description: "এই সেবা শুধুমাত্র বাংলাদেশে উপলব্ধ।",
        variant: "destructive",
      });
      return;
    }

    if (!product.inStock) {
      toast({
        title: "স্টকে নেই",
        description: "এই পণ্যটি বর্তমানে স্টকে নেই।",
        variant: "destructive",
      });
      return;
    }

    if (typeof window === "undefined") return;
    
    const cartKey = `bd_cart_${product.shopId}`;
    let existingCart: any[] = [];
    try {
      existingCart = JSON.parse(localStorage.getItem(cartKey) || "[]");
    } catch {
      existingCart = [];
    }
    
    const existingItemIndex = existingCart.findIndex(
      (item: any) => item.productId === product.id
    );

    if (existingItemIndex >= 0) {
      // Update quantity but cap at maxQuantity for limited stock items
      const newQty = existingCart[existingItemIndex].quantity + quantity;
      existingCart[existingItemIndex].quantity = hasUnlimitedStock 
        ? Math.min(newQty, 99) 
        : Math.min(newQty, maxQuantity);
      // Update stock info in case it changed
      existingCart[existingItemIndex].stockQuantity = availableStock;
      existingCart[existingItemIndex].hasUnlimitedStock = hasUnlimitedStock;
    } else {
      existingCart.push({
        productId: product.id,
        productName: product.name,
        price: product.discountPrice || product.price,
        quantity: quantity,
        imageUrl: product.images?.[0] || null,
        shopId: product.shopId,
        shopName: product.shopName,
        stockQuantity: availableStock,
        hasUnlimitedStock: hasUnlimitedStock,
      });
    }

    try {
      localStorage.setItem(cartKey, JSON.stringify(existingCart));
    } catch {
      toast({
        title: "ত্রুটি",
        description: "কার্টে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "কার্টে যোগ হয়েছে",
      description: `${product.name} (${quantity}${product.unit}) কার্টে যোগ হয়েছে।`,
    });

    setLocation(`/customer/bd-shop/${product.shopId}`);
  };

  const handleBuyNow = () => {
    if (!product) return;

    if (product.demo) {
      toast({
        title: "ডেমো পণ্য",
        description: "এটি একটি ডেমো পণ্য। প্রকৃত দোকান থেকে অর্ডার করুন।",
        variant: "destructive",
      });
      return;
    }

    if (!product.isAuthenticated) {
      toast({
        title: "লগইন প্রয়োজন",
        description: "অর্ডার দিতে আপনাকে লগইন করতে হবে।",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (!product.isBDCustomer) {
      toast({
        title: "অনুপলব্ধ",
        description: "এই সেবা শুধুমাত্র বাংলাদেশে উপলব্ধ।",
        variant: "destructive",
      });
      return;
    }

    if (!product.inStock) {
      toast({
        title: "স্টকে নেই",
        description: "এই পণ্যটি বর্তমানে স্টকে নেই।",
        variant: "destructive",
      });
      return;
    }

    if (typeof window === "undefined") return;
    
    const cartKey = `bd_cart_${product.shopId}`;
    const newCart = [{
      productId: product.id,
      productName: product.name,
      price: product.discountPrice || product.price,
      quantity: quantity,
      imageUrl: product.images?.[0] || null,
      shopId: product.shopId,
      shopName: product.shopName,
      stockQuantity: availableStock,
      hasUnlimitedStock: hasUnlimitedStock,
    }];

    try {
      localStorage.setItem(cartKey, JSON.stringify(newCart));
    } catch {
      toast({
        title: "ত্রুটি",
        description: "কার্টে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        variant: "destructive",
      });
      return;
    }
    setLocation(`/customer/bd-shop/${product.shopId}?checkout=true`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-4">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">পণ্য পাওয়া যায়নি</h2>
          <p className="text-muted-foreground mb-4">
            এই পণ্যটি বর্তমানে উপলব্ধ নেই।
          </p>
          <Button asChild>
            <Link href="/customer/bd-shops" data-testid="link-back-to-shops">
              দোকানে ফিরে যান
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayPrice = product.discountPrice || product.price;
  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : [];

  return (
    <div className="min-h-screen bg-background pb-32">
      {product.demo && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 p-3">
          <div className="max-w-lg mx-auto flex items-center gap-2 text-amber-600">
            <Info className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">
              এটি একটি ডেমো পণ্য। বাস্তব অর্ডারের জন্য প্রকৃত দোকানে অর্ডার করুন।
            </p>
          </div>
        </div>
      )}

      {!product.isAuthenticated && (
        <div className="bg-primary/10 border-b border-primary/30 p-3">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              <LogIn className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">অর্ডার দিতে লগইন করুন</p>
            </div>
            <Button size="sm" asChild>
              <Link href="/login" data-testid="link-login-prompt">
                লগইন
              </Link>
            </Button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-lg mx-auto flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold truncate">পণ্যের বিবরণ</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <div className="space-y-3">
          <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
            {images.length > 0 ? (
              <img
                src={images[selectedImageIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
                data-testid="img-product-main"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Image className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            {hasDiscount && (
              <Badge
                variant="destructive"
                className="absolute top-3 left-3"
                data-testid="badge-discount"
              >
                {product.discountPercent
                  ? `${product.discountPercent}% ছাড়`
                  : "ছাড়"}
              </Badge>
            )}
            {!product.inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="secondary" className="text-lg py-2 px-4">
                  স্টকে নেই
                </Badge>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                    selectedImageIndex === idx
                      ? "border-primary"
                      : "border-transparent"
                  }`}
                  data-testid={`button-thumbnail-${idx}`}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold" data-testid="text-product-name">
              {product.name}
            </h2>
            {product.isFeatured && (
              <Badge variant="secondary" className="flex-shrink-0">
                <Star className="h-3 w-3 mr-1" />
                ফিচার্ড
              </Badge>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className="text-2xl font-bold text-primary"
              data-testid="text-product-price"
            >
              ৳{displayPrice}
            </span>
            {hasDiscount && (
              <span className="text-lg text-muted-foreground line-through">
                ৳{product.price}
              </span>
            )}
            <span className="text-sm text-muted-foreground">/{product.unit}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {categoryLabels[product.category] || product.category}
            </Badge>
            {product.subcategory && (
              <Badge variant="outline">{product.subcategory}</Badge>
            )}
            {product.weight && (
              <Badge variant="outline">{product.weight} কেজি</Badge>
            )}
          </div>
        </div>

        <Separator />

        <Card data-testid="card-shop-info">
          <CardContent className="p-3">
            <Link href={`/customer/bd-shop/${product.shopId}`}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {product.shopLogo ? (
                    <img
                      src={product.shopLogo}
                      alt={product.shopName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{product.shopName}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{product.shopAddress}</span>
                  </div>
                </div>
                {product.shopIsOpen ? (
                  <Badge variant="default" className="bg-green-600">
                    খোলা
                  </Badge>
                ) : (
                  <Badge variant="secondary">বন্ধ</Badge>
                )}
              </div>
            </Link>
          </CardContent>
        </Card>

        {product.description && (
          <div className="space-y-2">
            <h3 className="font-semibold">পণ্যের বিবরণ</h3>
            <p className="text-muted-foreground" data-testid="text-product-description">
              {product.description}
            </p>
          </div>
        )}

        {!hasUnlimitedStock && availableStock > 0 && availableStock <= 10 && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">
              সীমিত স্টক! মাত্র {availableStock}টি বাকি আছে।
            </p>
          </div>
        )}

        {product.minOrderAmount && (
          <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Info className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">
              সর্বনিম্ন অর্ডার: ৳{product.minOrderAmount}
            </p>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">পরিমাণ</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1 || !product.inStock}
                data-testid="button-quantity-decrease"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium" data-testid="text-quantity">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(1)}
                disabled={!product.inStock || quantity >= maxQuantity}
                data-testid="button-quantity-increase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">মোট:</span>
            <span className="text-xl font-bold text-primary" data-testid="text-total-price">
              ৳{(displayPrice * quantity).toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleAddToCart}
              disabled={!product.inStock || product.demo}
              className="h-12"
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              কার্টে যোগ করুন
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={!product.inStock || product.demo}
              className="h-12"
              data-testid="button-buy-now"
            >
              এখনই কিনুন
            </Button>
          </div>

          {product.demo && (
            <p className="text-center text-sm text-amber-600">
              এটি একটি ডেমো পণ্য। প্রকৃত দোকান থেকে অর্ডার করুন।
            </p>
          )}

          {!product.demo && !product.isAuthenticated && (
            <p className="text-center text-sm text-muted-foreground">
              অর্ডার দিতে{" "}
              <Link href="/login" className="text-primary underline">
                লগইন করুন
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
