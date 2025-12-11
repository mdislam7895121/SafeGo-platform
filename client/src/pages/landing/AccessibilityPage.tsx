import { Accessibility, Eye, Ear, Hand, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlobalFooter from "@/components/landing/GlobalFooter";

const LAST_UPDATED = "December 1, 2024";

export default function AccessibilityPage() {
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
                <Accessibility className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Accessibility
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {LAST_UPDATED}
                </p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              SafeGo is committed to making our services accessible to everyone, including people with disabilities.
            </p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h2>Our Commitment</h2>
            <p>
              We believe everyone deserves access to safe, reliable transportation. SafeGo is committed to ensuring our platform and services are accessible to riders and drivers of all abilities.
            </p>

            <h2>App Accessibility Features</h2>
            
            <div className="not-prose grid md:grid-cols-2 gap-4 my-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Visual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                    <li>VoiceOver and TalkBack support</li>
                    <li>High contrast mode</li>
                    <li>Adjustable text sizes</li>
                    <li>Screen reader optimized</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Ear className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Hearing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                    <li>Visual alerts and notifications</li>
                    <li>In-app messaging alternative to calls</li>
                    <li>Captioned help content</li>
                    <li>Deaf or hard of hearing driver setting</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Hand className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Motor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                    <li>Large touch targets</li>
                    <li>Voice command support</li>
                    <li>Simplified booking flow</li>
                    <li>Customizable gestures</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Accessibility className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Mobility
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                    <li>Wheelchair accessible vehicle options</li>
                    <li>Extra assistance requests</li>
                    <li>Service animal accommodation</li>
                    <li>Curb-to-curb assistance</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <h2>Wheelchair Accessible Rides</h2>
            <p>
              In select markets, SafeGo offers wheelchair accessible vehicles (WAV) equipped to accommodate riders who use wheelchairs or mobility devices. When booking, select the "Accessible" option to be matched with an appropriate vehicle.
            </p>

            <h2>Service Animals</h2>
            <p>
              SafeGo welcomes service animals on all trips. Drivers are trained to accommodate service animals, and refusal to transport a service animal is a violation of our policies and may result in deactivation.
            </p>

            <h2>Driver Accessibility</h2>
            <p>
              We support drivers with disabilities who meet the requirements to drive safely:
            </p>
            <ul>
              <li>Vehicle modifications are permitted with proper documentation</li>
              <li>Deaf or hard of hearing drivers can indicate their status in the app</li>
              <li>The app supports various assistive technologies</li>
            </ul>

            <h2>Reporting Accessibility Issues</h2>
            <p>
              If you experience any accessibility barriers while using SafeGo, please let us know. We actively work to improve our services based on user feedback.
            </p>

            <h2>Compliance</h2>
            <p>
              SafeGo is committed to complying with applicable accessibility laws and regulations, including:
            </p>
            <ul>
              <li>Americans with Disabilities Act (ADA) in the United States</li>
              <li>Web Content Accessibility Guidelines (WCAG) 2.1</li>
              <li>Local accessibility requirements in each operating region</li>
            </ul>

            <div className="not-prose mt-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <MessageCircle className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Need Accessibility Support?
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Our accessibility team is available to help with any questions or concerns about using SafeGo with a disability.
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Email: <a href="mailto:accessibility@safego.app" className="text-blue-600 dark:text-blue-400 hover:underline">accessibility@safego.app</a>
                      </p>
                      <Link href="/contact">
                        <Button size="sm" variant="outline">Contact Support</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
