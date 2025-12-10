import { FileText, Car, Store, Ticket, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlobalFooter from "@/components/landing/GlobalFooter";

const LAST_UPDATED = "December 1, 2024";

export default function PartnerTermsPage() {
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

      <main className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Partner Terms & Agreements
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {LAST_UPDATED}
                </p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Review the terms and conditions for each partner type on the SafeGo platform.
            </p>
          </div>

          <Tabs defaultValue="drivers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="drivers" className="gap-2" data-testid="tab-driver-terms">
                <Car className="h-4 w-4" />
                <span className="hidden sm:inline">Drivers</span>
              </TabsTrigger>
              <TabsTrigger value="shops" className="gap-2" data-testid="tab-shop-terms">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Shops</span>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-2" data-testid="tab-ticket-terms">
                <Ticket className="h-4 w-4" />
                <span className="hidden sm:inline">Tickets</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="drivers">
              <Card>
                <CardHeader>
                  <CardTitle>Driver & Courier Partner Agreement</CardTitle>
                  <CardDescription>
                    Terms for ride-hailing drivers and delivery couriers
                  </CardDescription>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                  <h3>1. Partner Eligibility</h3>
                  <p>
                    To become a SafeGo driver or courier partner, you must: be at least 21 years of age (25 for ride-hailing in certain regions), hold a valid driver's license appropriate for your vehicle type, have access to a registered and insured vehicle, pass our background verification process, and maintain a smartphone capable of running the SafeGo Driver app.
                  </p>

                  <h3>2. Service Standards</h3>
                  <p>
                    Partners agree to: maintain professional conduct at all times, complete trips/deliveries in a timely manner, follow all applicable traffic laws, keep vehicles clean and well-maintained, and respond to customer inquiries professionally.
                  </p>

                  <h3>3. Commission Structure</h3>
                  <p>
                    SafeGo charges a service commission on each completed trip or delivery. Standard commission rates are 15-25% depending on service type and region. Partners receive weekly payouts for all completed earnings minus applicable commissions and fees.
                  </p>

                  <h3>4. Insurance & Safety</h3>
                  <p>
                    All active trips are covered by SafeGo's insurance policy. Partners are responsible for maintaining their own vehicle insurance as required by local law. Safety training modules must be completed before activation.
                  </p>

                  <h3>5. Deactivation Policy</h3>
                  <p>
                    SafeGo reserves the right to deactivate partners for: consistently low ratings, safety violations, fraudulent activity, violation of community guidelines, or failure to complete required verification updates.
                  </p>

                  <div className="not-prose mt-6">
                    <Link href="/driver/signup">
                      <Button>
                        Apply as Driver/Courier
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shops">
              <Card>
                <CardHeader>
                  <CardTitle>Shop Partner Agreement</CardTitle>
                  <CardDescription>
                    Terms for retail and grocery store partners (Bangladesh only)
                  </CardDescription>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                  <h3>1. Partner Eligibility</h3>
                  <p>
                    Shop partners must: hold a valid trade license, have a registered business entity, maintain a physical store location, have the capability to fulfill orders within promised timeframes, and provide accurate product listings and pricing.
                  </p>

                  <h3>2. Product Standards</h3>
                  <p>
                    Partners agree to: maintain accurate inventory, ensure product quality and freshness, package items appropriately for delivery, honor all listed prices and promotions, and comply with all applicable health and safety regulations.
                  </p>

                  <h3>3. Commission & Payments</h3>
                  <p>
                    Standard commission is 10-20% based on category and partnership tier. Payments are processed weekly. COD orders are settled within 2-3 business days after delivery confirmation.
                  </p>

                  <h3>4. Order Fulfillment</h3>
                  <p>
                    Partners must: confirm or reject orders within 10 minutes, prepare orders for pickup within the promised timeframe, communicate any substitutions or issues promptly, and maintain a minimum order acceptance rate of 85%.
                  </p>

                  <h3>5. Listing Guidelines</h3>
                  <p>
                    All product listings must include: accurate descriptions, clear images, correct pricing (including any applicable taxes), and availability status. Prohibited items include: alcohol, tobacco, weapons, and other regulated goods.
                  </p>

                  <div className="not-prose mt-6">
                    <Link href="/partner/shop">
                      <Button>
                        Apply as Shop Partner
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Partner Agreement</CardTitle>
                  <CardDescription>
                    Terms for bus, train, and event ticket operators (Bangladesh only)
                  </CardDescription>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                  <h3>1. Partner Eligibility</h3>
                  <p>
                    Ticket partners must: be licensed operators or authorized ticket agents, have valid business registration, maintain accurate schedule and availability information, and provide valid tickets/confirmations for all bookings.
                  </p>

                  <h3>2. Service Requirements</h3>
                  <p>
                    Partners agree to: maintain accurate and up-to-date schedules, honor all confirmed bookings, provide clear cancellation and refund policies, communicate any service changes promptly, and ensure passenger safety on all services.
                  </p>

                  <h3>3. Commission Structure</h3>
                  <p>
                    Commission rates vary by service type: Bus tickets 5-8%, Train tickets 3-5%, Event tickets 8-15%. Partners receive settlements weekly for all confirmed bookings minus commissions.
                  </p>

                  <h3>4. Booking Management</h3>
                  <p>
                    Partners must: confirm bookings in real-time, provide valid ticket/boarding information, handle customer inquiries for their services, and process cancellations and refunds according to stated policies.
                  </p>

                  <h3>5. Compliance</h3>
                  <p>
                    All ticket partners must comply with: Bangladesh Road Transport Authority regulations (for buses), Bangladesh Railway requirements (for trains), and local event licensing requirements (for events).
                  </p>

                  <div className="not-prose mt-6">
                    <Link href="/partner/ticket">
                      <Button>
                        Apply as Ticket Partner
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="mt-8">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <FileText className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    General Terms
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    All partner agreements are governed by the laws of the operating region. By signing up as a partner, you agree to these terms and our general <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    For questions about partner terms, contact: <a href="mailto:partners@safego.app" className="text-blue-600 dark:text-blue-400 hover:underline">partners@safego.app</a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
