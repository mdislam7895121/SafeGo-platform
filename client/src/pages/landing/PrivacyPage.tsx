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

export default function PrivacyPage() {
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';
  
  useLandingSeo({
    title: 'Privacy Policy | SafeGo',
    description: 'Learn how SafeGo collects, uses, and protects your personal information. Our privacy policy covers data handling for ride-hailing, food delivery, and parcel services.',
    keywords: 'privacy policy, data protection, personal information, SafeGo privacy',
    canonicalUrl: `${BASE_URL}/privacy`,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Privacy Policy', url: '/privacy' }]
  });

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="privacy-page">
      <LegalHeader />
      <main className="flex-1 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
              Testing Version - This policy will be updated before public launch.
            </p>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Privacy Policy
          </h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Privacy Policy – SafeGo
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
              <p className="text-gray-600 dark:text-gray-400">
                SafeGo ("we", "us", "our") provides ride, food delivery, and parcel services. This Privacy Policy explains how we collect, use, and protect your information when you visit safegoglobal.com or use our apps and services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Information we collect</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">We may collect:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
                <li>Account information (name, phone number, email, password)</li>
                <li>Trip and delivery information (pickup/drop-off, route, time, distance)</li>
                <li>Payment-related information (masked card details)</li>
                <li>Device information (IP, browser, OS, crash logs)</li>
                <li>Support messages and communication logs</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. How we use your information</h2>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
                <li>Create and manage accounts</li>
                <li>Provide rides and deliveries</li>
                <li>Calculate pricing and payouts</li>
                <li>Detect and prevent fraud</li>
                <li>Improve app performance</li>
                <li>Communicate trip/order updates</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Sharing</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">We share information only with:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
                <li>Drivers, couriers, restaurants, and shop partners</li>
                <li>Payment processors</li>
                <li>Cloud hosting and analytics providers</li>
                <li>Law enforcement when required</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">
                We do not sell your personal data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. Security</h2>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
                <li>HTTPS encryption</li>
                <li>Access control</li>
                <li>Activity logs and monitoring</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 mt-4">
                No system is perfect, but we work to reduce risk.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. Data retention</h2>
              <p className="text-gray-600 dark:text-gray-400">
                We keep data only as long as legally required or for service operations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">7. Your rights</h2>
              <p className="text-gray-600 dark:text-gray-400">
                You may request access, correction, or deletion where permitted by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">8. Contact</h2>
              <p className="text-gray-600 dark:text-gray-400">
                <a href="mailto:support@safegoglobal.com" className="text-blue-600 hover:underline">support@safegoglobal.com</a>
              </p>
              <p className="text-gray-500 dark:text-gray-500 mt-4 text-sm">
                Last updated: 2025
              </p>
            </section>
          </div>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
