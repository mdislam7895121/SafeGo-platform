import { useEffect } from 'react';

interface SeoConfig {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogImage?: string;
  region?: 'global' | 'BD' | 'US';
  breadcrumbs?: { name: string; url: string }[];
}

const REGION_KEYWORDS = {
  global: 'ride-hailing, food delivery, parcel delivery, super app, transportation, on-demand services',
  BD: 'Bangladesh ride-hailing, Dhaka taxi, food delivery Bangladesh, parcel delivery BD, bKash payment, Nagad',
  US: 'US ride-hailing, food delivery USA, parcel delivery America, Stripe payment, rideshare'
};

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';

function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SafeGo',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Global super-app platform for ride-hailing, food delivery, and parcel delivery services.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English', 'Bengali']
    }
  };
}

function getWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SafeGo',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

function getBreadcrumbSchema(breadcrumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`
    }))
  };
}

function getLocalBusinessSchema(region: 'BD' | 'US' | 'global') {
  const businesses = {
    BD: {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'SafeGo Bangladesh',
      description: 'Ride-hailing, food delivery, and parcel services in Bangladesh',
      url: `${BASE_URL}?region=BD`,
      telephone: '+880-1234-567890',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Gulshan-2',
        addressLocality: 'Dhaka',
        addressRegion: 'Dhaka',
        postalCode: '1212',
        addressCountry: 'BD'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 23.7925,
        longitude: 90.4078
      },
      areaServed: 'Bangladesh',
      priceRange: '৳৳'
    },
    US: {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'SafeGo USA',
      description: 'Ride-hailing, food delivery, and parcel services in the United States',
      url: `${BASE_URL}?region=US`,
      telephone: '+1-555-123-4567',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '123 Main Street',
        addressLocality: 'New York',
        addressRegion: 'NY',
        postalCode: '10001',
        addressCountry: 'US'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 40.7128,
        longitude: -74.0060
      },
      areaServed: 'United States',
      priceRange: '$$'
    },
    global: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SafeGo Global',
      description: 'Global super-app platform for ride-hailing, food delivery, and parcel delivery',
      url: BASE_URL,
      areaServed: 'Worldwide'
    }
  };
  return businesses[region];
}

export function useLandingSeo(config: SeoConfig) {
  useEffect(() => {
    const region = config.region || 'global';
    const keywords = `${config.keywords}, ${REGION_KEYWORDS[region]}`;

    document.title = config.title;

    const updateMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    updateMeta('description', config.description);
    updateMeta('keywords', keywords);
    updateMeta('robots', 'index, follow, max-image-preview:large');
    updateMeta('author', 'SafeGo');

    updateMeta('og:title', config.title, true);
    updateMeta('og:description', config.description, true);
    updateMeta('og:type', 'website', true);
    updateMeta('og:url', config.canonicalUrl, true);
    updateMeta('og:image', config.ogImage || `${BASE_URL}/og-image.png`, true);
    updateMeta('og:site_name', 'SafeGo', true);
    updateMeta('og:locale', 'en_US', true);

    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', config.title);
    updateMeta('twitter:description', config.description);
    updateMeta('twitter:image', config.ogImage || `${BASE_URL}/og-image.png`);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = config.canonicalUrl;

    const hreflangLinks = [
      { hreflang: 'en', href: BASE_URL },
      { hreflang: 'en-BD', href: `${BASE_URL}?region=BD` },
      { hreflang: 'en-US', href: `${BASE_URL}?region=US` },
      { hreflang: 'x-default', href: BASE_URL }
    ];

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    hreflangLinks.forEach(({ hreflang, href }) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = href;
      document.head.appendChild(link);
    });

    const schemas = [
      getOrganizationSchema(),
      getWebsiteSchema(),
      getLocalBusinessSchema(region)
    ];

    if (config.breadcrumbs && config.breadcrumbs.length > 0) {
      schemas.push(getBreadcrumbSchema(config.breadcrumbs));
    }

    document.querySelectorAll('script[type="application/ld+json"][data-seo]').forEach(el => el.remove());
    schemas.forEach((schema, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo', `schema-${index}`);
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[type="application/ld+json"][data-seo]').forEach(el => el.remove());
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    };
  }, [config.title, config.description, config.canonicalUrl, config.region, config.keywords, config.ogImage, config.breadcrumbs]);
}

export function LandingSeoHead({ config }: { config: SeoConfig }) {
  useLandingSeo(config);
  return null;
}
