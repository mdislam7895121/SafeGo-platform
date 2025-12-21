import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Region, HOW_IT_WORKS_DATA, HOW_IT_WORKS_SERVICES } from "./LandingConfig";

interface HowItWorksSectionProps {
  selectedRegion: Region;
  cmsTitle?: string;
  cmsSubtitle?: string;
}

export const HowItWorksSection = memo(function HowItWorksSection({ selectedRegion, cmsTitle, cmsSubtitle }: HowItWorksSectionProps) {
  const availableServices = HOW_IT_WORKS_SERVICES[selectedRegion];
  const flows = availableServices
    .map(id => HOW_IT_WORKS_DATA[id as keyof typeof HOW_IT_WORKS_DATA])
    .filter(Boolean);

  const title = cmsTitle || "Simple steps to get started";
  const subtitle = cmsSubtitle || "Getting a ride, ordering food, or sending a parcel takes just minutes";
  
  return (
    <section id="how-it-works" className="py-20 lg:py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {flows.map((flow) => (
            <Card 
              key={flow.id} 
              className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl hover:shadow-lg transition-shadow duration-300" 
              data-testid={`how-it-works-${flow.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-xl ${flow.iconBg}`}>
                    <flow.icon className={`h-5 w-5 ${flow.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{flow.title}</h3>
                </div>
                <ol className="space-y-4">
                  {flow.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shadow-sm">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 pt-0.5 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
});
