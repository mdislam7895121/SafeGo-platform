import { Link } from "wouter";
import { ChevronLeft, BookOpen, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function BlogPage() {
  useLandingSeo({
    title: "Blog - SafeGo",
    description: "Stay updated with the latest news, updates, and stories from SafeGo.",
    keywords: "safego blog, safego news, safego updates, safego stories",
    canonicalUrl: `${BASE_URL}/blog`
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Blog</h1>
          <p className="text-lg text-gray-600">
            News, updates, and stories from SafeGo
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Coming Soon</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-600 mb-2">
                Our blog is currently being prepared.
              </p>
              <p className="text-gray-500 text-sm">
                We're working on creating valuable content about our services, community stories, 
                and platform updates. Check back soon for our first posts.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-900">Stay Updated</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Want to be notified when we publish new content? Follow our updates through the app 
            or check back here regularly.
          </p>
          <Link href="/contact">
            <Button variant="outline" size="sm">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
