import { Link } from "wouter";
import { ChevronLeft, Globe, Users, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function AboutPage() {
  useLandingSeo({
    title: "About SafeGo",
    description: "Learn about SafeGo - a multi-service platform for rides, food delivery, and parcel services.",
    keywords: "about safego, safego company, ride hailing, food delivery, parcel delivery",
    canonicalUrl: `${BASE_URL}/about`
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">About SafeGo</h1>
          <p className="text-lg text-gray-600">
            Building the future of on-demand services
          </p>
        </div>

        <div className="prose prose-gray max-w-none mb-12">
          <p className="text-gray-700 leading-relaxed mb-6">
            SafeGo is a multi-service platform designed to make everyday transportation, food delivery, 
            and parcel services more accessible, reliable, and safe. We are currently operating in 
            pilot mode in selected regions as we refine our services and expand our reach.
          </p>

          <p className="text-gray-700 leading-relaxed mb-6">
            Our mission is to connect communities through technology, providing seamless experiences 
            for customers while creating earning opportunities for drivers, restaurants, and local businesses.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Global Vision</h3>
              </div>
              <p className="text-gray-600 text-sm">
                We aim to serve communities worldwide, starting with focused pilots to ensure quality.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Community First</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Empowering local drivers, restaurants, and shops to grow with our platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Safety Priority</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Every feature we build prioritizes the safety of our users and partners.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Zap className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Innovation</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Continuously improving our technology to deliver better experiences.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-gray-100 rounded-xl p-6 text-center">
          <p className="text-gray-600 mb-4">
            Have questions about SafeGo? We'd love to hear from you.
          </p>
          <Link href="/contact">
            <Button>Contact Us</Button>
          </Link>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
