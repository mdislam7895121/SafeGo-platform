import { useQuery } from "@tanstack/react-query";

export interface LandingSectionData {
  id: string;
  key: string;
  orderIndex: number;
  isEnabled: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  ctas?: any;
  media?: any;
  settings?: any;
}

export interface LandingSettingsData {
  defaultRegion?: string;
  showTestingBanner: boolean;
  testingBannerText?: string;
  supportEmail?: string;
  supportPhone?: string;
  socialLinks?: any;
  footerLinks?: any;
  legalLinks?: any;
  servicesConfig?: any;
}

export interface LandingCmsData {
  useFallback: boolean;
  country: string;
  pageId?: string;
  locale?: string;
  settings: LandingSettingsData | null;
  sections: Record<string, LandingSectionData>;
}

async function fetchLandingCms(country: string): Promise<LandingCmsData> {
  try {
    const res = await fetch(`/api/public/landing?country=${country}`, {
      credentials: 'include'
    });
    
    if (!res.ok) {
      return {
        useFallback: true,
        country,
        settings: null,
        sections: {}
      };
    }
    
    return res.json();
  } catch (error) {
    console.warn('[LandingCMS] Failed to fetch, using fallback:', error);
    return {
      useFallback: true,
      country,
      settings: null,
      sections: {}
    };
  }
}

export function useLandingCms(country: string) {
  return useQuery({
    queryKey: ['landing-cms', country],
    queryFn: () => fetchLandingCms(country),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });
}

export function getSectionContent<T>(
  cms: LandingCmsData | undefined,
  sectionKey: string,
  fallback: T
): T & { isFromCms: boolean; isEnabled: boolean } {
  if (!cms || cms.useFallback || !cms.sections[sectionKey]) {
    return { ...fallback, isFromCms: false, isEnabled: true };
  }

  const section = cms.sections[sectionKey];
  return {
    ...fallback,
    ...(section.title && { title: section.title }),
    ...(section.subtitle && { subtitle: section.subtitle }),
    ...(section.body && { body: section.body }),
    ...(section.ctas && { ctas: section.ctas }),
    ...(section.media && { media: section.media }),
    ...(section.settings && { settings: section.settings }),
    isFromCms: true,
    isEnabled: section.isEnabled
  };
}
