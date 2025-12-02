import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Store,
  Search,
  MapPin,
  Clock,
  Star,
  ChevronLeft,
  ShoppingBag,
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

export default function BDShops() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ shops: any[] }>({
    queryKey: ["/api/shops/bd", selectedType],
  });

  const shops = data?.shops || [];
  const filteredShops = shops.filter((shop: any) =>
    shop.shopName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shopTypes = Object.entries(shopTypeLabels);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 p-4">
          <Link href="/customer">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">দোকান</h1>
            <p className="text-sm text-muted-foreground">
              আপনার কাছের দোকান থেকে কিনুন
            </p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="দোকান খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
              data-testid="input-search-shops"
            />
          </div>
        </div>

        <div className="px-4 pb-4 overflow-x-auto">
          <div className="flex gap-2">
            <Button
              variant={selectedType === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(null)}
              className="whitespace-nowrap"
              data-testid="button-all-types"
            >
              সব দোকান
            </Button>
            {shopTypes.map(([value, label]) => (
              <Button
                key={value}
                variant={selectedType === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(value)}
                className="whitespace-nowrap"
                data-testid={`button-type-${value}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-12">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? "কোন দোকান পাওয়া যায়নি" : "এই এলাকায় কোন দোকান নেই"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery ? "অন্য কিছু দিয়ে খুঁজুন" : "শীঘ্রই আরও দোকান আসছে।"}
            </p>
          </div>
        ) : (
          filteredShops.map((shop: any) => (
            <Link key={shop.id} href={`/customer/bd-shop/${shop.id}`}>
              <Card className="hover-elevate" data-testid={`card-shop-${shop.id}`}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Avatar className="h-20 w-20 rounded-xl">
                      <AvatarImage src={shop.logoUrl} className="object-cover" />
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-2xl font-bold">
                        {shop.shopName?.charAt(0) || "D"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {shop.shopName}
                          </h3>
                          <Badge variant="secondary" className="mt-1">
                            {shopTypeLabels[shop.shopType] || shop.shopType}
                          </Badge>
                        </div>
                        {shop.rating && (
                          <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                            <Star className="h-4 w-4 fill-green-600 text-green-600" />
                            <span className="font-bold text-green-700 dark:text-green-400">
                              {shop.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="line-clamp-1">{shop.shopAddress}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{shop.preparationTime || 20} মিনিট</span>
                          </div>
                          {shop.deliveryEnabled && (
                            <div className="flex items-center gap-1">
                              <ShoppingBag className="h-4 w-4" />
                              <span>{shop.deliveryRadius || 5} কি.মি.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </main>
    </div>
  );
}
