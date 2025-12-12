import { SafeGoHeader } from "@/components/layout/SafeGoHeader";
import GlobalFooter from "@/components/landing/GlobalFooter";
import { useState, useEffect } from "react";
import { Region } from "@/components/landing/LandingConfig";
import { UtensilsCrossed, Clock, Star, Bike, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function FoodPage() {
  const [selectedRegion, setSelectedRegion] = useState<Region>("BD");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("safego-region");
    if (stored && ["BD", "US", "GLOBAL"].includes(stored)) {
      setSelectedRegion(stored as Region);
    }
  }, []);

  const handleRegionChange = (region: Region) => {
    setSelectedRegion(region);
    localStorage.setItem("safego-region", region);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <SafeGoHeader selectedRegion={selectedRegion} onRegionChange={handleRegionChange} />
      
      <main className="flex-1">
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-50 to-red-100 dark:from-gray-900 dark:to-gray-800">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-orange-500 rounded-2xl">
                <UtensilsCrossed className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Food Delivery
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Delicious meals from your favorite restaurants, delivered fast to your door. Browse menus, order easily, and enjoy!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg"
                onClick={() => setLocation("/login")}
              >
                <UtensilsCrossed className="mr-2 h-5 w-5" />
                Order Now
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="px-8 py-6 text-lg"
                onClick={() => setLocation("/signup")}
              >
                Create Account
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
              Why Order with SafeGo?
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                    <Clock className="h-8 w-8 text-orange-500 dark:text-orange-400" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Fast Delivery
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Hot food delivered quickly to your location.
                </p>
              </div>
              
              <div className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                    <Star className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Top Restaurants
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Curated selection of the best local eateries.
                </p>
              </div>
              
              <div className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                    <Bike className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Live Tracking
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Track your order from kitchen to door.
                </p>
              </div>
              
              <div className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <MapPin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Wide Coverage
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Delivering across your city and beyond.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Cuisines Available
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              From local favorites to international cuisines, we've got something for every craving.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Local Favorites", "Chinese", "Indian", "Thai", "Italian", "Fast Food", "Healthy", "Desserts"].map((cuisine) => (
                <span 
                  key={cuisine}
                  className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                >
                  {cuisine}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Order?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Sign up now and get special discounts on your first order!
            </p>
            <Button 
              size="lg" 
              className="bg-orange-500 hover:bg-orange-600 text-white px-8"
              onClick={() => setLocation("/signup")}
            >
              Get Started
            </Button>
          </div>
        </section>
      </main>

      <GlobalFooter 
        selectedRegion={selectedRegion === "GLOBAL" ? "BD" : selectedRegion}
        onRegionChange={handleRegionChange}
      />
    </div>
  );
}
