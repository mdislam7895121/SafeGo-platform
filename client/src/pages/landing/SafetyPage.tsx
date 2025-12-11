import { Shield, Users, Phone, Lock, Eye, FileCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlobalFooter from "@/components/landing/GlobalFooter";

const SAFETY_FEATURES = [
  {
    icon: Shield,
    title: "Verified Partners",
    description: "All drivers and delivery partners undergo thorough background checks, identity verification, and KYC processes before being allowed on the platform."
  },
  {
    icon: Lock,
    title: "Secure Payments",
    description: "End-to-end encrypted payment processing with PCI-DSS compliance. Your financial information is never stored on our servers."
  },
  {
    icon: Eye,
    title: "Real-Time Tracking",
    description: "Track your ride or delivery in real-time. Share your trip status with trusted contacts for added peace of mind."
  },
  {
    icon: Phone,
    title: "24/7 Emergency Support",
    description: "One-tap SOS button connects you directly to emergency services and our safety response team."
  },
  {
    icon: Users,
    title: "Community Guidelines",
    description: "Clear community standards that all users must follow. Zero tolerance for harassment, discrimination, or unsafe behavior."
  },
  {
    icon: FileCheck,
    title: "Insurance Coverage",
    description: "Comprehensive insurance coverage for all rides and deliveries, protecting both customers and partners."
  }
];

const SAFETY_TIPS = [
  "Always verify the vehicle details and driver photo before getting in",
  "Share your trip details with a trusted contact",
  "Use the in-app chat and calls instead of personal phone numbers",
  "Check the estimated fare before confirming your ride",
  "Report any suspicious activity immediately through the app",
  "Keep your valuables secure and visible during rides"
];

export default function SafetyPage() {
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
        <section className="py-16 lg:py-24 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
              Your Safety is Our Priority
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              SafeGo is built with multiple layers of protection to ensure every ride and delivery is safe for everyone.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Safety Features
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SAFETY_FEATURES.map((feature) => (
                <Card key={feature.title} className="border-gray-200 dark:border-gray-800">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Safety Tips for Riders
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <ul className="space-y-4">
                {SAFETY_TIPS.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                      Emergency? Use the SOS Button
                    </h3>
                    <p className="text-red-800 dark:text-red-400 text-sm mb-4">
                      If you ever feel unsafe during a ride or delivery, use the SOS button in the app. 
                      This will immediately alert emergency services and our safety team with your real-time location.
                    </p>
                    <Link href="/contact">
                      <Button variant="outline" className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30">
                        Contact Safety Team
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
