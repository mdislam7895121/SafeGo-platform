import { Users, Heart, Shield, AlertTriangle, Ban, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GlobalFooter from "@/components/landing/GlobalFooter";

const LAST_UPDATED = "December 1, 2024";

const CORE_VALUES = [
  {
    icon: Heart,
    title: "Respect",
    description: "Treat everyone with dignity and courtesy, regardless of background or differences."
  },
  {
    icon: Shield,
    title: "Safety",
    description: "Prioritize the safety and well-being of yourself and others in all interactions."
  },
  {
    icon: Users,
    title: "Community",
    description: "We're all part of the SafeGo community. Help make it welcoming for everyone."
  }
];

export default function CommunityGuidelinesPage() {
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
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Community Guidelines
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {LAST_UPDATED}
                </p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              These guidelines help ensure a safe, respectful experience for everyone in the SafeGo community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {CORE_VALUES.map((value) => (
              <Card key={value.title}>
                <CardContent className="p-5 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-3">
                    <value.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{value.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h2>For All Users</h2>
            
            <h3>Be Respectful</h3>
            <ul>
              <li>Use polite, professional language in all communications</li>
              <li>Respect others' personal space and property</li>
              <li>Be patient and understanding - everyone has different circumstances</li>
              <li>Avoid making assumptions based on appearance or background</li>
            </ul>

            <h3>Be Safe</h3>
            <ul>
              <li>Follow all safety guidelines and local laws</li>
              <li>Wear seatbelts during rides</li>
              <li>Report any safety concerns immediately</li>
              <li>Never share personal contact information outside the app</li>
            </ul>

            <h3>Be Honest</h3>
            <ul>
              <li>Provide accurate information in your profile</li>
              <li>Report issues truthfully and fairly</li>
              <li>Don't abuse the ratings or reporting systems</li>
            </ul>

            <h2>For Riders</h2>
            <ul>
              <li>Be ready at pickup location when your ride arrives</li>
              <li>Communicate clearly about your destination</li>
              <li>Respect the driver's vehicle - no eating or smoking without permission</li>
              <li>Exit safely and don't forget your belongings</li>
            </ul>

            <h2>For Drivers</h2>
            <ul>
              <li>Maintain a clean, safe vehicle</li>
              <li>Follow the app's navigation unless the rider requests otherwise</li>
              <li>Assist riders as needed, especially those with accessibility needs</li>
              <li>Keep personal conversations appropriate and professional</li>
            </ul>

            <h2>Prohibited Conduct</h2>
            <p>The following behaviors will result in account suspension or permanent ban:</p>
            
            <div className="not-prose my-6">
              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Ban className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <h3 className="font-semibold text-red-900 dark:text-red-300">Zero Tolerance</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-red-800 dark:text-red-300">
                    <li>Physical violence or threats of violence</li>
                    <li>Sexual harassment or misconduct</li>
                    <li>Discrimination or hate speech</li>
                    <li>Impaired driving (alcohol or drugs)</li>
                    <li>Fraud, theft, or deceptive practices</li>
                    <li>Carrying weapons in vehicles</li>
                    <li>Illegal activities of any kind</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <h2>Reporting Violations</h2>
            <p>
              If you experience or witness any violation of these guidelines:
            </p>
            <ul>
              <li>Use the in-app reporting feature after your trip</li>
              <li>For urgent safety issues, use the SOS button</li>
              <li>Contact our support team for assistance</li>
            </ul>
            <p>
              All reports are taken seriously and investigated promptly. We may take action ranging from warnings to permanent account deactivation.
            </p>

            <h2>Consequences</h2>
            <p>
              Violations of community guidelines may result in:
            </p>
            <ul>
              <li><strong>Warning:</strong> For minor, first-time violations</li>
              <li><strong>Temporary Suspension:</strong> For repeated or more serious violations</li>
              <li><strong>Permanent Ban:</strong> For severe violations or repeated offenses</li>
              <li><strong>Legal Action:</strong> For criminal activity or significant harm</li>
            </ul>

            <div className="not-prose mt-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <MessageCircle className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Questions About Our Guidelines?
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        If you have questions about what's allowed or need clarification, our support team is here to help.
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
