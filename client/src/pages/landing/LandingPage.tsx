/**
 * SafeGo Marketing Landing Page
 * Last Updated: December 2024
 * 
 * Uber-level professional design with region-aware content.
 * This is a visual/UX refactor only - no backend changes.
 * 
 * Region-aware features:
 * - HERO_CONFIG: Controls hero description per region
 * - REGION_SERVICES: Controls which services appear (BD: 5, US: 3, GLOBAL: 3)
 * - PARTNER_CONFIG: Controls partner section text per region
 * - HOW_IT_WORKS_SERVICES: Controls which service flows to show per region
 * 
 * All CTAs use existing public routes only. No secrets exposed.
 */

import { useState, useEffect } from "react";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import { SafeGoHeader } from "@/components/layout/SafeGoHeader";
import GlobalFooter from "@/components/landing/GlobalFooter";
import { ReadyToMoveSection } from "@/components/landing/ReadyToMoveSection";
import { HeroSection } from "@/components/landing/LandingHero";
import { ServicesSection } from "@/components/landing/LandingServices";
import { PartnerSection } from "@/components/landing/LandingPartners";
import { HowItWorksSection } from "@/components/landing/LandingHowItWorks";
import { SafetySection } from "@/components/landing/LandingSafety";
import { FAQSection } from "@/components/landing/LandingFAQ";
import { Region, HERO_CONFIG } from "@/components/landing/LandingConfig";
import { useLandingCms } from "@/hooks/useLandingCms";

export default function LandingPage() {
  const [selectedRegion, setSelectedRegion] = useState<Region>("BD");

  useEffect(() => {
    const stored = localStorage.getItem("safego-region");
    if (stored && ["BD", "US", "GLOBAL"].includes(stored)) {
      setSelectedRegion(stored as Region);
    }
  }, []);

  const handleRegionChange = (region: Region) => {
    setSelectedRegion(region);
    localStorage.setItem("safego-region", region);
  };

  const { data: cmsData } = useLandingCms(selectedRegion);

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';

  useLandingSeo({
    title: `SafeGo - Ride, Deliver, Connect | ${selectedRegion === 'BD' ? 'Bangladesh' : selectedRegion === 'US' ? 'USA' : 'Global'}`,
    description: HERO_CONFIG[selectedRegion].description,
    keywords: 'ride-hailing, food delivery, parcel delivery, super app, SafeGo',
    canonicalUrl: `${BASE_URL}/`,
    region: selectedRegion === 'GLOBAL' ? 'global' : selectedRegion,
    breadcrumbs: [{ name: 'Home', url: '/' }]
  });

  const showTestingBanner = cmsData?.settings?.showTestingBanner ?? false;
  const testingBannerText = cmsData?.settings?.testingBannerText || 'Testing Environment - Not for production use';

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid="landing-page">
      {showTestingBanner && (
        <div className="bg-yellow-500 text-black text-center py-2 text-sm font-medium">
          {testingBannerText}
        </div>
      )}
      <SafeGoHeader selectedRegion={selectedRegion} onRegionChange={handleRegionChange} />
      <main className="flex-1">
        <HeroSection 
          selectedRegion={selectedRegion} 
          onRegionChange={handleRegionChange} 
        />
        <ServicesSection selectedRegion={selectedRegion} />
        <PartnerSection selectedRegion={selectedRegion} />
        <HowItWorksSection selectedRegion={selectedRegion} />
        <SafetySection />
        <FAQSection selectedRegion={selectedRegion} />
        <ReadyToMoveSection selectedRegion={selectedRegion} />
      </main>
      <GlobalFooter 
        selectedRegion={selectedRegion === "GLOBAL" ? "BD" : selectedRegion}
        onRegionChange={(region) => handleRegionChange(region)}
      />
    </div>
  );
}
