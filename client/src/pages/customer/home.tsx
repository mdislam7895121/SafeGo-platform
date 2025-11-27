import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Car, Package, UtensilsCrossed, User, Clock, HelpCircle, MapPin, 
  ChevronDown, ChevronRight, Calendar, ShoppingCart, Smartphone, Bus,
  Briefcase, CreditCard, Navigation, Home, Settings,
  LogOut, Star, ArrowRight, Apple, Play, Globe, Check, Crosshair,
  BadgeCheck, Sun, Moon, Sunset, Key
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
  { id: "rental", label: "Rental", icon: Key, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
  { id: "shuttle", label: "Shuttle", icon: Bus, color: "bg-gray-100 dark:bg-gray-800", iconColor: "text-gray-900 dark:text-white", active: false },
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
    <div className="min-h-screen bg-background pb-20" data-testid="customer-home-page">
      {/* UBER-STYLE STICKY HEADER */}
      <header className="sticky top-0 z-50 bg-background border-b shadow-sm" data-testid="header">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight" data-testid="logo">SafeGo</h1>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium h-5" data-testid="region-badge">
              <Globe className="h-2.5 w-2.5 mr-0.5" />
              {getCountryLabel()}
            </Badge>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 px-2 h-8" data-testid="profile-pill">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile?.avatarUrl} />
                  <AvatarFallback className="text-[9px] font-semibold bg-primary text-primary-foreground">
                    {getInitials(getUserDisplayName(), profile?.email || user?.email)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
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

      <main className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {/* GREETING SECTION */}
        <section className="space-y-0.5" data-testid="greeting-section">
          <div className="flex items-center gap-2">
            <GreetingIcon className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold" data-testid="greeting-text">
              {greeting.text}, {getUserDisplayName().split(" ")[0]}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground pl-7" data-testid="greeting-subtitle">
            Where are you going?
          </p>
        </section>

        {/* UBER-STYLE RIDE REQUEST CARD */}
        <section ref={heroRef} data-testid="hero-section">
          <Card className="overflow-hidden shadow-xl border-0 bg-card">
            <CardContent className="p-0">
              {/* Uber-style Location Inputs with Timeline */}
              <div className="p-4 space-y-0">
                <div className="flex">
                  {/* Uber Vertical Timeline Indicator */}
                  <div className="flex flex-col items-center mr-3 py-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    <div className="w-0.5 flex-1 bg-gray-300 dark:bg-gray-600 my-1 min-h-[40px]" />
                    <div className="h-2.5 w-2.5 bg-gray-900 dark:bg-white" />
                  </div>
                  
                  {/* Input Fields */}
                  <div className="flex-1 space-y-2">
                    {/* Pickup Input */}
                    <div className="relative">
                      <Input
                        placeholder={isLocating ? "Detecting location..." : "Pickup location"}
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        onFocus={() => setShowPickupSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)}
                        className="h-12 pr-20 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-lg placeholder:text-gray-500"
                        data-testid="input-pickup"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          onClick={autoDetectLocation}
                          disabled={isLocating}
                          data-testid="button-detect-location"
                        >
                          <Crosshair className={`h-4 w-4 ${isLocating ? "animate-pulse text-primary" : "text-gray-500"}`} />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                      {showPickupSuggestions && (savedPlaces.length > 0 || recentLocations.length > 0) && (
                        <Card className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto shadow-xl border" data-testid="pickup-suggestions">
                          {savedPlaces.map((place) => (
                            <button
                              key={place.id}
                              className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                              onClick={() => { setPickupAddress(place.address); setShowPickupSuggestions(false); }}
                              data-testid={`pickup-saved-${place.id}`}
                            >
                              {place.icon === "home" ? <Home className="h-4 w-4 text-muted-foreground" /> : <Briefcase className="h-4 w-4 text-muted-foreground" />}
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
                              <p className="text-sm truncate">{loc.address}</p>
                            </button>
                          ))}
                        </Card>
                      )}
                    </div>

                    {/* Destination Input */}
                    <div className="relative">
                      <Input
                        placeholder="Where to?"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        onFocus={() => setShowDestSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
                        className="h-12 pr-10 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-lg placeholder:text-gray-500 font-medium"
                        data-testid="input-destination"
                      />
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      {showDestSuggestions && (savedPlaces.length > 0 || recentLocations.length > 0) && (
                        <Card className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto shadow-xl border" data-testid="destination-suggestions">
                          {savedPlaces.map((place) => (
                            <button
                              key={place.id}
                              className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                              onClick={() => { setDestinationAddress(place.address); setShowDestSuggestions(false); }}
                              data-testid={`dest-saved-${place.id}`}
                            >
                              {place.icon === "home" ? <Home className="h-4 w-4 text-muted-foreground" /> : <Briefcase className="h-4 w-4 text-muted-foreground" />}
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
                              <p className="text-sm truncate">{loc.address}</p>
                            </button>
                          ))}
                        </Card>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              {/* Quick Options & Payment */}
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="px-3 py-1.5 rounded-full text-xs font-medium" data-testid="badge-pickup-now">
                    <Clock className="h-3 w-3 mr-1.5" /> Now
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1.5 rounded-full text-xs font-medium" data-testid="badge-for-me">
                    <User className="h-3 w-3 mr-1.5" /> For me
                  </Badge>
                </div>

                {/* Payment Method Row */}
                <button 
                  className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
                  onClick={() => showComingSoon("Payment method selection")}
                  data-testid="payment-method"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium">•••• 4242</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>

                <p className="text-[11px] text-center text-muted-foreground" data-testid="no-cash-notice">
                  Cash payments are not available in the United States
                </p>

                {/* See Prices Button */}
                <Button 
                  className="w-full h-12 text-sm font-semibold rounded-lg" 
                  onClick={handleSeePrices}
                  data-testid="button-see-prices"
                >
                  See prices
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 8 SUGGESTION TILES - UBER STYLE */}
        <section data-testid="suggestions-section">
          <div className="grid grid-cols-4 gap-3">
            {suggestionTiles.map((tile) => (
              <button
                key={tile.id}
                onClick={() => tile.active && handleTileClick(tile)}
                disabled={!tile.active}
                aria-disabled={!tile.active}
                className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                  tile.active 
                    ? "hover:scale-105 hover:shadow-lg cursor-pointer active:scale-95" 
                    : "cursor-not-allowed"
                }`}
                style={{ 
                  boxShadow: tile.active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
                }}
                data-testid={`tile-${tile.id}`}
              >
                <div className={`h-12 w-12 rounded-full ${tile.color} flex items-center justify-center mb-2 ${
                  tile.active ? "shadow-md" : "grayscale-[30%] opacity-70"
                }`}>
                  <tile.icon className={`h-5 w-5 ${tile.active ? tile.iconColor : "text-gray-400"}`} />
                </div>
                <span className={`text-[11px] font-semibold text-center leading-tight ${!tile.active ? "text-muted-foreground" : ""}`}>{tile.label}</span>
                {!tile.active && (
                  <div 
                    className="absolute inset-0 flex items-end justify-center pb-1.5 rounded-xl pointer-events-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                  >
                    <span className="text-[8px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded shadow-sm">
                      Soon
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ACTIVITY PREVIEW - UBER STYLE */}
        <section data-testid="activity-section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Recent</h2>
            <Link href="/customer/activity">
              <Button variant="ghost" size="sm" className="text-primary text-xs font-semibold h-7 px-2" data-testid="link-see-all-activity">
                See all
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : recentRides && recentRides.length > 0 ? (
            <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/50">
              {recentRides.slice(0, 3).map((ride: any, index: number) => (
                <div 
                  key={ride.id}
                  className={`hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors ${
                    index < Math.min(recentRides.length, 3) - 1 ? "border-b" : ""
                  }`}
                  style={{ borderColor: '#e5e5e5' }}
                  data-testid={`activity-ride-${ride.id}`}
                >
                  <div className="px-4 py-5">
                    <div className="flex items-center gap-4">
                      {/* Large Uber-style Car Icon */}
                      <div className="h-14 w-14 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Car className="h-7 w-7 text-gray-700 dark:text-gray-300" />
                      </div>
                      
                      {/* Trip Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{ride.dropoffAddress || "Completed trip"}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString("en-US", { 
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit" 
                          }) : "Recently"}
                        </p>
                      </div>
                      
                      {/* Price & Action - Uber right-aligned */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-bold text-base tabular-nums">${ride.serviceFare?.toFixed(2) || "0.00"}</p>
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          See details
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-gray-50 dark:bg-gray-900/50 border-0 rounded-xl" data-testid="no-activity">
              <CardContent className="p-8 text-center">
                <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-7 w-7 text-gray-500" />
                </div>
                <p className="font-semibold text-sm">No recent trips</p>
                <p className="text-xs text-muted-foreground mt-1">Your ride history will appear here</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* RESERVE PREVIEW - UBER TEAL STYLE */}
        <section id="reserve-section" data-testid="reserve-section">
          <Card 
            className="overflow-hidden border-0 rounded-2xl"
            style={{ backgroundColor: '#d7f0f0' }}
          >
            <div className="dark:bg-teal-950/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                  <h3 className="font-bold text-base text-teal-900 dark:text-teal-100">Reserve</h3>
                </div>
                <Badge className="bg-teal-200/80 dark:bg-teal-800/50 text-teal-800 dark:text-teal-200 text-[10px] border-0">
                  Coming Soon
                </Badge>
              </div>
              
              <p className="text-xs text-teal-800/80 dark:text-teal-200/80 mb-4">
                Schedule rides in advance for airport trips and important meetings.
              </p>
              
              <div className="grid grid-cols-2 gap-3 opacity-60 pointer-events-none">
                <div>
                  <label className="text-[10px] font-semibold mb-1 block text-teal-900/60 dark:text-teal-100/60 uppercase tracking-wide">Date</label>
                  <div className="h-11 bg-white/60 dark:bg-white/10 rounded-lg flex items-center px-3">
                    <span className="text-sm text-teal-900/50 dark:text-teal-100/50">Select date</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold mb-1 block text-teal-900/60 dark:text-teal-100/60 uppercase tracking-wide">Time</label>
                  <div className="h-11 bg-white/60 dark:bg-white/10 rounded-lg flex items-center px-3">
                    <span className="text-sm text-teal-900/50 dark:text-teal-100/50">Select time</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200">
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Reserve up to 90 days ahead</span>
                </div>
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200">
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Free cancellation 60 min before</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* MORE FROM SAFEGO */}
        <section data-testid="more-section">
          <h2 className="text-base font-bold mb-3">More from SafeGo</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer rounded-xl border-0 bg-gray-50 dark:bg-gray-900/50" 
              onClick={() => showComingSoon("SafeGo Eats")}
              data-testid="card-safego-eats"
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-2">
                  <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-bold text-sm">Eats</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Food delivery</p>
                <Badge variant="secondary" className="mt-2 text-[9px]">Soon</Badge>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer rounded-xl border-0 bg-gray-50 dark:bg-gray-900/50" 
              onClick={() => showComingSoon("SafeGo Business")}
              data-testid="card-safego-business"
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-sm">Business</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Corporate travel</p>
                <Badge variant="secondary" className="mt-2 text-[9px]">Soon</Badge>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FOOTER */}
        <section className="text-center py-6 border-t" data-testid="footer-apps">
          <h3 className="font-bold text-sm mb-1">Get the SafeGo app</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Mobile apps coming soon
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" disabled size="sm" className="opacity-50 rounded-lg h-8 text-xs" data-testid="button-app-store">
              <Apple className="h-3.5 w-3.5 mr-1.5" />
              App Store
            </Button>
            <Button variant="outline" disabled size="sm" className="opacity-50 rounded-lg h-8 text-xs" data-testid="button-google-play">
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Google Play
            </Button>
          </div>
        </section>
      </main>

      {/* UBER-STYLE BOTTOM TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50" data-testid="bottom-nav">
        <div className="max-w-lg mx-auto flex items-center justify-around h-14">
          <Link href="/customer">
            <button className="flex flex-col items-center justify-center gap-0.5 w-16 h-full" data-testid="nav-home">
              <Home className="h-[22px] w-[22px] text-foreground" strokeWidth={2.5} />
              <span className="text-[10px] font-semibold">Home</span>
            </button>
          </Link>
          <button 
            className="flex flex-col items-center justify-center gap-0.5 w-16 h-full"
            onClick={() => document.getElementById("activity-section")?.scrollIntoView({ behavior: "smooth" })}
            data-testid="nav-activity"
          >
            <Clock className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[10px] font-medium text-muted-foreground">Activity</span>
          </button>
          <Link href="/customer/support">
            <button className="flex flex-col items-center justify-center gap-0.5 w-16 h-full" data-testid="nav-support">
              <HelpCircle className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[10px] font-medium text-muted-foreground">Support</span>
            </button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 w-16 h-full" data-testid="nav-profile">
                <User className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.5} />
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
