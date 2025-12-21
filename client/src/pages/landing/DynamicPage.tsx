import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ChevronLeft, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLandingSeo } from "@/components/landing/LandingSeo";
import GlobalFooter from "@/components/landing/GlobalFooter";
import DOMPurify from "dompurify";

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

interface CmsPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  status: string;
  visibility: string;
  metaDescription: string | null;
  metaKeywords: string | null;
  updatedAt: string;
}

export default function DynamicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || '';
  
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notPublished, setNotPublished] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      if (!slug) {
        setError('Page not found');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/cms/public/${slug}`);
        
        if (response.status === 404) {
          const data = await response.json();
          if (data.message?.includes('not yet published')) {
            setNotPublished(true);
          } else {
            setError('Page not found');
          }
          setLoading(false);
          return;
        }

        if (!response.ok) {
          setError('Failed to load page');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setPage(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Failed to load page');
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  useLandingSeo({
    title: page?.title ? `${page.title} | SafeGo` : 'SafeGo',
    description: page?.metaDescription || 'SafeGo - Your trusted multi-service platform',
    keywords: page?.metaKeywords || 'safego, rides, food delivery, parcel',
    canonicalUrl: `${BASE_URL}/p/${slug}`
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notPublished) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="ghost" className="mb-6 -ml-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Button>
          </Link>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Coming Soon</h1>
              </div>
              <p className="text-gray-600">
                This page is currently being prepared and will be available soon. 
                Please check back later or contact us if you need immediate assistance.
              </p>
              <div className="mt-6">
                <Link href="/contact">
                  <Button variant="outline">Contact Us</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        <GlobalFooter />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="ghost" className="mb-6 -ml-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Button>
          </Link>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
              </div>
              <p className="text-gray-600">
                The page you're looking for doesn't exist or has been moved.
              </p>
              <div className="mt-6">
                <Link href="/">
                  <Button>Go to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        <GlobalFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Button>
        </Link>

        <article>
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {page.title}
            </h1>
            {page.updatedAt && (
              <p className="text-sm text-gray-500">
                Last updated: {new Date(page.updatedAt).toLocaleDateString()}
              </p>
            )}
          </header>

          <div 
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: formatContent(page.body) }}
          />
        </article>
      </div>
      <GlobalFooter />
    </div>
  );
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

function processMarkdownLine(rawLine: string): string {
  let line = escapeHtml(rawLine);
  line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return line;
}

function formatContent(content: string): string {
  if (!content) return '';
  
  let lines = content.split('\n');
  let result: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let rawLine = lines[i].trim();
    
    if (!rawLine) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      continue;
    }
    
    if (rawLine.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      const text = processMarkdownLine(rawLine.slice(3));
      result.push(`<h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900">${text}</h2>`);
    } else if (rawLine.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      const text = processMarkdownLine(rawLine.slice(4));
      result.push(`<h3 class="text-xl font-semibold mt-6 mb-3 text-gray-800">${text}</h3>`);
    } else if (rawLine.startsWith('- ')) {
      if (!inList) {
        result.push('<ul class="list-disc pl-6 space-y-1 text-gray-700">');
        inList = true;
      }
      const text = processMarkdownLine(rawLine.slice(2));
      result.push(`<li>${text}</li>`);
    } else if (/^\d+\.\s/.test(rawLine)) {
      const text = processMarkdownLine(rawLine.replace(/^\d+\.\s/, ''));
      if (!inList) {
        result.push('<ol class="list-decimal pl-6 space-y-1 text-gray-700">');
        inList = true;
      }
      result.push(`<li>${text}</li>`);
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      const text = processMarkdownLine(rawLine);
      result.push(`<p class="text-gray-700 mb-4">${text}</p>`);
    }
  }
  
  if (inList) result.push('</ul>');
  
  const html = result.join('\n');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  });
}
