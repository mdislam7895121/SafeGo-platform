import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";

interface CmsPageData {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  status: string;
  visibility: string;
  metaDescription?: string;
  metaKeywords?: string;
  updatedAt: string;
}

interface CmsLegalPageProps {
  slug: string;
  fallbackTitle: string;
  fallbackContent: React.ReactNode;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

function LegalHeader() {
  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">SafeGo</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

async function fetchCmsPage(slug: string): Promise<CmsPageData | null> {
  try {
    const res = await fetch(`/api/cms/public/${slug}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch page');
    }
    return res.json();
  } catch (error) {
    console.error(`[CMS] Error fetching ${slug}:`, error);
    return null;
  }
}

export default function CmsLegalPage({
  slug,
  fallbackTitle,
  fallbackContent,
  seoTitle,
  seoDescription,
  seoKeywords
}: CmsLegalPageProps) {
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://safego.replit.app';

  const { data: cmsPage, isLoading, error } = useQuery({
    queryKey: ['cms-page', slug],
    queryFn: () => fetchCmsPage(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  useLandingSeo({
    title: cmsPage?.title ? `${cmsPage.title} | SafeGo` : seoTitle,
    description: cmsPage?.metaDescription || seoDescription,
    keywords: cmsPage?.metaKeywords || seoKeywords,
    canonicalUrl: `${BASE_URL}/${slug}`,
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: cmsPage?.title || fallbackTitle, url: `/${slug}` }
    ]
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (cmsPage && cmsPage.body) {
      return (
        <>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
            {cmsPage.title}
          </h1>
          <div 
            className="prose prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: cmsPage.body }}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-8 pt-4 border-t border-gray-200 dark:border-gray-800">
            Last updated: {new Date(cmsPage.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </>
      );
    }

    return (
      <>
        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
            Testing Version - This content will be updated before public launch.
          </p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
          {fallbackTitle}
        </h1>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          {fallbackContent}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950" data-testid={`${slug}-page`}>
      <LegalHeader />
      <main className="flex-1 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {renderContent()}
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
