import { Link } from "wouter";
import { ChevronLeft, Newspaper, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function PressPage() {
  useLandingSeo({
    title: "Press - SafeGo",
    description: "SafeGo press and media resources. Contact us for press inquiries.",
    keywords: "safego press, safego media, safego news, press inquiries",
    canonicalUrl: `${BASE_URL}/press`
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Press</h1>
          <p className="text-lg text-gray-600">
            Media resources and press inquiries
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Newspaper className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Press Resources</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-600 mb-2">
                Press kit and media resources coming soon.
              </p>
              <p className="text-gray-500 text-sm">
                We are currently in pilot mode and preparing our official press materials. 
                For urgent media inquiries, please contact us directly.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="prose prose-gray max-w-none mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About SafeGo</h2>
          <p className="text-gray-700 leading-relaxed">
            SafeGo is a multi-service platform providing rides, food delivery, and parcel services. 
            We are currently operating in pilot mode in selected regions, focused on delivering 
            safe, reliable, and accessible services to our communities.
          </p>
        </div>

        <div className="bg-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-900">Media Contact</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            For press and media inquiries, please contact:
          </p>
          <a 
            href="mailto:press@safego.com" 
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            press@safego.com
          </a>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
