import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Mail, Phone, MessageSquare, Building2, Scale, Newspaper, AlertTriangle, HelpCircle, Send, CheckCircle, Store, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLandingSeo } from "@/components/landing/LandingSeo";

type Region = "BD" | "US" | "GLOBAL";

const CONTACT_CATEGORY_CONFIG: Record<Region, { value: string; label: string }[]> = {
  BD: [
    { value: "general", label: "General Inquiry" },
    { value: "rides", label: "Rides & Transportation" },
    { value: "food", label: "Food Delivery" },
    { value: "parcel", label: "Parcel Delivery" },
    { value: "shops", label: "Local Shops" },
    { value: "tickets", label: "Tickets & Travel" },
    { value: "driver", label: "Driver/Courier Support" },
    { value: "partner", label: "Business Partnership" },
    { value: "payment", label: "Payments & Billing" },
    { value: "safety", label: "Safety Concern" },
    { value: "technical", label: "Technical Issue" },
    { value: "other", label: "Other" }
  ],
  US: [
    { value: "general", label: "General Inquiry" },
    { value: "rides", label: "Rides & Transportation" },
    { value: "food", label: "Food Delivery" },
    { value: "parcel", label: "Parcel Delivery" },
    { value: "driver", label: "Driver/Courier Support" },
    { value: "partner", label: "Business Partnership" },
    { value: "payment", label: "Payments & Billing" },
    { value: "safety", label: "Safety Concern" },
    { value: "technical", label: "Technical Issue" },
    { value: "other", label: "Other" }
  ],
  GLOBAL: [
    { value: "general", label: "General Inquiry" },
    { value: "rides", label: "Rides & Transportation" },
    { value: "food", label: "Food Delivery" },
    { value: "parcel", label: "Parcel Delivery" },
    { value: "driver", label: "Driver/Courier Support" },
    { value: "partner", label: "Business Partnership" },
    { value: "payment", label: "Payments & Billing" },
    { value: "safety", label: "Safety Concern" },
    { value: "technical", label: "Technical Issue" },
    { value: "other", label: "Other" }
  ]
};

const CONTACT_CARDS_CONFIG: Record<Region, {
  id: string;
  title: string;
  email: string;
  description: string;
  icon: typeof MessageSquare;
  color: string;
}[]> = {
  BD: [
    {
      id: "support",
      title: "General Support",
      email: "support@safego.com",
      description: "For general inquiries and customer support",
      icon: MessageSquare,
      color: "bg-blue-500"
    },
    {
      id: "drivers",
      title: "Driver & Courier Support",
      email: "drivers@safego.com",
      description: "For driver onboarding and delivery partner support",
      icon: Mail,
      color: "bg-green-500"
    },
    {
      id: "partners",
      title: "Restaurant & Business Partners",
      email: "partners@safego.com",
      description: "For business partnerships and restaurant inquiries",
      icon: Building2,
      color: "bg-purple-500"
    },
    {
      id: "shops",
      title: "Local Shops Support",
      email: "shops@safego.com",
      description: "For local shop onboarding and marketplace support",
      icon: Store,
      color: "bg-cyan-500"
    },
    {
      id: "tickets",
      title: "Tickets & Travel Support",
      email: "travel@safego.com",
      description: "For bus/train tickets and travel bookings",
      icon: Ticket,
      color: "bg-indigo-500"
    },
    {
      id: "press",
      title: "Media & Press",
      email: "press@safego.com",
      description: "For media inquiries and press releases",
      icon: Newspaper,
      color: "bg-orange-500"
    },
    {
      id: "legal",
      title: "Legal & Compliance",
      email: "legal@safego.com",
      description: "For legal matters and compliance inquiries",
      icon: Scale,
      color: "bg-red-500"
    }
  ],
  US: [
    {
      id: "support",
      title: "General Support",
      email: "support@safego.com",
      description: "For general inquiries and customer support",
      icon: MessageSquare,
      color: "bg-blue-500"
    },
    {
      id: "drivers",
      title: "Driver & Courier Support",
      email: "drivers@safego.com",
      description: "For driver onboarding and delivery partner support",
      icon: Mail,
      color: "bg-green-500"
    },
    {
      id: "partners",
      title: "Restaurant & Business Partners",
      email: "partners@safego.com",
      description: "For business partnerships and restaurant inquiries",
      icon: Building2,
      color: "bg-purple-500"
    },
    {
      id: "press",
      title: "Media & Press",
      email: "press@safego.com",
      description: "For media inquiries and press releases",
      icon: Newspaper,
      color: "bg-orange-500"
    },
    {
      id: "legal",
      title: "Legal & Compliance",
      email: "legal@safego.com",
      description: "For legal matters and compliance inquiries",
      icon: Scale,
      color: "bg-red-500"
    }
  ],
  GLOBAL: [
    {
      id: "support",
      title: "General Support",
      email: "support@safego.com",
      description: "For general inquiries and customer support",
      icon: MessageSquare,
      color: "bg-blue-500"
    },
    {
      id: "drivers",
      title: "Driver & Courier Support",
      email: "drivers@safego.com",
      description: "For driver onboarding and delivery partner support",
      icon: Mail,
      color: "bg-green-500"
    },
    {
      id: "partners",
      title: "Restaurant & Business Partners",
      email: "partners@safego.com",
      description: "For business partnerships and restaurant inquiries",
      icon: Building2,
      color: "bg-purple-500"
    },
    {
      id: "press",
      title: "Media & Press",
      email: "press@safego.com",
      description: "For media inquiries and press releases",
      icon: Newspaper,
      color: "bg-orange-500"
    },
    {
      id: "legal",
      title: "Legal & Compliance",
      email: "legal@safego.com",
      description: "For legal matters and compliance inquiries",
      icon: Scale,
      color: "bg-red-500"
    }
  ]
};

function ContactHeader() {
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

function ContactFooter() {
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

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region>("BD");

  useEffect(() => {
    const stored = localStorage.getItem("safego-region");
    if (stored && ["BD", "US", "GLOBAL"].includes(stored)) {
      setSelectedRegion(stored as Region);
    }
  }, []);

  const contactCategories = CONTACT_CATEGORY_CONFIG[selectedRegion];
  const contactCards = CONTACT_CARDS_CONFIG[selectedRegion];

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';

  useLandingSeo({
    title: 'Contact Us | SafeGo',
    description: 'Get in touch with SafeGo. Contact our support team for rides, food delivery, parcel services, partnerships, or general inquiries.',
    keywords: 'contact SafeGo, customer support, help, partnership, driver support',
    canonicalUrl: `${BASE_URL}/contact`,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact' }]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="contact-page">
      <ContactHeader />
      <main className="flex-1">
        <section className="py-16 lg:py-20 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Have questions or need assistance? We're here to help. Reach out to the right team using the options below.
            </p>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Contact Our Teams
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contactCards.map((card) => (
                <Card key={card.id} className="hover-elevate" data-testid={`contact-card-${card.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`${card.color} p-3 rounded-lg`}>
                        <card.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {card.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {card.description}
                        </p>
                        <a
                          href={`mailto:${card.email}`}
                          className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                          data-testid={`email-${card.id}`}
                        >
                          {card.email}
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 lg:py-16 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Send Us a Message
            </h2>

            {submitted ? (
              <Card data-testid="contact-success">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Message Sent Successfully
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Thank you for contacting us. Our team will review your message and get back to you within 24-48 hours.
                  </p>
                  <Button onClick={() => setSubmitted(false)} variant="outline" data-testid="button-send-another">
                    Send Another Message
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 sm:p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="Your full name"
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          required
                          data-testid="input-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          required
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="How can we help you?"
                        rows={5}
                        value={formData.message}
                        onChange={(e) => handleInputChange("message", e.target.value)}
                        required
                        data-testid="input-message"
                      />
                    </div>

                    <Button type="submit" className="w-full" data-testid="button-submit">
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-500 p-3 rounded-lg shrink-0">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Emergency Support
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      For urgent safety concerns during an active trip, please use the SOS button in the SafeGo app. 
                      Our emergency response team is available 24/7 to assist you.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      For life-threatening emergencies, always contact local emergency services first.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Looking for answers to common questions?
              </p>
              <Link href="/help">
                <Button variant="outline" data-testid="button-help-center">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Visit Help Center
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <ContactFooter />
    </div>
  );
}
