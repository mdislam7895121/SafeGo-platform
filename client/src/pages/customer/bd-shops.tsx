import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import {
  Store,
  Search,
  MapPin,
  Clock,
  Star,
  ChevronLeft,
  ShoppingBag,
} from "lucide-react";

interface Shop {
  id: string;
  shopName: string;
  shopType: string;
  shopDescription?: string;
  shopAddress: string;
  shopLat?: number;
  shopLng?: number;
  logoUrl?: string;
  bannerUrl?: string;
  rating: number;
  totalRatings: number;
  openingTime?: string;
  closingTime?: string;
  deliveryEnabled: boolean;
  deliveryRadius?: number;
  minOrderAmount?: number | null;
  preparationTime: number;
  distanceKm?: number;
}

const shopTypeLabels: Record<string, string> = {
  grocery: "মুদিখানা",
  electronics: "ইলেকট্রনিক্স",
  fashion: "ফ্যাশন",
  pharmacy: "ফার্মেসি",
  general_store: "জেনারেল স্টোর",
  hardware: "হার্ডওয়্যার",
  beauty: "বিউটি",
  books: "বই",
  sports: "স্পোর্টস",
  other: "অন্যান্য",
};

const shopTypeFilters = [
  { value: "all", label: "সব দোকান" },
  { value: "grocery", label: "মুদিখানা" },
  { value: "electronics", label: "ইলেকট্রনিক্স" },
  { value: "pharmacy", label: "ফার্মেসি" },
  { value: "fashion", label: "ফ্যাশন" },
  { value: "beauty", label: "বিউটি" },
  { value: "general_store", label: "জেনারেল স্টোর" },
  { value: "hardware", label: "হার্ডওয়্যার" },
  { value: "books", label: "বই" },
];

const fallbackDemoShops: Shop[] = [
  {
    id: "demo-grocery-1",
    shopName: "ডেমো মুদিখানা - গুলশান",
    shopType: "grocery",
    shopDescription: "তাজা শাকসবজি, ফলমূল এবং দৈনন্দিন মুদি সামগ্রী",
    shopAddress: "গুলশান-২, ঢাকা-১২১২",
    shopLat: 23.7925,
    shopLng: 90.4078,
    rating: 4.6,
    totalRatings: 89,
    openingTime: "09:00",
    closingTime: "21:00",
    deliveryEnabled: true,
    deliveryRadius: 5,
    preparationTime: 15,
    distanceKm: 1.2,
  },
  {
    id: "demo-electronics-1",
    shopName: "টেক মোবাইল শপ",
    shopType: "electronics",
    shopDescription: "মোবাইল ফোন, এক্সেসরিজ এবং গ্যাজেট",
    shopAddress: "বনানী ১১, ঢাকা",
    shopLat: 23.7934,
    shopLng: 90.4016,
    rating: 4.3,
    totalRatings: 56,
    openingTime: "10:00",
    closingTime: "20:00",
    deliveryEnabled: true,
    deliveryRadius: 8,
    preparationTime: 10,
    distanceKm: 1.5,
  },
  {
    id: "demo-pharmacy-1",
    shopName: "হেলথ ফার্মেসি",
    shopType: "pharmacy",
    shopDescription: "ওষুধ, স্বাস্থ্য পণ্য এবং মেডিকেল সাপ্লাই",
    shopAddress: "ধানমন্ডি ২৭, ঢাকা",
    shopLat: 23.7461,
    shopLng: 90.3742,
    rating: 4.8,
    totalRatings: 124,
    openingTime: "08:00",
    closingTime: "23:00",
    deliveryEnabled: true,
    deliveryRadius: 10,
    preparationTime: 5,
    distanceKm: 2.1,
  },
  {
    id: "demo-fashion-1",
    shopName: "স্টাইল ফ্যাশন",
    shopType: "fashion",
    shopDescription: "পুরুষ ও মহিলাদের পোশাক এবং এক্সেসরিজ",
    shopAddress: "উত্তরা সেক্টর ৭, ঢাকা",
    shopLat: 23.8759,
    shopLng: 90.3795,
    rating: 4.2,
    totalRatings: 45,
    openingTime: "11:00",
    closingTime: "21:00",
    deliveryEnabled: true,
    deliveryRadius: 6,
    preparationTime: 20,
    distanceKm: 2.8,
  },
  {
    id: "demo-beauty-1",
    shopName: "বিউটি কর্নার",
    shopType: "beauty",
    shopDescription: "কসমেটিক্স, স্কিনকেয়ার এবং বিউটি প্রোডাক্ট",
    shopAddress: "মিরপুর ১০, ঢাকা",
    shopLat: 23.8069,
    shopLng: 90.3687,
    rating: 4.4,
    totalRatings: 67,
    openingTime: "10:00",
    closingTime: "20:00",
    deliveryEnabled: true,
    deliveryRadius: 7,
    preparationTime: 10,
    distanceKm: 3.2,
  },
  {
    id: "demo-general-1",
    shopName: "সুপার স্টোর মার্ট",
    shopType: "general_store",
    shopDescription: "দৈনন্দিন প্রয়োজনীয় সব কিছু এক জায়গায়",
    shopAddress: "মহাখালী, ঢাকা",
    shopLat: 23.7787,
    shopLng: 90.3959,
    rating: 4.5,
    totalRatings: 98,
    openingTime: "08:00",
    closingTime: "22:00",
    deliveryEnabled: true,
    deliveryRadius: 5,
    preparationTime: 15,
    distanceKm: 3.5,
  },
  {
    id: "demo-hardware-1",
    shopName: "বিল্ডার্স হার্ডওয়্যার",
    shopType: "hardware",
    shopDescription: "নির্মাণ সামগ্রী, টুলস এবং হার্ডওয়্যার",
    shopAddress: "তেজগাঁও, ঢাকা",
    shopLat: 23.7590,
    shopLng: 90.3926,
    rating: 4.1,
    totalRatings: 34,
    openingTime: "09:00",
    closingTime: "19:00",
    deliveryEnabled: true,
    deliveryRadius: 10,
    preparationTime: 30,
    distanceKm: 4.0,
  },
  {
    id: "demo-books-1",
    shopName: "জ্ঞান বই ঘর",
    shopType: "books",
    shopDescription: "বই, স্টেশনারি এবং শিক্ষা সামগ্রী",
    shopAddress: "নিউমার্কেট, ঢাকা",
    shopLat: 23.7332,
    shopLng: 90.3847,
    rating: 4.7,
    totalRatings: 112,
    openingTime: "10:00",
    closingTime: "20:00",
    deliveryEnabled: true,
    deliveryRadius: 8,
    preparationTime: 10,
    distanceKm: 4.5,
  },
];

export default function BDShops() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (user && user.countryCode !== "BD") {
      setLocation("/customer");
    }
  }, [user, setLocation]);

  const { data, isLoading, error } = useQuery<{ shops: Shop[] }>({
    queryKey: ["/api/bd/shops", selectedType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType && selectedType !== "all") {
        params.set("shopType", selectedType);
      }
      return apiRequest(`/api/bd/shops?${params.toString()}`);
    },
    retry: false,
  });

  useEffect(() => {
    if (error) {
      console.log("[BD-Shops] API error, using fallback demo data");
      setUseFallback(true);
    } else if (data?.shops && data.shops.length > 0) {
      setUseFallback(false);
    }
  }, [error, data]);

  const apiShops = data?.shops || [];
  const displayShops = useFallback || apiShops.length === 0 ? fallbackDemoShops : apiShops;
  
  const typeFilteredShops = selectedType === "all" 
    ? displayShops 
    : displayShops.filter(shop => shop.shopType === selectedType);

  const filteredShops = typeFilteredShops
    .filter((shop) =>
      shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shop.shopDescription && shop.shopDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
      shop.shopAddress.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (a.distanceKm || 99) - (b.distanceKm || 99));

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
            {shopTypeFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={selectedType === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(filter.value)}
                className="whitespace-nowrap"
                data-testid={`button-type-${filter.value}`}
              >
                {filter.label}
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
            <p className="text-muted-foreground max-w-sm mx-auto">
              {searchQuery 
                ? "অন্য কিছু দিয়ে খুঁজুন" 
                : selectedType !== "all" 
                  ? "এই এলাকায় নির্বাচিত ক্যাটাগরির কোনো দোকান নেই। অন্য ক্যাটাগরি চেষ্টা করুন অথবা লোকেশন পরিবর্তন করুন।"
                  : "শীঘ্রই আরও দোকান আসছে।"
              }
            </p>
          </div>
        ) : (
          <>
            {useFallback && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                  ডেমো দোকান দেখানো হচ্ছে। লগইন করুন আসল দোকান দেখতে।
                </p>
              </div>
            )}
            {filteredShops.map((shop) => (
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
                            <h3 className="font-semibold text-lg line-clamp-1" data-testid={`text-shop-name-${shop.id}`}>
                              {shop.shopName}
                            </h3>
                            <Badge variant="secondary" className="mt-1">
                              {shopTypeLabels[shop.shopType] || shop.shopType}
                            </Badge>
                          </div>
                          {shop.rating > 0 && (
                            <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                              <Star className="h-4 w-4 fill-green-600 text-green-600" />
                              <span className="font-bold text-green-700 dark:text-green-400">
                                {shop.rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>

                        {shop.shopDescription && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {shop.shopDescription}
                          </p>
                        )}

                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="line-clamp-1">{shop.shopAddress}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {shop.distanceKm && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {shop.distanceKm.toFixed(1)} কিমি
                              </span>
                            )}
                            {shop.openingTime && shop.closingTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {shop.openingTime} - {shop.closingTime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
