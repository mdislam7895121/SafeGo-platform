import { memo } from "react";
import { Link } from "wouter";
import { Car, Store, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Region, PARTNER_CONFIG } from "./LandingConfig";

export const PartnerSection = memo(function PartnerSection({ selectedRegion }: { selectedRegion: Region }) {
  const config = PARTNER_CONFIG[selectedRegion];
  
  return (
    <section id="partners" className="py-20 lg:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Join Us
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Become a Partner
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Turn your time or business into earnings with SafeGo
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl transition-all duration-300" data-testid="partner-card-drivers">
            <CardContent className="p-8">
              <div className="p-3.5 rounded-2xl bg-blue-100 dark:bg-blue-900/30 w-fit mb-6">
                <Car className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{config.driverCard.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {config.driverCard.description}
              </p>
              
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">What you get</h4>
                <ul className="space-y-3">
                  {config.driverCard.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Basic requirements</h4>
                <ul className="space-y-2">
                  {config.driverCard.requirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Link href="/driver/signup">
                <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all duration-200" data-testid="button-driver-signup">
                  Start driving
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-xl transition-all duration-300" data-testid="partner-card-restaurants">
            <CardContent className="p-8">
              <div className="p-3.5 rounded-2xl bg-orange-100 dark:bg-orange-900/30 w-fit mb-6">
                <Store className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{config.businessCard.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {config.businessCard.description}
              </p>
              
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">What you get</h4>
                <ul className="space-y-3">
                  {config.businessCard.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 p-0.5 rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Basic requirements</h4>
                <ul className="space-y-2">
                  {config.businessCard.requirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Link href="/restaurant/signup">
                <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all duration-200" data-testid="button-restaurant-signup">
                  Register your business
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
});
