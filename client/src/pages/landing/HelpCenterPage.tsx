import { Search, Car, UtensilsCrossed, Package, CreditCard, User, Shield, MessageCircle, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import GlobalFooter from "@/components/landing/GlobalFooter";

const HELP_CATEGORIES = [
  {
    icon: Car,
    title: "Rides",
    description: "Booking, pricing, cancellations",
    topics: [
      { q: "How do I book a ride?", a: "Open the app, enter your destination, choose a ride type, and tap 'Confirm Ride'. You'll be matched with a nearby driver." },
      { q: "How is fare calculated?", a: "Fares are calculated based on distance, time, and demand. You'll see the estimated fare before confirming your ride." },
      { q: "What if I need to cancel?", a: "You can cancel a ride from the app. Free cancellation is available within 2 minutes of booking. After that, a small fee may apply." },
      { q: "How do I contact my driver?", a: "Once matched, you can call or message your driver directly through the app without sharing personal phone numbers." },
    ],
  },
  {
    icon: UtensilsCrossed,
    title: "Food Delivery",
    description: "Orders, refunds, restaurants",
    topics: [
      { q: "How do I place a food order?", a: "Browse restaurants, add items to your cart, and checkout. You can track your order in real-time." },
      { q: "What if my order is wrong?", a: "Report the issue through the app within 24 hours. We'll review and process a refund or credit if applicable." },
      { q: "Can I schedule orders?", a: "Yes, you can schedule orders up to 7 days in advance at participating restaurants." },
      { q: "How do I tip my delivery partner?", a: "You can add a tip during checkout or after delivery through the order details page." },
    ],
  },
  {
    icon: Package,
    title: "Parcel Delivery",
    description: "Shipping, tracking, COD",
    topics: [
      { q: "How do I send a parcel?", a: "Enter pickup and delivery addresses, package details, and confirm. A courier will be assigned to pick up your parcel." },
      { q: "What items can I send?", a: "Most items under 20kg are accepted. Restricted items include hazardous materials, perishables, and illegal goods." },
      { q: "How does COD work?", a: "Select Cash on Delivery at checkout. The recipient pays upon delivery, and funds are transferred to your wallet after confirmation." },
      { q: "Can I track my parcel?", a: "Yes, real-time tracking is available from pickup to delivery through the app." },
    ],
  },
  {
    icon: CreditCard,
    title: "Payments",
    description: "Methods, refunds, wallet",
    topics: [
      { q: "What payment methods are accepted?", a: "We accept credit/debit cards, mobile wallets (bKash, Nagad in BD), and SafeGo Wallet credits." },
      { q: "How do I add a payment method?", a: "Go to Settings > Payment Methods > Add New. Enter your card details or link your mobile wallet." },
      { q: "When will I get my refund?", a: "Refunds are typically processed within 5-7 business days to your original payment method." },
      { q: "How does SafeGo Wallet work?", a: "Add funds to your wallet for quick payments. Wallet balance can be used for all SafeGo services." },
    ],
  },
  {
    icon: User,
    title: "Account",
    description: "Profile, settings, privacy",
    topics: [
      { q: "How do I update my profile?", a: "Go to Settings > Profile to update your name, phone number, email, and profile photo." },
      { q: "How do I change my password?", a: "Go to Settings > Security > Change Password. You'll need to verify your current password first." },
      { q: "How do I delete my account?", a: "Go to Settings > Privacy > Delete Account. Account deletion is permanent and cannot be undone." },
      { q: "Can I have multiple accounts?", a: "No, each phone number can only be registered to one SafeGo account for security reasons." },
    ],
  },
  {
    icon: Shield,
    title: "Safety & Security",
    description: "Emergency, reporting, trust",
    topics: [
      { q: "How do I use the SOS button?", a: "During a ride, tap the shield icon and then 'Emergency SOS'. This alerts emergency services and shares your location." },
      { q: "How do I report a safety concern?", a: "Use the 'Report Issue' option in your trip history or contact our 24/7 safety team through the app." },
      { q: "Are drivers background checked?", a: "Yes, all drivers undergo thorough background checks, identity verification, and vehicle inspections." },
      { q: "How is my data protected?", a: "We use bank-level encryption and never share your personal information with third parties without consent." },
    ],
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = HELP_CATEGORIES.map(category => ({
    ...category,
    topics: category.topics.filter(topic => 
      topic.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.topics.length > 0 || searchQuery === "");

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">SafeGo</span>
              </div>
            </Link>
            <Link href="/">
              <Button variant="ghost">Back to Home</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 lg:py-16 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
              How can we help you?
            </h1>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              Search our help center or browse categories below
            </p>
            <div className="mt-6 relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search for help..."
                className="pl-12 h-12 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-help-search"
              />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {searchQuery === "" ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {HELP_CATEGORIES.map((category) => (
                  <Card key={category.title} className="hover-elevate cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <category.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{category.title}</CardTitle>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                        </div>
                        <ChevronRight className="ml-auto h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Accordion type="single" collapsible className="w-full">
                        {category.topics.slice(0, 2).map((topic, idx) => (
                          <AccordionItem key={idx} value={`item-${idx}`} className="border-b-0">
                            <AccordionTrigger className="text-sm text-left py-2 hover:no-underline">
                              {topic.q}
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-gray-600 dark:text-gray-400">
                              {topic.a}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredCategories.map((category) => (
                  <Card key={category.title}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <category.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <CardTitle>{category.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {category.topics.map((topic, idx) => (
                          <AccordionItem key={idx} value={`item-${idx}`}>
                            <AccordionTrigger className="text-left">
                              {topic.q}
                            </AccordionTrigger>
                            <AccordionContent className="text-gray-600 dark:text-gray-400">
                              {topic.a}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
                {filteredCategories.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">No results found for "{searchQuery}"</p>
                    <Link href="/contact">
                      <Button variant="outline" className="mt-4">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Contact Support
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="py-12 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Still need help?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Our support team is available 24/7 to assist you
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button data-testid="button-contact-support">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="outline" data-testid="button-report-issue">
                  Report an Issue
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
