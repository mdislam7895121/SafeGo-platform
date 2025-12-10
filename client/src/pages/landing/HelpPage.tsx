import { useState } from "react";
import { Link } from "wouter";
import { 
  ChevronLeft, Car, UtensilsCrossed, Package, User, CreditCard, Shield, 
  Building2, Smartphone, Search, ChevronDown, ChevronUp, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLandingSeo } from "@/components/landing/LandingSeo";

function HelpHeader() {
  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">SafeGo</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function HelpFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
      </div>
    </footer>
  );
}

const HELP_CATEGORIES = [
  { id: "rides", title: "Rides", icon: Car, color: "bg-blue-500", description: "Booking, fares, and ride issues" },
  { id: "food", title: "Food Delivery", icon: UtensilsCrossed, color: "bg-orange-500", description: "Orders, restaurants, and delivery" },
  { id: "parcel", title: "Parcel Delivery", icon: Package, color: "bg-green-500", description: "Sending and receiving packages" },
  { id: "account", title: "Account & Login", icon: User, color: "bg-purple-500", description: "Profile, verification, and access" },
  { id: "payments", title: "Payments", icon: CreditCard, color: "bg-pink-500", description: "Billing, refunds, and wallets" },
  { id: "safety", title: "Safety", icon: Shield, color: "bg-red-500", description: "Security, SOS, and reporting" },
  { id: "partners", title: "Partners", icon: Building2, color: "bg-teal-500", description: "Drivers, restaurants, and businesses" },
  { id: "technical", title: "App & Technical", icon: Smartphone, color: "bg-gray-500", description: "App issues and troubleshooting" }
];

const FAQ_DATA: Record<string, { question: string; answer: string }[]> = {
  rides: [
    { question: "How do I book a ride?", answer: "Open the SafeGo app, enter your pickup and drop-off locations, select your preferred vehicle type, and tap 'Book Ride'. You'll be matched with a nearby driver within moments." },
    { question: "How is the fare calculated?", answer: "Fares are calculated based on distance, estimated time, current demand (surge pricing), and vehicle type. You'll always see the estimated fare before confirming your booking." },
    { question: "Can I schedule a ride in advance?", answer: "Yes, you can schedule rides up to 7 days in advance. Select 'Schedule' when booking and choose your preferred pickup date and time." },
    { question: "What if my driver cancels?", answer: "If your driver cancels, we'll automatically try to match you with another nearby driver. You won't be charged any cancellation fees when the driver cancels." },
    { question: "How do I rate my driver?", answer: "After completing your trip, you'll be prompted to rate your driver from 1-5 stars. You can also add comments and tips if you'd like." }
  ],
  food: [
    { question: "How do I place a food order?", answer: "Browse restaurants in your area, add items to your cart, review your order, and proceed to checkout. Your food will be prepared and delivered to your location." },
    { question: "Can I track my food delivery?", answer: "Yes, you can track your order in real-time from the moment the restaurant accepts it until it arrives at your door." },
    { question: "What if my order is wrong or missing items?", answer: "Contact support through the app within 24 hours of delivery. We'll work with the restaurant to resolve the issue and may offer a refund or credit." },
    { question: "How do I apply a promo code?", answer: "During checkout, tap 'Add Promo Code' and enter your code. The discount will be applied to your order total if valid." },
    { question: "Can I leave special instructions?", answer: "Yes, you can add special instructions for both the restaurant (dietary requirements, preferences) and the delivery driver (building access, etc.)." }
  ],
  parcel: [
    { question: "How do I send a parcel?", answer: "Select 'Parcel' in the app, enter pickup and delivery addresses, specify package size and contents, and confirm. A courier will be assigned to pick up your package." },
    { question: "What items can I send?", answer: "You can send documents, packages, and goods that comply with our terms. Prohibited items include hazardous materials, illegal goods, and perishables without proper packaging." },
    { question: "How is parcel pricing determined?", answer: "Pricing depends on distance, package size/weight, delivery speed (standard or express), and any special handling requirements." },
    { question: "Can the recipient pay for delivery?", answer: "Yes, we offer Cash on Delivery (COD) options in select regions. The recipient can pay the delivery fee when receiving the package." },
    { question: "How do I track my parcel?", answer: "You'll receive real-time tracking updates and notifications throughout the delivery process. Both sender and recipient can track the parcel." }
  ],
  account: [
    { question: "How do I create an account?", answer: "Download the SafeGo app, enter your phone number, verify with OTP, and complete your profile with name and email. That's it!" },
    { question: "I forgot my password. What do I do?", answer: "Tap 'Forgot Password' on the login screen and follow the instructions to reset via email or phone verification." },
    { question: "How do I update my profile information?", answer: "Go to your profile settings in the app. You can update your name, email, phone number, and profile photo at any time." },
    { question: "How do I verify my identity?", answer: "For certain features, you may need to complete KYC verification. Go to Settings > Verification and follow the steps to submit your ID and selfie." },
    { question: "Can I delete my account?", answer: "Yes, you can request account deletion from Settings > Privacy > Delete Account. This action is permanent and will remove all your data after a 72-hour grace period." }
  ],
  payments: [
    { question: "What payment methods are accepted?", answer: "We accept credit/debit cards, mobile wallets (bKash, Nagad in Bangladesh), and SafeGo Wallet. Payment options vary by region." },
    { question: "How do I add a payment method?", answer: "Go to Settings > Payment Methods > Add New and follow the prompts to securely add your card or link your mobile wallet." },
    { question: "How do I request a refund?", answer: "For eligible transactions, go to your trip/order history, select the item, and tap 'Request Refund'. Our team will review and process within 3-5 business days." },
    { question: "What is SafeGo Wallet?", answer: "SafeGo Wallet is our in-app payment system. You can top up your wallet and use the balance for rides, food orders, and parcel deliveries." },
    { question: "Why was I charged twice?", answer: "Duplicate charges are usually temporary holds that will be released within 3-7 business days. If the charge persists, contact support with your transaction details." }
  ],
  safety: [
    { question: "How do I use the SOS feature?", answer: "During an active trip, tap the shield icon and then 'Emergency SOS'. This will alert our safety team and share your live location with your emergency contacts." },
    { question: "How do I share my trip with someone?", answer: "During a ride, tap 'Share Trip' to send your live location and trip details to friends or family via SMS or messaging apps." },
    { question: "How do I report a safety concern?", answer: "Go to your trip history, select the relevant trip, and tap 'Report Safety Issue'. You can also contact support directly for immediate assistance." },
    { question: "What safety features are available?", answer: "SafeGo includes trip sharing, SOS alerts, driver verification, trip recording, 24/7 support, and real-time GPS tracking for all services." },
    { question: "How are drivers verified?", answer: "All drivers undergo background checks, license verification, and vehicle inspection before being approved on the platform. We continuously monitor driver performance and ratings." }
  ],
  partners: [
    { question: "How do I become a SafeGo driver?", answer: "Sign up on our driver portal or app, submit required documents (license, vehicle registration, insurance), complete the background check, and attend orientation." },
    { question: "How do restaurant partners join?", answer: "Restaurants can apply through our business portal. We'll review your application, set up your menu, and provide training on our platform." },
    { question: "When and how do partners get paid?", answer: "Partners receive weekly payouts via bank transfer. You can view your earnings and payout history in the partner dashboard." },
    { question: "What commission does SafeGo charge?", answer: "Commission rates vary by service type and region. Partners can view their specific rates in their agreement and dashboard." },
    { question: "How do I update my partner account?", answer: "Log into your partner dashboard to update business information, banking details, operating hours, and menu items." }
  ],
  technical: [
    { question: "The app isn't loading. What should I do?", answer: "Try closing and reopening the app, checking your internet connection, or restarting your device. If issues persist, try reinstalling the app." },
    { question: "GPS isn't working correctly", answer: "Ensure location services are enabled for SafeGo, move to an area with better GPS signal, and check that your device's location settings are set to 'High Accuracy'." },
    { question: "I'm not receiving notifications", answer: "Check that notifications are enabled for SafeGo in your device settings. Also verify that Do Not Disturb mode is off and battery optimization isn't blocking the app." },
    { question: "How do I update the app?", answer: "Visit your device's app store (Play Store or App Store), search for SafeGo, and tap 'Update' if available. Enable auto-updates for the latest features." },
    { question: "The app is slow or crashing", answer: "Try clearing the app cache, ensuring you have enough storage space, and updating to the latest version. If problems continue, contact our technical support team." }
  ]
};

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 px-4 -mx-4 transition-colors"
        data-testid={`faq-toggle-${question.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
      >
        <span className="font-medium text-gray-900 dark:text-white pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-600 dark:text-gray-400">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';

  useLandingSeo({
    title: 'Help Center | SafeGo',
    description: 'Find answers to your questions about SafeGo rides, food delivery, parcel services, payments, and more. Browse FAQs or contact support.',
    keywords: 'help center, FAQ, support, SafeGo help, customer service, questions',
    canonicalUrl: `${BASE_URL}/help`,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Help Center', url: '/help' }]
  });

  const filteredFAQs = selectedCategory ? FAQ_DATA[selectedCategory] : [];

  const allFAQs = Object.entries(FAQ_DATA).flatMap(([category, faqs]) =>
    faqs.map(faq => ({ ...faq, category }))
  );

  const searchResults = searchQuery.length > 2
    ? allFAQs.filter(
        faq =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="help-page">
      <HelpHeader />
      <main className="flex-1">
        <section className="py-16 lg:py-20 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Help Center
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
              Find answers to common questions or browse topics below
            </p>
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for help..."
                className="pl-12 h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </section>

        {searchQuery.length > 2 && (
          <section className="py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Search Results ({searchResults.length})
              </h2>
              {searchResults.length > 0 ? (
                <Card>
                  <CardContent className="p-6">
                    {searchResults.map((faq, index) => (
                      <FAQItem key={index} question={faq.question} answer={faq.answer} />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  No results found for "{searchQuery}". Try different keywords or browse categories below.
                </p>
              )}
            </div>
          </section>
        )}

        {!searchQuery && (
          <>
            <section className="py-12 lg:py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
                  Browse by Category
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {HELP_CATEGORIES.map((category) => (
                    <Card
                      key={category.id}
                      className={`cursor-pointer hover-elevate transition-all ${
                        selectedCategory === category.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedCategory(
                        selectedCategory === category.id ? null : category.id
                      )}
                      data-testid={`category-${category.id}`}
                    >
                      <CardContent className="p-4 text-center">
                        <div className={`${category.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3`}>
                          <category.icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {category.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {category.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </section>

            {selectedCategory && (
              <section className="py-12 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {HELP_CATEGORIES.find(c => c.id === selectedCategory)?.title} FAQs
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      data-testid="button-clear-category"
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="p-6">
                      {filteredFAQs.map((faq, index) => (
                        <FAQItem key={index} question={faq.question} answer={faq.answer} />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}
          </>
        )}

        <section className="py-12 lg:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Still Need Help?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Can't find what you're looking for? Our support team is here to assist you.
            </p>
            <Link href="/contact">
              <Button data-testid="button-contact-us">
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <HelpFooter />
    </div>
  );
}
