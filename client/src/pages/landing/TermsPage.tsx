import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";

function LegalHeader() {
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

export default function TermsPage() {
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';
  
  useLandingSeo({
    title: 'Terms of Service | SafeGo',
    description: 'Read the SafeGo Terms of Service. Understand the rules and guidelines for using our ride-hailing, food delivery, and parcel delivery platform.',
    keywords: 'terms of service, user agreement, SafeGo terms, legal terms',
    canonicalUrl: `${BASE_URL}/terms`,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Terms of Service', url: '/terms' }]
  });

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="terms-page">
      <LegalHeader />
      <main className="flex-1 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
              Testing Version - These terms will be updated before public launch.
            </p>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Terms of Service
          </h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Terms of Service – SafeGo
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Agreement</h2>
              <p className="text-gray-600 dark:text-gray-400">
                By using SafeGo, you agree to these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Eligibility</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Must be 18 or older.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. Your Account</h2>
              <p className="text-gray-600 dark:text-gray-400">
                You are responsible for your login credentials.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Platform Role</h2>
              <p className="text-gray-600 dark:text-gray-400">
                SafeGo connects users with independent drivers, couriers, and restaurant partners.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. Payments</h2>
              <p className="text-gray-600 dark:text-gray-400">
                You authorize SafeGo to process payments for trips, deliveries, fees, and adjustments.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. Cancellation</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Cancellation or no-show fees may apply.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">7. Prohibited actions</h2>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
                <li>Illegal use</li>
                <li>Fraudulent activity</li>
                <li>Threats or harassment</li>
                <li>System tampering or hacking</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">8. Liability</h2>
              <p className="text-gray-600 dark:text-gray-400">
                SafeGo is not responsible for indirect damages. Maximum liability is the cost of your trip/order.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">9. Governing Law</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Bangladesh law applies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">10. Contact</h2>
              <p className="text-gray-600 dark:text-gray-400">
                <a href="mailto:support@safegoglobal.com" className="text-blue-600 hover:underline">support@safegoglobal.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
