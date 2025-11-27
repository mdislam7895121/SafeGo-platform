import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Car, Package, UtensilsCrossed, User, Clock, HelpCircle, MapPin, 
  ChevronDown, ChevronRight, Calendar, ShoppingCart, Smartphone, Bus,
  Briefcase, CreditCard, Navigation, Circle, Square, Home, Settings,
  LogOut, Shield, Star, ArrowRight, Apple, Play, Globe, Check
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
  { id: "reserve", label: "Reserve", icon: Calendar, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: true },
  { id: "courier", label: "Courier", icon: Package, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: true },
  { id: "food", label: "Food", icon: UtensilsCrossed, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "grocery", label: "Grocery", icon: ShoppingCart, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "rental", label: "Rental Cars", icon: Car, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "shuttle", label: "Shuttle", icon: Bus, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "electronics", label: "Electronics", icon: Smartphone, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
];

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
  const [reserveTab, setReserveTab] = useState<"reserve" | "rent">("reserve");
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
      case "reserve":
        document.getElementById("reserve-section")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "courier":
        setLocation("/customer/parcel");
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

  const getInitials = (email: string) => {
    return email?.substring(0, 2).toUpperCase() || "U";
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="customer-home-page">
      {/* SECTION 1: TOP HEADER */}
      <header className="sticky top-0 z-50 bg-background border-b" data-testid="header">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" data-testid="logo">SafeGo</h1>
            <Badge variant="outline" className="text-xs" data-testid="region-badge">
              <Globe className="h-3 w-3 mr-1" />
              United States
            </Badge>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 h-auto py-1.5" data-testid="profile-pill">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatarUrl} />
                  <AvatarFallback className="text-xs">{getInitials(profile?.email || user?.email || "")}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium truncate max-w-[120px]">{profile?.email || user?.email}</span>
                  {profile?.isVerified && (
                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                      <Check className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" data-testid="profile-dropdown">
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
        {/* SECTION 2: HERO - REQUEST A RIDE */}
        <section ref={heroRef} data-testid="hero-section">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl" data-testid="hero-title">Request a ride</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pickup Input */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-900 dark:bg-white" />
                  <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />
                </div>
                <Input
                  placeholder={isLocating ? "Detecting location..." : "Pickup location"}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  onFocus={() => setShowPickupSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)}
                  className="pl-10 h-12"
                  data-testid="input-pickup"
                />
                {showPickupSuggestions && (savedPlaces.length > 0 || recentLocations.length > 0) && (
                  <Card className="absolute top-full left-0 right-0 mt-1 z-10 max-h-48 overflow-y-auto" data-testid="pickup-suggestions">
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
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
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
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
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <div className="h-2.5 w-2.5 bg-gray-900 dark:bg-white" />
                </div>
                <Input
                  placeholder="Where to?"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  onFocus={() => setShowDestSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
                  className="pl-10 h-12"
                  data-testid="input-destination"
                />
                {showDestSuggestions && (savedPlaces.length > 0 || recentLocations.length > 0) && (
                  <Card className="absolute top-full left-0 right-0 mt-1 z-10 max-h-48 overflow-y-auto" data-testid="destination-suggestions">
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
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
                        className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
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

              {/* Options Row */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="px-3 py-1.5" data-testid="badge-pickup-now">
                  <Clock className="h-3 w-3 mr-1" /> Pickup now
                </Badge>
                <Badge variant="secondary" className="px-3 py-1.5" data-testid="badge-for-me">
                  <User className="h-3 w-3 mr-1" /> For me
                </Badge>
              </div>

              {/* Payment Method */}
              <div 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                onClick={() => showComingSoon("Payment method selection")}
                data-testid="payment-method"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">Card ending ****4242</p>
                    <p className="text-xs text-muted-foreground">Change payment method</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* USA No Cash Notice */}
              <p className="text-xs text-muted-foreground text-center" data-testid="no-cash-notice">
                Cash payments are not available in the United States.
              </p>

              {/* See Prices Button */}
              <Button 
                className="w-full h-12 text-base" 
                onClick={handleSeePrices}
                data-testid="button-see-prices"
              >
                See prices
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 3: SUGGESTIONS GRID */}
        <section data-testid="suggestions-section">
          <div className="grid grid-cols-4 gap-3">
            {suggestionTiles.map((tile) => (
              <button
                key={tile.id}
                onClick={tile.active ? () => handleTileClick(tile) : undefined}
                disabled={!tile.active}
                aria-disabled={!tile.active}
                className={`flex flex-col items-center p-3 rounded-xl ${
                  tile.active 
                    ? "hover-elevate cursor-pointer" 
                    : "opacity-50 cursor-not-allowed"
                }`}
                data-testid={`tile-${tile.id}`}
              >
                <div className={`h-12 w-12 rounded-full ${tile.color} flex items-center justify-center mb-2`}>
                  <tile.icon className={`h-5 w-5 ${tile.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-center">{tile.label}</span>
                {!tile.active && (
                  <Badge variant="secondary" className="text-[10px] mt-1 pointer-events-none">Soon</Badge>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 4: ACCOUNT & ACTIVITY */}
        <section data-testid="activity-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link href="/customer/activity">
              <Button variant="ghost" size="sm" data-testid="link-see-all-activity">
                See all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : recentRides && recentRides.length > 0 ? (
            <div className="space-y-3">
              {recentRides.slice(0, 3).map((ride: any) => (
                <Card key={ride.id} className="hover-elevate" data-testid={`activity-ride-${ride.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Car className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{ride.dropoffAddress || "Completed trip"}</p>
                            <p className="text-sm text-muted-foreground">
                              {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString() : "Recently"}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold">${ride.serviceFare?.toFixed(2) || "0.00"}</p>
                            <Badge variant="secondary" className="text-xs">{ride.status}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-muted/30" data-testid="no-activity">
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No recent trips</p>
                <p className="text-sm text-muted-foreground mt-1">Your ride history will appear here</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* SECTION 5: PLAN FOR LATER (RESERVE) */}
        <section id="reserve-section" data-testid="reserve-section">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex gap-4 border-b">
                <button
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    reserveTab === "reserve" 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setReserveTab("reserve")}
                  data-testid="tab-reserve"
                >
                  Reserve
                </button>
                <button
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    reserveTab === "rent" 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => { setReserveTab("rent"); showComingSoon("Rent a car"); }}
                  data-testid="tab-rent"
                >
                  Rent
                  <Badge variant="secondary" className="ml-2 text-[10px]">Soon</Badge>
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Date</label>
                  <Input
                    type="date"
                    value={reserveDate}
                    onChange={(e) => setReserveDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="h-11"
                    data-testid="input-reserve-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Time</label>
                  <Input
                    type="time"
                    value={reserveTime}
                    onChange={(e) => setReserveTime(e.target.value)}
                    className="h-11"
                    data-testid="input-reserve-time"
                  />
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => showComingSoon("Reserve a ride")}
                data-testid="button-reserve-next"
              >
                Next
              </Button>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm" data-testid="reserve-info">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <p>Reserve pickup time up to 90 days in advance</p>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <p>Extra wait time included to meet your ride</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <p>Cancel free 60 minutes before scheduled time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 6: MORE FROM SAFEGO */}
        <section data-testid="more-section">
          <h2 className="text-lg font-semibold mb-4">More from SafeGo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              className="hover-elevate cursor-pointer" 
              onClick={() => showComingSoon("SafeGo Eats")}
              data-testid="card-safego-eats"
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="h-7 w-7 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">SafeGo Eats</h3>
                  <p className="text-sm text-muted-foreground">Order food delivery</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">Coming soon</Badge>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="hover-elevate cursor-pointer" 
              onClick={() => showComingSoon("SafeGo Business")}
              data-testid="card-safego-business"
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">SafeGo Business</h3>
                  <p className="text-sm text-muted-foreground">Corporate travel solutions</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">Coming soon</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 7: FOOTER - UPCOMING APPS */}
        <section className="text-center py-8 border-t" data-testid="footer-apps">
          <h3 className="font-semibold mb-2">Get the SafeGo app</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Mobile apps coming soon. Web version active during development.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" disabled className="opacity-50" data-testid="button-app-store">
              <Apple className="h-4 w-4 mr-2" />
              App Store
            </Button>
            <Button variant="outline" disabled className="opacity-50" data-testid="button-google-play">
              <Play className="h-4 w-4 mr-2" />
              Google Play
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Coming soon</p>
        </section>
      </main>

      {/* SECTION 8: BOTTOM TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50" data-testid="bottom-nav">
        <div className="max-w-4xl mx-auto flex items-center justify-around h-16">
          <Link href="/customer">
            <button className="flex flex-col items-center gap-1 px-4 py-2 text-primary" data-testid="nav-home">
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium">Home</span>
            </button>
          </Link>
          <button 
            className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground"
            onClick={() => document.getElementById("activity-section")?.scrollIntoView({ behavior: "smooth" })}
            data-testid="nav-activity"
          >
            <Clock className="h-5 w-5" />
            <span className="text-xs">Activity</span>
          </button>
          <Link href="/customer/support">
            <button className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground" data-testid="nav-support">
              <HelpCircle className="h-5 w-5" />
              <span className="text-xs">Support</span>
            </button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground" data-testid="nav-profile">
                <User className="h-5 w-5" />
                <span className="text-xs">Profile</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
              <DropdownMenuItem onClick={() => showComingSoon("Profile Settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => showComingSoon("Payment Methods")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Payment Methods
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
