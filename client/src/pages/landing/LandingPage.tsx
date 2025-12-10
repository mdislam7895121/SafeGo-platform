import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Car, UtensilsCrossed, Package, Store, Ticket, Shield, Lock, MapPin,
  ChevronRight, Check, Users, Clock, Phone, Star, Smartphone,
  CreditCard, Bell, Headphones, Eye, FileCheck, Zap, Navigation,
  UserCheck, ShieldCheck, Database, Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Region = "BD" | "US" | "GLOBAL";

const HERO_SERVICES = [
  { icon: Car, label: "Rides", desc: "Safe & reliable transportation", color: "text-blue-500" },
  { icon: UtensilsCrossed, label: "Food", desc: "Delicious meals delivered fast", color: "text-orange-500" },
  { icon: Package, label: "Parcel", desc: "Send packages anywhere", color: "text-green-500" },
  { icon: Store, label: "Shops", desc: "Shop from local stores", color: "text-purple-500" },
];

const SERVICES = [
  {
    id: "rides",
    title: "Rides",
    description: "Get where you need to go with reliable, verified drivers at your fingertips.",
    icon: Car,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    link: "/ride",
  },
  {
    id: "food",
    title: "Food Delivery",
    description: "Order from your favorite restaurants and get meals delivered hot and fresh.",
    icon: UtensilsCrossed,
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    link: "/food",
  },
  {
    id: "parcel",
    title: "Parcel Delivery",
    description: "Send packages across the city or country with real-time tracking.",
    icon: Package,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-600 dark:text-green-400",
    link: "/parcel",
  },
  {
    id: "shops",
    title: "Local Shops",
    description: "Shop from local stores and get everything delivered to your doorstep.",
    icon: Store,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    link: "/shops",
  },
  {
    id: "tickets",
    title: "Tickets & Travel",
    description: "Book bus tickets and travel services for your next journey.",
    icon: Ticket,
    bgColor: "bg-pink-50 dark:bg-pink-950/30",
    iconColor: "text-pink-600 dark:text-pink-400",
    link: "/tickets",
  },
];

const HOW_IT_WORKS = {
  rides: {
    title: "Rides",
    icon: Car,
    steps: [
      "Enter your pickup and drop-off locations",
      "See fare estimate and choose your ride type",
      "Driver accepts and heads to your location",
      "Track your driver in real-time on the map",
      "Rate your experience and tip if you'd like",
    ],
  },
  food: {
    title: "Food Delivery",
    icon: UtensilsCrossed,
    steps: [
      "Browse restaurants and menus near you",
      "Add items to your cart and customize",
      "Place your order and track preparation",
      "Watch your delivery in real-time",
      "Enjoy your meal and rate the experience",
    ],
  },
  parcel: {
    title: "Parcel Delivery",
    icon: Package,
    steps: [
      "Enter pickup and delivery addresses",
      "Specify package size and weight",
      "Choose delivery speed (Regular/Express)",
      "Track your package in real-time",
      "Recipient confirms with signature",
    ],
  },
};

const SAFETY_SECTIONS = [
  {
    title: "Your safety comes first",
    subtitle: "For customers",
    icon: Shield,
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    points: [
      { icon: UserCheck, text: "All drivers verified with background checks" },
      { icon: Navigation, text: "Real-time GPS tracking on every trip" },
      { icon: Bell, text: "Share trip status with trusted contacts" },
      { icon: Headphones, text: "24/7 emergency support available" },
    ],
  },
  {
    title: "Safety while you work",
    subtitle: "For drivers & couriers",
    icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    points: [
      { icon: Star, text: "Verified rider profiles and ratings" },
      { icon: MapPin, text: "Safe route navigation built-in" },
      { icon: Phone, text: "Dedicated driver support line" },
      { icon: ShieldCheck, text: "Insurance coverage on all trips" },
    ],
  },
  {
    title: "Protecting your data",
    subtitle: "Cybersecurity",
    icon: Lock,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    points: [
      { icon: Database, text: "End-to-end encryption for all data" },
      { icon: Eye, text: "Personal info never shared without consent" },
      { icon: Server, text: "GDPR-compliant data handling" },
      { icon: FileCheck, text: "Regular security audits" },
    ],
  },
];

const FAQS = [
  {
    question: "How do I request a SafeGo ride?",
    answer: "Open the SafeGo app, enter your destination, choose your preferred vehicle type, and tap Request. A nearby driver will accept your ride and arrive at your pickup location within minutes.",
  },
  {
    question: "When is SafeGo launching in Bangladesh?",
    answer: "SafeGo is launching first in Dhaka, Bangladesh. Sign up to be notified when we go live in your area and get early access to exclusive promotions.",
  },
  {
    question: "How do I become a driver or courier?",
    answer: "Visit the 'Become a Partner' section and select your preferred service. Complete the registration form, submit required documents (license, vehicle papers, NID), and start earning once approved.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "SafeGo accepts cash, credit/debit cards, bKash, Nagad, and other popular mobile wallets in Bangladesh. More payment options will be added as we expand.",
  },
  {
    question: "How is my safety ensured?",
    answer: "All drivers undergo thorough background checks and vehicle inspections. Every trip includes real-time GPS tracking, an emergency SOS button, and 24/7 support from our safety team.",
  },
  {
    question: "Can I schedule rides in advance?",
    answer: "Yes! You can schedule rides up to 7 days in advance. Select your date and time when booking, and a driver will be assigned automatically.",
  },
];

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">SafeGo</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/ride" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Ride
            </Link>
            <Link href="/drive" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Drive
            </Link>
            <Link href="/business" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Business
            </Link>
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              About
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-gray-700 dark:text-gray-300" data-testid="button-login">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="rounded-full px-5 bg-blue-600 hover:bg-blue-700" data-testid="button-signup">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function RegionToggle({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region; 
  onRegionChange: (region: Region) => void;
}) {
  const regions: { id: Region; label: string }[] = [
    { id: "BD", label: "Bangladesh" },
    { id: "US", label: "United States" },
    { id: "GLOBAL", label: "Global" },
  ];

  return (
    <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-full">
      {regions.map((region) => (
        <button
          key={region.id}
          onClick={() => onRegionChange(region.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedRegion === region.id
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
          data-testid={`region-tab-${region.id.toLowerCase()}`}
        >
          {region.label}
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
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20 py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-8">
              <RegionToggle selectedRegion={selectedRegion} onRegionChange={onRegionChange} />
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
              Move, eat, and<br />
              deliver with <span className="text-blue-600">SafeGo</span>
            </h1>
            
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto lg:mx-0">
              One platform for rides, food delivery, and parcel delivery — launching first in Bangladesh.
            </p>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#services">
                <Button size="lg" className="w-full sm:w-auto rounded-full px-8 bg-blue-600 hover:bg-blue-700" data-testid="button-explore-services">
                  Explore services
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#partners">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 border-gray-300 dark:border-gray-700" data-testid="button-become-partner">
                  Become a partner
                </Button>
              </a>
            </div>
          </div>
          
          <div className="hidden lg:block">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-xl rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SafeGo Services</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">All-in-one platform</p>
              </div>
              <CardContent className="p-0">
                {HERO_SERVICES.map((service, index) => (
                  <div 
                    key={service.label}
                    className={`flex items-center gap-4 p-4 ${
                      index !== HERO_SERVICES.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 ${service.color}`}>
                      <service.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{service.label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{service.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section id="services" className="py-20 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4">
            Our Services
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">SafeGo Services</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need, all in one app. Choose a service to get started.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {SERVICES.map((service) => (
            <Link key={service.id} href={service.link}>
              <Card 
                className="h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 cursor-pointer group rounded-xl" 
                data-testid={`service-card-${service.id}`}
              >
                <CardContent className="p-6 text-center">
                  <div className={`inline-flex p-4 rounded-2xl ${service.bgColor} mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <service.icon className={`h-7 w-7 ${service.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{service.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
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
    <section id="partners" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4">
            Join Us
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Become a Partner</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Turn your time or business into earnings with SafeGo
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden" data-testid="partner-card-drivers">
            <CardContent className="p-8">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 w-fit mb-6">
                <Car className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">For Drivers & Couriers</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Earn on your own schedule. Drive or deliver when it works for you.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Flexible hours — work when you want</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Weekly payouts with transparent earnings</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Clear commission structure, no surprises</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Bonuses and incentives for top performers</span>
                </li>
              </ul>
              <Link href="/driver/signup">
                <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700" data-testid="button-driver-signup">
                  Start driving
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden" data-testid="partner-card-restaurants">
            <CardContent className="p-8">
              <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 w-fit mb-6">
                <Store className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">For Restaurants & Shops</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Reach more customers and grow your business with SafeGo.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Access thousands of hungry customers</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Easy-to-use order management dashboard</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Real-time analytics and business insights</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Marketing support to boost visibility</span>
                </li>
              </ul>
              <Link href="/restaurant/signup">
                <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700" data-testid="button-restaurant-signup">
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
    <section id="how-it-works" className="py-20 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">How SafeGo Works</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Simple steps to get started with any of our services
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {Object.entries(HOW_IT_WORKS).map(([key, flow]) => (
            <Card 
              key={key} 
              className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl" 
              data-testid={`how-it-works-${key}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30">
                    <flow.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{flow.title}</h3>
                </div>
                <ol className="space-y-4">
                  {flow.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 pt-0.5">{step}</span>
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
    <section id="safety" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4">
            Trust & Safety
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Safety & Security</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your safety is our top priority at every step
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {SAFETY_SECTIONS.map((section, idx) => (
            <Card 
              key={idx} 
              className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-xl" 
              data-testid={`safety-card-${idx}`}
            >
              <CardContent className="p-6">
                <div className={`p-3 rounded-xl ${section.iconBg} w-fit mb-4`}>
                  <section.icon className={`h-6 w-6 ${section.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{section.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{section.subtitle}</p>
                <ul className="space-y-3">
                  {section.points.map((point, pointIdx) => (
                    <li key={pointIdx} className="flex items-start gap-3">
                      <point.icon className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{point.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4">
            Support
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Got questions? We've got answers.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="border border-gray-200 dark:border-gray-800 rounded-xl px-6 data-[state=open]:bg-gray-50 dark:data-[state=open]:bg-gray-900"
                data-testid={`faq-item-${index}`}
              >
                <AccordionTrigger className="text-left text-gray-900 dark:text-white hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-400 pb-4">
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
    <section className="py-20 bg-blue-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to move with SafeGo?</h2>
        <p className="mt-4 text-blue-100 max-w-xl mx-auto">
          Join thousands of users who trust SafeGo for their daily transportation and delivery needs.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" className="rounded-full px-8" data-testid="button-download-app">
            <Smartphone className="mr-2 h-4 w-4" />
            Download the app
          </Button>
          <a href="#partners">
            <Button size="lg" variant="outline" className="rounded-full px-8 border-white/30 text-white hover:bg-white/10 hover:text-white" data-testid="button-cta-partner">
              Become a partner
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Services</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/ride" className="hover:text-white transition-colors">Ride</Link></li>
              <li><Link href="/food" className="hover:text-white transition-colors">Food</Link></li>
              <li><Link href="/parcel" className="hover:text-white transition-colors">Parcel</Link></li>
              <li><Link href="/shops" className="hover:text-white transition-colors">Shops</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Partners</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/driver/signup" className="hover:text-white transition-colors">Drive with us</Link></li>
              <li><Link href="/driver/signup" className="hover:text-white transition-colors">Deliver with us</Link></li>
              <li><Link href="/restaurant/signup" className="hover:text-white transition-colors">Restaurant partners</Link></li>
              <li><Link href="/business" className="hover:text-white transition-colors">Shop partners</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Support</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><a href="#safety" className="hover:text-white transition-colors">Safety</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-semibold text-white">SafeGo</span>
            </div>
            <p>&copy; {new Date().getFullYear()} SafeGo Global. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [selectedRegion, setSelectedRegion] = useState<Region>("BD");

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
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="landing-page">
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
