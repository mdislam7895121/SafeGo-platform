import { useState } from "react";
import { Link } from "wouter";
import { 
  Car, Utensils, Package, Store, Ticket, Shield, Lock, MapPin,
  ChevronDown, ChevronRight, Check, Users, Clock, Phone, Star,
  Briefcase, Heart, Globe, Zap, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Region = "BD" | "US" | "GLOBAL";

const SERVICES = [
  {
    id: "rides",
    title: "Rides",
    description: "Get where you need to go with reliable drivers",
    icon: Car,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    link: "/customer/ride-booking",
    available: true,
  },
  {
    id: "food",
    title: "Food Delivery",
    description: "Order from your favorite restaurants",
    icon: Utensils,
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    link: "/customer/food",
    available: true,
  },
  {
    id: "parcel",
    title: "Parcel Delivery",
    description: "Send packages across the city or country",
    icon: Package,
    color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    link: "/customer/parcel",
    available: true,
  },
  {
    id: "shops",
    title: "Local Shops",
    description: "Shop from local stores delivered to your door",
    icon: Store,
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    link: "/customer/bd-shops",
    available: true,
  },
  {
    id: "tickets",
    title: "Tickets & Travel",
    description: "Book bus tickets and travel services",
    icon: Ticket,
    color: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
    link: "/customer/bd-tickets",
    available: true,
  },
];

const HOW_IT_WORKS = {
  rides: {
    title: "How Rides Work",
    steps: [
      "Open the app and enter your destination",
      "Choose your ride type and confirm pickup location",
      "Track your driver in real-time",
      "Pay seamlessly via cash or card",
      "Rate your experience and tip if you'd like",
    ],
  },
  food: {
    title: "How Food Delivery Works",
    steps: [
      "Browse restaurants and menus near you",
      "Add items to your cart and customize orders",
      "Track your order from kitchen to doorstep",
      "Receive your food fresh and on time",
      "Rate the restaurant and delivery experience",
    ],
  },
  parcel: {
    title: "How Parcel Delivery Works",
    steps: [
      "Enter pickup and delivery addresses",
      "Specify package details and weight",
      "Choose delivery speed (Regular, Express, Same-Day)",
      "Track your package in real-time",
      "Recipient confirms delivery with signature",
    ],
  },
};

const FAQS = [
  {
    question: "How do I request a SafeGo ride?",
    answer: "Open the SafeGo app, enter your destination, choose your preferred vehicle type, and tap Request. A nearby driver will accept your ride and arrive at your pickup location.",
  },
  {
    question: "When is SafeGo launching?",
    answer: "SafeGo is launching first in Bangladesh with plans to expand to the United States and other markets. Sign up to get notified when we launch in your area.",
  },
  {
    question: "How do I become a driver or courier?",
    answer: "Visit the 'Become a Partner' section and choose your preferred service type. Complete the registration, submit required documents, and start earning once approved.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "SafeGo accepts cash, credit/debit cards, and mobile wallets (bKash, Nagad in Bangladesh). Payment options vary by region.",
  },
  {
    question: "How is my safety ensured?",
    answer: "All drivers undergo background checks and vehicle inspections. Real-time trip tracking, emergency SOS button, and 24/7 support ensure your safety on every ride.",
  },
  {
    question: "Can I schedule rides in advance?",
    answer: "Yes! You can schedule rides up to 7 days in advance. Just select your desired date and time when booking.",
  },
];

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl hidden sm:inline">SafeGo</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/customer/ride-booking" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Ride
            </Link>
            <Link href="/partner/ride/start" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Drive
            </Link>
            <Link href="/partner/restaurant/start" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Business
            </Link>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" data-testid="button-login">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" data-testid="button-signup">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function RegionTabs({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region; 
  onRegionChange: (region: Region) => void;
}) {
  const regions: { id: Region; label: string; flag: string }[] = [
    { id: "BD", label: "Bangladesh", flag: "🇧🇩" },
    { id: "US", label: "United States", flag: "🇺🇸" },
    { id: "GLOBAL", label: "Global", flag: "🌍" },
  ];

  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
      {regions.map((region) => (
        <button
          key={region.id}
          onClick={() => onRegionChange(region.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            selectedRegion === region.id
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid={`region-tab-${region.id.toLowerCase()}`}
        >
          <span>{region.flag}</span>
          <span className="hidden sm:inline">{region.label}</span>
        </button>
      ))}
    </div>
  );
}

function HeroSection({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region;
  onRegionChange: (region: Region) => void;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/10 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <RegionTabs selectedRegion={selectedRegion} onRegionChange={onRegionChange} />
          
          <h1 className="mt-8 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Move, eat, and deliver with{" "}
            <span className="text-primary">SafeGo</span>
          </h1>
          
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
            One platform for rides, food delivery, and parcel delivery — launching first in Bangladesh.
          </p>
          
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link href="/customer/ride-booking">
              <Button size="lg" className="w-full sm:w-auto" data-testid="button-explore-services">
                Explore services
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/partner/ride/start">
              <Button variant="outline" size="lg" className="w-full sm:w-auto" data-testid="button-become-partner">
                Become a partner
              </Button>
            </Link>
          </div>
          
          <div className="mt-12 flex items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Verified drivers</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>24/7 support</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span>Top-rated service</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section id="services" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Our Services</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">SafeGo Services</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Everything you need, all in one app. Choose a service to get started.
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {SERVICES.map((service) => (
            <Link key={service.id} href={service.link}>
              <Card className="h-full hover-elevate cursor-pointer group" data-testid={`service-card-${service.id}`}>
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className={`p-4 rounded-2xl ${service.color} mb-4 transition-transform group-hover:scale-110`}>
                    <service.icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PartnerSection() {
  return (
    <section id="partners" className="py-16 md:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Join Us</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Become a Partner</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Turn your time or business into earnings with SafeGo
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="hover-elevate" data-testid="partner-card-drivers">
            <CardHeader>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 w-fit mb-2">
                <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>For Drivers & Couriers</CardTitle>
              <CardDescription>
                Earn on your own schedule. Drive or deliver when it works for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">Flexible hours — work when you want</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">Weekly payouts with transparent earnings</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">Bonuses and incentives for top performers</span>
                </li>
              </ul>
              <Link href="/partner/ride/start">
                <Button className="w-full" data-testid="button-driver-signup">
                  Start driving
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="hover-elevate" data-testid="partner-card-restaurants">
            <CardHeader>
              <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 w-fit mb-2">
                <Store className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle>For Restaurants & Shops</CardTitle>
              <CardDescription>
                Reach more customers and grow your business with SafeGo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">Access thousands of hungry customers</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">Easy order management dashboard</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">Real-time analytics and insights</span>
                </li>
              </ul>
              <Link href="/partner/restaurant/start">
                <Button className="w-full" data-testid="button-restaurant-signup">
                  Register your business
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">How It Works</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Simple Steps to Get Started</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Whether you need a ride, food, or want to send a package — it's easy with SafeGo
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {Object.entries(HOW_IT_WORKS).map(([key, flow]) => (
            <Card key={key} className="h-full" data-testid={`how-it-works-${key}`}>
              <CardHeader>
                <CardTitle className="text-lg">{flow.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {flow.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function SafetySection() {
  return (
    <section id="safety" className="py-16 md:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Trust & Safety</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Safety & Security</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Your safety is our top priority at every step
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card data-testid="safety-card-riders">
            <CardHeader>
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30 w-fit mb-2">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">Your Safety Comes First</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>All drivers undergo thorough background checks before joining our platform.</p>
              <p>Real-time GPS tracking lets you share your trip with loved ones.</p>
              <p>24/7 emergency support with one-tap SOS button.</p>
            </CardContent>
          </Card>
          
          <Card data-testid="safety-card-partners">
            <CardHeader>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 w-fit mb-2">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">Safety While You Work</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Verified rider profiles and ratings help you feel secure.</p>
              <p>In-app navigation keeps you on the safest routes.</p>
              <p>Dedicated driver support available around the clock.</p>
            </CardContent>
          </Card>
          
          <Card data-testid="safety-card-privacy">
            <CardHeader>
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 w-fit mb-2">
                <Lock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg">Protecting Your Data</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>End-to-end encryption for all communications.</p>
              <p>Your personal information is never shared without consent.</p>
              <p>GDPR-compliant data handling and privacy controls.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Support</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Frequently Asked Questions</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} data-testid={`faq-item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-16 md:py-24 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">Ready to move with SafeGo?</h2>
        <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
          Join millions of users who trust SafeGo for their daily transportation and delivery needs.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" data-testid="button-download-app">
            Download the app
          </Button>
          <Link href="/partner/ride/start">
            <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-cta-partner">
              Become a partner
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-background border-t py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About us</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Press</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/customer/ride-booking" className="hover:text-foreground transition-colors">Ride</Link></li>
              <li><Link href="/customer/food" className="hover:text-foreground transition-colors">Food</Link></li>
              <li><Link href="/customer/parcel" className="hover:text-foreground transition-colors">Parcel</Link></li>
              <li><Link href="/customer/bd-shops" className="hover:text-foreground transition-colors">Shops</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Partners</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/partner/ride/start" className="hover:text-foreground transition-colors">Drive with us</Link></li>
              <li><Link href="/partner/delivery/start" className="hover:text-foreground transition-colors">Deliver with us</Link></li>
              <li><Link href="/partner/restaurant/start" className="hover:text-foreground transition-colors">Restaurant partners</Link></li>
              <li><Link href="/partner/shop/start" className="hover:text-foreground transition-colors">Shop partners</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              <li><a href="#safety" className="hover:text-foreground transition-colors">Safety</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <Separator className="my-8" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} SafeGo Global. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [selectedRegion, setSelectedRegion] = useState<Region>(() => {
    const stored = localStorage.getItem("safego-region");
    return (stored as Region) || "BD";
  });

  const handleRegionChange = (region: Region) => {
    setSelectedRegion(region);
    localStorage.setItem("safego-region", region);
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="landing-page">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection 
          selectedRegion={selectedRegion} 
          onRegionChange={handleRegionChange} 
        />
        <ServicesSection />
        <PartnerSection />
        <HowItWorksSection />
        <SafetySection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
