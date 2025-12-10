import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandingSeo } from "@/components/landing/LandingSeo";

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

function LegalFooter() {
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

export default function CookiesPage() {
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';
  
  useLandingSeo({
    title: 'Cookie Policy | SafeGo',
    description: 'Learn about how SafeGo uses cookies to improve your experience. Understand cookie types and how to manage your preferences.',
    keywords: 'cookie policy, cookies, tracking, SafeGo cookies, privacy',
    canonicalUrl: `${BASE_URL}/cookies`,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Cookie Policy', url: '/cookies' }]
  });

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="cookies-page">
      <LegalHeader />
      <main className="flex-1 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
              Testing Version - This policy will be updated before public launch.
            </p>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Cookie Policy
          </h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Cookie Policy – SafeGo
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">What we use cookies for</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">We use cookies to:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
                <li>Keep you logged in</li>
                <li>Remember preferences</li>
                <li>Measure performance and analytics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Types of cookies</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">1. Essential cookies (required)</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">2. Functional cookies</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third party providers whose services we have added to our pages.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">3. Analytics cookies</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular and see how visitors move around the site.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Managing cookies</h2>
              <p className="text-gray-600 dark:text-gray-400">
                You may control cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of our website.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contact</h2>
              <p className="text-gray-600 dark:text-gray-400">
                If you have any questions about our use of cookies, please contact us at{" "}
                <a href="mailto:support@safegoglobal.com" className="text-blue-600 hover:underline">support@safegoglobal.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
