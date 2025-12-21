import { Link } from "wouter";
import { ChevronLeft, Briefcase, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function CareersPage() {
  useLandingSeo({
    title: "Careers at SafeGo",
    description: "Join the SafeGo team and help build the future of on-demand services.",
    keywords: "safego careers, jobs at safego, safego hiring, work at safego",
    canonicalUrl: `${BASE_URL}/careers`
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Careers</h1>
          <p className="text-lg text-gray-600">
            Join our team and help shape the future of mobility
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Current Openings</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-600 mb-2">
                We are not actively hiring at the moment.
              </p>
              <p className="text-gray-500 text-sm">
                As we are in pilot mode, our team is focused on building and refining our core services. 
                Please check back later for updates on open positions.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="prose prose-gray max-w-none mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Stay Connected</h2>
          <p className="text-gray-700 leading-relaxed">
            Interested in future opportunities at SafeGo? We're always looking for passionate 
            individuals who want to make a difference in how people move, eat, and connect.
          </p>
        </div>

        <div className="bg-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-900">Get in Touch</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            For career inquiries, please contact us at:
          </p>
          <a 
            href="mailto:careers@safego.com" 
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            careers@safego.com
          </a>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
