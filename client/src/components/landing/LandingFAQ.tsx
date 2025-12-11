import { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Region, FAQ_CONFIG, REGION_TO_FAQ_KEY } from "./LandingConfig";

export const FAQSection = memo(function FAQSection({ selectedRegion }: { selectedRegion: Region }) {
  const regionKey = REGION_TO_FAQ_KEY[selectedRegion];
  const faqs = FAQ_CONFIG[regionKey];

  return (
    <section id="faq" className="py-20 lg:py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-full mb-4 uppercase tracking-wide">
            Support
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Got questions? We've got answers.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq) => (
              <AccordionItem 
                key={faq.id} 
                value={faq.id} 
                className="border border-gray-200 dark:border-gray-800 rounded-xl px-6 data-[state=open]:bg-gray-50 dark:data-[state=open]:bg-gray-900 data-[state=open]:border-blue-200 dark:data-[state=open]:border-blue-800 transition-colors duration-200"
                data-testid={`faq-item-${faq.id}`}
              >
                <AccordionTrigger className="text-left text-gray-900 dark:text-white hover:no-underline py-5 text-base font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-400 pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
});
