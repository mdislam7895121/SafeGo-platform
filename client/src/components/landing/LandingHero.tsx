import { memo } from "react";
import { Link } from "wouter";
import { ChevronRight, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Region, REGION_SERVICES, HERO_CONFIG } from "./LandingConfig";

const RegionToggle = memo(function RegionToggle({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region; 
  onRegionChange: (region: Region) => void;
}) {
  const regions: { id: Region; label: string }[] = [
    { id: "BD", label: "Bangladesh" },
    { id: "US", label: "United States" },
    { id: "GLOBAL", label: "Global" },
  ];

  return (
    <div 
      className="inline-flex items-center p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full shadow-sm"
      role="tablist"
      aria-label="Select region"
    >
      {regions.map((region) => (
        <button
          key={region.id}
          role="tab"
          aria-selected={selectedRegion === region.id}
          aria-controls={`region-content-${region.id}`}
          onClick={() => onRegionChange(region.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            selectedRegion === region.id
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          data-testid={`region-tab-${region.id.toLowerCase()}`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
});

export const HeroSection = memo(function HeroSection({ 
  selectedRegion, 
  onRegionChange 
}: { 
  selectedRegion: Region;
  onRegionChange: (region: Region) => void;
}) {
  const services = REGION_SERVICES[selectedRegion];
  const heroConfig = HERO_CONFIG[selectedRegion];
  
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30 py-16 lg:py-24">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl opacity-50" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-8">
              <RegionToggle selectedRegion={selectedRegion} onRegionChange={onRegionChange} />
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-[1.1] tracking-tight">
              Move, eat, and<br />
              deliver with <span className="text-blue-600">SafeGo</span>
            </h1>
            
            <p 
              className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-lg mx-auto lg:mx-0 leading-relaxed transition-opacity duration-300"
              id={`region-content-${selectedRegion}`}
            >
              {heroConfig.description}
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#services">
                <Button size="lg" className="w-full sm:w-auto rounded-full px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200" data-testid="button-explore-services">
                  Explore services
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#partners">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200" data-testid="button-become-partner">
                  Become a partner
                </Button>
              </a>
            </div>
          </div>
          
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
              <Card className="relative bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-600 shadow-sm">
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SafeGo Services</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">All-in-one platform</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  {services.map((service, index) => (
                    <Link 
                      key={service.id}
                      href={service.link}
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group ${
                        index !== services.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                      }`}
                      data-testid={`hero-service-${service.id}`}
                    >
                      <div className={`p-3 rounded-xl ${service.bgColor} group-hover:scale-105 transition-transform duration-200`}>
                        <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{service.title}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{service.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        <div className="lg:hidden mt-12">
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SafeGo Services</h3>
            </div>
            <CardContent className="p-0">
              {services.map((service, index) => (
                <Link 
                  key={service.id}
                  href={service.link}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    index !== services.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                  }`}
                  data-testid={`hero-service-mobile-${service.id}`}
                >
                  <div className={`p-2.5 rounded-xl ${service.bgColor}`}>
                    <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{service.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{service.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
});
