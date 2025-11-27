import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Car, Package, UtensilsCrossed, User, Clock, HelpCircle, MapPin, 
  ChevronDown, ChevronRight, Calendar, ShoppingCart, Smartphone, Bus,
  Briefcase, CreditCard, Navigation, Circle, Square, Home, Settings,
  LogOut, Shield, Star, ArrowRight, Apple, Play, Globe, Check, Crosshair,
  BadgeCheck, Sun, Moon, Sunset
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSavedPlaces, getRecentLocations, reverseGeocode, type SavedPlace, type RecentLocation } from "@/lib/locationService";

const suggestionTiles = [
  { id: "ride", label: "Ride", icon: Car, color: "bg-black dark:bg-white", iconColor: "text-white dark:text-black", active: true },
  { id: "eats", label: "Eats", icon: UtensilsCrossed, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "grocery", label: "Grocery", icon: ShoppingCart, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "courier", label: "Courier", icon: Package, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "reserve", label: "Reserve", icon: Calendar, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "business", label: "Business", icon: Briefcase, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
];

function getGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { text: "Good morning", icon: Sun };
  } else if (hour >= 12 && hour < 17) {
    return { text: "Good afternoon", icon: Sun };
  } else if (hour >= 17 && hour < 21) {
    return { text: "Good evening", icon: Sunset };
  } else {
    return { text: "Good night", icon: Moon };
  }
}

export default function CustomerHome() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [reserveDate, setReserveDate] = useState("");
  const [reserveTime, setReserveTime] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);

  const { data: customerData, isLoading } = useQuery<{
    profile?: any;
    recentRides?: any[];
    activeTrip?: any;
  }>({
    queryKey: ["/api/customer/home"],
    refetchInterval: 10000,
  });

  const profile = customerData?.profile || user?.profile;
  const recentRides = customerData?.recentRides || [];
  const activeTrip = customerData?.activeTrip;
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSavedPlaces(getSavedPlaces());
      setRecentLocations(getRecentLocations());
      autoDetectLocation();
    }
  }, []);

  const autoDetectLocation = async () => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
          const shortAddress = address.split(",")[0];
          setPickupAddress(`Current location • ${shortAddress}`);
        } catch {
          setPickupAddress("Current location");
        }
        setIsLocating(false);
      },
      () => {
        setPickupAddress("");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleTileClick = (tile: typeof suggestionTiles[0]) => {
    if (!tile.active) {
      toast({ title: "Coming soon", description: `${tile.label} will be available soon.` });
      return;
    }
    
    switch (tile.id) {
      case "ride":
        heroRef.current?.scrollIntoView({ behavior: "smooth" });
        break;
      default:
        toast({ title: "Coming soon", description: `${tile.label} will be available soon.` });
    }
  };

  const handleSeePrices = () => {
    if (!pickupAddress || !destinationAddress) {
      toast({ title: "Enter locations", description: "Please enter pickup and destination." });
      return;
    }
    setLocation("/customer/ride");
  };

  const showComingSoon = (feature: string) => {
    toast({ title: "Coming soon", description: `${feature} will be available soon.` });
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.substring(0, 2).toUpperCase() || "U";
  };

  const getUserDisplayName = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    if (profile?.fullName) {
      return profile.fullName;
    }
    return profile?.email?.split("@")[0] || user?.email?.split("@")[0] || "User";
  };

  const getCountryLabel = () => {
    const countryCode = profile?.countryCode || "US";
    return countryCode === "BD" ? "Bangladesh" : "United States";
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="customer-home-page">
      {/* SECTION 1: COMPACT TOP HEADER - Uber Style */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b" data-testid="header">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight" data-testid="logo">SafeGo</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-medium" data-testid="region-badge">
              <Globe className="h-2.5 w-2.5 mr-0.5" />
              {getCountryLabel()}
            </Badge>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 px-2 h-9" data-testid="profile-pill">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatarUrl} />
                  <AvatarFallback className="text-[10px] font-medium bg-primary text-primary-foreground">
                    {getInitials(getUserDisplayName(), profile?.email || user?.email)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64" data-testid="profile-dropdown">
              <div className="px-3 py-3 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatarUrl} />
                    <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
                      {getInitials(getUserDisplayName(), profile?.email || user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" data-testid="text-user-name">{getUserDisplayName()}</p>
                    <div className="flex items-center gap-1">
                      {profile?.isVerified && (
                        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="text-xs text-muted-foreground truncate">{profile?.email || user?.email}</span>
                    </div>
                  </div>
                </div>
              </div>
              <DropdownMenuItem onClick={() => showComingSoon("Profile Settings")} data-testid="menu-profile-settings">
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
                <Badge variant="secondary" className="ml-auto text-[10px]">Soon</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => showComingSoon("Payment Methods")} data-testid="menu-payment-methods">
                <CreditCard className="mr-2 h-4 w-4" />
                Payment Methods
                <Badge variant="secondary" className="ml-auto text-[10px]">Soon</Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600" data-testid="menu-sign-out">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* SECTION 2: GREETING HERO */}
        <section className="space-y-1" data-testid="greeting-section">
          <div className="flex items-center gap-2">
            <GreetingIcon className="h-5 w-5 text-amber-500" />
            <h2 className="text-2xl font-bold tracking-tight" data-testid="greeting-text">
              {greeting.text}, {getUserDisplayName().split(" ")[0]}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="greeting-subtitle">
            Where would you like to go today?
          </p>
        </section>

        {/* SECTION 3: RIDE REQUEST BLOCK - Uber Style */}
        <section ref={heroRef} data-testid="hero-section">
          <Card className="overflow-hidden shadow-lg border-2">
            <CardContent className="p-5 space-y-4">
              {/* Pickup Input with Location Button */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                  <div className="h-3 w-3 rounded-full bg-gray-900 dark:bg-white ring-4 ring-gray-900/10 dark:ring-white/10" />
                  <div className="w-0.5 h-10 bg-gray-300 dark:bg-gray-600" />
                </div>
                <Input
                  placeholder={isLocating ? "Detecting location..." : "Pickup location"}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  onFocus={() => setShowPickupSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)}
                  className="pl-12 pr-12 h-14 text-base bg-muted/50 border-0 rounded-xl focus:ring-2 focus:ring-primary"
                  data-testid="input-pickup"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full hover:bg-primary/10"
                  onClick={autoDetectLocation}
                  disabled={isLocating}
                  data-testid="button-detect-location"
                >
                  <Crosshair className={`h-5 w-5 ${isLocating ? "animate-pulse text-primary" : "text-muted-foreground"}`} />
                </Button>
                {showPickupSuggestions && (savedPlaces.length > 0 || recentLocations.length > 0) && (
                  <Card className="absolute top-full left-0 right-0 mt-2 z-20 max-h-48 overflow-y-auto shadow-xl" data-testid="pickup-suggestions">
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                        onClick={() => { setPickupAddress(place.address); setShowPickupSuggestions(false); }}
                        data-testid={`pickup-saved-${place.id}`}
                      >
                        {place.icon === "home" ? <Home className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                        <div>
                          <p className="font-medium text-sm">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        </div>
                      </button>
                    ))}
                    {recentLocations.slice(0, 3).map((loc) => (
                      <button
                        key={loc.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                        onClick={() => { setPickupAddress(loc.address); setShowPickupSuggestions(false); }}
                        data-testid={`pickup-recent-${loc.id}`}
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm truncate">{loc.address}</p>
                        </div>
                      </button>
                    ))}
                  </Card>
                )}
              </div>

              {/* Destination Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                  <div className="h-3 w-3 bg-primary" />
                </div>
                <Input
                  placeholder="Where to?"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  onFocus={() => setShowDestSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
                  className="pl-12 h-14 text-base bg-muted/50 border-0 rounded-xl focus:ring-2 focus:ring-primary"
                  data-testid="input-destination"
                />
                {showDestSuggestions && (savedPlaces.length > 0 || recentLocations.length > 0) && (
                  <Card className="absolute top-full left-0 right-0 mt-2 z-20 max-h-48 overflow-y-auto shadow-xl" data-testid="destination-suggestions">
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                        onClick={() => { setDestinationAddress(place.address); setShowDestSuggestions(false); }}
                        data-testid={`dest-saved-${place.id}`}
                      >
                        {place.icon === "home" ? <Home className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                        <div>
                          <p className="font-medium text-sm">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        </div>
                      </button>
                    ))}
                    {recentLocations.slice(0, 3).map((loc) => (
                      <button
                        key={loc.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                        onClick={() => { setDestinationAddress(loc.address); setShowDestSuggestions(false); }}
                        data-testid={`dest-recent-${loc.id}`}
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm truncate">{loc.address}</p>
                        </div>
                      </button>
                    ))}
                  </Card>
                )}
              </div>

              {/* Quick Options */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="px-3 py-1.5 rounded-full" data-testid="badge-pickup-now">
                  <Clock className="h-3 w-3 mr-1.5" /> Pickup now
                </Badge>
                <Badge variant="secondary" className="px-3 py-1.5 rounded-full" data-testid="badge-for-me">
                  <User className="h-3 w-3 mr-1.5" /> For me
                </Badge>
              </div>

              {/* Payment Method */}
              <div 
                className="flex items-center justify-between p-4 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => showComingSoon("Payment method selection")}
                data-testid="payment-method"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Card ending ****4242</p>
                    <p className="text-xs text-muted-foreground">Tap to change payment method</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* USA No Cash Notice */}
              <p className="text-xs text-muted-foreground text-center px-4" data-testid="no-cash-notice">
                Cash payments are not available in the United States
              </p>

              {/* See Prices Button - Uber Blue Style */}
              <Button 
                className="w-full h-14 text-base font-semibold rounded-xl shadow-lg" 
                onClick={handleSeePrices}
                data-testid="button-see-prices"
              >
                See prices
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 4: SERVICE TILES - Only Ride Active */}
        <section data-testid="suggestions-section">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {suggestionTiles.map((tile) => (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                disabled={!tile.active}
                aria-disabled={!tile.active}
                className={`relative flex flex-col items-center p-4 rounded-2xl transition-all duration-200 ${
                  tile.active 
                    ? "hover:shadow-lg hover:scale-105 cursor-pointer bg-card" 
                    : "opacity-60 cursor-not-allowed bg-muted/30"
                }`}
                data-testid={`tile-${tile.id}`}
              >
                <div className={`h-14 w-14 rounded-2xl ${tile.color} flex items-center justify-center mb-3 ${
                  tile.active ? "shadow-md" : ""
                }`}>
                  <tile.icon className={`h-6 w-6 ${tile.iconColor}`} />
                </div>
                <span className="text-xs font-semibold text-center">{tile.label}</span>
                {!tile.active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-2xl">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 pointer-events-none">
                      Soon
                    </Badge>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 5: RECENT ACTIVITY */}
        <section data-testid="activity-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Recent Activity</h2>
            <Link href="/customer/activity">
              <Button variant="ghost" size="sm" className="text-primary font-medium" data-testid="link-see-all-activity">
                See all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : recentRides && recentRides.length > 0 ? (
            <div className="space-y-3">
              {recentRides.slice(0, 3).map((ride: any) => (
                <Card key={ride.id} className="hover:shadow-md transition-shadow rounded-xl" data-testid={`activity-ride-${ride.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Car className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{ride.dropoffAddress || "Completed trip"}</p>
                            <p className="text-sm text-muted-foreground">
                              {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString("en-US", { 
                                month: "short", day: "numeric", hour: "numeric", minute: "2-digit" 
                              }) : "Recently"}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-lg">${ride.serviceFare?.toFixed(2) || "0.00"}</p>
                            <Badge variant={ride.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                              {ride.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-muted/20 border-dashed rounded-xl" data-testid="no-activity">
              <CardContent className="p-10 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-semibold text-lg">No recent trips</p>
                <p className="text-sm text-muted-foreground mt-1">Your ride history will appear here</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* SECTION 6: RESERVE PREVIEW - Coming Soon */}
        <section id="reserve-section" data-testid="reserve-section">
          <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20 border-blue-100 dark:border-blue-900/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Reserve a Ride
                </CardTitle>
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Coming Soon
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Schedule your ride in advance. Perfect for airport trips and important meetings.
              </p>
              
              <div className="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    disabled
                    className="h-11 bg-white/50 dark:bg-white/5"
                    data-testid="input-reserve-date"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Time</label>
                  <Input
                    type="time"
                    disabled
                    className="h-11 bg-white/50 dark:bg-white/5"
                    data-testid="input-reserve-time"
                  />
                </div>
              </div>

              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 space-y-2 text-sm" data-testid="reserve-info">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <p className="text-muted-foreground">Reserve up to 90 days in advance</p>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <p className="text-muted-foreground">Extra wait time included</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <p className="text-muted-foreground">Free cancellation 60 min before</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 7: MORE FROM SAFEGO */}
        <section data-testid="more-section">
          <h2 className="text-lg font-bold mb-4">More from SafeGo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer rounded-xl" 
              onClick={() => showComingSoon("SafeGo Eats")}
              data-testid="card-safego-eats"
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="h-7 w-7 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold">SafeGo Eats</h3>
                  <p className="text-sm text-muted-foreground">Order food delivery</p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">Coming soon</Badge>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer rounded-xl" 
              onClick={() => showComingSoon("SafeGo Business")}
              data-testid="card-safego-business"
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-7 w-7 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold">SafeGo Business</h3>
                  <p className="text-sm text-muted-foreground">Corporate travel solutions</p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">Coming soon</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 8: FOOTER - UPCOMING APPS */}
        <section className="text-center py-8 border-t" data-testid="footer-apps">
          <h3 className="font-bold mb-2">Get the SafeGo app</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Mobile apps coming soon. Web version active during development.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" disabled className="opacity-50 rounded-xl" data-testid="button-app-store">
              <Apple className="h-4 w-4 mr-2" />
              App Store
            </Button>
            <Button variant="outline" disabled className="opacity-50 rounded-xl" data-testid="button-google-play">
              <Play className="h-4 w-4 mr-2" />
              Google Play
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Coming soon</p>
        </section>
      </main>

      {/* SECTION 9: BOTTOM TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t z-50 safe-area-inset-bottom" data-testid="bottom-nav">
        <div className="max-w-4xl mx-auto flex items-center justify-around h-16">
          <Link href="/customer">
            <button className="flex flex-col items-center gap-1 px-6 py-2" data-testid="nav-home">
              <Home className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-semibold text-primary">Home</span>
            </button>
          </Link>
          <button 
            className="flex flex-col items-center gap-1 px-6 py-2"
            onClick={() => document.getElementById("activity-section")?.scrollIntoView({ behavior: "smooth" })}
            data-testid="nav-activity"
          >
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">Activity</span>
          </button>
          <Link href="/customer/support">
            <button className="flex flex-col items-center gap-1 px-6 py-2" data-testid="nav-support">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Support</span>
            </button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center gap-1 px-6 py-2" data-testid="nav-profile">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Account</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
              <DropdownMenuItem onClick={() => showComingSoon("Profile Settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
                <Badge variant="secondary" className="ml-auto text-[10px]">Soon</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => showComingSoon("Payment Methods")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Payment Methods
                <Badge variant="secondary" className="ml-auto text-[10px]">Soon</Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}
