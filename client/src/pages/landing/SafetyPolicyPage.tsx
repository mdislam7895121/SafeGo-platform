import { Shield, Users, AlertTriangle, CheckCircle, Phone, Eye, Lock, FileCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlobalFooter from "@/components/landing/GlobalFooter";

const LAST_UPDATED = "December 1, 2024";

export default function SafetyPolicyPage() {
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
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Safety Policy
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {LAST_UPDATED}
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Card className="mb-8 not-prose">
              <CardContent className="p-6">
                <p className="text-gray-700 dark:text-gray-300">
                  At SafeGo, safety is our top priority. This policy outlines our commitment to creating a secure environment for all users, partners, and communities we serve.
                </p>
              </CardContent>
            </Card>

            <h2>1. Partner Verification</h2>
            <p>
              All SafeGo partners undergo comprehensive verification before being activated on our platform:
            </p>
            <ul>
              <li><strong>Identity Verification:</strong> Government-issued ID verification with facial recognition</li>
              <li><strong>Background Checks:</strong> Criminal history screening and driving record review</li>
              <li><strong>Vehicle Inspection:</strong> Safety and documentation verification for all vehicles</li>
              <li><strong>Ongoing Monitoring:</strong> Continuous review of ratings, feedback, and compliance</li>
            </ul>

            <h2>2. In-Trip Safety Features</h2>
            <p>
              SafeGo provides multiple layers of protection during every trip:
            </p>
            <ul>
              <li><strong>Real-Time GPS Tracking:</strong> All trips are tracked and recorded</li>
              <li><strong>Share Trip Status:</strong> Share live trip details with trusted contacts</li>
              <li><strong>Emergency SOS:</strong> One-tap connection to emergency services</li>
              <li><strong>Audio Recording:</strong> Optional trip audio recording for safety documentation</li>
              <li><strong>Route Monitoring:</strong> Alerts for unexpected route deviations</li>
            </ul>

            <h2>3. Community Guidelines</h2>
            <p>
              All SafeGo users are expected to:
            </p>
            <ul>
              <li>Treat others with respect and courtesy</li>
              <li>Follow all applicable laws and regulations</li>
              <li>Report any safety concerns immediately</li>
              <li>Not engage in any form of harassment or discrimination</li>
              <li>Maintain appropriate conduct during all service interactions</li>
            </ul>

            <h2>4. Zero Tolerance Policy</h2>
            <p>
              SafeGo maintains a zero tolerance policy for:
            </p>
            <ul>
              <li>Physical or verbal harassment</li>
              <li>Sexual misconduct</li>
              <li>Discrimination based on race, gender, religion, or any protected characteristic</li>
              <li>Threatening behavior or violence</li>
              <li>Impaired driving (alcohol or drugs)</li>
              <li>Fraud or deceptive practices</li>
            </ul>

            <h2>5. Incident Response</h2>
            <p>
              When safety incidents are reported:
            </p>
            <ul>
              <li>All reports are investigated within 24 hours</li>
              <li>Affected parties are contacted promptly</li>
              <li>Temporary holds may be placed on accounts pending investigation</li>
              <li>Law enforcement is notified when appropriate</li>
              <li>Victims are provided with support resources</li>
            </ul>

            <h2>6. Insurance Coverage</h2>
            <p>
              SafeGo provides comprehensive insurance for all active trips:
            </p>
            <ul>
              <li>Liability coverage for third-party injuries and property damage</li>
              <li>Personal accident coverage for passengers</li>
              <li>Coverage begins when a trip is accepted and ends at destination</li>
            </ul>

            <h2>7. Data Protection</h2>
            <p>
              Safety-related data is handled with care:
            </p>
            <ul>
              <li>Trip data is encrypted and stored securely</li>
              <li>Location data is only shared as needed for safety features</li>
              <li>Safety reports are handled confidentially</li>
              <li>Data retention follows our <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link></li>
            </ul>

            <h2>8. Reporting Safety Concerns</h2>
            <p>
              If you experience or witness any safety issue:
            </p>
            <ul>
              <li><strong>In an emergency:</strong> Use the in-app SOS button or call local emergency services</li>
              <li><strong>After a trip:</strong> Report through the app's trip history</li>
              <li><strong>General concerns:</strong> Contact our 24/7 safety team</li>
            </ul>

            <div className="not-prose mt-8">
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                        24/7 Safety Support
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-400 mb-4">
                        Our safety team is available around the clock to assist with any concerns.
                      </p>
                      <Link href="/contact">
                        <Button size="sm">Contact Safety Team</Button>
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
