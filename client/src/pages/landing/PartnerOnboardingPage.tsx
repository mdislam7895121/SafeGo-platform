import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Car, UtensilsCrossed, Store, Ticket, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import { useToast } from "@/hooks/use-toast";

type Region = "BD" | "US";

type PartnerType = "driver" | "restaurant" | "shop" | "ticket";

interface PartnerCard {
  type: PartnerType;
  title: string;
  description: string;
  icon: typeof Car;
  color: string;
  bdOnly?: boolean;
}

const PARTNER_CARDS: PartnerCard[] = [
  {
    type: "driver",
    title: "Driver / Courier",
    description: "Join as a ride driver or delivery courier",
    icon: Car,
    color: "bg-blue-500"
  },
  {
    type: "restaurant",
    title: "Restaurant Partner",
    description: "Partner your restaurant with SafeGo Food",
    icon: UtensilsCrossed,
    color: "bg-orange-500",
    bdOnly: true
  },
  {
    type: "shop",
    title: "Shop Partner",
    description: "List your shop on SafeGo Marketplace",
    icon: Store,
    color: "bg-cyan-500",
    bdOnly: true
  },
  {
    type: "ticket",
    title: "Ticket Partner",
    description: "Sell bus, train, launch or event tickets",
    icon: Ticket,
    color: "bg-indigo-500",
    bdOnly: true
  }
];

const BD_CITIES = ["Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barisal", "Rangpur", "Mymensingh", "Comilla", "Gazipur"];
const US_CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"];
const CUISINE_TYPES = ["Bengali", "Indian", "Chinese", "Thai", "Fast Food", "Pizza", "Biryani", "Seafood", "Vegetarian", "Mixed"];
const SHOP_CATEGORIES = [
  { value: "electronics", label: "Electronics" },
  { value: "groceries", label: "Groceries" },
  { value: "clothing", label: "Clothing" },
  { value: "essentials", label: "Essentials" }
];
const TICKET_TYPES = [
  { value: "bus", label: "Bus" },
  { value: "train", label: "Train" },
  { value: "launch", label: "Launch/Ferry" },
  { value: "event", label: "Event" }
];
const SERVICE_TYPES = [
  { value: "ride_driver", label: "Ride Driver" },
  { value: "delivery_courier", label: "Delivery Courier" }
];
const VEHICLE_TYPES = [
  { value: "car", label: "Car" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "bicycle", label: "Bicycle" },
  { value: "walking", label: "Walking (Delivery Only)" }
];

export default function PartnerOnboardingPage() {
  useLandingSeo({
    title: "Partner With SafeGo - Join Our Network",
    description: "Become a SafeGo partner. Join as a driver, courier, restaurant, shop, or ticket partner. Apply now and start earning."
  });

  const { toast } = useToast();
  const [region, setRegion] = useState<Region>("BD");
  const [selectedPartner, setSelectedPartner] = useState<PartnerType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [driverForm, setDriverForm] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    city: "",
    serviceType: "",
    vehicleType: ""
  });

  const [restaurantForm, setRestaurantForm] = useState({
    restaurantName: "",
    ownerName: "",
    phoneNumber: "",
    businessEmail: "",
    city: "",
    cuisineType: ""
  });

  const [shopForm, setShopForm] = useState({
    shopName: "",
    ownerName: "",
    phoneNumber: "",
    category: "",
    city: ""
  });

  const [ticketForm, setTicketForm] = useState({
    businessName: "",
    contactPerson: "",
    phoneNumber: "",
    ticketType: "",
    city: ""
  });

  useEffect(() => {
    if (region === "US") {
      if (selectedPartner === "restaurant" || selectedPartner === "shop" || selectedPartner === "ticket") {
        setSelectedPartner(null);
      }
    }
  }, [region, selectedPartner]);

  const resetForms = () => {
    setDriverForm({ fullName: "", phoneNumber: "", email: "", city: "", serviceType: "", vehicleType: "" });
    setRestaurantForm({ restaurantName: "", ownerName: "", phoneNumber: "", businessEmail: "", city: "", cuisineType: "" });
    setShopForm({ shopName: "", ownerName: "", phoneNumber: "", category: "", city: "" });
    setTicketForm({ businessName: "", contactPerson: "", phoneNumber: "", ticketType: "", city: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let endpoint = "";
      let payload: any = {};

      switch (selectedPartner) {
        case "driver":
          endpoint = "/api/partner-onboarding/driver";
          payload = { ...driverForm, region };
          break;
        case "restaurant":
          endpoint = "/api/partner-onboarding/restaurant";
          payload = restaurantForm;
          break;
        case "shop":
          endpoint = "/api/partner-onboarding/shop";
          payload = shopForm;
          break;
        case "ticket":
          endpoint = "/api/partner-onboarding/ticket";
          payload = ticketForm;
          break;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit application");
      }

      setSubmitSuccess(true);
      resetForms();
      toast({
        title: "Application Submitted",
        description: data.message
      });
    } catch (error: any) {
      setSubmitError(error.message);
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cities = region === "BD" ? BD_CITIES : US_CITIES;
  const availablePartners = PARTNER_CARDS.filter(p => !p.bdOnly || region === "BD");

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-xl mx-auto text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-4">Application Submitted</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for your interest in partnering with SafeGo. We will review your application and contact you within 3-5 business days.
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => { setSubmitSuccess(false); setSelectedPartner(null); }} data-testid="button-submit-another">
                Submit Another Application
              </Button>
              <Link href="/">
                <Button variant="outline" className="w-full" data-testid="button-back-home">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Partner With SafeGo</h1>
            <p className="text-muted-foreground">Join our growing network of partners and start earning today</p>
          </div>

          <div className="mb-6">
            <Label className="mb-2 block">Select Your Region</Label>
            <div className="flex gap-3">
              <Button
                variant={region === "BD" ? "default" : "outline"}
                onClick={() => setRegion("BD")}
                data-testid="button-region-bd"
              >
                Bangladesh
              </Button>
              <Button
                variant={region === "US" ? "default" : "outline"}
                onClick={() => setRegion("US")}
                data-testid="button-region-us"
              >
                United States
              </Button>
            </div>
          </div>

          {!selectedPartner ? (
            <div className="grid gap-4 md:grid-cols-2">
              {availablePartners.map((partner) => (
                <Card
                  key={partner.type}
                  className="cursor-pointer hover-elevate transition-all"
                  onClick={() => setSelectedPartner(partner.type)}
                  data-testid={`card-partner-${partner.type}`}
                >
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className={`h-12 w-12 rounded-lg ${partner.color} flex items-center justify-center`}>
                      <partner.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{partner.title}</CardTitle>
                      <CardDescription>{partner.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {PARTNER_CARDS.find(p => p.type === selectedPartner)?.title} Application
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPartner(null)} data-testid="button-change-type">
                    Change Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {submitError && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {selectedPartner === "driver" && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input
                            id="fullName"
                            value={driverForm.fullName}
                            onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                            required
                            data-testid="input-driver-fullname"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={driverForm.email}
                            onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                            required
                            data-testid="input-driver-email"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={driverForm.phoneNumber}
                            onChange={(e) => setDriverForm({ ...driverForm, phoneNumber: e.target.value })}
                            required
                            data-testid="input-driver-phone"
                          />
                        </div>
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Select value={driverForm.city} onValueChange={(v) => setDriverForm({ ...driverForm, city: v })}>
                            <SelectTrigger data-testid="select-driver-city">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem key={city} value={city}>{city}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="serviceType">Service Type</Label>
                          <Select value={driverForm.serviceType} onValueChange={(v) => setDriverForm({ ...driverForm, serviceType: v })}>
                            <SelectTrigger data-testid="select-driver-service">
                              <SelectValue placeholder="Select service" />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="vehicleType">Vehicle Type</Label>
                          <Select value={driverForm.vehicleType} onValueChange={(v) => setDriverForm({ ...driverForm, vehicleType: v })}>
                            <SelectTrigger data-testid="select-driver-vehicle">
                              <SelectValue placeholder="Select vehicle" />
                            </SelectTrigger>
                            <SelectContent>
                              {VEHICLE_TYPES.map((v) => (
                                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedPartner === "restaurant" && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="restaurantName">Restaurant Name</Label>
                          <Input
                            id="restaurantName"
                            value={restaurantForm.restaurantName}
                            onChange={(e) => setRestaurantForm({ ...restaurantForm, restaurantName: e.target.value })}
                            required
                            data-testid="input-restaurant-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ownerName">Owner Name</Label>
                          <Input
                            id="ownerName"
                            value={restaurantForm.ownerName}
                            onChange={(e) => setRestaurantForm({ ...restaurantForm, ownerName: e.target.value })}
                            required
                            data-testid="input-restaurant-owner"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={restaurantForm.phoneNumber}
                            onChange={(e) => setRestaurantForm({ ...restaurantForm, phoneNumber: e.target.value })}
                            required
                            data-testid="input-restaurant-phone"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Business Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={restaurantForm.businessEmail}
                            onChange={(e) => setRestaurantForm({ ...restaurantForm, businessEmail: e.target.value })}
                            required
                            data-testid="input-restaurant-email"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Select value={restaurantForm.city} onValueChange={(v) => setRestaurantForm({ ...restaurantForm, city: v })}>
                            <SelectTrigger data-testid="select-restaurant-city">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {BD_CITIES.map((city) => (
                                <SelectItem key={city} value={city}>{city}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="cuisineType">Cuisine Type</Label>
                          <Select value={restaurantForm.cuisineType} onValueChange={(v) => setRestaurantForm({ ...restaurantForm, cuisineType: v })}>
                            <SelectTrigger data-testid="select-restaurant-cuisine">
                              <SelectValue placeholder="Select cuisine" />
                            </SelectTrigger>
                            <SelectContent>
                              {CUISINE_TYPES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedPartner === "shop" && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="shopName">Shop Name</Label>
                          <Input
                            id="shopName"
                            value={shopForm.shopName}
                            onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
                            required
                            data-testid="input-shop-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ownerName">Owner Name</Label>
                          <Input
                            id="ownerName"
                            value={shopForm.ownerName}
                            onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })}
                            required
                            data-testid="input-shop-owner"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={shopForm.phoneNumber}
                            onChange={(e) => setShopForm({ ...shopForm, phoneNumber: e.target.value })}
                            required
                            data-testid="input-shop-phone"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select value={shopForm.category} onValueChange={(v) => setShopForm({ ...shopForm, category: v })}>
                            <SelectTrigger data-testid="select-shop-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {SHOP_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Select value={shopForm.city} onValueChange={(v) => setShopForm({ ...shopForm, city: v })}>
                          <SelectTrigger data-testid="select-shop-city">
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            {BD_CITIES.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedPartner === "ticket" && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="businessName">Business Name</Label>
                          <Input
                            id="businessName"
                            value={ticketForm.businessName}
                            onChange={(e) => setTicketForm({ ...ticketForm, businessName: e.target.value })}
                            required
                            data-testid="input-ticket-business"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contactPerson">Contact Person</Label>
                          <Input
                            id="contactPerson"
                            value={ticketForm.contactPerson}
                            onChange={(e) => setTicketForm({ ...ticketForm, contactPerson: e.target.value })}
                            required
                            data-testid="input-ticket-contact"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={ticketForm.phoneNumber}
                            onChange={(e) => setTicketForm({ ...ticketForm, phoneNumber: e.target.value })}
                            required
                            data-testid="input-ticket-phone"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ticketType">Ticket Type</Label>
                          <Select value={ticketForm.ticketType} onValueChange={(v) => setTicketForm({ ...ticketForm, ticketType: v })}>
                            <SelectTrigger data-testid="select-ticket-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {TICKET_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Select value={ticketForm.city} onValueChange={(v) => setTicketForm({ ...ticketForm, city: v })}>
                          <SelectTrigger data-testid="select-ticket-city">
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            {BD_CITIES.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-application">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
