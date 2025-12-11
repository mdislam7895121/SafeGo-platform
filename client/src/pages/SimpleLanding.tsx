import { Link } from "wouter";
import { Car, UtensilsCrossed, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SimpleLanding() {
  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SG</span>
            </div>
            <span className="text-xl font-bold">SafeGo</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost" data-testid="button-signin">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button data-testid="button-signup">Create account</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-hero-title">
            Go anywhere. Get anything.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-hero-subtitle">
            One platform for rides, food delivery, and parcel services. 
            Available in Bangladesh and United States.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="hover-elevate cursor-pointer" data-testid="card-service-ride">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ride</h3>
              <p className="text-sm text-muted-foreground">
                Request a ride and get picked up in minutes
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" data-testid="card-service-food">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <UtensilsCrossed className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Food</h3>
              <p className="text-sm text-muted-foreground">
                Order from your favorite restaurants
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" data-testid="card-service-parcel">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Parcel</h3>
              <p className="text-sm text-muted-foreground">
                Send packages across the city
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <Link href="/signup">
            <Button size="lg" className="px-8" data-testid="button-get-started">
              Get Started
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 SafeGo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
