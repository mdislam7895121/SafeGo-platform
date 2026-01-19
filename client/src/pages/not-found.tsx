import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 pb-6">
          <div className="flex mb-4 gap-3 items-center">
            <AlertCircle className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            We couldn't find the page you're looking for. The link may be broken or the page may have been removed.
          </p>

          <div className="mt-6 flex gap-3">
            <Button
              onClick={() => setLocation("/")}
              className="flex-1"
              variant="default"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="flex-1"
            >
              Go Back
            </Button>
          </div>

          <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-500">
            Error 404
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
