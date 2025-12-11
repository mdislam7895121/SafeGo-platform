import { memo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Region, REGION_SERVICES } from "./LandingConfig";

export const ServicesSection = memo(function ServicesSection({ selectedRegion }: { selectedRegion: Region }) {
  const services = REGION_SERVICES[selectedRegion];
  
  return (
    <section id="services" className="py-20 lg:py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Our Services
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Everything in one app
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose a service to get started with SafeGo
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {services.map((service) => (
            <Link key={service.id} href={service.link}>
              <Card 
                className="h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group rounded-2xl" 
                data-testid={`service-card-${service.id}`}
              >
                <CardContent className="p-8 text-center">
                  <div className={`inline-flex p-5 rounded-2xl ${service.bgColor} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <service.icon className={`h-8 w-8 ${service.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{service.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
});
