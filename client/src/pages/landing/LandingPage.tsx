/**
 * SafeGo Marketing Landing Page
 * Last Updated: December 2024
 * 
 * Uber-level professional design with region-aware content.
 * This is a visual/UX refactor only - no backend changes.
 * 
 * Region-aware features:
 * - HERO_CONFIG: Controls hero description per region
 * - REGION_SERVICES: Controls which services appear (BD: 5, US: 3, GLOBAL: 3)
 * - PARTNER_CONFIG: Controls partner section text per region
 * - HOW_IT_WORKS_SERVICES: Controls which service flows to show per region
 * 
 * All CTAs use existing public routes only. No secrets exposed.
 */

import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { 
  Car, UtensilsCrossed, Package, Store, Ticket, Shield, Lock, MapPin,
  ChevronRight, Check, Users, Clock, Phone, Star, Smartphone,
  CreditCard, Bell, Headphones, Eye, FileCheck, Zap, Navigation,
  UserCheck, ShieldCheck, Database, Server, Globe, ArrowRight
} from "lucide-react";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Region = "BD" | "US" | "GLOBAL";

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: typeof Car;
  bgColor: string;
  iconColor: string;
  link: string;
  heroColor: string;
}

const HERO_CONFIG: Record<Region, {
  description: string;
}> = {
  BD: {
    description: "One platform for rides, food, parcels, local shops, and tickets. Launching first in Bangladesh.",
  },
  US: {
    description: "Safe, reliable rides and deliveries with strong compliance and driver protection built in.",
  },
  GLOBAL: {
    description: "A secure global mobility platform. Move, eat, and deliver anywhere with SafeGo.",
  },
};

const PARTNER_CONFIG: Record<Region, {
  driverCard: {
    title: string;
    description: string;
    benefits: string[];
    requirements: string[];
  };
  businessCard: {
    title: string;
    description: string;
    benefits: string[];
    requirements: string[];
  };
}> = {
  BD: {
    driverCard: {
      title: "For Drivers & Couriers",
      description: "Earn on your own schedule. Drive or deliver when it works for you.",
      benefits: [
        "Flexible hours — work when you want",
        "Weekly payouts with transparent earnings",
        "Clear commission structure, no surprises",
        "Bonuses and incentives for top performers",
      ],
      requirements: [
        "Valid driving license",
        "Vehicle registration papers",
        "National ID card",
        "Smartphone with internet",
      ],
    },
    businessCard: {
      title: "For Restaurants & Shops",
      description: "Reach more customers and grow your business with SafeGo.",
      benefits: [
        "Access thousands of hungry customers",
        "Easy-to-use order management dashboard",
        "Real-time analytics and business insights",
        "Marketing support to boost visibility",
      ],
      requirements: [
        "Valid trade license",
        "Business registration documents",
        "Bank account for payouts",
        "Menu or product catalog",
      ],
    },
  },
  US: {
    driverCard: {
      title: "For Drivers & Couriers",
      description: "Earn on your own schedule with full transparency and protection.",
      benefits: [
        "Flexible hours — work when you want",
        "Weekly payouts with transparent earnings",
        "Clear commission structure, no surprises",
        "Insurance coverage on all trips",
      ],
      requirements: [
        "Valid US driver's license",
        "Vehicle registration & insurance",
        "Background check clearance",
        "Smartphone with iOS or Android",
      ],
    },
    businessCard: {
      title: "For Restaurants",
      description: "Reach more customers and grow your restaurant with SafeGo.",
      benefits: [
        "Access thousands of hungry customers",
        "Easy-to-use order management dashboard",
        "Real-time analytics and business insights",
        "Dedicated account manager support",
      ],
      requirements: [
        "Valid business license",
        "Food service permit",
        "Bank account for payouts",
        "Digital menu ready",
      ],
    },
  },
  GLOBAL: {
    driverCard: {
      title: "For Drivers & Couriers",
      description: "Join the global SafeGo network and earn on your terms.",
      benefits: [
        "Flexible hours — work when you want",
        "Weekly payouts with transparent earnings",
        "Clear commission structure, no surprises",
        "Bonuses and incentives for top performers",
      ],
      requirements: [
        "Valid local driving license",
        "Vehicle registration papers",
        "Government-issued ID",
        "Smartphone with internet",
      ],
    },
    businessCard: {
      title: "For Restaurants & Shops",
      description: "Expand your reach with SafeGo's global delivery network.",
      benefits: [
        "Access thousands of hungry customers",
        "Easy-to-use order management dashboard",
        "Real-time analytics and business insights",
        "Marketing support to boost visibility",
      ],
      requirements: [
        "Valid business license",
        "Business registration documents",
        "Bank account for payouts",
        "Menu or product catalog",
      ],
    },
  },
};

const REGION_SERVICES: Record<Region, ServiceItem[]> = {
  BD: [
    {
      id: "rides",
      title: "Rides",
      description: "Safe & reliable transportation",
      icon: Car,
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      heroColor: "text-blue-500",
      link: "/ride",
    },
    {
      id: "food",
      title: "Food Delivery",
      description: "Delicious meals delivered fast",
      icon: UtensilsCrossed,
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      heroColor: "text-orange-500",
      link: "/food",
    },
    {
      id: "parcel",
      title: "Parcel Delivery",
      description: "Send packages with tracking",
      icon: Package,
      bgColor: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-600 dark:text-green-400",
      heroColor: "text-green-500",
      link: "/parcel",
    },
    {
      id: "shops",
      title: "Local Shops",
      description: "Groceries, pharmacy & more",
      icon: Store,
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      iconColor: "text-purple-600 dark:text-purple-400",
      heroColor: "text-purple-500",
      link: "/shops",
    },
    {
      id: "tickets",
      title: "Tickets & Travel",
      description: "Bus, train & event tickets",
      icon: Ticket,
      bgColor: "bg-pink-50 dark:bg-pink-950/30",
      iconColor: "text-pink-600 dark:text-pink-400",
      heroColor: "text-pink-500",
      link: "/tickets",
    },
  ],
  US: [
    {
      id: "rides",
      title: "Rides",
      description: "Safe & reliable transportation",
      icon: Car,
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      heroColor: "text-blue-500",
      link: "/ride",
    },
    {
      id: "food",
      title: "Food Delivery",
      description: "Delicious meals delivered fast",
      icon: UtensilsCrossed,
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      heroColor: "text-orange-500",
      link: "/food",
    },
    {
      id: "parcel",
      title: "Parcel Delivery",
      description: "Send packages with tracking",
      icon: Package,
      bgColor: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-600 dark:text-green-400",
      heroColor: "text-green-500",
      link: "/parcel",
    },
  ],
  GLOBAL: [
    {
      id: "rides",
      title: "Rides",
      description: "Safe & reliable transportation",
      icon: Car,
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      heroColor: "text-blue-500",
      link: "/ride",
    },
    {
      id: "food",
      title: "Food Delivery",
      description: "Delicious meals delivered fast",
      icon: UtensilsCrossed,
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      heroColor: "text-orange-500",
      link: "/food",
    },
    {
      id: "parcel",
      title: "Parcel Delivery",
      description: "Send packages with tracking",
      icon: Package,
      bgColor: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-600 dark:text-green-400",
      heroColor: "text-green-500",
      link: "/parcel",
    },
  ],
};

const HOW_IT_WORKS_DATA = {
  rides: {
    id: "rides",
    title: "Rides",
    icon: Car,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    steps: [
      "Enter pickup and drop-off locations",
      "Choose your ride type and see fare",
      "Driver accepts and heads your way",
      "Track your driver on the map",
      "Rate and tip after arrival",
    ],
  },
  food: {
    id: "food",
    title: "Food Delivery",
    icon: UtensilsCrossed,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    steps: [
      "Browse restaurants near you",
      "Add items and customize your order",
      "Place order and track preparation",
      "Watch your delivery in real-time",
      "Enjoy your meal and rate",
    ],
  },
  parcel: {
    id: "parcel",
    title: "Parcel Delivery",
    icon: Package,
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    steps: [
      "Enter pickup and delivery address",
      "Specify package size and weight",
      "Choose Regular or Express speed",
      "Track package in real-time",
      "Recipient confirms delivery",
    ],
  },
};

const HOW_IT_WORKS_SERVICES: Record<Region, string[]> = {
  BD: ["rides", "food", "parcel"],
  US: ["rides", "food", "parcel"],
  GLOBAL: ["rides", "food", "parcel"],
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
      { icon: FileCheck, text: "Regular third-party security audits" },
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

const LandingHeader = memo(function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">SafeGo</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/ride" className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
              Ride
            </Link>
            <Link href="/drive" className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
              Drive
            </Link>
            <Link href="/business" className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
              Business
            </Link>
            <a href="#safety" className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
              Safety
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" data-testid="button-login">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="rounded-full px-5 bg-blue-600 hover:bg-blue-700 shadow-sm" data-testid="button-signup">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
});

const RegionToggle = memo(function RegionToggle({ 
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
    <div 
      className="inline-flex items-center p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full shadow-sm"
      role="tablist"
      aria-label="Select region"
    >
      {regions.map((region) => (
        <button
          key={region.id}
          role="tab"
          aria-selected={selectedRegion === region.id}
          aria-controls={`region-content-${region.id}`}
          onClick={() => onRegionChange(region.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            selectedRegion === region.id
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          data-testid={`region-tab-${region.id.toLowerCase()}`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
});

const HeroSection = memo(function HeroSection({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region;
  onRegionChange: (region: Region) => void;
}) {
  const services = REGION_SERVICES[selectedRegion];
  const heroConfig = HERO_CONFIG[selectedRegion];
  
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30 py-16 lg:py-24">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl opacity-50" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-8">
              <RegionToggle selectedRegion={selectedRegion} onRegionChange={onRegionChange} />
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-[1.1] tracking-tight">
              Move, eat, and<br />
              deliver with <span className="text-blue-600">SafeGo</span>
            </h1>
            
            <p 
              className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-lg mx-auto lg:mx-0 leading-relaxed transition-opacity duration-300"
              id={`region-content-${selectedRegion}`}
            >
              {heroConfig.description}
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#services">
                <Button size="lg" className="w-full sm:w-auto rounded-full px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200" data-testid="button-explore-services">
                  Explore services
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#partners">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200" data-testid="button-become-partner">
                  Become a partner
                </Button>
              </a>
            </div>
          </div>
          
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
              <Card className="relative bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-600 shadow-sm">
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SafeGo Services</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">All-in-one platform</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  {services.map((service, index) => (
                    <Link 
                      key={service.id}
                      href={service.link}
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group ${
                        index !== services.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                      }`}
                      data-testid={`hero-service-${service.id}`}
                    >
                      <div className={`p-3 rounded-xl ${service.bgColor} group-hover:scale-105 transition-transform duration-200`}>
                        <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{service.title}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{service.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        <div className="lg:hidden mt-12">
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SafeGo Services</h3>
            </div>
            <CardContent className="p-0">
              {services.map((service, index) => (
                <Link 
                  key={service.id}
                  href={service.link}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    index !== services.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                  }`}
                  data-testid={`hero-service-mobile-${service.id}`}
                >
                  <div className={`p-2.5 rounded-xl ${service.bgColor}`}>
                    <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{service.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{service.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
});

const ServicesSection = memo(function ServicesSection({ selectedRegion }: { selectedRegion: Region }) {
  const services = REGION_SERVICES[selectedRegion];
  
  return (
    <section id="services" className="py-20 lg:py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Our Services
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Everything in one app
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose a service to get started with SafeGo
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {services.map((service) => (
            <Link key={service.id} href={service.link}>
              <Card 
                className="h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group rounded-2xl" 
                data-testid={`service-card-${service.id}`}
              >
                <CardContent className="p-8 text-center">
                  <div className={`inline-flex p-5 rounded-2xl ${service.bgColor} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <service.icon className={`h-8 w-8 ${service.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{service.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
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
});

const PartnerSection = memo(function PartnerSection({ selectedRegion }: { selectedRegion: Region }) {
  const config = PARTNER_CONFIG[selectedRegion];
  
  return (
    <section id="partners" className="py-20 lg:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Join Us
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Become a Partner
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Turn your time or business into earnings with SafeGo
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl transition-all duration-300" data-testid="partner-card-drivers">
            <CardContent className="p-8">
              <div className="p-3.5 rounded-2xl bg-blue-100 dark:bg-blue-900/30 w-fit mb-6">
                <Car className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{config.driverCard.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {config.driverCard.description}
              </p>
              
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">What you get</h4>
                <ul className="space-y-3">
                  {config.driverCard.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Basic requirements</h4>
                <ul className="space-y-2">
                  {config.driverCard.requirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Link href="/driver/signup">
                <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all duration-200" data-testid="button-driver-signup">
                  Start driving
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-xl transition-all duration-300" data-testid="partner-card-restaurants">
            <CardContent className="p-8">
              <div className="p-3.5 rounded-2xl bg-orange-100 dark:bg-orange-900/30 w-fit mb-6">
                <Store className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{config.businessCard.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {config.businessCard.description}
              </p>
              
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">What you get</h4>
                <ul className="space-y-3">
                  {config.businessCard.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Basic requirements</h4>
                <ul className="space-y-2">
                  {config.businessCard.requirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Link href="/restaurant/signup">
                <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all duration-200" data-testid="button-restaurant-signup">
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
});

const HowItWorksSection = memo(function HowItWorksSection({ selectedRegion }: { selectedRegion: Region }) {
  const availableServices = HOW_IT_WORKS_SERVICES[selectedRegion];
  const flows = availableServices
    .map(id => HOW_IT_WORKS_DATA[id as keyof typeof HOW_IT_WORKS_DATA])
    .filter(Boolean);
  
  return (
    <section id="how-it-works" className="py-20 lg:py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Simple steps to get started
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Getting a ride, ordering food, or sending a parcel takes just minutes
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {flows.map((flow) => (
            <Card 
              key={flow.id} 
              className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl hover:shadow-lg transition-shadow duration-300" 
              data-testid={`how-it-works-${flow.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-xl ${flow.iconBg}`}>
                    <flow.icon className={`h-5 w-5 ${flow.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{flow.title}</h3>
                </div>
                <ol className="space-y-4">
                  {flow.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shadow-sm">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 pt-0.5 leading-relaxed">{step}</span>
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
});

const SafetySection = memo(function SafetySection() {
  return (
    <section id="safety" className="py-20 lg:py-24 bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/30 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-100 dark:bg-green-900/20 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-30" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Trust & Safety
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Safety & Security
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your safety and privacy are our top priority at every step
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {SAFETY_SECTIONS.map((section, idx) => (
            <Card 
              key={idx} 
              className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300" 
              data-testid={`safety-card-${idx}`}
            >
              <CardContent className="p-6">
                <div className={`p-3.5 rounded-2xl ${section.iconBg} w-fit mb-5`}>
                  <section.icon className={`h-6 w-6 ${section.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{section.title}</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-5">{section.subtitle}</p>
                <ul className="space-y-3">
                  {section.points.map((point, pointIdx) => (
                    <li key={pointIdx} className="flex items-start gap-3">
                      <div className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 mt-0.5 flex-shrink-0">
                        <point.icon className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{point.text}</span>
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
});

const FAQSection = memo(function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Support
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Got questions? We've got answers.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="border border-gray-200 dark:border-gray-800 rounded-xl px-6 data-[state=open]:bg-gray-50 dark:data-[state=open]:bg-gray-900 data-[state=open]:border-blue-200 dark:data-[state=open]:border-blue-800 transition-colors duration-200"
                data-testid={`faq-item-${index}`}
              >
                <AccordionTrigger className="text-left text-gray-900 dark:text-white hover:no-underline py-5 text-base font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-400 pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
});

const CTASection = memo(function CTASection() {
  return (
    <section className="py-20 lg:py-24 bg-blue-600 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-700 rounded-full blur-3xl opacity-50" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">Ready to move with SafeGo?</h2>
        <p className="mt-4 text-lg text-blue-100 max-w-xl mx-auto">
          Join thousands of users who trust SafeGo for their daily rides and deliveries.
        </p>
        
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" className="rounded-full px-8 shadow-lg" data-testid="button-download-app">
            <Smartphone className="mr-2 h-4 w-4" />
            Download the app
          </Button>
          <a href="#partners">
            <Button size="lg" variant="outline" className="rounded-full px-8 border-white/30 text-white hover:bg-white/10 hover:text-white backdrop-blur-sm" data-testid="button-cta-partner">
              Become a partner
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
});

const LandingFooter = memo(function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Services</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/ride" className="hover:text-white transition-colors">Ride</Link></li>
              <li><Link href="/food" className="hover:text-white transition-colors">Food</Link></li>
              <li><Link href="/parcel" className="hover:text-white transition-colors">Parcel</Link></li>
              <li><Link href="/shops" className="hover:text-white transition-colors">Shops</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Partners</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/driver/signup" className="hover:text-white transition-colors">Drive with us</Link></li>
              <li><Link href="/driver/signup" className="hover:text-white transition-colors">Deliver with us</Link></li>
              <li><Link href="/restaurant/signup" className="hover:text-white transition-colors">Restaurant partners</Link></li>
              <li><Link href="/business" className="hover:text-white transition-colors">Shop partners</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Support</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><a href="#safety" className="hover:text-white transition-colors">Safety</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-semibold text-white">SafeGo</span>
            </div>
            <p className="text-gray-500">&copy; {new Date().getFullYear()} SafeGo Global. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-center text-xs text-gray-500">
              SafeGo services are in testing mode. Some features are disabled or simulated. Public launch will include full KYC, payment, safety, and legal compliance systems.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
});

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

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';

  useLandingSeo({
    title: `SafeGo - Ride, Deliver, Connect | ${selectedRegion === 'BD' ? 'Bangladesh' : selectedRegion === 'US' ? 'USA' : 'Global'}`,
    description: HERO_CONFIG[selectedRegion].description,
    keywords: 'ride-hailing, food delivery, parcel delivery, super app, SafeGo',
    canonicalUrl: `${BASE_URL}/`,
    region: selectedRegion === 'GLOBAL' ? 'global' : selectedRegion,
    breadcrumbs: [{ name: 'Home', url: '/' }]
  });

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="landing-page">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection 
          selectedRegion={selectedRegion} 
          onRegionChange={handleRegionChange} 
        />
        <ServicesSection selectedRegion={selectedRegion} />
        <PartnerSection selectedRegion={selectedRegion} />
        <HowItWorksSection selectedRegion={selectedRegion} />
        <SafetySection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
