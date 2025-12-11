import { 
  Car, UtensilsCrossed, Package, Store, Ticket, Shield, Lock,
  Users, Phone, Star, Bell, Headphones, Eye, FileCheck,
  UserCheck, ShieldCheck, Database, Server, Navigation
} from "lucide-react";

export type Region = "BD" | "US" | "GLOBAL";

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: typeof Car;
  bgColor: string;
  iconColor: string;
  link: string;
  heroColor: string;
}

export const HERO_CONFIG: Record<Region, {
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

export const PARTNER_CONFIG: Record<Region, {
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

export const REGION_SERVICES: Record<Region, ServiceItem[]> = {
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

export const HOW_IT_WORKS_DATA = {
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

export const HOW_IT_WORKS_SERVICES: Record<Region, string[]> = {
  BD: ["rides", "food", "parcel"],
  US: ["rides", "food", "parcel"],
  GLOBAL: ["rides", "food", "parcel"],
};

export const SAFETY_SECTIONS = [
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
      { icon: Navigation, text: "Safe route navigation built-in" },
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

type RegionKey = "bangladesh" | "united_states" | "global";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: "rides" | "food" | "parcel" | "shops" | "tickets" | "account" | "payments" | "safety" | "general";
};

export const FAQ_CONFIG: Record<RegionKey, FaqItem[]> = {
  bangladesh: [
    {
      id: "bd-rides-1",
      question: "How do I request a SafeGo ride in Bangladesh?",
      answer: "Open the SafeGo app, enter your destination, choose from CNG, bike, or car options, and tap Request. A nearby driver will accept your ride and arrive at your pickup location within minutes.",
      category: "rides"
    },
    {
      id: "bd-launch-1",
      question: "When is SafeGo launching in Bangladesh?",
      answer: "SafeGo is launching first in Dhaka, Bangladesh. Sign up to be notified when we go live in your area and get early access to exclusive promotions.",
      category: "general"
    },
    {
      id: "bd-partner-1",
      question: "How do I become a driver or courier in Bangladesh?",
      answer: "Visit the 'Become a Partner' section and select your preferred service. Complete the registration form, submit required documents (license, vehicle papers, NID), and start earning once approved.",
      category: "general"
    },
    {
      id: "bd-payments-1",
      question: "What payment methods are accepted in Bangladesh?",
      answer: "SafeGo accepts cash, bKash, Nagad, Rocket, and credit/debit cards. More payment options will be added as we expand across the country.",
      category: "payments"
    },
    {
      id: "bd-shops-1",
      question: "How does the Local Shops service work?",
      answer: "Browse nearby grocery stores, pharmacies, and retail shops in the app. Add items to your cart, checkout, and a SafeGo delivery partner will pick up and deliver your order to your doorstep.",
      category: "shops"
    },
    {
      id: "bd-tickets-1",
      question: "Can I book bus or train tickets through SafeGo?",
      answer: "Yes! Our Tickets & Travel feature lets you book inter-city bus tickets, train reservations, and launch (boat) tickets across Bangladesh, all from one app.",
      category: "tickets"
    },
    {
      id: "bd-safety-1",
      question: "How is my safety ensured?",
      answer: "All drivers undergo thorough background checks and vehicle inspections. Every trip includes real-time GPS tracking, an emergency SOS button, and 24/7 support from our safety team.",
      category: "safety"
    },
    {
      id: "bd-schedule-1",
      question: "Can I schedule rides in advance?",
      answer: "Yes! You can schedule rides up to 7 days in advance. Select your date and time when booking, and a driver will be assigned automatically.",
      category: "rides"
    }
  ],
  united_states: [
    {
      id: "us-rides-1",
      question: "How do I request a SafeGo ride?",
      answer: "Open the SafeGo app, enter your destination, choose your preferred vehicle type (Economy, Comfort, or XL), and tap Request. A nearby driver will accept your ride and arrive within minutes.",
      category: "rides"
    },
    {
      id: "us-launch-1",
      question: "Where is SafeGo available in the United States?",
      answer: "SafeGo is currently expanding across major US cities. Sign up to be notified when we launch in your area and receive exclusive promotional offers.",
      category: "general"
    },
    {
      id: "us-partner-1",
      question: "How do I become a SafeGo driver?",
      answer: "Visit the 'Become a Partner' section and complete the application. You'll need a valid driver's license, vehicle registration, insurance, and pass a background check.",
      category: "general"
    },
    {
      id: "us-payments-1",
      question: "What payment methods are accepted?",
      answer: "SafeGo accepts all major credit and debit cards, Apple Pay, Google Pay, PayPal, and SafeGo Wallet credits. Cash is not available in the US market.",
      category: "payments"
    },
    {
      id: "us-food-1",
      question: "How does food delivery work?",
      answer: "Browse restaurants in your area, select your items, and checkout. Track your order in real-time as a SafeGo courier picks up and delivers your meal.",
      category: "food"
    },
    {
      id: "us-safety-1",
      question: "How is my safety ensured?",
      answer: "All drivers undergo comprehensive background checks including DMV and criminal history. Every trip includes real-time GPS tracking, trip sharing, an emergency SOS button, and 24/7 support.",
      category: "safety"
    },
    {
      id: "us-schedule-1",
      question: "Can I schedule rides in advance?",
      answer: "Yes! You can schedule rides up to 7 days in advance. Select your date and time when booking, and a driver will be assigned automatically.",
      category: "rides"
    },
    {
      id: "us-parcel-1",
      question: "How do I send a package?",
      answer: "Select 'Parcel' in the app, enter pickup and delivery addresses, choose package size, and confirm. A courier will pick up your package and deliver it same-day or scheduled.",
      category: "parcel"
    }
  ],
  global: [
    {
      id: "gl-rides-1",
      question: "How do I request a SafeGo ride?",
      answer: "Open the SafeGo app, enter your destination, choose your preferred vehicle type, and tap Request. A nearby driver will accept your ride and arrive at your pickup location within minutes.",
      category: "rides"
    },
    {
      id: "gl-launch-1",
      question: "Where is SafeGo available?",
      answer: "SafeGo is currently available in Bangladesh and expanding to the United States. Sign up to be notified when we launch in your region and get early access to exclusive promotions.",
      category: "general"
    },
    {
      id: "gl-partner-1",
      question: "How do I become a driver or courier?",
      answer: "Visit the 'Become a Partner' section and select your preferred service. Complete the registration form, submit required documents, and start earning once approved.",
      category: "general"
    },
    {
      id: "gl-payments-1",
      question: "What payment methods are accepted?",
      answer: "SafeGo accepts various payment methods depending on your region, including cash, credit/debit cards, and popular mobile wallets. Check the app for available options in your area.",
      category: "payments"
    },
    {
      id: "gl-food-1",
      question: "How does food delivery work?",
      answer: "Browse restaurants in your area, select your items, and checkout. Track your order in real-time as a SafeGo courier picks up and delivers your meal.",
      category: "food"
    },
    {
      id: "gl-safety-1",
      question: "How is my safety ensured?",
      answer: "All drivers undergo thorough background checks and vehicle inspections. Every trip includes real-time GPS tracking, an emergency SOS button, and 24/7 support from our safety team.",
      category: "safety"
    },
    {
      id: "gl-schedule-1",
      question: "Can I schedule rides in advance?",
      answer: "Yes! You can schedule rides up to 7 days in advance. Select your date and time when booking, and a driver will be assigned automatically.",
      category: "rides"
    },
    {
      id: "gl-parcel-1",
      question: "How do I send a package?",
      answer: "Select 'Parcel' in the app, enter pickup and delivery addresses, choose package size, and confirm. A courier will pick up your package and deliver it to the destination.",
      category: "parcel"
    }
  ]
};

export const REGION_TO_FAQ_KEY: Record<Region, RegionKey> = {
  BD: "bangladesh",
  US: "united_states",
  GLOBAL: "global"
};
