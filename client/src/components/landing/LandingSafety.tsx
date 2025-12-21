import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SAFETY_SECTIONS } from "./LandingConfig";

interface SafetySectionProps {
  cmsTitle?: string;
  cmsSubtitle?: string;
}

export const SafetySection = memo(function SafetySection({ cmsTitle, cmsSubtitle }: SafetySectionProps) {
  const title = cmsTitle || "Safety & Security";
  const subtitle = cmsSubtitle || "Your safety and privacy are our top priority at every step";

  return (
    <section id="safety" className="py-20 lg:py-24 bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/30 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-100 dark:bg-green-900/20 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-30" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Trust & Safety
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {SAFETY_SECTIONS.map((section, idx) => (
            <Card 
              key={idx} 
              className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300" 
              data-testid={`safety-card-${idx}`}
            >
              <CardContent className="p-6">
                <div className={`p-3.5 rounded-2xl ${section.iconBg} w-fit mb-5`}>
                  <section.icon className={`h-6 w-6 ${section.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{section.title}</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-5">{section.subtitle}</p>
                <ul className="space-y-3">
                  {section.points.map((point, pointIdx) => (
                    <li key={pointIdx} className="flex items-start gap-3">
                      <div className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 mt-0.5 flex-shrink-0">
                        <point.icon className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{point.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
});
